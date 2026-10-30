<?php

namespace App\Http\Controllers;

use App\Models\Teacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class TeacherController extends Controller
{
    public function index(Request $request)
    {
        $query = Teacher::with('user')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('teacher_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
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
        $item = Teacher::with(['user', 'homeroomClasses'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Guru tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'teacher_number' => ['required', 'string', 'max:50', 'unique:teachers,teacher_number'],
            'name' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150', 'unique:teachers,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', 'unique:teachers,user_id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'teacher_number.required' => 'Nomor guru/NIP wajib diisi.',
            'teacher_number.unique' => 'Nomor guru sudah digunakan.',
            'name.required' => 'Nama wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = Teacher::create($request->only(['teacher_number', 'name', 'email', 'phone', 'user_id']) + [
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Guru berhasil dibuat.', 'data' => $item], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Teacher::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Guru tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'teacher_number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('teachers', 'teacher_number')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150', Rule::unique('teachers', 'email')->ignore($item->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('teachers', 'user_id')->ignore($item->id)],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['teacher_number', 'name', 'email', 'phone', 'user_id', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Guru berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Teacher::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Guru tidak ditemukan.'], 404);
        }

        if ($item->homeroomClasses()->exists()) {
            return response()->json(['success' => false, 'message' => 'Guru tidak dapat dihapus karena masih menjadi wali kelas.'], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Guru berhasil dihapus.']);
    }
}
