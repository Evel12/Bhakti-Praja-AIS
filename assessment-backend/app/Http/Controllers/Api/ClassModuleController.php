<?php

namespace App\Http\Controllers\Api;

use App\Enums\ModuleVisibility;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\ModuleRead;
use App\Models\SchoolClass;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

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
            ->withCount($this->classCountRelations($user))
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
            $payload = $this->serializeClass($schoolClass);

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

        $schoolClass->load('teacher:id,name')->loadCount($this->classCountRelations($request->user()));

        return ApiResponse::success($this->serializeClass($schoolClass), 'Class created.', 201);
    }

    public function showClass(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        Gate::authorize('view', $schoolClass);

        $schoolClass->load('teacher:id,name')->loadCount($this->classCountRelations($request->user()));

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

        $schoolClass->load('teacher:id,name')->loadCount($this->classCountRelations($request->user()));

        return ApiResponse::success($this->serializeClass($schoolClass), 'Class updated.');
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

        $schoolClass->load('teacher:id,name')->loadCount($this->classCountRelations($user));

        return ApiResponse::success($this->serializeClass($schoolClass), 'Joined class successfully.', 201);
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
        $storedFileName = 'module-'.Str::uuid().'.pdf';
        $storagePath = 'modules/'.$storedFileName;

        if ($request->hasFile('file')) {
            $uploaded = $request->file('file');
            $realPath = $uploaded->getRealPath();
            if ($realPath === false || ! is_string($realPath) || $realPath === '' || ! is_file($realPath)) {
                throw ValidationException::withMessages([
                    'file' => ['File yang diunggah harus berupa dokumen PDF yang valid.'],
                ]);
            }

            $stream = fopen($realPath, 'rb');
            if ($stream === false) {
                throw new RuntimeException('Failed to open uploaded PDF file stream.');
            }

            try {
                $header = fread($stream, 1024);
            } finally {
                fclose($stream);
            }

            if (! is_string($header) || ! $this->hasValidPdfHeader($header)) {
                throw ValidationException::withMessages([
                    'file' => ['File yang diunggah harus berupa dokumen PDF yang valid.'],
                ]);
            }

            $fileName = $this->sanitizePdfFileName($uploaded->getClientOriginalName() ?: 'module.pdf');
            $written = Storage::disk($disk)->putFileAs('modules', $uploaded, $storedFileName);
            if ($written === false) {
                throw new RuntimeException('Failed to store uploaded PDF module.');
            }
            if (is_string($written) && $written !== '') {
                $storagePath = $written;
            }
        } else {
            $fileName = $this->sanitizePdfFileName((string) $validated['file_name']);
            $written = Storage::disk($disk)->put($storagePath, "%PDF-1.4\nEXAMNIA Module: ".$fileName."\n%%EOF");
            if ($written === false) {
                throw new RuntimeException('Failed to store PDF module.');
            }
        }

        try {
            $module = new Module([
                'file_name' => $fileName,
                'path' => $storagePath,
                'visibility' => $validated['visibility'] ?? ModuleVisibility::Public->value,
            ]);
            $module->class_id = $schoolClass->id;
            $module->save();
        } catch (Throwable $exception) {
            try {
                Storage::disk($disk)->delete($storagePath);
            } catch (Throwable) {
                // Preserve the original persistence exception if cleanup fails.
            }

            throw $exception;
        }

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
        $moduleId = $module->id;

        DB::transaction(function () use ($module, $disk, $path): void {
            if ($module->quizGenerations()->exists()) {
                throw new ConflictHttpException('Module has quiz generation history and cannot be deleted.');
            }

            $module->delete();

            if ($path !== '') {
                DB::afterCommit(static function () use ($disk, $path): void {
                    if (Storage::disk($disk)->exists($path)) {
                        Storage::disk($disk)->delete($path);
                    }
                });
            }
        });

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
        $read = ModuleRead::query()
            ->where('module_id', $module->id)
            ->where('student_id', $user->id)
            ->first();

        if (! $read) {
            try {
                $record = new ModuleRead;
                $record->forceFill([
                    'module_id' => $module->id,
                    'student_id' => $user->id,
                    'read_at' => now(),
                ])->save();
                $read = $record;
            } catch (QueryException $exception) {
                $read = ModuleRead::query()
                    ->where('module_id', $module->id)
                    ->where('student_id', $user->id)
                    ->first();

                if (! $read) {
                    throw $exception;
                }
            }
        }

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

    private function classCountRelations(User $user): array
    {
        $isStudent = $user->role === Role::Student;

        return [
            'students',
            'quizzes' => static function ($query) use ($isStudent): void {
                $query->where(static function ($q): void {
                    $q->whereNull('assessment_type')
                        ->orWhere('assessment_type', '!=', 'bank');
                });
                if ($isStudent) {
                    $query->where('status', QuizStatus::Published);
                }
            },
            'modules' => static function ($query) use ($isStudent): void {
                if ($isStudent) {
                    $query->where('visibility', ModuleVisibility::Public);
                }
            },
            'modules as public_modules_count' => static fn ($q) => $q->where('visibility', ModuleVisibility::Public),
            'assignments' => static function ($query) use ($isStudent): void {
                if ($isStudent) {
                    $query->where('status', 'published');
                }
            },
            'announcements',
        ];
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
            'students_count' => (int) ($schoolClass->students_count ?? 0),
            'quizzes_count' => (int) ($schoolClass->quizzes_count ?? 0),
            'modules_count' => (int) ($schoolClass->modules_count ?? 0),
            'public_modules_count' => (int) ($schoolClass->public_modules_count ?? 0),
            'assignments_count' => (int) ($schoolClass->assignments_count ?? 0),
            'announcements_count' => (int) ($schoolClass->announcements_count ?? 0),
            'created_at' => $schoolClass->created_at?->toIso8601String(),
        ];
    }

    private function hasValidPdfHeader(string $header): bool
    {
        $trimmed = str_starts_with($header, "\xEF\xBB\xBF") ? substr($header, 3) : $header;
        $trimmed = ltrim($trimmed, " \t\n\r\0\x0B\x0C");

        return str_starts_with($trimmed, '%PDF-');
    }

    private function sanitizePdfFileName(string $rawName): string
    {
        $normalized = str_replace('\\', '/', $rawName);
        $base = basename($normalized);
        $base = preg_replace('/[\x00-\x1F\x7F"\';<>|*?`\/\\\\:]/u', '', $base) ?? '';
        $base = trim($base, " \t\n\r\0\x0B");

        if ($base === '') {
            return 'modul.pdf';
        }

        // Strip .pdf before trimming leading dots so inputs like "   .pdf" do not become "pdf.pdf".
        $stem = preg_replace('/\.pdf$/i', '', $base) ?? $base;
        $stem = Str::ascii($stem);
        $stem = preg_replace('/\.{2,}/', '.', $stem) ?? $stem;
        $stem = preg_replace('/[^A-Za-z0-9 ._()-]+/', '-', $stem) ?? '';
        $stem = preg_replace('/\s+/', ' ', $stem) ?? '';
        $stem = trim($stem, ". \t\n\r\0\x0B-_");

        if (mb_strlen($stem) > 180) {
            $stem = trim(mb_substr($stem, 0, 180), ". \t\n\r\0\x0B-_");
        }

        if ($stem === '' || ! preg_match('/[A-Za-z0-9]/', $stem)) {
            $stem = 'modul';
        }

        return $stem.'.pdf';
    }
}
