<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationType;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\SchoolClass;
use App\Services\LmsNotificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AnnouncementController extends Controller
{
    public function __construct(private readonly LmsNotificationService $notifications) {}

    public function index(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('viewAny', [Announcement::class, $schoolClass]);

        $items = $schoolClass->announcements()
            ->with('author:id,name')
            ->orderByDesc('is_pinned')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Announcement $item): array => $this->serialize($item))
            ->values();

        return ApiResponse::success(['items' => $items], 'Announcements retrieved.');
    }

    public function store(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('create', [Announcement::class, $schoolClass]);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:10000'],
            'is_pinned' => ['sometimes', 'boolean'],
        ]);

        $announcement = new Announcement([
            'title' => trim((string) $validated['title']),
            'content' => trim((string) $validated['content']),
            'is_pinned' => (bool) ($validated['is_pinned'] ?? false),
        ]);
        $announcement->class_id = $schoolClass->id;
        $announcement->author_id = $request->user()->id;
        $announcement->save();

        $this->notifications->notifyClassStudents(
            $schoolClass,
            NotificationType::AnnouncementPosted,
            "Pengumuman baru: {$announcement->title}",
            $announcement->content,
            ['announcement_id' => $announcement->id],
        );

        return ApiResponse::success($this->serialize($announcement->load('author:id,name')), 'Announcement created.', 201);
    }

    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        Gate::authorize('delete', $announcement);
        $announcement->delete();

        return ApiResponse::success(message: 'Announcement deleted.');
    }

    private function serialize(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'class_id' => $announcement->class_id,
            'author_id' => $announcement->author_id,
            'author_name' => $announcement->author?->name,
            'title' => $announcement->title,
            'content' => $announcement->content,
            'is_pinned' => (bool) $announcement->is_pinned,
            'created_at' => $announcement->created_at?->toIso8601String(),
        ];
    }
}
