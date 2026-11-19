<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Services\AisGradebookExporter;
use App\Services\AisRosterSyncService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class IntegrationSyncController extends Controller
{
    public function syncRoster(AuthenticatedRequest $request, AisRosterSyncService $sync): JsonResponse
    {
        $user = $request->user();
        $teacherUserId = $user->role === Role::Admin ? null : $user->id;
        $result = $sync->syncAll($teacherUserId);

        return ApiResponse::success($result, 'AIS roster synchronization completed.');
    }

    public function exportGrades(AuthenticatedRequest $request, AisGradebookExporter $exporter): JsonResponse
    {
        $count = $exporter->exportAllReleased();

        return ApiResponse::success(['exported_count' => $count], 'Released grades exported to AIS.');
    }
}
