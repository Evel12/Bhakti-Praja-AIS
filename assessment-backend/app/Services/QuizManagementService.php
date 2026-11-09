<?php

namespace App\Services;

use App\Enums\QuestionType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use App\Support\QuizValidationRules;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class QuizManagementService
{
    public function list(User $actor, SchoolClass $schoolClass, array $filters): LengthAwarePaginator
    {
        Gate::forUser($actor)->authorize('viewAny', [Quiz::class, $schoolClass]);
        $query = $schoolClass->quizzes()->withCount('questions')->orderByDesc('id');

        if ($actor->role === Role::Student) {
            $query->where('status', QuizStatus::Published);
        }
        if (isset($filters['status'])) {
            // AND with the student's visibility filter; a client filter cannot widen access.
            $query->where('status', $filters['status']);
        }

        return $query->paginate($filters['per_page'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function show(User $actor, Quiz $quiz): Quiz
    {
        Gate::forUser($actor)->authorize('view', $quiz);

        return $this->details($quiz);
    }

    public function create(User $actor, array $data): Quiz
    {
        return DB::transaction(function () use ($actor, $data): Quiz {
            $schoolClass = SchoolClass::query()->lockForUpdate()->findOrFail($data['class_id']);
            Gate::forUser($actor)->authorize('create', [Quiz::class, $schoolClass]);
            $quiz = $schoolClass->quizzes()->create($this->metadata($data));
            $this->logAfterCommit('quiz.created', $actor, 'quiz', $quiz->id);

            return $this->details($quiz->refresh());
        });
    }

    public function update(User $actor, int $quizId, array $data): Quiz
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $data): Quiz {
            $quiz->fill($this->metadata($data))->save();
            $this->logAfterCommit('quiz.updated', $actor, 'quiz', $quiz->id);

            return $this->details($quiz);
        });
    }

    public function delete(User $actor, int $quizId): void
    {
        $this->mutate($actor, $quizId, 'delete', function (Quiz $quiz) use ($actor): void {
            $quiz->delete();
            $this->logAfterCommit('quiz.deleted', $actor, 'quiz', $quiz->id);
        });
    }

    public function publish(User $actor, int $quizId, string $deadline): Quiz
    {
        return $this->mutate($actor, $quizId, 'publish', function (Quiz $quiz) use ($actor, $deadline): Quiz {
            $expiresAt = CarbonImmutable::parse($deadline)->utc();
            if (! $expiresAt->isFuture()) {
                throw ValidationException::withMessages(['deadline' => ['The deadline must be in the future.']]);
            }
            $quiz->load('questions.options');
            if ($quiz->questions->isEmpty()) {
                throw ValidationException::withMessages(['questions' => ['A quiz must have at least one complete question before publication.']]);
            }
            foreach ($quiz->questions as $question) {
                $this->assertComplete($question);
            }
            $quiz->status = QuizStatus::Published;
            $quiz->deadline = $expiresAt;
            $quiz->save();
            $this->logAfterCommit('quiz.published', $actor, 'quiz', $quiz->id);

            return $this->details($quiz);
        });
    }

    public function close(User $actor, int $quizId): Quiz
    {
        return $this->mutate($actor, $quizId, 'close', function (Quiz $quiz) use ($actor): Quiz {
            $quiz->status = QuizStatus::Closed;
            $quiz->save();
            $this->logAfterCommit('quiz.closed', $actor, 'quiz', $quiz->id);

            return $this->details($quiz);
        });
    }

    public function questions(User $actor, Quiz $quiz): Collection
    {
        Gate::forUser($actor)->authorize('view', $quiz);

        return $quiz->questions()->with('options')->get();
    }

    public function question(User $actor, Question $question): Question
    {
        Gate::forUser($actor)->authorize('view', $question);

        return $question->load('options');
    }

    public function createQuestion(User $actor, int $quizId, array $data): Question
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $data): Question {
            Gate::forUser($actor)->authorize('create', [Question::class, $quiz]);
            $question = $quiz->questions()->create([
                'question_text' => $data['question_text'],
                'question_type' => $data['question_type'] ?? QuestionType::MultipleChoice,
            ]);
            $this->writeOptions($question, $data['options']);
            $this->assertComplete($question);
            $this->logAfterCommit('question.created', $actor, 'question', $question->id);

            return $question;
        });
    }

    public function updateQuestion(User $actor, int $quizId, int $questionId, array $data): Question
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $questionId, $data): Question {
            $question = $quiz->questions()->findOrFail($questionId);
            Gate::forUser($actor)->authorize('update', $question);
            $question->fill(Arr::only($data, ['question_text', 'question_type']))->save();
            if (array_key_exists('options', $data)) {
                $this->writeOptions($question, $data['options']);
            }
            $this->assertComplete($question);
            $this->logAfterCommit('question.updated', $actor, 'question', $question->id);

            return $question;
        });
    }

    public function deleteQuestion(User $actor, int $quizId, int $questionId): void
    {
        $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $questionId): void {
            $question = $quiz->questions()->findOrFail($questionId);
            Gate::forUser($actor)->authorize('delete', $question);
            $question->delete();
            $this->logAfterCommit('question.deleted', $actor, 'question', $questionId);
        });
    }

    public function replaceOptions(User $actor, int $quizId, int $questionId, array $options): Question
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $questionId, $options): Question {
            $question = $quiz->questions()->findOrFail($questionId);
            Gate::forUser($actor)->authorize('update', $question);
            $this->writeOptions($question, $options);
            $this->assertComplete($question);
            $this->logAfterCommit('options.replaced', $actor, 'question', $questionId);

            return $question;
        });
    }

    public function option(User $actor, Option $option): Option
    {
        Gate::forUser($actor)->authorize('view', $option);

        return $option;
    }

    public function updateOption(User $actor, int $quizId, int $questionId, int $optionId, array $data): Option
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $questionId, $optionId, $data): Option {
            $question = $quiz->questions()->findOrFail($questionId);
            $option = $question->options()->findOrFail($optionId);
            Gate::forUser($actor)->authorize('update', $option);

            if (array_key_exists('is_correct', $data) && in_array($data['is_correct'], [true, 1, '1'], true)) {
                // A teacher explicitly selects a new key; move it atomically within the quiz lock.
                $question->options()->whereKeyNot($optionId)->update(['is_correct' => false]);
            }
            $option->fill(Arr::only($data, ['option_text', 'is_correct']))->save();
            $this->assertComplete($question);
            $this->logAfterCommit('option.updated', $actor, 'option', $optionId);

            return $option;
        });
    }

    private function mutate(User $actor, int $quizId, string $ability, Closure $operation): mixed
    {
        return DB::transaction(function () use ($actor, $quizId, $ability, $operation): mixed {
            // All content and status writes acquire the same parent lock to serialize publish/edit.
            $quiz = Quiz::query()->lockForUpdate()->findOrFail($quizId);
            Gate::forUser($actor)->authorize($ability, $quiz);
            if ($ability !== 'close' && $quiz->attempts()->exists()) {
                throw new ConflictHttpException('Quiz content cannot change after an attempt exists.');
            }

            return $operation($quiz);
        });
    }

    private function writeOptions(Question $question, array $options): void
    {
        // Replacing the set supports option creation/deletion without an observable partial question.
        $question->options()->delete();
        foreach ($options as $option) {
            $question->options()->create(Arr::only($option, ['option_label', 'option_text', 'is_correct']));
        }
        $question->unsetRelation('options');
    }

    private function assertComplete(Question $question): void
    {
        $question->load('options');
        Validator::make([
            'question_text' => trim($question->question_text),
            'question_type' => $question->question_type->value,
            'options' => $question->options->map(fn (Option $option) => [
                'option_label' => $option->option_label->value,
                'option_text' => trim($option->option_text),
                'is_correct' => $option->is_correct,
            ])->all(),
        ], QuizValidationRules::question())->validate();
    }

    private function details(Quiz $quiz): Quiz
    {
        return $quiz->load('questions.options')->loadCount('questions');
    }

    private function metadata(array $data): array
    {
        $attributes = Arr::only($data, ['title', 'description', 'deadline']);
        if (isset($attributes['deadline'])) {
            // Database datetimes do not retain an input offset: normalize before serialization.
            $attributes['deadline'] = CarbonImmutable::parse($attributes['deadline'])->utc();
        }

        return $attributes;
    }

    private function logAfterCommit(string $action, User $actor, string $type, int $id): void
    {
        DB::afterCommit(fn () => logSystemActivity($action, $actor->id, ['entity_type' => $type, 'entity_id' => $id]));
    }
}
