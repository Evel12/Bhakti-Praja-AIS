<?php

namespace App\Services;

use App\Models\ClassStudent;
use App\Models\TeachingLoad;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Synchronizes AIS teaching loads and student placements into shared Assessment tables when present. */
class AisAssessmentRosterBridge
{
    public function syncTeachingLoad(int $teachingLoadId): void
    {
        if (! $this->hasAssessmentTables()) {
            return;
        }

        $load = TeachingLoad::with(['teacher.user', 'subject', 'classroom'])->find($teachingLoadId);
        $this->syncTeachingLoadModel($load, $teachingLoadId);
    }

    private function syncTeachingLoadModel(?TeachingLoad $load, int $teachingLoadId): void
    {
        if (! $load || $load->status !== 'active') {
            $this->deactivateTeachingLoad($teachingLoadId);

            return;
        }

        $teacher = $load->teacher;
        $classroom = $load->classroom;
        $subject = $load->subject;

        if (
            ! $teacher
            || $teacher->status !== 'active'
            || ! $teacher->user_id
            || $teacher->user?->status !== 'active'
            || ! $classroom
            || $classroom->status !== 'active'
            || ! $subject
            || $subject->status !== 'active'
        ) {
            $this->deactivateTeachingLoad($teachingLoadId);

            return;
        }

        $classId = $this->upsertAssessmentClass($load, (int) $teacher->user_id, $subject->name.' · '.$classroom->name);
        $this->syncClassroomMembers($classId, (int) $classroom->id, (int) $classroom->academic_year_id, (int) $load->semester_id);
    }

    public function deactivateTeachingLoad(int $teachingLoadId): void
    {
        if (! $this->hasAssessmentTables()) {
            return;
        }

        $existing = DB::table('classes')->where('ais_teaching_load_id', $teachingLoadId)->first();
        if (! $existing) {
            return;
        }

        DB::table('class_members')->where('class_id', $existing->id)->delete();
    }

    public function removeTeachingLoad(int $teachingLoadId): void
    {
        if (! $this->hasAssessmentTables()) {
            return;
        }

        $existing = DB::table('classes')->where('ais_teaching_load_id', $teachingLoadId)->first();
        if (! $existing) {
            return;
        }

        DB::table('class_members')->where('class_id', $existing->id)->delete();

        $hasContent = (Schema::hasTable('quizzes') && DB::table('quizzes')->where('class_id', $existing->id)->exists())
            || (Schema::hasTable('modules') && DB::table('modules')->where('class_id', $existing->id)->exists())
            || (Schema::hasTable('assignments') && DB::table('assignments')->where('class_id', $existing->id)->exists())
            || (Schema::hasTable('announcements') && Schema::hasColumn('announcements', 'class_id') && DB::table('announcements')->where('class_id', $existing->id)->exists());

        if (! $hasContent && $existing->sync_source === 'ais') {
            DB::table('classes')->where('id', $existing->id)->delete();

            return;
        }

        DB::table('classes')->where('id', $existing->id)->update([
            'ais_teaching_load_id' => null,
            'updated_at' => now(),
        ]);
    }

    public function syncClassroom(int $classroomId): void
    {
        $this->syncLoadsWhere('classroom_id', $classroomId);
    }

    public function syncTeacher(int $teacherId): void
    {
        $this->syncLoadsWhere('teacher_id', $teacherId);
    }

    public function syncSubject(int $subjectId): void
    {
        $this->syncLoadsWhere('subject_id', $subjectId);
    }

    public function syncStudent(int $studentId): void
    {
        if (! $this->hasAssessmentTables()) {
            return;
        }

        $classroomIds = ClassStudent::query()
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->distinct()
            ->pluck('classroom_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        if ($classroomIds === []) {
            return;
        }

        $this->syncLoadsWhere('classroom_id', $classroomIds);
    }

    private function syncLoadsWhere(string $column, int|array $ids): void
    {
        if (! $this->hasAssessmentTables()) {
            return;
        }

        $query = TeachingLoad::with(['teacher.user', 'subject', 'classroom'])
            ->where('status', 'active');

        is_array($ids) ? $query->whereIn($column, $ids) : $query->where($column, $ids);

        foreach ($query->get() as $load) {
            $this->syncTeachingLoadModel($load, (int) $load->id);
        }
    }

    private function upsertAssessmentClass(TeachingLoad $load, int $teacherUserId, string $name): int
    {
        $now = now();
        $existing = DB::table('classes')->where('ais_teaching_load_id', $load->id)->first();

        if ($existing) {
            DB::table('classes')->where('id', $existing->id)->update([
                'teacher_id' => $teacherUserId,
                'name' => $name,
                'ais_classroom_id' => $load->classroom_id,
                'ais_subject_id' => $load->subject_id,
                'sync_source' => 'ais',
                'updated_at' => $now,
            ]);

            return (int) $existing->id;
        }

        $payload = [
            'teacher_id' => $teacherUserId,
            'name' => $name,
            'ais_teaching_load_id' => $load->id,
            'ais_classroom_id' => $load->classroom_id,
            'ais_subject_id' => $load->subject_id,
            'sync_source' => 'ais',
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if (Schema::hasColumn('classes', 'class_code')) {
            $payload['class_code'] = $this->generateUniqueClassCode();
        }

        return (int) DB::table('classes')->insertGetId($payload);
    }

    private function syncClassroomMembers(int $classId, int $classroomId, int $academicYearId, int $semesterId): void
    {
        $now = now();
        $targetStudentIds = DB::table('class_student as cs')
            ->join('students as st', 'st.id', '=', 'cs.student_id')
            ->join('users as u', 'u.id', '=', 'st.user_id')
            ->where('cs.classroom_id', $classroomId)
            ->where('cs.academic_year_id', $academicYearId)
            ->where('cs.status', 'active')
            ->where('st.status', 'active')
            ->where('u.status', 'active')
            ->where(fn ($q) => $q->whereNull('cs.semester_id')->orWhere('cs.semester_id', $semesterId))
            ->whereNotNull('st.user_id')
            ->pluck('st.user_id')
            ->map(static fn ($id): int => (int) $id)
            ->unique()
            ->values();

        $currentStudentIds = DB::table('class_members')
            ->where('class_id', $classId)
            ->pluck('student_id')
            ->map(static fn ($id): int => (int) $id);

        $toRemove = $currentStudentIds->diff($targetStudentIds);
        if ($toRemove->isNotEmpty()) {
            DB::table('class_members')
                ->where('class_id', $classId)
                ->whereIn('student_id', $toRemove->all())
                ->delete();
        }

        $toAdd = $targetStudentIds->diff($currentStudentIds);
        foreach ($toAdd as $studentUserId) {
            DB::table('class_members')->insert([
                'class_id' => $classId,
                'student_id' => $studentUserId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function generateUniqueClassCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $maxIndex = strlen($alphabet) - 1;

        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, $maxIndex)];
            }
        } while (DB::table('classes')->where('class_code', $code)->exists());

        return $code;
    }

    private function hasAssessmentTables(): bool
    {
        return Schema::hasTable('classes')
            && Schema::hasTable('class_members')
            && Schema::hasColumn('classes', 'ais_teaching_load_id')
            && Schema::hasColumn('classes', 'ais_classroom_id')
            && Schema::hasColumn('classes', 'ais_subject_id')
            && Schema::hasColumn('classes', 'sync_source');
    }
}
