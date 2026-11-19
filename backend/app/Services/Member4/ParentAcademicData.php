<?php

namespace App\Services\Member4;

use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Reads verified Assessment/LMS records from shared tables; never fabricates missing records. */
class ParentAcademicData
{
    public const SECTIONS = ['grades', 'attendance', 'assignments', 'progress'];

    public function read(string $section, ?Student $student = null): array
    {
        $messages = [
            'grades' => 'Informasi nilai akademik belum tersedia. Silakan periksa kembali nanti.',
            'attendance' => 'Informasi absensi belum tersedia. Silakan periksa kembali nanti.',
            'assignments' => 'Informasi tugas dan pengumpulannya belum tersedia. Silakan periksa kembali nanti.',
            'progress' => 'Informasi perkembangan akademik belum tersedia. Silakan periksa kembali nanti.',
        ];
        if (! isset($messages[$section])) {
            throw new \InvalidArgumentException('Bagian akademik tidak dikenal.');
        }

        if ($section === 'attendance' || $student === null) {
            return $this->unavailable($messages[$section]);
        }

        $studentUserId = $student->user_id ?? Student::query()->whereKey($student->id)->value('user_id');
        if ($studentUserId === null) {
            return $this->unavailable($messages[$section]);
        }
        $student->user_id = (int) $studentUserId;

        return match ($section) {
            'grades' => $this->readGrades($student, $messages['grades']),
            'assignments' => $this->readAssignments($student, $messages['assignments']),
            'progress' => $this->readProgress($student, $messages['progress']),
        };
    }

    public function overview(?Student $student = null): array
    {
        $sections = [];
        foreach (self::SECTIONS as $section) {
            $sections[$section] = $this->read($section, $student);
        }

        return $sections;
    }

    private function unavailable(string $message): array
    {
        return ['available' => false, 'status' => 'unavailable', 'message' => $message, 'data' => null];
    }

    private function readGrades(Student $student, string $fallbackMessage): array
    {
        $hasGradesTable = Schema::hasTable('ais_assessment_grades');
        $hasAssessmentTables = Schema::hasTable('quizzes') && Schema::hasTable('attempts');

        $exportedRows = $hasGradesTable
            ? DB::table('ais_assessment_grades as g')
                ->leftJoin('subjects as s', 's.id', '=', 'g.subject_id')
                ->leftJoin('classrooms as c', 'c.id', '=', 'g.classroom_id')
                ->where('g.student_id', $student->id)
                ->orderByDesc('g.released_at')
                ->orderByDesc('g.id')
                ->get([
                    'g.source_quiz_id as quiz_id',
                    'g.title',
                    'g.assessment_type',
                    'g.score',
                    'g.max_score',
                    'g.teacher_feedback',
                    'g.submitted_at',
                    'g.graded_at',
                    'g.released_at',
                    's.name as subject_name',
                    'c.name as classroom_name',
                ])
            : collect();

        if (! $hasAssessmentTables && $exportedRows->isEmpty()) {
            return $this->unavailable($fallbackMessage);
        }

        $itemsByQuiz = [];
        foreach ($exportedRows as $row) {
            $itemsByQuiz[(int) $row->quiz_id] = [
                'quiz_id' => (int) $row->quiz_id,
                'title' => $row->title,
                'assessment_type' => $row->assessment_type,
                'subject_name' => $row->subject_name,
                'classroom_name' => $row->classroom_name,
                'score' => $row->score !== null ? round((float) $row->score, 2) : null,
                'max_score' => round((float) ($row->max_score ?? 100), 2),
                'teacher_feedback' => $row->teacher_feedback,
                'submitted_at' => $row->submitted_at,
                'graded_at' => $row->graded_at,
                'released_at' => $row->released_at,
            ];
        }

        if ($hasAssessmentTables) {
            $liveAttempts = DB::table('attempts as a')
                ->join('quizzes as q', 'q.id', '=', 'a.quiz_id')
                ->join('classes as cls', 'cls.id', '=', 'q.class_id')
                ->where('a.student_id', $student->user_id)
                ->where('a.status', 'finished')
                ->where('q.status', '!=', 'draft')
                ->where(function ($w): void {
                    $w->where('q.release_mode', 'immediate')
                        ->orWhere('q.results_released', true);
                })
                ->orderByDesc('a.finished_at')
                ->get([
                    'q.id as quiz_id',
                    'q.title',
                    'q.assessment_type',
                    'q.course_name',
                    'cls.name as class_name',
                    'a.final_grade',
                    'a.teacher_feedback',
                    'a.finished_at',
                    'a.graded_at',
                ]);

            foreach ($liveAttempts as $row) {
                $quizId = (int) $row->quiz_id;
                if (isset($itemsByQuiz[$quizId])) {
                    continue;
                }
                $itemsByQuiz[$quizId] = [
                    'quiz_id' => $quizId,
                    'title' => $row->title,
                    'assessment_type' => $row->assessment_type ?? 'quiz',
                    'subject_name' => $row->course_name ?: $row->class_name,
                    'classroom_name' => $row->class_name,
                    'score' => $row->final_grade !== null ? round((float) $row->final_grade, 2) : null,
                    'max_score' => 100.0,
                    'teacher_feedback' => $row->teacher_feedback,
                    'submitted_at' => $row->finished_at,
                    'graded_at' => $row->graded_at,
                    'released_at' => $row->graded_at ?? $row->finished_at,
                ];
            }
        }

        $items = array_values($itemsByQuiz);
        $scored = array_values(array_filter(
            array_map(static fn (array $item): ?float => $item['score'], $items),
            static fn (?float $score): bool => $score !== null,
        ));

        return [
            'available' => true,
            'status' => 'available',
            'message' => null,
            'data' => [
                'summary' => [
                    'count' => count($items),
                    'average_score' => count($scored) > 0 ? round(array_sum($scored) / count($scored), 2) : null,
                ],
                'items' => $items,
            ],
        ];
    }

