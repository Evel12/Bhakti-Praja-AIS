<?php

namespace App\Http\Controllers\Api;

use App\Enums\ModuleVisibility;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\SchoolClass;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ClassModuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $user->role === Role::Teacher
            ? $user->ownedClasses()
            : $user->classes();

        $classes = $query
            ->withCount(['students', 'quizzes', 'modules'])
            ->orderBy('classes.id')
            ->get()
            ->map(static fn (SchoolClass $schoolClass): array => [
                'id' => $schoolClass->id,
                'name' => $schoolClass->name,
                'teacher_id' => $schoolClass->teacher_id,
                'students_count' => $schoolClass->students_count,
                'quizzes_count' => $schoolClass->quizzes_count,
                'modules_count' => $schoolClass->modules_count,
            ])
            ->values();

        return ApiResponse::success(['items' => $classes], 'Classes retrieved.');
    }

    public function modules(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('view', $schoolClass);

        $modulesQuery = $schoolClass->modules()->orderByDesc('id');
        if ($request->user()->role === Role::Student) {
            $modulesQuery->where('visibility', ModuleVisibility::Public);
        }

        $items = $modulesQuery->get()->map(static fn (Module $module): array => [
            'id' => $module->id,
            'class_id' => $module->class_id,
            'file_name' => $module->file_name,
            'visibility' => $module->visibility->value,
            'created_at' => $module->created_at?->toIso8601String(),
        ])->values();

        return ApiResponse::success(['items' => $items], 'Modules retrieved.');
    }

    public function storeModule(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('update', $schoolClass);

        $validated = $request->validate([
            'file' => ['sometimes', 'file', 'mimes:pdf', 'max:20480'],
            'file_name' => ['required_without:file', 'string', 'max:255'],
            'visibility' => ['sometimes', 'string', 'in:private,public'],
        ]);

        $disk = config('quiz_generation.disk', 'local');
        $storagePath = 'modules/module-'.Str::uuid().'.pdf';

        if ($request->hasFile('file')) {
            $uploaded = $request->file('file');
            $fileName = $uploaded->getClientOriginalName() ?: 'module.pdf';
            Storage::disk($disk)->put($storagePath, (string) file_get_contents($uploaded->getRealPath()));
        } else {
            $rawName = trim((string) $validated['file_name']);
            $fileName = str_ends_with(strtolower($rawName), '.pdf') ? $rawName : ($rawName.'.pdf');
            Storage::disk($disk)->put($storagePath, "%PDF-1.4\nEXAMNIA Module: ".$fileName."\n%%EOF");
        }

        $module = new Module([
            'file_name' => $fileName,
            'path' => $storagePath,
            'visibility' => $validated['visibility'] ?? ModuleVisibility::Public->value,
        ]);
        $module->class_id = $schoolClass->id;
        $module->save();

        return ApiResponse::created([
            'id' => $module->id,
            'class_id' => $module->class_id,
            'file_name' => $module->file_name,
            'visibility' => $module->visibility->value,
            'created_at' => $module->created_at?->toIso8601String(),
        ], 'Module uploaded.');
    }
}
