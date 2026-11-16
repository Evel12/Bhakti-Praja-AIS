<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\AcademicProfiles;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $query = Student::with(['user', 'currentPlacement.classroom.studyProgram', 'currentPlacement.academicYear'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('student_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('level')) {
            $query->whereHas('currentPlacement.classroom', fn ($q) => $q->where('level', $request->query('level')));
        }
        if ($request->filled('study_program_id')) {
            $query->whereHas('currentPlacement.classroom', fn ($q) => $q->where('study_program_id', $request->query('study_program_id')));
        }
        if ($request->filled('academic_year_id')) {
            $query->whereHas('currentPlacement', fn ($q) => $q->where('academic_year_id', $request->query('academic_year_id')));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        $page->setCollection($page->getCollection()->map(fn (Student $student) => $this->present($student)));

        return response()->json([
            'success' => true,
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    private function present(Student $student): array
    {
        $data = $student->toArray();
        $placement = $student->currentPlacement;
        $data['level'] = $placement?->classroom?->level;
        $data['classroom_id'] = $placement?->classroom_id;
        $data['class_name'] = $placement?->classroom?->name;
        $data['study_program_id'] = $placement?->classroom?->study_program_id;
        $data['study_program_name'] = $placement?->classroom?->studyProgram?->name;
        $data['academic_year_id'] = $placement?->academic_year_id;
        $data['academic_year_name'] = $placement?->academicYear?->name;
        return $data;
    }

    public function show(string $id)
    {
        $item = Student::with(['user', 'guardians', 'currentPlacement'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $this->present($item)]);
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

        $validator->after(function ($validator) use ($request) {
            if ($request->filled('user_id')) {
                $role = \App\Models\User::find($request->input('user_id'))?->role?->name;
                if ($role !== 'murid') $validator->errors()->add('user_id', 'Pilih akun dengan peran murid.');
            }
        });

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = DB::transaction(function () use ($request) {
            $item = Student::create($request->only(['student_number', 'name', 'gender', 'birth_date', 'address', 'user_id']) + [
                'status' => $request->input('status', 'active'),
            ]);
            app(AcademicProfiles::class)->syncAccount($item);
            return $item;
        });

        return response()->json(['success' => true, 'message' => 'Siswa berhasil dibuat.', 'data' => $item], 201);
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

        $validator->after(function ($validator) use ($request) {
            if ($request->filled('user_id')) {
                $role = \App\Models\User::find($request->input('user_id'))?->role?->name;
                if ($role !== 'murid') $validator->errors()->add('user_id', 'Pilih akun dengan peran murid.');
            }
        });

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['student_number', 'name', 'gender', 'birth_date', 'address', 'user_id', 'status']));
        DB::transaction(function () use ($item) {
            $item->save();
            app(AcademicProfiles::class)->syncAccount($item);
        });

        return response()->json(['success' => true, 'message' => 'Siswa berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Student::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        if ($item->user_id) return response()->json(['success' => false, 'message' => 'Profil terhubung dengan akun. Nonaktifkan akun atau profil untuk mempertahankan riwayat akademik.'], 422);

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Siswa berhasil dihapus.']);
    }
}
