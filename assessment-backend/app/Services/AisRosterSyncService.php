<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AisRosterSyncService
{
    public function syncAll(?int $teacherUserId = null): array
    {
        if (! $this->hasAisTables()) {
            return [
                'synced' => false,
                'reason' => 'ais_tables_unavailable',
                'classes_synced' => 0,
                'memberships_synced' => 0,
            ];
        }

        $query = DB::table('teaching_loads as tl')
            ->join('teachers as t', 't.id', '=', 'tl.teacher_id')
            ->join('subjects as s', 's.id', '=', 'tl.subject_id')
            ->join('classrooms as c', 'c.id', '=', 'tl.classroom_id')
            ->where('tl.status', 'active')
            ->where('t.status', 'active')
            ->where('c.status', 'active')
            ->whereNotNull('t.user_id')
            ->select([
                'tl.id as teaching_load_id',
                'tl.classroom_id',
                'tl.subject_id',
                'tl.semester_id',
                't.user_id as teacher_user_id',
                's.name as subject_name',
                'c.name as classroom_name',
                'c.academic_year_id',
            ]);

        if ($teacherUserId !== null) {
            $query->where('t.user_id', $teacherUserId);
        }

        $loads = $query->orderBy('tl.id')->get();
        $classesSynced = 0;
        $membershipsSynced = 0;
        $activeLoadIds = [];

        DB::transaction(function () use ($loads, $teacherUserId, &$classesSynced, &$membershipsSynced, &$activeLoadIds): void {
            foreach ($loads as $load) {
                $teacher = User::query()->find($load->teacher_user_id);
                if (! $teacher || ! $teacher->isActive()) {
                    continue;
                }

                if (! in_array($teacher->role, [Role::Teacher, Role::Admin], true)) {
                    continue;
                }

                $activeLoadIds[] = (int) $load->teaching_load_id;
                $className = trim($load->subject_name).' · '.trim($load->classroom_name);

                $schoolClass = SchoolClass::query()
                    ->where('ais_teaching_load_id', $load->teaching_load_id)
                    ->first();

                if (! $schoolClass) {
                    $schoolClass = new SchoolClass;
                }

                $schoolClass->forceFill([
                    'teacher_id' => $teacher->id,
                    'name' => $className,
                    'ais_teaching_load_id' => $load->teaching_load_id,
                    'ais_classroom_id' => $load->classroom_id,
                    'ais_subject_id' => $load->subject_id,
                    'sync_source' => 'ais',
                ])->save();

                $classesSynced++;

                $studentUserIds = DB::table('class_student as cs')
                    ->join('students as st', 'st.id', '=', 'cs.student_id')
                    ->join('users as u', 'u.id', '=', 'st.user_id')
                    ->where('cs.classroom_id', $load->classroom_id)
                    ->where('cs.academic_year_id', $load->academic_year_id)
                    ->where('cs.status', 'active')
                    ->where('st.status', 'active')
                    ->where(function ($q): void {
                        if (Schema::hasColumn('users', 'status')) {
                            $q->where('u.status', 'active')->orWhereNull('u.status');
                        }
                    })
                    ->where(function ($q) use ($load): void {
                        $q->whereNull('cs.semester_id')
                            ->orWhere('cs.semester_id', $load->semester_id);
                    })
                    ->whereNotNull('st.user_id')
                    ->pluck('st.user_id')
                    ->map(static fn ($id): int => (int) $id)
                    ->unique()
                    ->values()
                    ->all();

                $syncResult = $schoolClass->students()->sync($studentUserIds);
                $membershipsSynced += count($syncResult['attached']) + count($syncResult['detached']);
            }

            $staleClassesQuery = SchoolClass::query()->where('sync_source', 'ais');
            if ($teacherUserId !== null) {
                $staleClassesQuery->where('teacher_id', $teacherUserId);
            }
            if ($activeLoadIds !== []) {
                $staleClassesQuery->where(function ($q) use ($activeLoadIds): void {
                    $q->whereNull('ais_teaching_load_id')
                        ->orWhereNotIn('ais_teaching_load_id', $activeLoadIds);
                });
            }
            foreach ($staleClassesQuery->get() as $staleClass) {
                $detached = $staleClass->students()->detach();
                $membershipsSynced += (int) $detached;
            }
        });

        return [
            'synced' => true,
            'classes_synced' => $classesSynced,
            'memberships_synced' => $membershipsSynced,
            'teaching_load_ids' => $activeLoadIds,
        ];
    }

    private function hasAisTables(): bool
    {
        return Schema::hasTable('teaching_loads')
            && Schema::hasTable('teachers')
            && Schema::hasTable('subjects')
            && Schema::hasTable('classrooms')
            && Schema::hasTable('class_student')
            && Schema::hasTable('students');
    }
}
