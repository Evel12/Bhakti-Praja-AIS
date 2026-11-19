<?php

namespace App\Http\Controllers;

use App\Models\AisAssessmentGrade;
use App\Models\Teacher;
use App\Models\TeachingLoad;
use Illuminate\Http\Request;

class AssessmentGradeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user()->load('role');
        $role = $user->role?->name;

        $query = AisAssessmentGrade::query()
            ->with(['student:id,name,student_number', 'classroom:id,name,level', 'subject:id,code,name'])
            ->orderByDesc('released_at')
            ->orderByDesc('id');

        if ($role === 'guru') {
            $teacherId = Teacher::query()->where('user_id', $user->id)->value('id');
            if (! $teacherId) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 0, 'last_page' => 1],
                ]);
            }

            $loads = TeachingLoad::query()
                ->where('teacher_id', $teacherId)
                ->where('status', 'active')
                ->get(['classroom_id', 'subject_id']);

            if ($loads->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 0, 'last_page' => 1],
                ]);
            }

            $query->where(function ($outer) use ($loads): void {
                foreach ($loads as $load) {
                    $outer->orWhere(function ($pair) use ($load): void {
                        $pair->where('classroom_id', $load->classroom_id)
                            ->where('subject_id', $load->subject_id);
                    });
                }
            });
        }

        foreach (['classroom_id', 'subject_id', 'student_id', 'source_type'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
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
}
