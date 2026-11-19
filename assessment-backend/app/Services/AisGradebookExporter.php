<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuizStatus;
use App\Models\Attempt;
use App\Models\Quiz;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AisGradebookExporter
{
    public function exportAttempt(Attempt $attempt): int
    {
        if (! $this->hasExportTables()) {
            return 0;
        }

        $attempt->loadMissing(['quiz.schoolClass']);
        $quiz = $attempt->quiz;
        if (! $quiz || ! $this->shouldExportQuiz($quiz)) {
            return 0;
        }

        return $this->upsertAttemptRecord($quiz, $attempt) ? 1 : 0;
    }

    public function exportQuiz(Quiz $quiz): int
    {
        if (! $this->hasExportTables()) {
            return 0;
        }

        if (! $this->shouldExportQuiz($quiz)) {
            return 0;
        }

        $quiz->loadMissing('schoolClass');
        $attempts = $quiz->attempts()
            ->where('status', AttemptStatus::Finished->value)
            ->get();

        $exported = 0;
        foreach ($attempts as $attempt) {
            if ($this->upsertAttemptRecord($quiz, $attempt)) {
                $exported++;
            }
        }

        return $exported;
    }

    public function exportAllReleased(): int
    {
        if (! $this->hasExportTables()) {
            return 0;
        }

        $quizzes = Quiz::query()
            ->with('schoolClass')
            ->where('status', '!=', QuizStatus::Draft->value)
            ->where(function ($q): void {
                $q->where('release_mode', 'immediate')
                    ->orWhere('results_released', true);
            })
            ->get();

        $total = 0;
        foreach ($quizzes as $quiz) {
            $total += $this->exportQuiz($quiz);
        }

        return $total;
    }

    private function shouldExportQuiz(Quiz $quiz): bool
    {
        return $quiz->status !== QuizStatus::Draft && $quiz->resultsVisibleFor(null);
    }

    private function upsertAttemptRecord(Quiz $quiz, Attempt $attempt): bool
    {
        if ($attempt->status !== AttemptStatus::Finished || $attempt->final_grade === null) {
            return false;
        }

        $studentId = DB::table('students')
            ->where('user_id', $attempt->student_id)
            ->value('id');

        if (! $studentId) {
            return false;
        }

        $now = now()->utc();
        $schoolClass = $quiz->schoolClass;
        $sourceType = ($quiz->assessment_type ?? 'quiz') === 'assignment' ? 'assignment' : 'quiz';

        $values = [
            'user_id' => $attempt->student_id,
            'classroom_id' => $schoolClass?->ais_classroom_id,
            'subject_id' => $schoolClass?->ais_subject_id,
            'assessment_class_id' => $schoolClass?->id,
            'source_type' => $sourceType,
            'title' => $quiz->title,
            'assessment_type' => $quiz->assessment_type ?? 'quiz',
            'score' => number_format((float) $attempt->final_grade, 2, '.', ''),
            'max_score' => '100.00',
            'teacher_feedback' => $attempt->teacher_feedback,
            'submitted_at' => $attempt->finished_at,
            'graded_at' => $attempt->graded_at ?? $attempt->finished_at,
            'released_at' => $now,
            'updated_at' => $now,
        ];

        $existing = DB::table('ais_assessment_grades')
            ->where('student_id', $studentId)
            ->where('source_quiz_id', $quiz->id)
            ->first();

        if ($existing) {
            DB::table('ais_assessment_grades')
                ->where('id', $existing->id)
                ->update($values);
        } else {
            DB::table('ais_assessment_grades')->insert($values + [
                'student_id' => $studentId,
                'source_quiz_id' => $quiz->id,
                'created_at' => $now,
            ]);
        }

        return true;
    }

    private function hasExportTables(): bool
    {
        return Schema::hasTable('ais_assessment_grades') && Schema::hasTable('students');
    }
}
