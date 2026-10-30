<?php

namespace App\Http\Controllers;

use App\Models\ClassStudent;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ClassStudentController extends Controller
{
    private function resolveClassroomId(Request $request, ?int $default = null): ?int
    {
        if ($request->filled('classroom_id')) {
            return (int) $request->input('classroom_id');
        }

        if ($request->filled('class_id')) {
            return (int) $request->input('class_id');
        }

        return $default;
    }

    private function semesterMatchesYear(?int $semesterId, int $yearId): ?string
    {
        if (! $semesterId) {
            return null;
        }

        $semester = Semester::find($semesterId);

        if (! $semester) {
            return 'Semester tidak ditemukan.';
        }

        if ((int) $semester->academic_year_id !== $yearId) {
            return 'Semester tidak termasuk tahun ajaran tersebut.';
        }

        return null;
    }

    private function hasActiveConflict(int $studentId, int $yearId, ?int $semesterId, ?int $excludeId = null): bool
    {
        $query = ClassStudent::where('student_id', $studentId)
            ->where('academic_year_id', $yearId)
            ->where('status', 'active');

        if ($semesterId) {
            $query->where(fn ($q) => $q->where('semester_id', $semesterId)->orWhereNull('semester_id'));
        }

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    public function index(Request $request)
    {
        $query = ClassStudent::with(['classroom', 'student', 'academicYear', 'semester'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('student_number', 'like', "%{$search}%");
            });
        }

        $classroomId = $request->query('classroom_id', $request->query('class_id'));

        if ($classroomId) {
            $query->where('classroom_id', $classroomId);
        }

        foreach (['student_id', 'academic_year_id', 'semester_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        $items = collect($page->items())->map(function ($i) {
            $data = $i->toArray();
            $data['class_id'] = $i->classroom_id;

            return $data;
        })->values();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = ClassStudent::with(['classroom', 'student', 'academicYear', 'semester'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Penempatan tidak ditemukan.'], 404);
        }

        $data = $item->toArray();
        $data['class_id'] = $item->classroom_id;

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'class_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'integer', 'exists:semesters,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'assigned_at' => ['nullable', 'date'],
        ], [
            'student_id.required' => 'Siswa wajib dipilih.',
            'academic_year_id.required' => 'Tahun ajaran wajib dipilih.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $classroomId = $this->resolveClassroomId($request);

        if (! $classroomId) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['classroom_id' => ['Kelas wajib dipilih.']]], 422);
        }

        $semesterId = $request->input('semester_id') ? (int) $request->input('semester_id') : null;
        $yearId = (int) $request->input('academic_year_id');

        if (\App\Models\Classroom::findOrFail($classroomId)->academic_year_id != $yearId) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak termasuk tahun ajaran tersebut.', 'errors' => ['classroom_id' => ['Pilih kelas pada tahun ajaran yang sama.']]], 422);
        }

        if ($error = $this->semesterMatchesYear($semesterId, $yearId)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        $status = $request->input('status', 'active');

        if ($status === 'active' && $this->hasActiveConflict((int) $request->input('student_id'), $yearId, $semesterId)) {
            return response()->json(['success' => false, 'message' => 'Siswa sudah memiliki penempatan aktif pada tahun/semester ini.', 'errors' => ['student_id' => ['Siswa sudah memiliki penempatan aktif pada tahun/semester ini. Pindahkan/nonaktifkan dulu.']]], 422);
        }

        if (ClassStudent::where('student_id', $request->input('student_id'))->where('academic_year_id', $yearId)->where('classroom_id', $classroomId)->where(function ($q) use ($semesterId) {
            $semesterId ? $q->where('semester_id', $semesterId) : $q->whereNull('semester_id');
        })->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['classroom_id' => ['Siswa sudah terdaftar di kelas ini pada periode tersebut.']]], 422);
        }

        $item = ClassStudent::create([
            'classroom_id' => $classroomId,
            'student_id' => $request->input('student_id'),
            'academic_year_id' => $yearId,
            'semester_id' => $semesterId,
            'status' => $status,
            'assigned_at' => $request->input('assigned_at', now()->format('Y-m-d')),
        ]);

        return response()->json(['success' => true, 'message' => 'Penempatan berhasil dibuat.', 'data' => $item->load(['classroom', 'student'])], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = ClassStudent::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Penempatan tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'student_id' => ['sometimes', 'required', 'integer', 'exists:students,id'],
            'classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'class_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'integer', 'exists:semesters,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'assigned_at' => ['nullable', 'date'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $studentId = (int) $request->input('student_id', $item->student_id);
        $yearId = (int) $request->input('academic_year_id', $item->academic_year_id);
        $semesterId = $request->has('semester_id')
            ? ($request->input('semester_id') ? (int) $request->input('semester_id') : null)
            : $item->semester_id;
        $status = $request->input('status', $item->status);

        $classroomId = $this->resolveClassroomId($request, $item->classroom_id);
        if (\App\Models\Classroom::findOrFail($classroomId)->academic_year_id != $yearId) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak termasuk tahun ajaran tersebut.', 'errors' => ['classroom_id' => ['Pilih kelas pada tahun ajaran yang sama.']]], 422);
        }

        if ($error = $this->semesterMatchesYear($semesterId, $yearId)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        if ($status === 'active' && $this->hasActiveConflict($studentId, $yearId, $semesterId, $item->id)) {
            return response()->json(['success' => false, 'message' => 'Siswa sudah memiliki penempatan aktif lain pada periode ini.', 'errors' => ['student_id' => ['Konflik penempatan aktif.']]], 422);
        }

        $item->student_id = $studentId;
        $item->academic_year_id = $yearId;
        $item->semester_id = $semesterId;
        $item->status = $status;

        $newClassroom = $this->resolveClassroomId($request, $item->classroom_id);

        if ($newClassroom) {
            $item->classroom_id = $newClassroom;
        }

        if ($request->has('assigned_at')) {
            $item->assigned_at = $request->input('assigned_at');
        }

        $item->save();

        return response()->json(['success' => true, 'message' => 'Penempatan berhasil diperbarui.', 'data' => $item->load(['classroom', 'student'])]);
    }

    public function destroy(string $id)
    {
        $item = ClassStudent::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Penempatan tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Penempatan berhasil dihapus.']);
    }
}
