<?php

namespace App\Http\Controllers;

use App\Models\ClassStudent;
use App\Models\Schedule;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    private function resolveClassroomId(Request $request, ?int $default = null): ?int
    {
        if ($request->filled('classroom_id')) {
            return (int) $request->input('classroom_id');
        }

        if ($request->filled('class_id')) {
            return (int) $request->input('class_id');
        }

        return $default;
    }

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

    private function findOverlap(array $data, ?int $excludeId = null): ?string
    {
        $base = Schedule::where('day', $data['day'])
            ->where('academic_year_id', $data['academic_year_id'])
            ->where('semester_id', $data['semester_id'])
            ->where('status', 'active')
            ->where('start_time', '<', $data['end_time'])
            ->where('end_time', '>', $data['start_time']);

        if ($excludeId) {
            $base->where('id', '!=', $excludeId);
        }

        if ((clone $base)->where('teacher_id', $data['teacher_id'])->exists()) {
            return 'Guru sudah memiliki jadwal lain yang bertabrakan pada hari dan jam tersebut.';
        }

        if ((clone $base)->where('classroom_id', $data['classroom_id'])->exists()) {
            return 'Kelas sudah memiliki jadwal lain yang bertabrakan pada hari dan jam tersebut.';
        }

        if (! empty($data['room_id']) && (clone $base)->where('room_id', $data['room_id'])->exists()) {
            return 'Ruang sudah digunakan jadwal lain yang bertabrakan pada hari dan jam tersebut.';
        }

        return null;
    }

    private function checkRoomCapacity(int $roomId, int $classroomId, int $yearId, int $semesterId): ?string
    {
        $room = \App\Models\Room::find($roomId);

        if (! $room) {
            return null;
        }

        $count = ClassStudent::where('classroom_id', $classroomId)
            ->where('academic_year_id', $yearId)
            ->where('semester_id', $semesterId)
            ->where('status', 'active')
            ->count();

        if ($count > 0 && $room->capacity < $count) {
            return "Kapasitas ruang ({$room->capacity}) lebih kecil dari jumlah siswa aktif di kelas ({$count}).";
        }

        return null;
    }

    public function index(Request $request)
    {
        $query = Schedule::with(['subject', 'classroom', 'teacher', 'room', 'semester'])->orderBy('id');

        if ($request->filled('day')) {
            $query->where('day', $request->query('day'));
        }

        $classroomId = $request->query('classroom_id', $request->query('class_id'));

        if ($classroomId) {
            $query->where('classroom_id', $classroomId);
        }

        foreach (['subject_id', 'teacher_id', 'room_id', 'semester_id', 'academic_year_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $page = $query->paginate($perPage);

        $items = collect($page->items())->map(function ($i) {
            $data = $i->toArray();
            $data['class_id'] = $i->classroom_id;

            return $data;
        })->values();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(string $id)
    {
        $item = Schedule::with(['subject', 'classroom', 'teacher', 'room', 'semester'])->find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $data = $item->toArray();
        $data['class_id'] = $item->classroom_id;

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'class_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'teacher_id' => ['required', 'integer', 'exists:teachers,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'semester_id' => ['required', 'integer', 'exists:semesters,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'day' => ['required', 'string', Rule::in(Schedule::DAYS)],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ], [
            'day.in' => 'Hari tidak valid. Gunakan monday s/d sunday.',
            'end_time.date_format' => 'Format jam selesai harus HH:MM.',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $classroomId = $this->resolveClassroomId($request);

        if (! $classroomId) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['classroom_id' => ['Kelas wajib dipilih.']]], 422);
        }

        if (strtotime($request->input('end_time')) <= strtotime($request->input('start_time'))) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['end_time' => ['Jam selesai harus setelah jam mulai.']]], 422);
        }

        $yearId = (int) $request->input('academic_year_id');
        $semesterId = (int) $request->input('semester_id');

        if (\App\Models\Classroom::findOrFail($classroomId)->academic_year_id != $yearId) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak termasuk tahun ajaran tersebut.', 'errors' => ['classroom_id' => ['Pilih kelas pada tahun ajaran yang sama.']]], 422);
        }

        if ($error = $this->semesterMatchesYear($semesterId, $yearId)) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        $data = [
            'subject_id' => (int) $request->input('subject_id'),
            'classroom_id' => $classroomId,
            'teacher_id' => (int) $request->input('teacher_id'),
            'room_id' => $request->input('room_id') ? (int) $request->input('room_id') : null,
            'semester_id' => $semesterId,
            'academic_year_id' => $yearId,
            'day' => $request->input('day'),
            'start_time' => $request->input('start_time'),
            'end_time' => $request->input('end_time'),
        ];

        $status = $request->input('status', 'active');

        if ($status === 'active' && ($conflict = $this->findOverlap($data))) {
            return response()->json(['success' => false, 'message' => $conflict, 'errors' => ['start_time' => [$conflict]]], 422);
        }

        if ($status === 'active' && $data['room_id'] && ($cap = $this->checkRoomCapacity($data['room_id'], $classroomId, $yearId, $semesterId))) {
            return response()->json(['success' => false, 'message' => $cap, 'errors' => ['room_id' => [$cap]]], 422);
        }

        $item = Schedule::create($data + ['status' => $status]);

        return response()->json(['success' => true, 'message' => 'Jadwal berhasil dibuat.', 'data' => $item->load(['subject', 'classroom', 'teacher'])], 201);
    }

    public function update(Request $request, string $id)
    {
        $item = Schedule::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'subject_id' => ['sometimes', 'required', 'integer', 'exists:subjects,id'],
            'classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'class_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            'teacher_id' => ['sometimes', 'required', 'integer', 'exists:teachers,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'semester_id' => ['sometimes', 'required', 'integer', 'exists:semesters,id'],
            'academic_year_id' => ['sometimes', 'required', 'integer', 'exists:academic_years,id'],
            'day' => ['sometimes', 'required', 'string', Rule::in(Schedule::DAYS)],
            'start_time' => ['sometimes', 'required', 'date_format:H:i'],
            'end_time' => ['sometimes', 'required', 'date_format:H:i'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => $validator->errors()], 422);
        }

        $data = [
            'subject_id' => (int) $request->input('subject_id', $item->subject_id),
            'classroom_id' => $this->resolveClassroomId($request, $item->classroom_id),
            'teacher_id' => (int) $request->input('teacher_id', $item->teacher_id),
            'room_id' => $request->has('room_id') ? ($request->input('room_id') ? (int) $request->input('room_id') : null) : $item->room_id,
            'semester_id' => (int) $request->input('semester_id', $item->semester_id),
            'academic_year_id' => (int) $request->input('academic_year_id', $item->academic_year_id),
            'day' => $request->input('day', $item->day),
            'start_time' => $request->input('start_time', substr($item->start_time, 0, 5)),
            'end_time' => $request->input('end_time', substr($item->end_time, 0, 5)),
        ];

        if (strtotime($data['end_time']) <= strtotime($data['start_time'])) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['end_time' => ['Jam selesai harus setelah jam mulai.']]], 422);
        }

        if (\App\Models\Classroom::findOrFail($data['classroom_id'])->academic_year_id != $data['academic_year_id']) {
            return response()->json(['success' => false, 'message' => 'Kelas tidak termasuk tahun ajaran tersebut.', 'errors' => ['classroom_id' => ['Pilih kelas pada tahun ajaran yang sama.']]], 422);
        }

        if ($error = $this->semesterMatchesYear($data['semester_id'], $data['academic_year_id'])) {
            return response()->json(['success' => false, 'message' => 'Validasi gagal.', 'errors' => ['semester_id' => [$error]]], 422);
        }

        $status = $request->input('status', $item->status);

        if ($status === 'active' && ($conflict = $this->findOverlap($data, $item->id))) {
            return response()->json(['success' => false, 'message' => $conflict, 'errors' => ['start_time' => [$conflict]]], 422);
        }

        if ($status === 'active' && $data['room_id'] && ($cap = $this->checkRoomCapacity($data['room_id'], $data['classroom_id'], $data['academic_year_id'], $data['semester_id']))) {
            return response()->json(['success' => false, 'message' => $cap, 'errors' => ['room_id' => [$cap]]], 422);
        }

        $item->fill($data + ['status' => $status]);
        $item->save();

        return response()->json(['success' => true, 'message' => 'Jadwal berhasil diperbarui.', 'data' => $item->load(['subject', 'classroom', 'teacher'])]);
    }

    public function destroy(string $id)
    {
        $item = Schedule::find($id);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Jadwal berhasil dihapus.']);
    }
}
