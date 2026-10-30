<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Models\Semester;
use App\Models\TeachingLoad;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeachingLoadController extends Controller
{
    public function index(Request $request)
    {
        $query = TeachingLoad::with(['teacher', 'subject', 'classroom', 'semester.academicYear'])->orderBy('id');
        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(fn ($q) => $q->whereHas('teacher', fn ($t) => $t->where('name', 'like', "%{$search}%"))
                ->orWhereHas('subject', fn ($s) => $s->where('name', 'like', "%{$search}%"))
                ->orWhereHas('classroom', fn ($c) => $c->where('name', 'like', "%{$search}%")));
        }
        foreach (['teacher_id', 'semester_id', 'status'] as $field) {
            if ($request->filled($field)) $query->where($field, $request->query($field));
        }
        $page = $query->paginate(max(1, min(100, (int) $request->query('per_page', 15))));
        return response()->json(['success' => true, 'data' => $page->items(), 'meta' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(), 'total' => $page->total(),
        ]]);
    }

    private function validated(Request $request, ?TeachingLoad $item = null): array
    {
        $data = $request->validate([
            'teacher_id' => ['required', 'integer', 'exists:teachers,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'classroom_id' => ['required', 'integer', 'exists:classrooms,id'],
            'semester_id' => ['required', 'integer', 'exists:semesters,id'],
            'weekly_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);
        if (Classroom::findOrFail($data['classroom_id'])->academic_year_id != Semester::findOrFail($data['semester_id'])->academic_year_id) {
            throw ValidationException::withMessages(['semester_id' => 'Semester dan kelas harus berada pada tahun ajaran yang sama.']);
        }
        $duplicate = TeachingLoad::where(collect($data)->only(['teacher_id', 'subject_id', 'classroom_id', 'semester_id'])->all());
        if ($item) $duplicate->where('id', '!=', $item->id);
        if ($duplicate->exists()) throw ValidationException::withMessages(['teacher_id' => 'Beban mengajar ini sudah terdaftar.']);
        return $data;
    }

    public function store(Request $request)
    {
        $item = TeachingLoad::create($this->validated($request));
        return response()->json(['success' => true, 'data' => $item->load(['teacher', 'subject', 'classroom', 'semester'])], 201);
    }

    public function show(string $id)
    {
        return response()->json(['success' => true, 'data' => TeachingLoad::with(['teacher', 'subject', 'classroom', 'semester'])->findOrFail($id)]);
    }

    public function update(Request $request, string $id)
    {
        $item = TeachingLoad::findOrFail($id);
        $request->merge(array_merge($item->only($item->getFillable()), $request->all()));
        $item->update($this->validated($request, $item));
        return response()->json(['success' => true, 'data' => $item->load(['teacher', 'subject', 'classroom', 'semester'])]);
    }

    public function destroy(string $id)
    {
        TeachingLoad::findOrFail($id)->delete();
        return response()->json(['success' => true, 'message' => 'Beban mengajar berhasil dihapus.']);
    }
}