    private function readAssignments(Student $student, string $fallbackMessage): array
    {
        $hasQuizzes = Schema::hasTable('quizzes') && Schema::hasTable('attempts');
        $hasAssignments = Schema::hasTable('assignments');

        if (! Schema::hasTable('class_members') || (! $hasQuizzes && ! $hasAssignments)) {
            return $this->unavailable($fallbackMessage);
        }

        $classIds = DB::table('class_members')
            ->where('student_id', $student->user_id)
            ->pluck('class_id');

        $quizRows = ($classIds->isEmpty() || ! $hasQuizzes)
            ? collect()
            : DB::table('quizzes as q')
                ->join('classes as cls', 'cls.id', '=', 'q.class_id')
                ->leftJoin('attempts as a', function ($join) use ($student): void {
                    $join->on('a.quiz_id', '=', 'q.id')
                        ->where('a.student_id', '=', $student->user_id);
                })
                ->whereIn('q.class_id', $classIds->all())
                ->where('q.status', '!=', 'draft')
                ->orderByDesc('q.deadline')
                ->orderByDesc('q.id')
                ->get([
                    'q.id',
                    'q.title',
                    'q.assessment_type',
                    'q.status',
                    'q.deadline',
                    'q.release_mode',
                    'q.results_released',
                    'cls.name as class_name',
                    'a.status as attempt_status',
                    'a.finished_at',
                    'a.final_grade',
                ]);

        $items = $quizRows->map(static function ($row): array {
            $visible = ($row->release_mode ?? 'immediate') === 'immediate' || (bool) ($row->results_released ?? false);
            $completionStatus = match ($row->attempt_status) {
                'finished' => ($visible && $row->final_grade !== null) ? 'graded' : 'submitted',
                'ongoing' => 'in_progress',
                default => 'pending',
            };

            return [
                'id' => (int) $row->id,
                'title' => $row->title,
                'assessment_type' => $row->assessment_type ?? 'quiz',
                'class_name' => $row->class_name,
                'deadline' => $row->deadline,
                'completion_status' => $completionStatus,
                'submitted_at' => $row->finished_at,
                'score' => ($visible && $row->attempt_status === 'finished' && $row->final_grade !== null)
                    ? round((float) $row->final_grade, 2)
                    : null,
            ];
        })->values()->all();

        if (! $classIds->isEmpty() && $hasAssignments) {
            $lmsAssignments = DB::table('assignments as asg')
                ->join('classes as cls', 'cls.id', '=', 'asg.class_id')
                ->whereIn('asg.class_id', $classIds->all())
                ->where('asg.status', 'published')
                ->orderByDesc('asg.deadline')
                ->orderByDesc('asg.id')
                ->get([
                    'asg.id',
                    'asg.title',
                    'asg.deadline',
                    'cls.name as class_name',
                ]);

            foreach ($lmsAssignments as $row) {
                $items[] = [
                    'id' => (int) $row->id,
                    'title' => $row->title,
                    'assessment_type' => 'assignment',
                    'class_name' => $row->class_name,
                    'deadline' => $row->deadline,
                    'completion_status' => 'pending',
                    'submitted_at' => null,
                    'score' => null,
                ];
            }
        }

        $submitted = count(array_filter($items, static fn (array $item): bool => in_array($item['completion_status'], ['submitted', 'graded'], true)));
        $pending = count(array_filter($items, static fn (array $item): bool => in_array($item['completion_status'], ['pending', 'in_progress'], true)));

        return [
            'available' => true,
            'status' => 'available',
            'message' => null,
            'data' => [
                'summary' => [
                    'total' => count($items),
                    'submitted' => $submitted,
                    'pending' => $pending,
                ],
                'items' => $items,
            ],
        ];
    }

