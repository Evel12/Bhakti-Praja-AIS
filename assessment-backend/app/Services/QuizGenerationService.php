<?php

namespace App\Services;

use App\Enums\QuestionType;
use App\Enums\QuizGenerationStatus;
use App\Enums\QuizStatus;
use App\Exceptions\QuizGenerationException;
use App\Jobs\GenerateQuiz;
use App\Models\Module;
use App\Models\QuizGeneration;
use App\Models\SchoolClass;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

class QuizGenerationService
{
    public function request(User $actor, Module $module, int $questionCount = 5): QuizGeneration
    {
        if ($questionCount < 1 || $questionCount > 50) {
            throw ValidationException::withMessages(['question_count' => ['Choose between 1 and 50 questions.']]);
        }

        return DB::transaction(function () use ($actor, $module, $questionCount): QuizGeneration {
            $schoolClass = SchoolClass::query()->lockForUpdate()->findOrFail($module->class_id);
            $freshModule = Module::query()->lockForUpdate()->findOrFail($module->id);
            if ($freshModule->class_id !== $schoolClass->id) {
                throw new ServiceUnavailableHttpException;
            }
            $freshModule->setRelation('schoolClass', $schoolClass);
            Gate::forUser($actor)->authorize('generateQuiz', $freshModule);
            $this->assertDurableQueue();

            $generation = new QuizGeneration;
            $generation->forceFill([
                'module_id' => $freshModule->id,
                'requested_by' => $actor->id,
                'question_count' => $questionCount,
                'status' => QuizGenerationStatus::Queued,
            ])->save();

            // The job and tracking row share the application DB and commit together.
            // Bus::dispatch dispatches immediately; a PendingDispatch destructor would be too late.
            Bus::dispatch((new GenerateQuiz($generation->id))->onConnection('quiz-generation')
                ->onQueue('quiz-generation')->beforeCommit());
            $this->logAfterCommit('quiz_generation.queued', $generation);

            return $generation->refresh()->setRelation('module', $freshModule);
        });
    }

    public function status(User $actor, QuizGeneration $generation): QuizGeneration
    {
        $fresh = $generation->fresh('module.schoolClass');
        abort_unless($fresh, 404);
        Gate::forUser($actor)->authorize('view', $fresh);

        return $fresh;
    }

    public function begin(int $id): ?QuizGeneration
    {
        return $this->locked($id, function (QuizGeneration $generation): ?QuizGeneration {
            if ($generation->status->isTerminal()) {
                return null;
            }
            $this->authorizeWorker($generation);
            // Processing is reclaimable after a worker crash; the completion lock prevents duplicates.
            $generation->forceFill([
                'status' => QuizGenerationStatus::Processing,
                'started_at' => $generation->started_at ?? now(),
                'error_code' => null,
            ])->save();
            $this->logAfterCommit('quiz_generation.started', $generation);

            return $generation;
        });
    }

    /** $draft has already passed GeneratedQuizValidator, before this transaction is opened. */
    public function complete(int $id, array $draft): void
    {
        $this->locked($id, function (QuizGeneration $generation) use ($draft): void {
            if ($generation->status->isTerminal()) {
                return;
            }
            $this->authorizeWorker($generation);
            $quiz = $generation->module->schoolClass->quizzes()->create([
                'title' => $draft['title'], 'description' => $draft['description'],
            ]);
            $quiz->forceFill(['status' => QuizStatus::Draft, 'deadline' => null])->save();
            foreach ($draft['questions'] as $item) {
                $question = $quiz->questions()->create([
                    'question_text' => $item['question_text'], 'question_type' => QuestionType::MultipleChoice,
                ]);
                foreach ($item['options'] as $option) {
                    $question->options()->create($option);
                }
            }
            $generation->forceFill([
                'quiz_id' => $quiz->id, 'status' => QuizGenerationStatus::Completed,
                'error_code' => null, 'finished_at' => now(),
            ])->save();
            $this->logAfterCommit('quiz_generation.completed', $generation);
        });
    }

    public function retrying(int $id, string $code): void
    {
        DB::transaction(function () use ($id, $code): void {
            $generation = QuizGeneration::query()->lockForUpdate()->find($id);
            if (! $generation || $generation->status->isTerminal()) {
                return;
            }
            $generation->forceFill(['status' => QuizGenerationStatus::Queued, 'error_code' => null])->save();
            $this->logAfterCommit('quiz_generation.retrying', $generation, QuizGenerationException::safeCode($code));
        });
    }

    public function fail(int $id, string $code): void
    {
        DB::transaction(function () use ($id, $code): void {
            $generation = QuizGeneration::query()->lockForUpdate()->find($id);
            if (! $generation || $generation->status->isTerminal()) {
                return;
            }
            $code = QuizGenerationException::safeCode($code);
            $generation->forceFill([
                'status' => QuizGenerationStatus::Failed, 'error_code' => $code, 'finished_at' => now(),
            ])->save();
            $this->logAfterCommit('quiz_generation.failed', $generation, $code);
        });
    }

    private function locked(int $id, Closure $operation): mixed
    {
        // References are read before the transaction; locking reads determine authoritative state.
        $reference = QuizGeneration::query()->with('module')->findOrFail($id);

        return DB::transaction(function () use ($reference, $operation): mixed {
            $schoolClass = SchoolClass::query()->lockForUpdate()->findOrFail($reference->module->class_id);
            $module = Module::query()->lockForUpdate()->findOrFail($reference->module_id);
            $generation = QuizGeneration::query()->lockForUpdate()->findOrFail($reference->id);
            if ($module->class_id !== $schoolClass->id || $generation->module_id !== $module->id) {
                throw new QuizGenerationException('ownership_changed');
            }
            $module->setRelation('schoolClass', $schoolClass);
            $generation->setRelation('module', $module);

            return $operation($generation);
        });
    }

    private function authorizeWorker(QuizGeneration $generation): void
    {
        $requester = User::query()->lockForUpdate()->find($generation->requested_by);
        if (! $requester || ! Gate::forUser($requester)->allows('generateQuiz', $generation->module)) {
            throw new QuizGenerationException('ownership_changed');
        }
    }

    private function assertDurableQueue(): void
    {
        $queue = config('queue.connections.quiz-generation', []);
        if (($queue['driver'] ?? null) !== 'database' || ($queue['connection'] ?? null) !== null
            || ($queue['after_commit'] ?? null) !== false || ($queue['table'] ?? null) !== 'jobs'
            || ($queue['retry_after'] ?? 0) <= 75) {
            throw new ServiceUnavailableHttpException;
        }
    }

    private function logAfterCommit(string $action, QuizGeneration $generation, ?string $reason = null): void
    {
        $actorId = $generation->requested_by;
        $id = $generation->id;
        DB::afterCommit(fn () => logSystemActivity($action, $actorId, [
            'entity_type' => 'quiz_generation', 'entity_id' => $id, 'reason' => $reason,
        ]));
    }
}
