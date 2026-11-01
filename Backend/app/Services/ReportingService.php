<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ReportingService
{
    public function __construct(private readonly GradeStatistics $statistics) {}

    public function personal(User $student, array $filters): array
    {
        return DB::transaction(function () use ($student, $filters): array {
            Gate::forUser($student)->authorize('grades', User::class);
            $attempts = Attempt::query()->where('attempts.student_id', $student->id);
            if (isset($filters['class_id'])) {
                $attempts->whereHas('quiz', fn (Builder $query) => $query->where('class_id', $filters['class_id']));
            }
            if (isset($filters['quiz_id'])) {
                $attempts->where('attempts.quiz_id', $filters['quiz_id']);
            }
            $this->filterStatus($attempts, $filters);
            $result = [
                'summary' => $this->statistics->summarize($attempts),
                'page' => $this->attemptPage($attempts, $filters),
            ];
            $this->logAfterCommit('report.personal_grades_viewed', $student, 'user', $student->id);

            return $result;
        });
    }

    public function quiz(User $teacher, int $quizId, array $filters): array
    {
        return DB::transaction(function () use ($teacher, $quizId, $filters): array {
            $quiz = Quiz::query()->with('schoolClass')->findOrFail($quizId);
            Gate::forUser($teacher)->authorize('grades', $quiz);
            $attempts = Attempt::query()->where('attempts.quiz_id', $quiz->id);
            if (isset($filters['student_id'])) {
                $attempts->where('attempts.student_id', $filters['student_id']);
            }
            $this->filterStatus($attempts, $filters);
            $result = [
                'quiz' => $quiz,
                'summary' => $this->statistics->summarize($attempts),
                'page' => $this->attemptPage($attempts, $filters),
            ];
            $this->logAfterCommit('report.quiz_grades_viewed', $teacher, 'quiz', $quiz->id);

            return $result;
        });
    }

    public function gradebook(User $teacher, int $classId, array $filters): array
    {
        return DB::transaction(function () use ($teacher, $classId, $filters): array {
            $schoolClass = SchoolClass::query()->findOrFail($classId);
            Gate::forUser($teacher)->authorize('gradebook', $schoolClass);
            $quiz = isset($filters['quiz_id']) ? $schoolClass->quizzes()->findOrFail($filters['quiz_id']) : null;
            $attempts = Attempt::query()->whereHas('quiz', fn (Builder $query) => $query->where('class_id', $schoolClass->id));
            if ($quiz) {
                $attempts->where('attempts.quiz_id', $quiz->id);
            }

            $history = (clone $attempts)->select('attempts.student_id');
            $students = User::query()->where(function (Builder $users) use ($schoolClass, $history): void {
                // Group the roster/history union so subsequent predicates cannot escape scope.
                $users->where(function (Builder $enrolled) use ($schoolClass): void {
                    $enrolled->where('role', Role::Student)
                        ->whereHas('classes', fn (Builder $classes) => $classes->whereKey($schoolClass->id));
                })->orWhereIn('users.id', $history);
            })->withExists([
                'classes as enrolled' => fn (Builder $classes) => $classes->whereKey($schoolClass->id),
            ])->orderBy('users.id')->paginate($filters['per_page'] ?? 20, ['users.*'], 'page', $filters['page'] ?? 1);

            $perStudent = $this->statistics->byStudent($attempts, $students->getCollection()->modelKeys());
            $items = $students->getCollection()->map(fn (User $student) => [
                'student' => $student,
                'summary' => $perStudent[$student->id] ?? $this->statistics->empty(),
            ]);
            $result = [
                'schoolClass' => $schoolClass,
                'quiz' => $quiz,
                'summary' => $this->statistics->summarize($attempts),
                'page' => $students,
                'items' => $items,
            ];
            $this->logAfterCommit('report.class_gradebook_viewed', $teacher, 'class', $schoolClass->id);

            return $result;
        });
    }

    public function review(User $actor, Attempt $reference): Attempt
    {
        Gate::forUser($actor)->authorize('review', $reference);

        return DB::transaction(function () use ($actor, $reference): Attempt {
            // Match quiz -> attempt ordering used by finalization, then recheck completion.
            $quiz = Quiz::query()->lockForUpdate()->findOrFail($reference->quiz_id);
            $attempt = $quiz->attempts()->lockForUpdate()->findOrFail($reference->id);
            $attempt->setRelation('quiz', $quiz);
            Gate::forUser($actor)->authorize('review', $attempt);
            $quiz->load('schoolClass', 'questions.options')->loadCount('questions');
            $attempt->load('student', 'answers')->loadCount('answers');
            $this->logAfterCommit('report.attempt_reviewed', $actor, 'attempt', $attempt->id);

            return $attempt;
        });
    }

    private function attemptPage(Builder $attempts, array $filters): LengthAwarePaginator
    {
        return (clone $attempts)->with(['student', 'quiz'])->withCount('answers')
            ->orderByDesc('attempts.id')->paginate($filters['per_page'] ?? 20, ['attempts.*'], 'page', $filters['page'] ?? 1);
    }

    private function filterStatus(Builder $attempts, array $filters): void
    {
        if (isset($filters['status'])) {
            $attempts->where('attempts.status', $filters['status']);
        }
    }

    private function logAfterCommit(string $action, User $actor, string $type, int $id): void
    {
        DB::afterCommit(fn () => logSystemActivity($action, $actor->id, ['entity_type' => $type, 'entity_id' => $id]));
    }
}
