<?php

namespace App\Http\Controllers;

use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SemesterController extends Controller
{
    private function format(Semester $item): array
    {
        $data = $item->toArray();
        $data['status'] = $item->is_active ? 'active' : 'inactive';

        return $data;
    }

    private function resolveActive(Request $request): ?bool
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

        return null;
    }

    public function index(Request $request)
    {
        $query = Semester::with('academicYear')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('period', 'like', "%{$search}%");
            });
        }

        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->query('academic_year_id'));
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
        $item = Semester::with('academicYear')->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Semester tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $this->format($item)]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'name' => ['required', 'string', 'max:50', Rule::unique('semesters', 'name')->where('academic_year_id', $request->input('academic_year_id'))],
            'period' => ['nullable', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'academic_year_id.required' => 'Tahun ajaran wajib dipilih.',
            'name.required' => 'Nama semester wajib diisi.',
            'name.unique' => 'Semester sudah ada pada tahun ajaran ini.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = DB::transaction(function () use ($request) {
            $active = $this->resolveActive($request) ?? false;

            if ($active) {
                Semester::where('is_active', true)->update(['is_active' => false]);
            }

            return Semester::create([
                'academic_year_id' => $request->input('academic_year_id'),
                'name' => $request->input('name'),
                'period' => $request->input('period'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'is_active' => $active,
            ]);
        });

        return response()->json(['success' => true, 'message' => 'Semester berhasil dibuat.', 'data' => $this->format($item)], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Semester::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Semester tidak ditemukan.'], 404);
        }

        $yearId = $request->input('academic_year_id', $item->academic_year_id);

        $validator = Validator::make($request->all(), [
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'name' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('semesters', 'name')->where('academic_year_id', $yearId)->ignore($item->id)],
            'period' => ['nullable', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($item, $request) {
            $item->fill($request->only(['academic_year_id', 'name', 'period', 'start_date', 'end_date']));

            $active = $this->resolveActive($request);

            if ($active === true) {
                Semester::where('id', '!=', $item->id)->where('is_active', true)->update(['is_active' => false]);
                $item->is_active = true;
            } elseif ($active === false) {
                $item->is_active = false;
            }

            $item->save();
        });

        return response()->json(['success' => true, 'message' => 'Semester berhasil diperbarui.', 'data' => $this->format($item->fresh()->load('academicYear'))]);
    }

    public function destroy(string $id)
    {
        $item = Semester::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Semester tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Semester berhasil dihapus.']);
    }
}
