<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LmsNotification;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->lmsNotifications()
            ->where('type', '!=', 'member4')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        $items = $notifications->map(static fn (LmsNotification $n): array => [
            'id' => $n->id,
            'class_id' => $n->class_id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'data' => $n->data ?? [],
            'is_read' => $n->read_at !== null,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
        ])->values();

        return ApiResponse::success([
            'items' => $items,
            'unread_count' => $items->where('is_read', false)->count(),
        ], 'Notifications retrieved.');
    }

    public function markAsRead(Request $request, LmsNotification $notification): JsonResponse
    {
        Gate::authorize('update', $notification);

        if (! $notification->read_at) {
            $notification->read_at = now();
            $notification->save();
        }

        return ApiResponse::success([
            'id' => $notification->id,
            'is_read' => true,
            'read_at' => $notification->read_at?->toIso8601String(),
        ], 'Notification marked as read.');
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()
            ->lmsNotifications()
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return ApiResponse::success(message: 'All notifications marked as read.');
    }
}
