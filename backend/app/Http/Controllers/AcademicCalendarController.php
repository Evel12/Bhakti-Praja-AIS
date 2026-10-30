<?php

namespace App\Http\Controllers;

use App\Models\AcademicCalendar;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AcademicCalendarController extends Controller
{
    public function index(Request $request)
    {
        $query = AcademicCalendar::with(['academicYear', 'semester'])->orderBy('start_date');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->query('academic_year_id'));
        }

        if ($request->filled('semester_id')) {
            $query->where('semester_id', $request->query('semester_id'));
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
        $item = AcademicCalendar::with(['academicYear', 'semester'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kegiatan tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    private function validateSemesterYear(?int $semesterId, int $yearId): ?string
    {
        if (! $semesterId) {
            return null;
        }

        $semester = Semester::find($semesterId);

        if (! $semester) {
            return 'Semester tidak ditemukan.';
        }

        if ((int) $semester->academic_year_id !== $yearId) {
            return 'Semester tidak termasuk tahun ajaran tersebut.';
        }

        return null;
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'integer', 'exists:semesters,id'],
            'name' => ['required', 'string', 'max:150'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string'],
        ], [
            'name.required' => 'Nama kegiatan wajib diisi.',
            'end_date.after_or_equal' => 'Tanggal selesai minimal sama dengan tanggal mulai.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $error = $this->validateSemesterYear(
            $request->input('semester_id') ? (int) $request->input('semester_id') : null,
            (int) $request->input('academic_year_id')
        );

        if ($error) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        $item = AcademicCalendar::create($request->only(['academic_year_id', 'semester_id', 'name', 'start_date', 'end_date', 'description']));

        return response()->json(['success' => true, 'message' => 'Kegiatan berhasil dibuat.', 'data' => $item->load(['academicYear', 'semester'])], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = AcademicCalendar::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kegiatan tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'integer', 'exists:semesters,id'],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date'],
            'description' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $start = $request->input('start_date', $item->start_date->format('Y-m-d'));
        $end = $request->input('end_date', $item->end_date->format('Y-m-d'));

        if (strtotime($end) < strtotime($start)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['end_date' => ['Tanggal selesai minimal sama dengan tanggal mulai.']]], 422);
        }

        $yearId = (int) $request->input('academic_year_id', $item->academic_year_id);
        $semesterId = $request->has('semester_id') && $request->input('semester_id')
            ? (int) $request->input('semester_id')
            : ($request->has('semester_id') ? null : $item->semester_id);

        $error = $this->validateSemesterYear($semesterId, $yearId);

        if ($error) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        $item->fill($request->only(['academic_year_id', 'semester_id', 'name', 'start_date', 'end_date', 'description']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Kegiatan berhasil diperbarui.', 'data' => $item->load(['academicYear', 'semester'])]);
    }

    public function destroy(string $id)
    {
        $item = AcademicCalendar::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kegiatan tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Kegiatan berhasil dihapus.']);
    }
}
