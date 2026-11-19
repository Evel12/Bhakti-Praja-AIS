<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Models\ClassStudent;
use App\Models\Semester;
use App\Models\Student;
use App\Services\AisAssessmentRosterBridge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    private function normalizeLevelValues(string $level): array
    {
        $upper = strtoupper(trim($level));

        return match ($upper) {
            '10', 'X' => ['10', 'X'],
            '11', 'XI' => ['11', 'XI'],
            '12', 'XII' => ['12', 'XII'],
            default => [$level],
        };
    }

    private function format(Student $student): array
    {
        $student->loadMissing([
            'user',
            'classStudents' => fn ($q) => $q
                ->where('status', 'active')
                ->with(['classroom.studyProgram', 'academicYear', 'semester'])
                ->orderByDesc('academic_year_id')
                ->orderByDesc('id'),
        ]);

        $placements = $student->classStudents
            ->sortByDesc(fn ($p) => [
                $p->academicYear?->start_date?->format('Y-m-d') ?? '',
                $p->id,
            ]);
        $current = $placements->first();

        $data = $student->toArray();
        unset($data['class_students']);
        $data['classroom_id'] = $current?->classroom_id;
        $data['class_name'] = $current?->classroom?->name;
        $data['level'] = $current?->classroom?->level;
        $data['study_program_id'] = $current?->classroom?->study_program_id;
        $data['academic_year_id'] = $current?->academic_year_id;
        $data['academic_year_name'] = $current?->academicYear?->name;

        return $data;
    }

    public function index(Request $request)
    {
        $levels = $request->filled('level') ? $this->normalizeLevelValues((string) $request->query('level')) : null;
        $studyProgramId = $request->query('study_program_id');
        $academicYearId = $request->query('academic_year_id');
        $placementFilter = function ($placements) use ($levels, $studyProgramId, $academicYearId) {
            $placements->where('status', 'active');
            if ($academicYearId) {
                $placements->where('academic_year_id', $academicYearId);
            }
            if ($levels !== null || $studyProgramId) {
                $placements->whereHas('classroom', function ($classroom) use ($levels, $studyProgramId) {
                    if ($levels !== null) {
                        $classroom->whereIn('level', $levels);
                    }
                    if ($studyProgramId) {
                        $classroom->where('study_program_id', $studyProgramId);
                    }
                });
            }

            return $placements;
        };
        $query = Student::with([
            'user',
            'classStudents' => fn ($q) => $placementFilter($q)
                ->with(['classroom.studyProgram', 'academicYear']),
        ])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('student_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('level') || $request->filled('study_program_id') || $request->filled('academic_year_id')) {
            $query->whereHas('classStudents', $placementFilter);
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($page->items())->map(fn (Student $item) => $this->format($item))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = Student::with(['user', 'guardians'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $this->format($item)]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'student_number' => ['required', 'string', 'max:50', 'unique:students,student_number'],
            'name' => ['required', 'string', 'max:150'],
            'gender' => ['nullable', Rule::in(['L', 'P'])],
            'birth_date' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', 'unique:students,user_id'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'graduated', 'transferred'])],
        ], [
            'student_number.required' => 'Nomor siswa wajib diisi.',
            'student_number.unique' => 'Nomor siswa sudah digunakan.',
            'name.required' => 'Nama wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = Student::create($request->only(['student_number', 'name', 'gender', 'birth_date', 'address', 'user_id']) + [
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Siswa berhasil dibuat.', 'data' => $this->format($item)], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Student::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'student_number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('students', 'student_number')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'gender' => ['nullable', Rule::in(['L', 'P'])],
            'birth_date' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('students', 'user_id')->ignore($item->id)],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'graduated', 'transferred'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['student_number', 'name', 'gender', 'birth_date', 'address', 'user_id', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Siswa berhasil diperbarui.', 'data' => $this->format($item)]);
    }

    public function promote(Request $request, string $id)
    {
        $item = Student::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        if ($item->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya siswa berstatus aktif yang dapat dinaikkan kelas.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'integer', 'exists:semesters,id'],
            'classroom_id' => ['required', 'integer', 'exists:classrooms,id'],
        ], [
            'academic_year_id.required' => 'Tahun ajaran tujuan wajib dipilih.',
            'classroom_id.required' => 'Kelas tujuan wajib dipilih.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $yearId = (int) $request->input('academic_year_id');
        $semesterId = $request->input('semester_id') ? (int) $request->input('semester_id') : null;
        $classroomId = (int) $request->input('classroom_id');

        $classroom = Classroom::findOrFail($classroomId);
        if ((int) $classroom->academic_year_id !== $yearId) {
            return response()->json([
                'success' => false,
                'message' => 'Kelas tidak termasuk tahun ajaran tujuan.',
                'errors' => ['classroom_id' => ['Pilih kelas pada tahun ajaran yang sama.']],
            ], 422);
        }

        if ($semesterId) {
            $semester = Semester::find($semesterId);
            if (! $semester || (int) $semester->academic_year_id !== $yearId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validasi gagal.',
                    'errors' => ['semester_id' => ['Semester tidak termasuk tahun ajaran tujuan.']],
                ], 422);
            }
        }

        $conflict = ClassStudent::where('student_id', $item->id)
            ->where('academic_year_id', $yearId)
            ->where('status', 'active');
        if ($semesterId) {
            $conflict->where(fn ($q) => $q->where('semester_id', $semesterId)->orWhereNull('semester_id'));
        }
        if ($conflict->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa sudah memiliki penempatan aktif pada periode tujuan.',
                'errors' => ['classroom_id' => ['Siswa sudah terdaftar di kelas aktif pada periode tujuan.']],
            ], 422);
        }

        $placement = DB::transaction(function () use ($item, $classroomId, $yearId, $semesterId) {
            return ClassStudent::create([
                'student_id' => $item->id,
                'classroom_id' => $classroomId,
                'academic_year_id' => $yearId,
                'semester_id' => $semesterId,
                'status' => 'active',
                'assigned_at' => now()->format('Y-m-d'),
            ]);
        });

        app(AisAssessmentRosterBridge::class)->syncClassroom($classroomId);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil dinaikkan dan ditempatkan di kelas baru.',
            'data' => $this->format($item->fresh()),
            'placement' => $placement->load(['classroom', 'academicYear', 'semester']),
        ], 201);
    }

    public function destroy(string $id)
    {
        $item = Student::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        if ($item->classStudents()->exists() || $item->invoices()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa tidak dapat dihapus karena masih memiliki penempatan kelas atau data tagihan.',
            ], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Siswa berhasil dihapus.']);
    }
}
