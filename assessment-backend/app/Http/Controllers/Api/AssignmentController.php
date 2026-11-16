<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationType;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\SchoolClass;
use App\Services\LmsNotificationService;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AssignmentController extends Controller
{
    public function __construct(private readonly LmsNotificationService $notifications) {}

    public function index(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('viewAny', [Assignment::class, $schoolClass]);

        $query = $schoolClass->assignments()->orderByDesc('id');
        if ($request->user()->role === Role::Student) {
            $query->where('status', 'published');
        }

        $items = $query->get()->map(fn (Assignment $assignment): array => $this->serialize($assignment))->values();

        return ApiResponse::success(['items' => $items], 'Assignments retrieved.');
    }

    public function show(Request $request, Assignment $assignment): JsonResponse
    {
        Gate::authorize('view', $assignment);

        return ApiResponse::success($this->serialize($assignment), 'Assignment retrieved.');
    }

    public function store(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('create', [Assignment::class, $schoolClass]);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'deadline' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string', 'in:draft,published,closed'],
        ]);

        $status = $validated['status'] ?? 'draft';
        $assignment = $schoolClass->assignments()->create([
            'title' => trim((string) $validated['title']),
            'description' => isset($validated['description']) ? trim((string) $validated['description']) : null,
            'deadline' => isset($validated['deadline']) ? CarbonImmutable::parse($validated['deadline'])->utc() : null,
            'status' => $status,
            'published_at' => $status === 'published' ? now() : null,
        ]);

        if ($status === 'published') {
            $this->notifications->notifyClassStudents(
                $schoolClass,
                NotificationType::AssignmentPublished,
                "Tugas baru: {$assignment->title}",
                "Tugas \"{$assignment->title}\" telah dipublish di kelas {$schoolClass->name}.",
                ['assignment_id' => $assignment->id],
            );
        }

        return ApiResponse::success($this->serialize($assignment), 'Assignment created.', 201);
    }

    public function update(Request $request, Assignment $assignment): JsonResponse
    {
        Gate::authorize('update', $assignment);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'deadline' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string', 'in:draft,published,closed'],
        ]);

        if (array_key_exists('title', $validated)) {
            $assignment->title = trim((string) $validated['title']);
        }
        if (array_key_exists('description', $validated)) {
            $assignment->description = $validated['description'] !== null ? trim((string) $validated['description']) : null;
        }
        if (array_key_exists('deadline', $validated)) {
            $assignment->deadline = $validated['deadline'] ? CarbonImmutable::parse($validated['deadline'])->utc() : null;
        }
        if (array_key_exists('status', $validated)) {
            $assignment->status = $validated['status'];
            if ($validated['status'] === 'published' && ! $assignment->published_at) {
                $assignment->published_at = now();
            }
        }
        $assignment->save();

        return ApiResponse::success($this->serialize($assignment), 'Assignment updated.');
    }

    public function publish(Request $request, Assignment $assignment): JsonResponse
    {
        Gate::authorize('update', $assignment);

        $assignment->status = 'published';
        $assignment->published_at = $assignment->published_at ?? now();
        $assignment->save();

        $this->notifications->notifyClassStudents(
            $assignment->schoolClass,
            NotificationType::AssignmentPublished,
            "Tugas baru: {$assignment->title}",
            "Tugas \"{$assignment->title}\" telah dipublish di kelas {$assignment->schoolClass->name}.",
            ['assignment_id' => $assignment->id],
        );

        return ApiResponse::success($this->serialize($assignment), 'Assignment published.');
    }

    public function destroy(Request $request, Assignment $assignment): JsonResponse
    {
        Gate::authorize('delete', $assignment);
        $assignment->delete();

        return ApiResponse::success(message: 'Assignment deleted.');
    }

    private function serialize(Assignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'class_id' => $assignment->class_id,
            'title' => $assignment->title,
            'description' => $assignment->description,
            'deadline' => $assignment->deadline?->toIso8601String(),
            'status' => $assignment->status,
            'published_at' => $assignment->published_at?->toIso8601String(),
            'created_at' => $assignment->created_at?->toIso8601String(),
        ];
    }
}
