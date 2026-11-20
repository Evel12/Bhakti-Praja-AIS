<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Services\AisAssessmentRosterBridge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    public function __construct(private readonly ?AisAssessmentRosterBridge $rosterBridge = null) {}
    public function index(Request $request)
    {
        $query = Subject::with('studyProgram')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('study_program_id')) {
            $query->where('study_program_id', $request->query('study_program_id'));
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
        $item = Subject::with(['studyProgram', 'curricula'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Mata pelajaran tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'study_program_id' => ['nullable', 'integer', 'exists:study_programs,id'],
            'code' => ['required', 'string', 'max:30', 'unique:subjects,code'],
            'name' => ['required', 'string', 'max:150'],
            'credit_hours' => ['nullable', 'integer', 'min:1', 'max:60'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'code.required' => 'Kode wajib diisi.',
            'code.unique' => 'Kode sudah digunakan.',
            'name.required' => 'Nama wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $status = $request->filled('status') ? $request->input('status') : 'active';
        $item = Subject::create($request->only(['study_program_id', 'code', 'name', 'credit_hours']) + [
            'status' => $status,
            'credit_hours' => $request->input('credit_hours'),
        ]);

        return response()->json(['success' => true, 'message' => 'Mata pelajaran berhasil dibuat.', 'data' => $item->load('studyProgram')], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Subject::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Mata pelajaran tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'study_program_id' => ['nullable', 'integer', 'exists:study_programs,id'],
            'code' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('subjects', 'code')->ignore($item->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'credit_hours' => ['nullable', 'integer', 'min:1', 'max:60'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $status = $request->filled('status') ? $request->input('status') : $item->status;
        $item->fill($request->only(['study_program_id', 'code', 'name', 'credit_hours']));
        $item->status = $status;
        $item->save();

        if ($item->wasChanged(['name', 'status'])) {
            ($this->rosterBridge ?? app(AisAssessmentRosterBridge::class))->syncSubject((int) $item->id);
        }

        return response()->json(['success' => true, 'message' => 'Mata pelajaran berhasil diperbarui.', 'data' => $item->load('studyProgram')]);
    }

    public function destroy(string $id)
    {
        $item = Subject::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Mata pelajaran tidak ditemukan.'], 404);
        }

        if (
            $item->curricula()->exists()
            || Schedule::where('subject_id', $item->id)->exists()
            || TeachingLoad::where('subject_id', $item->id)->exists()
        ) {
            return response()->json(['success' => false, 'message' => 'Mata pelajaran tidak dapat dihapus karena masih dipakai kurikulum, jadwal, atau beban mengajar.'], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Mata pelajaran berhasil dihapus.']);
    }
}
