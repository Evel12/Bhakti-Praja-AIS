<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ClassroomController extends Controller
{
    public function index(Request $request)
    {
        $query = Classroom::with(['studyProgram', 'academicYear', 'homeroomTeacher'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('level', 'like', "%{$search}%");
            });
        }

        if ($request->filled('study_program_id')) {
            $query->where('study_program_id', $request->query('study_program_id'));
        }

        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->query('academic_year_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = Classroom::with(['studyProgram', 'academicYear', 'homeroomTeacher'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:50'],
            'level' => ['required', 'string', 'max:10'],
            'study_program_id' => ['required', 'integer', 'exists:study_programs,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'homeroom_teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'name.required' => 'Nama kelas wajib diisi.',
            'level.required' => 'Tingkat wajib diisi.',
            'study_program_id.required' => 'Konsentrasi keahlian wajib dipilih.',
            'academic_year_id.required' => 'Tahun ajaran wajib dipilih.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        if (Classroom::where('name', $request->input('name'))->where('academic_year_id', $request->input('academic_year_id'))->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['name' => ['Nama kelas sudah ada pada tahun ajaran ini.']]], 422);
        }

        $item = Classroom::create($request->only(['name', 'level', 'study_program_id', 'academic_year_id', 'homeroom_teacher_id']) + [
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Kelas berhasil dibuat.', 'data' => $item->load(['studyProgram', 'academicYear', 'homeroomTeacher'])], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Classroom::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'max:50'],
            'level' => ['sometimes', 'required', 'string', 'max:10'],
            'study_program_id' => ['sometimes', 'required', 'integer', 'exists:study_programs,id'],
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'homeroom_teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $name = $request->input('name', $item->name);
        $yearId = $request->input('academic_year_id', $item->academic_year_id);

        if (Classroom::where('name', $name)->where('academic_year_id', $yearId)->where('id', '!=', $item->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['name' => ['Nama kelas sudah ada pada tahun ajaran ini.']]], 422);
        }

        $item->fill($request->only(['name', 'level', 'study_program_id', 'academic_year_id', 'homeroom_teacher_id', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Kelas berhasil diperbarui.', 'data' => $item->load(['studyProgram', 'academicYear', 'homeroomTeacher'])]);
    }

    public function destroy(string $id)
    {
        $item = Classroom::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Kelas berhasil dihapus.']);
    }
}
