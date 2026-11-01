<?php

namespace App\Services;

use App\Data\ScoringResult;
use App\Enums\AttemptStatus;
use App\Enums\QuizStatus;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\User;
use App\Support\QuizValidationRules;
use Closure;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class AttemptService
{
    public function __construct(private readonly ScoringServiceFactory $scoring) {}

    public function start(User $student, int $quizId, array $data): array
    {
        return DB::transaction(function () use ($student, $quizId, $data): array {
            // This also serializes start against teacher close and other starts for this quiz.
            $quiz = Quiz::query()->lockForUpdate()->findOrFail($quizId);
            Gate::forUser($student)->authorize('view', $quiz->schoolClass);
            $this->assertOpen($quiz);
            Gate::forUser($student)->authorize('create', [Attempt::class, $quiz]);
            if ($quiz->attempts()->where('student_id', $student->id)->where('status', AttemptStatus::Ongoing)->exists()) {
                throw new ConflictHttpException('An ongoing attempt already exists.');
            }

            $total = $this->validateQuiz($quiz);
            $scoring = $this->scoring->current();
            try {
                $result = $scoring->calculate([], $total);
            } catch (InvalidArgumentException $exception) {
                throw ValidationException::withMessages(['questions' => [$exception->getMessage()]]);
            }

            $attempt = new Attempt(Arr::only($data, ['game_mode', 'challenge_mode', 'boss_id', 'map_id']));
            $attempt->quiz()->associate($quiz);
            $attempt->student()->associate($student);
            $attempt->started_at = now()->utc();
            $attempt->status = AttemptStatus::Ongoing;
            $attempt->scoring_rules = $scoring->rules();
            $attempt->save();
            $attempt->refresh();
            $this->logAfterCommit('attempt.started', $student, $attempt);

            return $this->state($attempt, $result, $total);
        });
    }

    public function show(User $student, Attempt $attempt): array
    {
        return $this->withLockedAttempt($student, $attempt, 'participate', fn (Quiz $quiz, Attempt $locked) => $this->present($quiz, $locked));
    }

    public function questions(User $student, Attempt $attempt): array
    {
        return $this->withLockedAttempt($student, $attempt, 'questions', fn (Quiz $quiz, Attempt $locked) => [
            'state' => $this->present($quiz, $locked),
            'questions' => $quiz->questions()->with('options')->get(),
        ]);
    }

    public function answer(User $student, Attempt $attempt, array $data): array
    {
        return $this->withLockedAttempt($student, $attempt, 'participate', function (Quiz $quiz, Attempt $locked) use ($student, $data): array {
            $this->assertOngoing($locked);
            $this->assertOpen($quiz);
            Gate::forUser($student)->authorize('answer', $locked);
            $scoring = $this->scoring->forAttempt($locked);

            $question = $quiz->questions()->find($data['question_id']);
            if (! $question) {
                throw ValidationException::withMessages(['question_id' => ['The question does not belong to this quiz.']]);
            }
            $option = $question->options()->find($data['chosen_option_id']);
            if (! $option) {
                throw ValidationException::withMessages(['chosen_option_id' => ['The option does not belong to this question.']]);
            }
            if ($locked->answers()->where('question_id', $question->id)->exists()) {
                throw new ConflictHttpException('This question has already been answered.');
            }

            $answer = $locked->answers()->make([
                'question_id' => $question->id, 'chosen_option_id' => $option->id,
            ]);
            $answer->is_correct = $option->is_correct;
            $answer->answered_at = now()->utc();
            $answer->save();

            $total = $quiz->questions()->count();
            $result = $this->replay($locked, $scoring, $total);
            $this->saveProgress($locked, $result);
            $this->logAfterCommit('attempt.answer_saved', $student, $locked);

            return ['answer' => $answer, 'state' => $this->state($locked, $result, $total)];
        });
    }

    public function finish(User $student, Attempt $attempt): array
    {
        return $this->withLockedAttempt($student, $attempt, 'finish', function (Quiz $quiz, Attempt $locked) use ($student): array {
            if ($locked->status === AttemptStatus::Finished) {
                // Never rewrite the stored final grade, game score, or completion timestamp on retry.
                return $this->present($quiz, $locked);
            }

            $scoring = $this->scoring->forAttempt($locked);
            $total = $quiz->questions()->count();
            $result = $this->replay($locked, $scoring, $total);
            $locked->status = AttemptStatus::Finished;
            $locked->finished_at = now()->utc();
            $locked->final_grade = $result->finalGrade;
            $this->saveProgress($locked, $result);
            $this->logAfterCommit('attempt.finished', $student, $locked);

            return $this->state($locked, $result, $total);
        });
    }

    private function withLockedAttempt(User $student, Attempt $reference, string $ability, Closure $operation): mixed
    {
        Gate::forUser($student)->authorize('participate', $reference);

        return DB::transaction(function () use ($student, $reference, $ability, $operation): mixed {
            // Use the already-bound reference only to locate the immutable parent ID. A SELECT
            // before this lock would create a stale read snapshot under MySQL REPEATABLE READ.
            $quiz = Quiz::query()->lockForUpdate()->findOrFail($reference->quiz_id);
            $locked = $quiz->attempts()->lockForUpdate()->findOrFail($reference->id);
            Gate::forUser($student)->authorize($ability, $locked);

            return $operation($quiz, $locked);
        });
    }

    private function assertOpen(Quiz $quiz): void
    {
        if ($quiz->status !== QuizStatus::Published || $quiz->deadline === null || ! $quiz->deadline->isFuture()) {
            throw new ConflictHttpException('The quiz is not open for answers.');
        }
    }

    private function assertOngoing(Attempt $attempt): void
    {
        if ($attempt->status !== AttemptStatus::Ongoing) {
            throw new ConflictHttpException('This attempt is already finished.');
        }
    }

    private function validateQuiz(Quiz $quiz): int
    {
        $quiz->load('questions.options');
        if ($quiz->questions->isEmpty()) {
            throw ValidationException::withMessages(['questions' => ['A quiz must contain at least one complete question.']]);
        }
        foreach ($quiz->questions as $question) {
            Validator::make([
                'question_text' => trim($question->question_text),
                'question_type' => $question->question_type->value,
                'options' => $question->options->map(fn ($option) => [
                    'option_label' => $option->option_label->value,
                    'option_text' => trim($option->option_text),
                    'is_correct' => $option->is_correct,
                ])->all(),
            ], QuizValidationRules::question())->validate();
        }

        return $quiz->questions->count();
    }

    private function replay(Attempt $attempt, ScoringService $scoring, int $total): ScoringResult
    {
        // Receipt order is authoritative; server wall clocks can move backwards between requests.
        $correctness = $attempt->answers()->reorder('id')->get(['id', 'is_correct'])->map(fn ($answer) => $answer->is_correct)->all();

        try {
            return $scoring->calculate($correctness, $total);
        } catch (InvalidArgumentException $exception) {
            throw new ConflictHttpException('The saved attempt cannot be scored with these quiz rules.', $exception);
        }
    }

    private function saveProgress(Attempt $attempt, ScoringResult $result): void
    {
        $attempt->score = $result->score;
        $attempt->streak_max = $result->streakMax;
        $attempt->multiplier_max = $result->multiplierMax;
        $attempt->progress_percentage = $result->progressPercentage;
        $attempt->save();
    }

    private function present(Quiz $quiz, Attempt $attempt): array
    {
        $total = $quiz->questions()->count();
        $result = $this->replay($attempt, $this->scoring->forAttempt($attempt), $total);

        return $this->state($attempt, $result, $total);
    }

    private function state(Attempt $attempt, ScoringResult $result, int $total): array
    {
        return ['attempt' => $attempt, 'scoring' => $result, 'question_count' => $total];
    }

    private function logAfterCommit(string $action, User $student, Attempt $attempt): void
    {
        DB::afterCommit(fn () => logSystemActivity($action, $student->id, ['entity_type' => 'attempt', 'entity_id' => $attempt->id]));
    }
}
