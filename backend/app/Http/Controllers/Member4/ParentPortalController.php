<?php

namespace App\Http\Controllers\Member4;

use App\Models\ClassStudent;
use App\Services\Member4\FinanceSummary;
use App\Services\Member4\ParentAcademicData;
use App\Services\Member4\ParentScheduleReader;
use App\Services\Member4\StudentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ParentPortalController extends Member4Controller
{
    public function __construct(private StudentAccess $access, private ParentScheduleReader $scheduleReader, private ParentAcademicData $academic) {}

    private function children(Request $request)
    {
        return $this->access->students($request->user())->select('students.id', 'name', 'student_number', 'gender', 'birth_date', 'status');
    }

    private function placements(int $studentId)
    {
        return ClassStudent::where('student_id', $studentId)->where('status', 'active')
            ->select('id', 'classroom_id', 'academic_year_id', 'semester_id')
            ->with(['classroom:id,name,level,study_program_id', 'classroom.studyProgram:id,name', 'academicYear:id,name', 'semester:id,name'])
            ->orderByDesc('academic_year_id')->orderByDesc('semester_id')->get();
    }

    public function index(Request $request)
    {
        return $this->listing($this->children($request)->orderBy('name')->orderBy('id'), $request);
    }

    public function show(Request $request, string $student)
    {
        $child = $this->children($request)->find($student);
        if (! $child) return $this->missing();
        return response()->json(['success' => true, 'data' => $child->toArray() + ['placements' => $this->placements($child->id)]]);
    }

    public function dashboard(Request $request, string $student, FinanceSummary $finance)
    {
        $child = $this->children($request)->find($student);
        if (! $child) return $this->missing();
        return response()->json(['success' => true, 'data' => [
            'student' => $child, 'placements' => $this->placements($child->id),
            'schedule_count' => $this->scheduleReader->forStudent($child->id)->count(),
            'finance' => $finance->forUser($request->user(), $child->id),
            'academic' => $this->academic->overview(), 'as_of' => now(config('member4_finance.timezone'))->toIso8601String(),
        ]]);
    }

    public function academic(Request $request, string $student, string $section)
    {
        if (! $this->children($request)->whereKey($student)->exists()) return $this->missing();
        return response()->json(['success' => true] + $this->academic->read($section));
    }

    public function schedules(Request $request, string $student)
    {
        $child = $this->access->students($request->user())->find($student);
        if (! $child) return $this->missing();
        $validator = Validator::make($request->query(), [
            'academic_year_id' => ['nullable', 'integer', 'min:1'],
            'semester_id' => ['nullable', 'integer', 'min:1'],
        ], $this->messages(['integer' => 'Periode akademik harus berupa nomor yang valid.']));
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $query = $this->scheduleReader->forStudent($child->id)->with(['subject:id,name,code', 'teacher:id,name', 'room:id,name,code', 'classroom:id,name', 'academicYear:id,name', 'semester:id,name']);
        foreach (['academic_year_id', 'semester_id'] as $field) {
            if ($request->filled($field)) $query->where($field, $request->query($field));
        }
        return $this->listing($query->orderByRaw("CASE day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 ELSE 8 END")->orderBy('start_time')->orderBy('id'), $request);
    }
}
