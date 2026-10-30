<?php

namespace App\Http\Controllers;

use App\Models\StudyProgram;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StudyProgramController extends Controller
{
    public function index(Request $request)
    {
        $query = StudyProgram::with('department')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->query('department_id'));
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
        $item = StudyProgram::with(['department', 'subjects', 'classrooms'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Konsentrasi keahlian tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'code' => ['required', 'string', 'max:30', 'unique:study_programs,code'],
            'name' => ['required', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'department_id.required' => 'Program keahlian wajib dipilih.',
            'department_id.exists' => 'Program keahlian tidak ditemukan.',
            'code.required' => 'Kode wajib diisi.',
            'code.unique' => 'Kode sudah digunakan.',
            'name.required' => 'Nama wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = StudyProgram::create($request->only(['department_id', 'code', 'name']) + [
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['success' => true, 'message' => 'Konsentrasi keahlian berhasil dibuat.', 'data' => $item->load('department')], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = StudyProgram::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Konsentrasi keahlian tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'department_id' => ['sometimes', 'required', 'integer', 'exists:departments,id'],
            'code' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('study_programs', 'code')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item->fill($request->only(['department_id', 'code', 'name', 'status']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Konsentrasi keahlian berhasil diperbarui.', 'data' => $item->load('department')]);
    }

    public function destroy(string $id)
    {
        $item = StudyProgram::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Konsentrasi keahlian tidak ditemukan.'], 404);
        }

        if ($item->subjects()->exists() || $item->classrooms()->exists() || $item->curricula()->exists()) {
            return response()->json(['success' => false, 'message' => 'Konsentrasi keahlian tidak dapat dihapus karena masih digunakan data akademik.'], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Konsentrasi keahlian berhasil dihapus.']);
    }
}
