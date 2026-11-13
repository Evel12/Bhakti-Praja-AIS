<?php

namespace App\Http\Controllers\Api;

use App\Enums\ModuleVisibility;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\ModuleRead;
use App\Models\SchoolClass;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ClassModuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $user->role === Role::Teacher
            ? $user->ownedClasses()
            : $user->classes();

        $classes = $query
            ->with('teacher:id,name')
            ->withCount([
                'students',
                'quizzes',
                'modules',
                'modules as public_modules_count' => fn ($q) => $q->where('visibility', ModuleVisibility::Public),
                'assignments',
                'announcements',
            ])
            ->orderBy('classes.id')
            ->get();

        $readCountsByClass = [];
        if ($user->role === Role::Student && $classes->isNotEmpty()) {
            $readCountsByClass = ModuleRead::query()
                ->join('modules', 'modules.id', '=', 'module_reads.module_id')
                ->where('module_reads.student_id', $user->id)
                ->where('modules.visibility', ModuleVisibility::Public->value)
                ->whereIn('modules.class_id', $classes->pluck('id'))
                ->selectRaw('modules.class_id, count(*) as read_count')
                ->groupBy('modules.class_id')
                ->pluck('read_count', 'modules.class_id')
                ->all();
        }

        $items = $classes->map(function (SchoolClass $schoolClass) use ($user, $readCountsByClass): array {
            $payload = [
                'id' => $schoolClass->id,
                'name' => $schoolClass->name,
                'description' => $schoolClass->description,
                'class_code' => $schoolClass->class_code,
                'teacher_id' => $schoolClass->teacher_id,
                'teacher_name' => $schoolClass->teacher?->name,
                'students_count' => $schoolClass->students_count,
                'quizzes_count' => $schoolClass->quizzes_count,
                'modules_count' => $schoolClass->modules_count,
                'public_modules_count' => $schoolClass->public_modules_count,
                'assignments_count' => $schoolClass->assignments_count,
                'announcements_count' => $schoolClass->announcements_count,
                'created_at' => $schoolClass->created_at?->toIso8601String(),
            ];

            if ($user->role === Role::Student) {
                $totalPublic = (int) $schoolClass->public_modules_count;
                $readCount = (int) ($readCountsByClass[$schoolClass->id] ?? 0);
                $payload['read_modules_count'] = $readCount;
                $payload['progress_percentage'] = $totalPublic > 0 ? round(($readCount / $totalPublic) * 100, 2) : 0.0;
            }

            return $payload;
        })->values();

        return ApiResponse::success(['items' => $items], 'Classes retrieved.');
    }

    public function storeClass(Request $request): JsonResponse
    {
        Gate::authorize('create', SchoolClass::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $schoolClass = new SchoolClass([
            'name' => trim((string) $validated['name']),
            'description' => isset($validated['description']) ? trim((string) $validated['description']) : null,
        ]);
        $schoolClass->teacher_id = $request->user()->id;
        $schoolClass->class_code = SchoolClass::generateUniqueClassCode();
        $schoolClass->save();

        logSystemActivity('class.created', $request->user()->id, [
            'entity_type' => 'class',
            'entity_id' => $schoolClass->id,
        ]);

        return ApiResponse::success($this->serializeClass($schoolClass->load('teacher:id,name')), 'Class created.', 201);
    }

    public function showClass(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('view', $schoolClass);

        $schoolClass->load('teacher:id,name')->loadCount([
            'students',
            'quizzes',
            'modules',
            'modules as public_modules_count' => fn ($q) => $q->where('visibility', ModuleVisibility::Public),
            'assignments',
            'announcements',
        ]);

        $data = $this->serializeClass($schoolClass);
        if ($request->user()->role === Role::Teacher) {
            $data['students'] = $schoolClass->students()
                ->select('users.id', 'users.name', 'users.email')
                ->orderBy('users.name')
                ->get()
                ->map(static fn ($student): array => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'joined_at' => $student->pivot?->created_at?->toIso8601String(),
                ])->values();
        }

        return ApiResponse::success($data, 'Class retrieved.');
    }

    public function updateClass(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('update', $schoolClass);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'regenerate_code' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('name', $validated)) {
            $schoolClass->name = trim((string) $validated['name']);
        }
        if (array_key_exists('description', $validated)) {
            $schoolClass->description = $validated['description'] !== null ? trim((string) $validated['description']) : null;
        }
        if (! empty($validated['regenerate_code'])) {
            $schoolClass->class_code = SchoolClass::generateUniqueClassCode();
        }
        $schoolClass->save();

        logSystemActivity('class.updated', $request->user()->id, [
            'entity_type' => 'class',
            'entity_id' => $schoolClass->id,
        ]);

        return ApiResponse::success($this->serializeClass($schoolClass->load('teacher:id,name')), 'Class updated.');
    }

    public function joinClass(Request $request): JsonResponse
    {
        Gate::authorize('join', SchoolClass::class);

        $validated = $request->validate([
            'class_code' => ['required', 'string', 'max:16'],
        ]);

        $code = strtoupper(trim((string) $validated['class_code']));
        $schoolClass = SchoolClass::query()->where('class_code', $code)->first();

        if (! $schoolClass) {
            throw ValidationException::withMessages([
                'class_code' => ['Kode kelas tidak ditemukan.'],
            ]);
        }

        $user = $request->user();
        if ($schoolClass->students()->whereKey($user->id)->exists()) {
            throw new ConflictHttpException('You are already enrolled in this class.');
        }

        $schoolClass->students()->attach($user->id);

        logSystemActivity('class.joined', $user->id, [
            'entity_type' => 'class',
            'entity_id' => $schoolClass->id,
        ]);

        return ApiResponse::success($this->serializeClass($schoolClass->load('teacher:id,name')), 'Joined class successfully.', 201);
    }

    public function leaveClass(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('leave', $schoolClass);

        $user = $request->user();
        DB::transaction(function () use ($schoolClass, $user): void {
            $moduleIds = $schoolClass->modules()->pluck('id');
            if ($moduleIds->isNotEmpty()) {
                ModuleRead::query()
                    ->where('student_id', $user->id)
                    ->whereIn('module_id', $moduleIds)
                    ->delete();
            }
            $schoolClass->students()->detach($user->id);
        });

        logSystemActivity('class.left', $user->id, [
            'entity_type' => 'class',
            'entity_id' => $schoolClass->id,
        ]);

        return ApiResponse::success(message: 'Left class successfully.');
    }

    public function modules(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('view', $schoolClass);

        $user = $request->user();
        $modulesQuery = $schoolClass->modules()->withCount('reads')->orderByDesc('id');
        if ($user->role === Role::Student) {
            $modulesQuery->where('visibility', ModuleVisibility::Public);
        }

        $modules = $modulesQuery->get();
        $readsByModule = [];
        if ($user->role === Role::Student && $modules->isNotEmpty()) {
            $readsByModule = ModuleRead::query()
                ->where('student_id', $user->id)
                ->whereIn('module_id', $modules->pluck('id'))
                ->get()
                ->keyBy('module_id');
        }

        $items = $modules->map(function (Module $module) use ($user, $readsByModule): array {
            $item = [
                'id' => $module->id,
                'class_id' => $module->class_id,
                'file_name' => $module->file_name,
                'visibility' => $module->visibility->value,
                'reads_count' => $module->reads_count ?? 0,
                'created_at' => $module->created_at?->toIso8601String(),
            ];

            if ($user->role === Role::Student) {
                $read = $readsByModule->get($module->id);
                $item['is_read'] = $read !== null;
                $item['read_at'] = $read?->read_at?->toIso8601String();
            }

            return $item;
        })->values();

        $payload = ['items' => $items];
        if ($user->role === Role::Student) {
            $total = $items->count();
            $readCount = $items->where('is_read', true)->count();
            $payload['progress'] = [
                'read_count' => $readCount,
                'total_modules' => $total,
                'progress_percentage' => $total > 0 ? round(($readCount / $total) * 100, 2) : 0.0,
            ];
        }

        return ApiResponse::success($payload, 'Modules retrieved.');
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
            $bytes = (string) file_get_contents($uploaded->getRealPath());
            if (! str_starts_with($bytes, '%PDF-')) {
                throw ValidationException::withMessages([
                    'file' => ['File yang diunggah harus berupa dokumen PDF yang valid.'],
                ]);
            }
            $fileName = $this->sanitizePdfFileName($uploaded->getClientOriginalName() ?: 'module.pdf');
            Storage::disk($disk)->put($storagePath, $bytes);
        } else {
            $fileName = $this->sanitizePdfFileName((string) $validated['file_name']);
            Storage::disk($disk)->put($storagePath, "%PDF-1.4\nEXAMNIA Module: ".$fileName."\n%%EOF");
        }

        $module = new Module([
            'file_name' => $fileName,
            'path' => $storagePath,
            'visibility' => $validated['visibility'] ?? ModuleVisibility::Public->value,
        ]);
        $module->class_id = $schoolClass->id;
        $module->save();

        logSystemActivity('module.uploaded', $request->user()->id, [
            'entity_type' => 'module',
            'entity_id' => $module->id,
        ]);

        return ApiResponse::success([
            'id' => $module->id,
            'class_id' => $module->class_id,
            'file_name' => $module->file_name,
            'visibility' => $module->visibility->value,
            'created_at' => $module->created_at?->toIso8601String(),
        ], 'Module uploaded.', 201);
    }

    public function setModuleVisibility(Request $request, Module $module): JsonResponse
    {
        Gate::authorize('update', $module);

        $validated = $request->validate([
            'visibility' => ['required', 'string', 'in:private,public'],
        ]);

        $module->visibility = ModuleVisibility::from($validated['visibility']);
        $module->save();

        logSystemActivity('module.visibility_updated', $request->user()->id, [
            'entity_type' => 'module',
            'entity_id' => $module->id,
        ]);

        return ApiResponse::success([
            'id' => $module->id,
            'class_id' => $module->class_id,
            'file_name' => $module->file_name,
            'visibility' => $module->visibility->value,
            'created_at' => $module->created_at?->toIso8601String(),
        ], 'Module visibility updated.');
    }

    public function downloadModule(Request $request, Module $module): StreamedResponse
    {
        Gate::authorize('view', $module);

        $path = str_replace('\\', '/', (string) $module->path);
        if (
            $path === ''
            || str_starts_with($path, '/')
            || str_contains($path, ':')
            || str_contains($path, "\0")
            || preg_match('~(^|/)\.\.?(/|$)~', $path)
            || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'pdf'
        ) {
            abort(404);
        }

        $disk = config('quiz_generation.disk', 'local');
        if (! Storage::disk($disk)->exists($path)) {
            abort(404);
        }

        $downloadName = $this->sanitizePdfFileName($module->file_name);

        return Storage::disk($disk)->download($path, $downloadName, [
            'Content-Type' => 'application/pdf',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function destroyModule(Request $request, Module $module): JsonResponse
    {
        Gate::authorize('delete', $module);

        if ($module->quizGenerations()->exists()) {
            throw new ConflictHttpException('Module has quiz generation history and cannot be deleted.');
        }

        $disk = config('quiz_generation.disk', 'local');
        $path = (string) $module->path;
        if ($path !== '' && Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);
        }

        $moduleId = $module->id;
        $module->delete();

        logSystemActivity('module.deleted', $request->user()->id, [
            'entity_type' => 'module',
            'entity_id' => $moduleId,
        ]);

        return ApiResponse::success(message: 'Module deleted.');
    }

    public function markModuleRead(Request $request, Module $module): JsonResponse
    {
        Gate::authorize('markRead', $module);

        $user = $request->user();
        $read = DB::transaction(function () use ($module, $user): ModuleRead {
            $existing = ModuleRead::query()
                ->where('module_id', $module->id)
                ->where('student_id', $user->id)
                ->first();

            if ($existing) {
                return $existing;
            }

            $record = new ModuleRead;
            $record->forceFill([
                'module_id' => $module->id,
                'student_id' => $user->id,
                'read_at' => now(),
            ])->save();

            return $record;
        });

        $publicModuleIds = $module->schoolClass
            ->modules()
            ->where('visibility', ModuleVisibility::Public)
            ->pluck('id');

        $total = $publicModuleIds->count();
        $readCount = $total > 0
            ? ModuleRead::query()
                ->where('student_id', $user->id)
                ->whereIn('module_id', $publicModuleIds)
                ->count()
            : 0;

        logSystemActivity('module.read', $user->id, [
            'entity_type' => 'module',
            'entity_id' => $module->id,
        ]);

        return ApiResponse::success([
            'module_id' => $module->id,
            'read_at' => $read->read_at?->toIso8601String(),
            'progress' => [
                'read_count' => $readCount,
                'total_modules' => $total,
                'progress_percentage' => $total > 0 ? round(($readCount / $total) * 100, 2) : 0.0,
            ],
        ], 'Module marked as read.');
    }

    public function classProgress(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('view', $schoolClass);

        $user = $request->user();
        $publicModules = $schoolClass->modules()
            ->where('visibility', ModuleVisibility::Public)
            ->withCount('reads')
            ->orderBy('id')
            ->get();

        $publicModuleIds = $publicModules->pluck('id');
        $totalPublic = $publicModules->count();

        if ($user->role === Role::Student) {
            $readIds = $totalPublic > 0
                ? ModuleRead::query()
                    ->where('student_id', $user->id)
                    ->whereIn('module_id', $publicModuleIds)
                    ->pluck('module_id')
                    ->all()
                : [];
            $readCount = count($readIds);

            return ApiResponse::success([
                'class_id' => $schoolClass->id,
                'total_public_modules' => $totalPublic,
                'read_count' => $readCount,
                'progress_percentage' => $totalPublic > 0 ? round(($readCount / $totalPublic) * 100, 2) : 0.0,
                'read_module_ids' => $readIds,
            ], 'Class learning progress retrieved.');
        }

        $students = $schoolClass->students()
            ->select('users.id', 'users.name', 'users.email')
            ->orderBy('users.name')
            ->get();

        $readsGrouped = $totalPublic > 0 && $students->isNotEmpty()
            ? ModuleRead::query()
                ->whereIn('module_id', $publicModuleIds)
                ->whereIn('student_id', $students->pluck('id'))
                ->get()
                ->groupBy('student_id')
            : collect();

        $studentProgress = $students->map(function ($student) use ($readsGrouped, $totalPublic): array {
            $reads = $readsGrouped->get($student->id, collect());
            $readIds = $reads->pluck('module_id')->values()->all();
            $readCount = count($readIds);

            return [
                'student_id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'read_count' => $readCount,
                'total_modules' => $totalPublic,
                'progress_percentage' => $totalPublic > 0 ? round(($readCount / $totalPublic) * 100, 2) : 0.0,
                'read_module_ids' => $readIds,
            ];
        })->values();

        return ApiResponse::success([
            'class_id' => $schoolClass->id,
            'total_public_modules' => $totalPublic,
            'modules' => $publicModules->map(static fn (Module $module): array => [
                'id' => $module->id,
                'file_name' => $module->file_name,
                'reads_count' => $module->reads_count ?? 0,
            ])->values(),
            'students' => $studentProgress,
        ], 'Class learning progress retrieved.');
    }

    private function serializeClass(SchoolClass $schoolClass): array
    {
        return [
            'id' => $schoolClass->id,
            'name' => $schoolClass->name,
            'description' => $schoolClass->description,
            'class_code' => $schoolClass->class_code,
            'teacher_id' => $schoolClass->teacher_id,
            'teacher_name' => $schoolClass->teacher?->name,
            'students_count' => $schoolClass->students_count ?? $schoolClass->students()->count(),
            'quizzes_count' => $schoolClass->quizzes_count ?? $schoolClass->quizzes()->count(),
            'modules_count' => $schoolClass->modules_count ?? $schoolClass->modules()->count(),
            'public_modules_count' => $schoolClass->public_modules_count ?? $schoolClass->modules()->where('visibility', ModuleVisibility::Public)->count(),
            'assignments_count' => $schoolClass->assignments_count ?? $schoolClass->assignments()->count(),
            'announcements_count' => $schoolClass->announcements_count ?? $schoolClass->announcements()->count(),
            'created_at' => $schoolClass->created_at?->toIso8601String(),
        ];
    }

    private function sanitizePdfFileName(string $rawName): string
    {
        $normalized = str_replace('\\', '/', $rawName);
        $base = basename($normalized);
        $base = preg_replace('/[\x00-\x1F\x7F"\';<>|*?`]/u', '', $base) ?? '';
        $base = str_replace('..', '', $base);
        $base = trim($base, ". \t\n\r\0\x0B");

        if ($base === '') {
            return 'modul.pdf';
        }

        $stem = preg_replace('/\.pdf$/i', '', $base) ?? $base;
        $stem = preg_replace('/[^A-Za-z0-9._-]+/u', '-', $stem) ?? '';
        $stem = trim($stem, '.-_');
        if ($stem === '') {
            $stem = 'modul';
        }

        if (mb_strlen($stem) > 180) {
            $stem = mb_substr($stem, 0, 180);
        }

        return $stem.'.pdf';
    }
}
