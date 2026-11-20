<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LmsNotification;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);

        $unreadOnly = $this->parseOptionalBoolean($request->query('unread_only'), 'unread_only');
        $perPage = (int) ($validated['per_page'] ?? 100);

        $baseQuery = $this->scopedNotificationsQuery($request);
        $unreadCount = (clone $baseQuery)->whereNull('read_at')->count();

        $query = (clone $baseQuery)->with('schoolClass:id,name')->orderByDesc('id');
        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        $paginator = $query->paginate($perPage);

        $items = $paginator->getCollection()->map(static fn (LmsNotification $n): array => [
            'id' => $n->id,
            'class_id' => $n->class_id,
            'class_name' => $n->schoolClass?->name,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'message' => $n->body ?? $n->getAttribute('message'),
            'data' => $n->data ?? [],
            'is_read' => $n->read_at !== null,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
        ])->values();

        return ApiResponse::success([
            'items' => $items,
            'unread_count' => $unreadCount,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
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
        $this->scopedNotificationsQuery($request)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return ApiResponse::success(message: 'All notifications marked as read.');
    }

    private function scopedNotificationsQuery(Request $request): HasMany
    {
        $query = $request->user()->lmsNotifications();
        if (Schema::hasColumn('notifications', 'type')) {
            $query->where(static fn ($q) => $q->whereNull('type')->orWhere('type', '!=', 'member4'));
        }

        return $query;
    }

    private function parseOptionalBoolean(mixed $rawValue, string $field): bool
    {
        if ($rawValue === null || $rawValue === '') {
            return false;
        }

        if (is_bool($rawValue)) {
            return $rawValue;
        }

        $parsed = filter_var($rawValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($parsed === null) {
            throw ValidationException::withMessages([
                $field => ["The {$field} field must be true or false."],
            ]);
        }

        return $parsed;
    }
}
