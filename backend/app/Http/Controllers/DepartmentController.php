<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Department::withCount('studyPrograms')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
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
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function show(string $id)
    {
        $item = Department::with('studyPrograms')->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Program keahlian tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', 'max:20', 'unique:departments,code'],
            'name' => ['required', 'string', 'max:150', 'unique:departments,name'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'code.required' => 'Kode wajib diisi.',
            'code.unique' => 'Kode sudah digunakan.',
            'name.required' => 'Nama wajib diisi.',
            'name.unique' => 'Nama sudah digunakan.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = Department::create([
            'code' => $request->input('code'),
            'name' => $request->input('name'),
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Program keahlian berhasil dibuat.', 'data' => $item], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Department::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Program keahlian tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('departments', 'code')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150', Rule::unique('departments', 'name')->ignore($item->id)],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['code', 'name', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Program keahlian berhasil diperbarui.', 'data' => $item]);
    }

    public function destroy(string $id)
    {
        $item = Department::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Program keahlian tidak ditemukan.'], 404);
        }

        if ($item->studyPrograms()->exists()) {
            return response()->json(['success' => false, 'message' => 'Program keahlian tidak dapat dihapus karena masih memiliki konsentrasi keahlian.'], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Program keahlian berhasil dihapus.']);
    }
}
