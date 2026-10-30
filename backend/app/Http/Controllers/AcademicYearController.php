<?php

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AcademicYearController extends Controller
{
    private function format(AcademicYear $item): array
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
        $query = AcademicYear::orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where('name', 'like', "%{$search}%");
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
        $item = AcademicYear::with('semesters')->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Tahun ajaran tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $this->format($item)]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:20', 'unique:academic_years,name'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'name.required' => 'Nama tahun ajaran wajib diisi.',
            'name.unique' => 'Nama tahun ajaran sudah digunakan.',
            'end_date.after' => 'Tanggal selesai harus setelah tanggal mulai.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $item = DB::transaction(function () use ($request) {
            $active = $this->resolveActive($request) ?? false;

            if ($active) {
                AcademicYear::where('is_active', true)->update(['is_active' => false]);
            }

            return AcademicYear::create([
                'name' => $request->input('name'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'is_active' => $active,
            ]);
        });

        return response()->json(['success' => true, 'message' => 'Tahun ajaran berhasil dibuat.', 'data' => $this->format($item)], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = AcademicYear::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Tahun ajaran tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('academic_years', 'name')->ignore($item->id)],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $start = $request->input('start_date', $item->start_date->format('Y-m-d'));
        $end = $request->input('end_date', $item->end_date->format('Y-m-d'));

        if (strtotime($end) <= strtotime($start)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['end_date' => ['Tanggal selesai harus setelah tanggal mulai.']]], 422);
        }

        DB::transaction(function () use ($item, $request) {
            $item->fill($request->only(['name', 'start_date', 'end_date']));

            $active = $this->resolveActive($request);

            if ($active === true) {
                AcademicYear::where('id', '!=', $item->id)->where('is_active', true)->update(['is_active' => false]);
                $item->is_active = true;
            } elseif ($active === false) {
                $item->is_active = false;
            }

            $item->save();
        });

        return response()->json(['success' => true, 'message' => 'Tahun ajaran berhasil diperbarui.', 'data' => $this->format($item->fresh())]);
    }

    public function destroy(string $id)
    {
        $item = AcademicYear::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Tahun ajaran tidak ditemukan.'], 404);
        }

        if ($item->semesters()->exists() || $item->classrooms()->exists()) {
            return response()->json(['success' => false, 'message' => 'Tahun ajaran tidak dapat dihapus karena masih digunakan.'], 422);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Tahun ajaran berhasil dihapus.']);
    }
}
