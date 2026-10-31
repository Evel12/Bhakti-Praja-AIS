<?php

namespace App\Services\Member4;

use App\Models\Schedule;
use Illuminate\Database\Eloquent\Builder;

class ParentScheduleReader
{
    public function forStudent(int $studentId): Builder
    {
        return Schedule::where('status', 'active')->whereExists(function ($q) use ($studentId) {
            $q->selectRaw('1')->from('class_student')
                ->whereColumn('class_student.classroom_id', 'schedules.classroom_id')
                ->whereColumn('class_student.academic_year_id', 'schedules.academic_year_id')
                ->where('class_student.student_id', $studentId)->where('class_student.status', 'active')
                ->where(fn ($semester) => $semester->whereNull('class_student.semester_id')->orWhereColumn('class_student.semester_id', 'schedules.semester_id'));
        });
    }
}
