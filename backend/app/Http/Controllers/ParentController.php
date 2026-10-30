<?php

namespace App\Http\Controllers;

use App\Models\Guardian;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ParentController extends Controller
{
    public function index(Request $request)
    {
        $query = Guardian::with(['students:id,name,student_number'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
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
        $item = Guardian::with('students')->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Wali murid tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    private function syncStudents(Guardian $parent, Request $request): void
    {
        if (! $request->has('student_ids')) {
            return;
        }

        $ids = $request->input('student_ids', []);
        $relationship = $request->input('relationship', 'wali');

        if (! is_array($ids)) {
            $ids = [];
        }

        $sync = [];

        foreach ($ids as $sid) {
            $sync[(int) $sid] = ['relationship' => $relationship];
        }

        $parent->students()->sync($sync);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150', 'unique:parents,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
            'occupation' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', 'unique:parents,user_id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'student_ids' => ['nullable', 'array'],
            'student_ids.*' => ['integer', 'exists:students,id'],
            'relationship' => ['nullable', 'string', 'max:50'],
        ], [
            'name.required' => 'Nama wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = DB::transaction(function () use ($request) {
            $parent = Guardian::create($request->only(['name', 'email', 'phone', 'address', 'occupation', 'user_id']) + [
                'status' => $request->input('status', 'active'),
            ]);

            $this->syncStudents($parent, $request);

            return $parent;
        });

        return response()->json(['success' => true, 'message' => 'Wali murid berhasil dibuat.', 'data' => $item->load('students')], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Guardian::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Wali murid tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150', Rule::unique('parents', 'email')->ignore($item->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
            'occupation' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('parents', 'user_id')->ignore($item->id)],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'student_ids' => ['nullable', 'array'],
            'student_ids.*' => ['integer', 'exists:students,id'],
            'relationship' => ['nullable', 'string', 'max:50'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($item, $request) {
            $item->fill($request->only(['name', 'email', 'phone', 'address', 'occupation', 'user_id', 'status']));
            $item->save();
            $this->syncStudents($item, $request);
        });

        return response()->json(['success' => true, 'message' => 'Wali murid berhasil diperbarui.', 'data' => $item->load('students')]);
    }

    public function destroy(string $id)
    {
        $item = Guardian::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Wali murid tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Wali murid berhasil dihapus.']);
    }
}
