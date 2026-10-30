<?php

namespace App\Http\Controllers;

use App\Models\Curriculum;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CurriculumController extends Controller
{
    private function format(Curriculum $item): array
    {
        $data = $item->toArray();
        $data['period'] = $item->year;
        $data['status'] = $item->is_active ? 'active' : 'inactive';

        return $data;
    }

    public function index(Request $request)
    {
        $query = Curriculum::with(['studyProgram', 'subjects'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('year', 'like', "%{$search}%");
            });
        }

        if ($request->filled('study_program_id')) {
            $query->where('study_program_id', $request->query('study_program_id'));
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->query('status') === 'active');
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($page->items())->map(fn ($i) => $this->format($i))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = Curriculum::with(['studyProgram', 'subjects'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kurikulum tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $this->format($item)]);
    }

    private function resolveYear(Request $request, ?string $default = null): ?string
    {
        if ($request->filled('year')) {
            return (string) $request->input('year');
        }

        if ($request->filled('period')) {
            return (string) $request->input('period');
        }

        return $default;
    }

    private function resolveActive(Request $request, ?bool $default = null): ?bool
    {
        if ($request->has('is_active')) {
            return (bool) $request->input('is_active');
        }

        if ($request->input('status') === 'active') {
            return true;
        }

        if ($request->input('status') === 'inactive') {
            return false;
        }

        return $default;
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'study_program_id' => ['required', 'integer', 'exists:study_programs,id'],
            'name' => ['required', 'string', 'max:150'],
            'year' => ['nullable', 'string', 'max:10'],
            'period' => ['nullable', 'string', 'max:10'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'subject_ids' => ['nullable', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ], [
            'study_program_id.required' => 'Konsentrasi keahlian wajib dipilih.',
            'name.required' => 'Nama kurikulum wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $year = $this->resolveYear($request);

        if (! $year) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['year' => ['Tahun/periode wajib diisi.']]], 422);
        }

        if (Curriculum::where('study_program_id', $request->input('study_program_id'))->where('name', $request->input('name'))->where('year', $year)->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['name' => ['Kurikulum sudah ada pada konsentrasi keahlian dan tahun ini.']]], 422);
        }

        $item = DB::transaction(function () use ($request, $year) {
            $active = $this->resolveActive($request, true) ?? true;

            $curriculum = Curriculum::create([
                'study_program_id' => $request->input('study_program_id'),
                'name' => $request->input('name'),
                'year' => $year,
                'is_active' => $active,
                'source_url' => $request->input('source_url'),
                'notes' => $request->input('notes'),
            ]);

            if ($request->filled('subject_ids')) {
                $curriculum->subjects()->sync($request->input('subject_ids'));
            }

            return $curriculum;
        });

        return response()->json(['success' => true, 'message' => 'Kurikulum berhasil dibuat.', 'data' => $this->format($item->load(['studyProgram', 'subjects']))], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Curriculum::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kurikulum tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'study_program_id' => ['sometimes', 'required', 'integer', 'exists:study_programs,id'],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'year' => ['nullable', 'string', 'max:10'],
            'period' => ['nullable', 'string', 'max:10'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'subject_ids' => ['nullable', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $year = $this->resolveYear($request, $item->year);
        $programId = $request->input('study_program_id', $item->study_program_id);
        $name = $request->input('name', $item->name);

        if (Curriculum::where('study_program_id', $programId)->where('name', $name)->where('year', $year)->where('id', '!=', $item->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['name' => ['Kurikulum sudah ada pada konsentrasi keahlian dan tahun ini.']]], 422);
        }

        DB::transaction(function () use ($item, $request, $year, $programId, $name) {
            $item->study_program_id = $programId;
            $item->name = $name;
            $item->year = $year;
            $item->fill($request->only(['source_url', 'notes']));

            $active = $this->resolveActive($request);

            if ($active !== null) {
                $item->is_active = $active;
            }

            $item->save();

            if ($request->has('subject_ids')) {
                $item->subjects()->sync($request->input('subject_ids') ?? []);
            }
        });

        return response()->json(['success' => true, 'message' => 'Kurikulum berhasil diperbarui.', 'data' => $this->format($item->fresh()->load(['studyProgram', 'subjects']))]);
    }

    public function destroy(string $id)
    {
        $item = Curriculum::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kurikulum tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Kurikulum berhasil dihapus.']);
    }
}
