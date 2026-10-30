<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $query = Student::with('user')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('student_number', 'like', "%{$search}%");
            });
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
        $item = Student::with(['user', 'guardians'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
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

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['student_number', 'name', 'gender', 'birth_date', 'address', 'user_id', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Siswa berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Student::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Siswa tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Siswa berhasil dihapus.']);
    }
}
