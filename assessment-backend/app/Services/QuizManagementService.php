<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Enums\QuestionSource;
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
    public function __construct(private readonly LmsNotificationService $notifications) {}

    public function list(User $actor, SchoolClass $schoolClass, array $filters): LengthAwarePaginator
    {
        Gate::forUser($actor)->authorize('viewAny', [Quiz::class, $schoolClass]);
        $query = $schoolClass->quizzes()
            ->where('assessment_type', '!=', 'bank')
            ->withCount('questions')
            ->orderByDesc('id');

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
                if ($question->source === QuestionSource::Ai && ! $question->reviewed) {
                    throw ValidationException::withMessages([
                        'questions' => ['All AI-generated questions must be reviewed by a teacher before publishing.'],
                    ]);
                }
            }
            $quiz->status = QuizStatus::Published;
            $quiz->deadline = $expiresAt;
            $quiz->save();
            $this->notifications->notifyClassStudents(
                $quiz->schoolClass,
                NotificationType::QuizPublished,
                "Kuis baru dipublish: {$quiz->title}",
                "Kuis \"{$quiz->title}\" telah dibuka untuk kelas {$quiz->schoolClass->name}.",
                ['quiz_id' => $quiz->id, 'deadline' => $quiz->deadline?->toIso8601String()],
            );
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

    public function archive(User $actor, int $quizId): Quiz
    {
        return $this->mutate($actor, $quizId, 'archive', function (Quiz $quiz) use ($actor): Quiz {
            $quiz->status = QuizStatus::Archived;
            $quiz->save();
            $this->logAfterCommit('quiz.archived', $actor, 'quiz', $quiz->id);

            return $this->details($quiz);
        });
    }

    public function duplicate(User $actor, int $quizId): Quiz
    {
        return $this->mutate($actor, $quizId, 'duplicate', function (Quiz $quiz) use ($actor): Quiz {
            $quiz->load('questions.options');
            $copy = $quiz->schoolClass->quizzes()->create([
                'title' => $quiz->title.' (Salinan)',
                'description' => $quiz->description,
                'assessment_type' => $quiz->assessment_type ?? 'quiz',
                'course_name' => $quiz->course_name,
                'instructions' => $quiz->instructions,
                'open_at' => $quiz->open_at,
                'deadline' => $quiz->deadline,
                'duration_minutes' => $quiz->duration_minutes ?? 30,
                'release_mode' => $quiz->release_mode ?? 'immediate',
                'results_released' => false,
            ]);
            $copy->forceFill(['status' => QuizStatus::Draft])->save();

            foreach ($quiz->questions as $question) {
                $newQuestion = $copy->questions()->make([
                    'question_text' => $question->question_text,
                    'question_type' => $question->question_type,
                    'points' => $question->points ?? 10,
                    'explanation' => $question->explanation,
                    'topic' => $question->topic,
                    'is_bank_item' => false,
                ]);
                $newQuestion->forceFill([
                    'source' => $question->source ?? QuestionSource::Manual,
                    'reviewed' => (bool) $question->reviewed,
                ])->save();

                foreach ($question->options as $option) {
                    $newQuestion->options()->create([
                        'option_label' => $option->option_label,
                        'option_text' => $option->option_text,
                        'is_correct' => (bool) $option->is_correct,
                    ]);
                }
            }

            $this->logAfterCommit('quiz.duplicated', $actor, 'quiz', $copy->id);

            return $this->details($copy->refresh());
        });
    }

    public function releaseResults(User $actor, int $quizId): Quiz
    {
        return $this->mutate($actor, $quizId, 'releaseResults', function (Quiz $quiz) use ($actor): Quiz {
            $quiz->results_released = true;
            $quiz->save();
            $this->notifications->notifyClassStudents(
                $quiz->schoolClass,
                NotificationType::GradeReleased,
                "Nilai dirilis: {$quiz->title}",
                "Nilai untuk \"{$quiz->title}\" pada kelas {$quiz->schoolClass->name} sudah dapat dilihat.",
                ['quiz_id' => $quiz->id],
            );
            $this->logAfterCommit('quiz.results_released', $actor, 'quiz', $quiz->id);

            return $this->details($quiz);
        });
    }

    public function listBankQuestions(User $actor): Collection
    {
        $classIds = $actor->ownedClasses()->pluck('id');
        if ($classIds->isEmpty()) {
            return new Collection;
        }

        return Question::query()
            ->where('is_bank_item', true)
            ->whereHas('quiz', fn ($q) => $q->whereIn('class_id', $classIds))
            ->with('options')
            ->orderByDesc('id')
            ->get();
    }

    public function createBankQuestion(User $actor, array $data): Question
    {
        return DB::transaction(function () use ($actor, $data): Question {
            $schoolClass = $actor->ownedClasses()->orderBy('id')->first();
            if (! $schoolClass) {
                $schoolClass = new SchoolClass([
                    'name' => 'Bank Soal Default',
                    'description' => 'Kelas kontainer internal untuk Bank Soal',
                ]);
                $schoolClass->teacher_id = $actor->id;
                $schoolClass->save();
            }

            $bankQuiz = $schoolClass->quizzes()
                ->where('assessment_type', 'bank')
                ->first();

            if (! $bankQuiz) {
                $bankQuiz = $schoolClass->quizzes()->create([
                    'title' => '__QUESTION_BANK__',
                    'description' => 'Internal container for standalone question bank items.',
                    'assessment_type' => 'bank',
                ]);
                $bankQuiz->forceFill(['status' => QuizStatus::Archived])->save();
            }

            $question = $bankQuiz->questions()->make([
                'question_text' => $data['question_text'],
                'question_type' => $data['question_type'] ?? QuestionType::MultipleChoice,
                'points' => $data['points'] ?? 10,
                'explanation' => $data['explanation'] ?? null,
                'topic' => $data['topic'] ?? null,
                'is_bank_item' => true,
            ]);
            $question->forceFill([
                'source' => QuestionSource::Manual,
                'reviewed' => true,
            ])->save();

            $this->writeOptions($question, $data['options']);
            $this->assertComplete($question);
            $this->logAfterCommit('bank_question.created', $actor, 'question', $question->id);

            return $question;
        });
    }

    public function deleteBankQuestion(User $actor, Question $question): void
    {
        DB::transaction(function () use ($actor, $question): void {
            $schoolClass = $question->quiz?->schoolClass;
            abort_unless($schoolClass && $schoolClass->teacher_id === $actor->id && $question->is_bank_item, 403);
            $id = $question->id;
            $question->delete();
            $this->logAfterCommit('bank_question.deleted', $actor, 'question', $id);
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
            $question = $quiz->questions()->make([
                'question_text' => $data['question_text'],
                'question_type' => $data['question_type'] ?? QuestionType::MultipleChoice,
                'points' => $data['points'] ?? 10,
                'explanation' => $data['explanation'] ?? null,
                'topic' => $data['topic'] ?? null,
                'is_bank_item' => (bool) ($data['is_bank_item'] ?? false),
            ]);
            $question->forceFill([
                'source' => QuestionSource::Manual,
                'reviewed' => true,
            ])->save();
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
            $question->fill(Arr::only($data, ['question_text', 'question_type', 'points', 'explanation', 'topic', 'is_bank_item']));
            if (array_key_exists('reviewed', $data)) {
                $question->reviewed = (bool) $data['reviewed'];
            } elseif ($question->source === QuestionSource::Ai && (array_key_exists('question_text', $data) || array_key_exists('options', $data))) {
                $question->reviewed = false;
            }
            $question->save();
            if (array_key_exists('options', $data)) {
                $this->writeOptions($question, $data['options']);
            }
            $this->assertComplete($question);
            $this->logAfterCommit('question.updated', $actor, 'question', $question->id);

            return $question;
        });
    }

    public function reviewQuestion(User $actor, int $quizId, int $questionId, bool $reviewed = true): Question
    {
        return $this->mutate($actor, $quizId, 'update', function (Quiz $quiz) use ($actor, $questionId, $reviewed): Question {
            $question = $quiz->questions()->findOrFail($questionId);
            Gate::forUser($actor)->authorize('update', $question);
            $this->assertComplete($question);
            $question->forceFill(['reviewed' => $reviewed])->save();
            $this->logAfterCommit('question.reviewed', $actor, 'question', $question->id);

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
            if ($question->source === QuestionSource::Ai) {
                $question->forceFill(['reviewed' => false])->save();
            }
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
            if ($question->source === QuestionSource::Ai) {
                $question->forceFill(['reviewed' => false])->save();
            }
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
            if (! in_array($ability, ['close', 'archive', 'duplicate', 'releaseResults'], true) && $quiz->attempts()->exists()) {
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
        $attributes = Arr::only($data, [
            'title',
            'description',
            'deadline',
            'assessment_type',
            'course_name',
            'instructions',
            'open_at',
            'duration_minutes',
            'release_mode',
            'results_released',
        ]);
        if (isset($attributes['assessment_type'])) {
            $attributes['assessment_type'] = match ($attributes['assessment_type']) {
                'Kuis' => 'quiz',
                'Tugas' => 'assignment',
                default => $attributes['assessment_type'],
            };
        }
        if (isset($attributes['deadline'])) {
            // Database datetimes do not retain an input offset: normalize before serialization.
            $attributes['deadline'] = CarbonImmutable::parse($attributes['deadline'])->utc();
        }
        if (isset($attributes['open_at'])) {
            $attributes['open_at'] = CarbonImmutable::parse($attributes['open_at'])->utc();
        }

        return $attributes;
    }

    private function logAfterCommit(string $action, User $actor, string $type, int $id): void
    {
        DB::afterCommit(fn () => logSystemActivity($action, $actor->id, ['entity_type' => $type, 'entity_id' => $id]));
    }
}