    private function readProgress(Student $student, string $fallbackMessage): array
    {
        if (! Schema::hasTable('class_members') || ! Schema::hasTable('modules') || ! Schema::hasTable('module_reads')) {
            return $this->unavailable($fallbackMessage);
        }

        $classIds = DB::table('class_members')
            ->where('student_id', $student->user_id)
            ->pluck('class_id');

        $totalModules = $classIds->isEmpty() ? 0 : (int) DB::table('modules')
            ->whereIn('class_id', $classIds->all())
            ->where('visibility', 'public')
            ->count();

        $readModules = $classIds->isEmpty() ? 0 : (int) DB::table('module_reads as mr')
            ->join('modules as m', 'm.id', '=', 'mr.module_id')
            ->whereIn('m.class_id', $classIds->all())
            ->where('m.visibility', 'public')
            ->where('mr.student_id', $student->user_id)
            ->count();

        $totalQuizzes = ($classIds->isEmpty() || ! Schema::hasTable('quizzes')) ? 0 : (int) DB::table('quizzes')
            ->whereIn('class_id', $classIds->all())
            ->where('status', '!=', 'draft')
            ->count();

        $completedQuizzes = ($classIds->isEmpty() || ! Schema::hasTable('attempts') || ! Schema::hasTable('quizzes')) ? 0 : (int) DB::table('attempts as a')
            ->join('quizzes as q', 'q.id', '=', 'a.quiz_id')
            ->whereIn('q.class_id', $classIds->all())
            ->where('a.student_id', $student->user_id)
            ->where('a.status', 'finished')
            ->distinct()
            ->count('q.id');

        $modulePct = $totalModules > 0 ? round(($readModules / $totalModules) * 100, 1) : null;

        return [
            'available' => true,
            'status' => 'available',
            'message' => null,
            'data' => [
                'enrolled_classes' => $classIds->count(),
                'total_modules' => $totalModules,
                'read_modules' => $readModules,
                'module_completion_percentage' => $modulePct,
                'total_quizzes' => $totalQuizzes,
                'completed_quizzes' => $completedQuizzes,
            ],
        ];
    }
}
