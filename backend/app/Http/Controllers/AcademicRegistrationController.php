<?php

namespace App\Http\Controllers;

use App\Models\AcademicRegistration;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AcademicRegistrationController extends Controller
{
    private function semesterMatchesYear(int $semesterId, int $yearId): ?string
    {
        $semester = Semester::find($semesterId);

        if (! $semester) {
            return 'Semester tidak ditemukan.';
        }

        if ((int) $semester->academic_year_id !== $yearId) {
            return 'Semester tidak termasuk tahun ajaran tersebut.';
        }

        return null;
    }

    public function index(Request $request)
    {
        $query = AcademicRegistration::with(['student', 'academicYear', 'semester'])->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('registration_number', 'like', "%{$search}%")
                    ->orWhereHas('student', function ($sq) use ($search) {
                        $sq->where('name', 'like', "%{$search}%")
                            ->orWhere('student_number', 'like', "%{$search}%");
                    });
            });
        }

        foreach (['student_id', 'academic_year_id', 'semester_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
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
        $item = AcademicRegistration::with(['student', 'academicYear', 'semester'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Registrasi tidak ditemukan.'], 404);
        }

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['required', 'integer', 'exists:semesters,id'],
            'registration_number' => ['nullable', 'string', 'max:50', 'unique:academic_registrations,registration_number'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'registered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ], [
            'student_id.required' => 'Siswa wajib dipilih.',
            'academic_year_id.required' => 'Tahun ajaran wajib dipilih.',
            'semester_id.required' => 'Semester wajib dipilih.',
            'registration_number.unique' => 'Nomor registrasi sudah digunakan.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $yearId = (int) $request->input('academic_year_id');
        $semesterId = (int) $request->input('semester_id');

        if ($error = $this->semesterMatchesYear($semesterId, $yearId)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        if (AcademicRegistration::where('student_id', $request->input('student_id'))->where('academic_year_id', $yearId)->where('semester_id', $semesterId)->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['student_id' => ['Siswa sudah terregistrasi pada tahun/semester ini.']]], 422);
        }

        $number = $request->input('registration_number');

        if (! $number) {
            do {
                $number = 'REG-' . date('Y') . '-' . strtoupper(Str::random(6));
            } while (AcademicRegistration::where('registration_number', $number)->exists());
        }

        $item = AcademicRegistration::create([
            'student_id' => $request->input('student_id'),
            'academic_year_id' => $yearId,
            'semester_id' => $semesterId,
            'registration_number' => $number,
            'status' => $request->input('status', 'pending'),
            'registered_at' => $request->input('registered_at', now()->format('Y-m-d')),
            'notes' => $request->input('notes'),
        ]);

        return response()->json(['success' => true, 'message' => 'Registrasi berhasil dibuat.', 'data' => $item->load(['student', 'semester'])], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = AcademicRegistration::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Registrasi tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'student_id' => ['sometimes', 'required', 'integer', 'exists:students,id'],
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'semester_id' => ['sometimes', 'required', 'integer', 'exists:semesters,id'],
            'registration_number' => ['nullable', 'string', 'max:50', Rule::unique('academic_registrations', 'registration_number')->ignore($item->id)],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'registered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $studentId = (int) $request->input('student_id', $item->student_id);
        $yearId = (int) $request->input('academic_year_id', $item->academic_year_id);
        $semesterId = (int) $request->input('semester_id', $item->semester_id);

        if ($error = $this->semesterMatchesYear($semesterId, $yearId)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        if (AcademicRegistration::where('student_id', $studentId)->where('academic_year_id', $yearId)->where('semester_id', $semesterId)->where('id', '!=', $item->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['student_id' => ['Siswa sudah terregistrasi pada tahun/semester ini.']]], 422);
        }

        $item->fill($request->only(['student_id', 'academic_year_id', 'semester_id', 'registration_number', 'status', 'registered_at', 'notes']));
        $item->save();

        return response()->json(['success' => true, 'message' => 'Registrasi berhasil diperbarui.', 'data' => $item->load(['student', 'semester'])]);
    }

    public function destroy(string $id)
    {
        $item = AcademicRegistration::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Registrasi tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Registrasi berhasil dihapus.']);
    }
}
