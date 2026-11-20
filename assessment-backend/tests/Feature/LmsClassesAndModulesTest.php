<?php

namespace Tests\Feature;

use App\Contracts\QuizGenerator;
use App\Enums\ModuleVisibility;
use App\Enums\NotificationType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Http\Controllers\Api\AnnouncementController;
use App\Models\Announcement;
use App\Models\LmsNotification;
use App\Models\Module;
use App\Models\ModuleRead;
use App\Models\Quiz;
use App\Models\QuizGeneration;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AisRosterSyncService;
use App\Services\LmsNotificationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class LmsClassesAndModulesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Http::preventStrayRequests();
    }

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('lms-test')->plainTextToken);
    }

    public function test_teacher_can_create_and_update_class_and_student_can_join_and_leave(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $student = User::factory()->create(['role' => Role::Student]);

        $this->signIn($teacher);
        $created = $this->postJson('/api/classes', [
            'name' => 'Matematika XI',
            'description' => 'Kelas Aljabar Linear',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Matematika XI')
            ->assertJsonPath('data.students_count', 0);

        $classId = $created->json('data.id');
        $oldCode = $created->json('data.class_code');
        $this->assertNotEmpty($oldCode);

        $updated = $this->patchJson("/api/classes/{$classId}", [
            'name' => 'Matematika XI Lanjut',
            'regenerate_code' => true,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Matematika XI Lanjut');

        $newCode = $updated->json('data.class_code');
        $this->assertNotSame($oldCode, $newCode);

        $this->signIn($student);
        $this->postJson('/api/classes/join', ['class_code' => $oldCode])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->postJson('/api/classes/join', ['class_code' => strtolower($newCode)])
            ->assertCreated()
            ->assertJsonPath('data.id', $classId)
            ->assertJsonPath('data.students_count', 1);

        $this->postJson('/api/classes/join', ['class_code' => $newCode])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');

        $module = Module::factory()->create([
            'class_id' => $classId,
            'visibility' => ModuleVisibility::Public,
        ]);
        ModuleRead::query()->create([
            'module_id' => $module->id,
            'student_id' => $student->id,
            'read_at' => now(),
        ]);

        $this->deleteJson("/api/classes/{$classId}/leave")
            ->assertOk();

        $this->assertDatabaseMissing('class_members', [
            'class_id' => $classId,
            'student_id' => $student->id,
        ]);
        $this->assertDatabaseMissing('module_reads', [
            'module_id' => $module->id,
            'student_id' => $student->id,
        ]);
        $this->getJson("/api/classes/{$classId}")->assertForbidden();
    }

    public function test_pdf_upload_preserves_clean_filenames_accepts_bom_and_rejects_invalid_or_oversized_files(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        $cleanFile = UploadedFile::fake()->createWithContent(
            'Signal Processing (3).pdf',
            "%PDF-1.4\nSignal Processing Lesson\n%%EOF",
        );

        $cleanRes = $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => $cleanFile,
            'visibility' => 'public',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.file_name', 'Signal Processing (3).pdf');

        $cleanModule = Module::query()->findOrFail($cleanRes->json('data.id'));
        Storage::disk('local')->assertExists($cleanModule->path);

        $dotOnlyRes = $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent('   .pdf', "%PDF-1.4\nDot Name\n%%EOF"),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.file_name', 'modul.pdf');
        $this->assertNotSame('pdf.pdf', $dotOnlyRes->json('data.file_name'));

        $bomRes = $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent(
                'Materi BOM.pdf',
                "\xEF\xBB\xBF  \r\n%PDF-1.4\nUTF-8 BOM PDF\n%%EOF",
            ),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.file_name', 'Materi BOM.pdf');
        $this->assertNotNull(Module::query()->find($bomRes->json('data.id')));

        $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent('bad.pdf', '<html>not-a-pdf</html>'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->create('too-big.pdf', 20481, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->assertDatabaseCount('modules', 3);
    }

    public function test_module_upload_cleans_up_stored_file_when_database_save_fails(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        Event::listen('eloquent.saving: '.Module::class, static function (): never {
            throw new RuntimeException('Simulated DB failure during module save.');
        });

        $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent('rollback.pdf', "%PDF-1.4\nBody\n%%EOF"),
        ], ['Accept' => 'application/json'])
            ->assertStatus(500)
            ->assertJsonPath('error.code', 'SERVER_ERROR');

        $this->assertDatabaseCount('modules', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('modules'));
    }

    public function test_module_upload_returns_500_without_db_row_when_storage_write_returns_false(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        $mockDisk = \Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $mockDisk->shouldReceive('putFileAs')->once()->andReturn(false);
        Storage::shouldReceive('disk')->with(config('quiz_generation.disk', 'local'))->andReturn($mockDisk);

        $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent('write-fail.pdf', "%PDF-1.4\nBody\n%%EOF"),
        ], ['Accept' => 'application/json'])
            ->assertStatus(500)
            ->assertJsonPath('error.code', 'SERVER_ERROR');

        $this->assertDatabaseCount('modules', 0);
    }

    public function test_module_visibility_download_content_disposition_and_delete_behavior(): void
    {
        $this->assertContains('Content-Disposition', config('cors.exposed_headers'));

        $schoolClass = SchoolClass::factory()->create();
        $student = User::factory()->create(['role' => Role::Student]);
        $schoolClass->students()->attach($student);

        $this->signIn($schoolClass->teacher);
        $upload = $this->post("/api/classes/{$schoolClass->id}/modules", [
            'file' => UploadedFile::fake()->createWithContent('Signal Processing (3).pdf', "%PDF-1.4\nContent\n%%EOF"),
            'visibility' => 'private',
        ], ['Accept' => 'application/json'])->assertCreated();

        $moduleId = $upload->json('data.id');
        $module = Module::query()->findOrFail($moduleId);

        $this->signIn($student);
        $this->getJson("/api/classes/{$schoolClass->id}/modules")
            ->assertOk()
            ->assertJsonCount(0, 'data.items');
        $this->get("/api/modules/{$moduleId}/download")->assertForbidden();
        $this->postJson("/api/modules/{$moduleId}/read")->assertForbidden();

        $this->signIn($schoolClass->teacher);
        $this->patchJson("/api/modules/{$moduleId}/visibility", ['visibility' => 'public'])
            ->assertOk()
            ->assertJsonPath('data.visibility', 'public');

        $this->signIn($student);
        $this->getJson("/api/classes/{$schoolClass->id}/modules")
            ->assertOk()
            ->assertJsonCount(1, 'data.items');

        $download = $this->get("/api/modules/{$moduleId}/download")->assertOk();
        $download->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('Signal Processing (3).pdf', (string) $download->headers->get('Content-Disposition'));

        // Module with quiz generation history cannot be deleted
        $generation = new QuizGeneration;
        $generation->forceFill([
            'module_id' => $moduleId,
            'requested_by' => $schoolClass->teacher_id,
            'question_count' => 5,
        ])->save();

        $this->signIn($schoolClass->teacher);
        $this->deleteJson("/api/modules/{$moduleId}")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');
        Storage::disk('local')->assertExists($module->path);

        $generation->delete();
        $this->deleteJson("/api/modules/{$moduleId}")->assertOk();
        $this->assertDatabaseMissing('modules', ['id' => $moduleId]);
        Storage::disk('local')->assertMissing($module->path);
    }

    public function test_mark_module_read_is_idempotent_and_handles_concurrent_unique_conflict(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $student = User::factory()->create(['role' => Role::Student]);
        $schoolClass->students()->attach($student);
        $module = Module::factory()->create([
            'class_id' => $schoolClass->id,
            'visibility' => ModuleVisibility::Public,
        ]);

        $this->signIn($student);

        // Simulate a concurrent request inserting the same ModuleRead right before save() commits.
        $injected = false;
        Event::listen('eloquent.creating: '.ModuleRead::class, static function (ModuleRead $pending) use (&$injected): void {
            if (! $injected) {
                $injected = true;
                DB::table('module_reads')->insert([
                    'module_id' => $pending->module_id,
                    'student_id' => $pending->student_id,
                    'read_at' => now()->subSecond(),
                    'created_at' => now()->subSecond(),
                    'updated_at' => now()->subSecond(),
                ]);
            }
        });

        $this->postJson("/api/modules/{$module->id}/read")
            ->assertOk()
            ->assertJsonPath('data.module_id', $module->id)
            ->assertJsonPath('data.progress.read_count', 1)
            ->assertJsonPath('data.progress.total_modules', 1)
            ->assertJsonPath('data.progress.progress_percentage', 100);

        $this->postJson("/api/modules/{$module->id}/read")
            ->assertOk()
            ->assertJsonPath('data.progress.read_count', 1);

        $this->assertDatabaseCount('module_reads', 1);
    }

    public function test_class_counts_exclude_bank_quizzes_and_scope_hidden_items_for_students(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $student = User::factory()->create(['role' => Role::Student]);
        $schoolClass->students()->attach($student);

        Module::factory()->create(['class_id' => $schoolClass->id, 'visibility' => ModuleVisibility::Public]);
        Module::factory()->create(['class_id' => $schoolClass->id, 'visibility' => ModuleVisibility::Private]);

        $publishedQuiz = Quiz::factory()->published()->create(['class_id' => $schoolClass->id]);
        Quiz::factory()->create(['class_id' => $schoolClass->id, 'status' => QuizStatus::Draft]);
        Quiz::factory()->create([
            'class_id' => $schoolClass->id,
            'title' => '__QUESTION_BANK__',
            'assessment_type' => 'bank',
            'status' => QuizStatus::Archived,
        ]);

        $schoolClass->assignments()->create(['title' => 'Tugas Terbit', 'status' => 'published', 'published_at' => now()]);
        $schoolClass->assignments()->create(['title' => 'Tugas Draf', 'status' => 'draft']);

        $ann = new Announcement(['title' => 'Info Kelas', 'content' => 'Jadwal minggu ini']);
        $ann->class_id = $schoolClass->id;
        $ann->author_id = $schoolClass->teacher_id;
        $ann->save();

        $this->signIn($schoolClass->teacher);
        $this->getJson('/api/classes')
            ->assertOk()
            ->assertJsonPath('data.items.0.modules_count', 2)
            ->assertJsonPath('data.items.0.public_modules_count', 1)
            ->assertJsonPath('data.items.0.quizzes_count', 2)
            ->assertJsonPath('data.items.0.assignments_count', 2)
            ->assertJsonPath('data.items.0.announcements_count', 1);

        $this->getJson("/api/classes/{$schoolClass->id}")
            ->assertOk()
            ->assertJsonPath('data.modules_count', 2)
            ->assertJsonPath('data.quizzes_count', 2)
            ->assertJsonPath('data.assignments_count', 2);

        $this->signIn($student);
        $this->getJson('/api/classes')
            ->assertOk()
            ->assertJsonPath('data.items.0.modules_count', 1)
            ->assertJsonPath('data.items.0.public_modules_count', 1)
            ->assertJsonPath('data.items.0.quizzes_count', 1)
            ->assertJsonPath('data.items.0.assignments_count', 1)
            ->assertJsonPath('data.items.0.announcements_count', 1);

        $this->getJson("/api/classes/{$schoolClass->id}")
            ->assertOk()
            ->assertJsonPath('data.modules_count', 1)
            ->assertJsonPath('data.quizzes_count', 1)
            ->assertJsonPath('data.assignments_count', 1);

        $this->assertNotNull($publishedQuiz->id);
    }

    public function test_announcement_policy_denies_null_school_class_without_type_error(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $orphanAnnouncement = new Announcement([
            'title' => 'Pengumuman Sekolah Global',
            'content' => 'Libur nasional',
        ]);
        $orphanAnnouncement->forceFill([
            'class_id' => null,
            'author_id' => $teacher->id,
        ]);

        $this->assertFalse(Gate::forUser($teacher)->allows('delete', $orphanAnnouncement));

        $request = Request::create('/api/announcements/999', 'DELETE');
        $request->setUserResolver(static fn () => $teacher);

        $this->expectException(AuthorizationException::class);
        app(AnnouncementController::class)->destroy($request, $orphanAnnouncement);
    }

    public function test_assignment_deadline_bounds_and_idempotent_publish_notifications(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $student = User::factory()->create(['role' => Role::Student]);
        $schoolClass->students()->attach($student);

        $this->signIn($schoolClass->teacher);

        $this->postJson("/api/classes/{$schoolClass->id}/assignments", [
            'title' => 'Tugas Tahun 2040',
            'deadline' => '2040-01-01T00:00:00Z',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->postJson("/api/classes/{$schoolClass->id}/assignments", [
            'title' => 'Tugas Tahun 1969',
            'deadline' => '1969-12-31T23:59:59Z',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $created = $this->postJson("/api/classes/{$schoolClass->id}/assignments", [
            'title' => 'Tugas Algoritma',
            'deadline' => '2035-06-15T12:00:00Z',
            'status' => 'draft',
        ])->assertCreated();

        $assignmentId = $created->json('data.id');
        $this->assertDatabaseCount('notifications', 0);

        $this->patchJson("/api/assignments/{$assignmentId}", [
            'deadline' => '2039-01-01T00:00:00Z',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');

        // Calling publish twice must only send one notification
        $this->postJson("/api/assignments/{$assignmentId}/publish")->assertOk();
        $this->postJson("/api/assignments/{$assignmentId}/publish")->assertOk();

        $this->assertSame(1, LmsNotification::query()
            ->where('user_id', $student->id)
            ->where('type', NotificationType::AssignmentPublished->value)
            ->count());

        // Transitioning draft -> published via update() dispatches exactly one notification
        $draftTwo = $this->postJson("/api/classes/{$schoolClass->id}/assignments", [
            'title' => 'Tugas Struktur Data',
            'status' => 'draft',
        ])->assertCreated();
        $draftTwoId = $draftTwo->json('data.id');

        $this->patchJson("/api/assignments/{$draftTwoId}", ['status' => 'published'])->assertOk();
        $this->patchJson("/api/assignments/{$draftTwoId}", ['title' => 'Tugas Struktur Data Revisi', 'status' => 'published'])->assertOk();

        $this->assertSame(2, LmsNotification::query()
            ->where('user_id', $student->id)
            ->where('type', NotificationType::AssignmentPublished->value)
            ->count());
    }

    public function test_notifications_endpoint_supports_filters_class_name_message_and_preserves_member4_rows(): void
    {
        $schoolClass = SchoolClass::factory()->create(['name' => 'Biologi XII IPA']);
        $student = User::factory()->create(['role' => Role::Student]);
        $schoolClass->students()->attach($student);

        LmsNotification::query()->create([
            'user_id' => $student->id,
            'class_id' => $schoolClass->id,
            'type' => NotificationType::QuizPublished->value,
            'title' => 'Kuis Lama',
            'body' => 'Sudah dibaca sebelumnya.',
            'read_at' => now()->subHour(),
        ]);
        $unread = LmsNotification::query()->create([
            'user_id' => $student->id,
            'class_id' => $schoolClass->id,
            'type' => NotificationType::AnnouncementPosted->value,
            'title' => 'Pengumuman Baru',
            'body' => 'Jangan lupa praktikum besok.',
        ]);
        $member4 = LmsNotification::query()->create([
            'user_id' => $student->id,
            'class_id' => null,
            'type' => 'member4',
            'title' => 'Tagihan SPP',
            'body' => 'Notifikasi internal Member 4.',
        ]);

        $this->signIn($student);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.unread_count', 1)
            ->assertJsonPath('data.items.0.id', $unread->id)
            ->assertJsonPath('data.items.0.body', 'Jangan lupa praktikum besok.')
            ->assertJsonPath('data.items.0.message', 'Jangan lupa praktikum besok.')
            ->assertJsonPath('data.items.0.class_name', 'Biologi XII IPA');

        $this->getJson('/api/notifications?unread_only=1&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.unread_count', 1)
            ->assertJsonPath('data.pagination.per_page', 1)
            ->assertJsonPath('data.items.0.id', $unread->id);

        $this->getJson('/api/notifications?unread_only=true')
            ->assertOk()
            ->assertJsonCount(1, 'data.items');

        $this->getJson('/api/notifications?unread_only=invalid')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->postJson('/api/notifications/read-all')->assertOk();

        $this->assertNotNull($unread->fresh()->read_at);
        $this->assertNull($member4->fresh()->read_at);
    }

    public function test_http_quiz_generator_accepts_bom_pdf_and_generate_endpoint_accepts_optional_title(): void
    {
        config([
            'quiz_generation.base_url' => 'https://python.example.test/v1/',
            'quiz_generation.endpoint' => '/generate-quiz',
            'quiz_generation.api_key' => 'private-service-test-key',
            'quiz_generation.timeout' => 60,
            'quiz_generation.connect_timeout' => 10,
            'quiz_generation.disk' => 'local',
        ]);

        $module = Module::factory()->create();
        $bomPdf = "\xEF\xBB\xBF  \n%PDF-1.4\nMateri Uji BOM\n%%EOF";
        Storage::disk('local')->put($module->path, $bomPdf);

        Http::fake(['*' => static fn () => Http::response([
            'title' => 'Kuis BOM',
            'description' => 'Draft kuis',
            'questions' => [[
                'question_text' => 'Ibu kota Indonesia?',
                'options' => [
                    ['option_label' => 'A', 'option_text' => 'Jakarta', 'is_correct' => true],
                    ['option_label' => 'B', 'option_text' => 'Bandung', 'is_correct' => false],
                    ['option_label' => 'C', 'option_text' => 'Surabaya', 'is_correct' => false],
                    ['option_label' => 'D', 'option_text' => 'Medan', 'is_correct' => false],
                ],
            ]],
        ])]);

        $result = app(QuizGenerator::class)->generate($module, 1, 99);
        $this->assertSame('Kuis BOM', $result['title']);
        Http::assertSentCount(1);

        $this->signIn($module->schoolClass->teacher);
        $queued = $this->postJson("/api/modules/{$module->id}/generate-quiz", [
            'question_count' => 1,
            'title' => 'Kuis Custom Guru',
        ])->assertAccepted()
            ->assertJsonPath('data.question_count', 1)
            ->assertJsonPath('data.status', 'queued');

        $jobRow = DB::table('jobs')->where('queue', 'quiz-generation')->orderByDesc('id')->first();
        $this->assertNotNull($jobRow);
        $payload = json_decode($jobRow->payload, true, 512, JSON_THROW_ON_ERROR);
        $jobInstance = unserialize($payload['data']['command']);
        app()->call([$jobInstance, 'handle']);

        $generation = \App\Models\QuizGeneration::query()->findOrFail($queued->json('data.id'));
        $this->assertSame('completed', $generation->status->value);
        $this->assertSame('Kuis Custom Guru', $generation->quiz?->title);

        // Legacy serialized GenerateQuiz payloads without customTitle must still complete cleanly.
        $legacyQueued = $this->postJson("/api/modules/{$module->id}/generate-quiz", [
            'question_count' => 1,
        ])->assertAccepted();
        $legacyId = (int) $legacyQueued->json('data.id');
        $legacySerialized = sprintf('O:21:"App\\Jobs\\GenerateQuiz":1:{s:12:"generationId";i:%d;}', $legacyId);
        $legacyJob = unserialize($legacySerialized);
        app()->call([$legacyJob, 'handle']);
        $legacyGeneration = \App\Models\QuizGeneration::query()->findOrFail($legacyId);
        $this->assertSame('completed', $legacyGeneration->status->value);
        $this->assertSame('Kuis BOM', $legacyGeneration->quiz?->title);

        $this->postJson("/api/modules/{$module->id}/generate-quiz", [
            'question_count' => 3,
            'title' => str_repeat('X', 256),
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_ais_roster_sync_backfills_class_code_and_preserves_reassigned_active_teaching_loads(): void
    {
        $this->createMinimalAisTables();

        $teacherA = User::factory()->create(['role' => Role::Teacher, 'name' => 'Guru A']);
        $teacherB = User::factory()->create(['role' => Role::Teacher, 'name' => 'Guru B']);
        $student1 = User::factory()->create(['role' => Role::Student, 'name' => 'Murid 1']);
        $student2 = User::factory()->create(['role' => Role::Student, 'name' => 'Murid 2']);

        $tARow = DB::table('teachers')->insertGetId(['user_id' => $teacherA->id, 'teacher_number' => 'T-1', 'name' => $teacherA->name, 'status' => 'active']);
        $tBRow = DB::table('teachers')->insertGetId(['user_id' => $teacherB->id, 'teacher_number' => 'T-2', 'name' => $teacherB->name, 'status' => 'active']);
        $s1Row = DB::table('students')->insertGetId(['user_id' => $student1->id, 'student_number' => 'S-1', 'name' => $student1->name, 'status' => 'active']);
        $s2Row = DB::table('students')->insertGetId(['user_id' => $student2->id, 'student_number' => 'S-2', 'name' => $student2->name, 'status' => 'active']);

        $yearId = DB::table('academic_years')->insertGetId(['name' => '2026/2027']);
        $semId = DB::table('semesters')->insertGetId(['academic_year_id' => $yearId, 'name' => 'Genap']);
        $subjId = DB::table('subjects')->insertGetId(['code' => 'INF-1', 'name' => 'Informatika', 'status' => 'active']);
        $class1Id = DB::table('classrooms')->insertGetId(['name' => 'X A', 'level' => '10', 'academic_year_id' => $yearId, 'status' => 'active']);
        $class2Id = DB::table('classrooms')->insertGetId(['name' => 'X B', 'level' => '10', 'academic_year_id' => $yearId, 'status' => 'active']);

        $load1Id = DB::table('teaching_loads')->insertGetId([
            'teacher_id' => $tARow,
            'subject_id' => $subjId,
            'classroom_id' => $class1Id,
            'semester_id' => $semId,
            'weekly_hours' => 4,
            'status' => 'active',
        ]);
        // Load 2 is active and reassigned to Teacher B in AIS, while local SchoolClass still points to Teacher A
        $load2Id = DB::table('teaching_loads')->insertGetId([
            'teacher_id' => $tBRow,
            'subject_id' => $subjId,
            'classroom_id' => $class2Id,
            'semester_id' => $semId,
            'weekly_hours' => 4,
            'status' => 'active',
        ]);

        DB::table('class_student')->insert([
            ['classroom_id' => $class1Id, 'student_id' => $s1Row, 'academic_year_id' => $yearId, 'semester_id' => $semId, 'status' => 'active'],
            ['classroom_id' => $class2Id, 'student_id' => $s2Row, 'academic_year_id' => $yearId, 'semester_id' => $semId, 'status' => 'active'],
        ]);

        $existingNullCodeClass = new SchoolClass(['name' => 'Old AIS Name']);
        $existingNullCodeClass->forceFill([
            'teacher_id' => $teacherA->id,
            'class_code' => 'TEMP1234',
            'ais_teaching_load_id' => $load1Id,
            'ais_classroom_id' => $class1Id,
            'ais_subject_id' => $subjId,
            'sync_source' => 'ais',
        ])->save();
        DB::table('classes')->where('id', $existingNullCodeClass->id)->update(['class_code' => null]);

        $reassignedClass = new SchoolClass(['name' => 'Informatika · X B']);
        $reassignedClass->forceFill([
            'teacher_id' => $teacherA->id,
            'ais_teaching_load_id' => $load2Id,
            'ais_classroom_id' => $class2Id,
            'ais_subject_id' => $subjId,
            'sync_source' => 'ais',
        ])->save();
        $reassignedClass->students()->attach($student2->id);

        $sync = app(AisRosterSyncService::class);
        $res = $sync->syncAll($teacherA->id);

        $this->assertTrue($res['synced']);
        $this->assertSame(1, $res['classes_synced']);
        $this->assertNotNull($existingNullCodeClass->fresh()->class_code);
        $this->assertSame([$student1->id], $existingNullCodeClass->fresh()->students()->pluck('users.id')->all());
        // Active load 2 reassigned to Teacher B must NOT have its students detached by Teacher A's sync
        $this->assertSame([$student2->id], $reassignedClass->fresh()->students()->pluck('users.id')->all());

        // Deactivating load 1 cleans up only load 1's memberships, still preserving reassigned active load 2
        DB::table('teaching_loads')->where('id', $load1Id)->update(['status' => 'inactive']);
        $sync->syncAll($teacherA->id);
        $this->assertSame([], $existingNullCodeClass->fresh()->students()->pluck('users.id')->all());
        $this->assertSame([$student2->id], $reassignedClass->fresh()->students()->pluck('users.id')->all());
    }

    private function createMinimalAisTables(): void
    {
        if (! Schema::hasTable('teachers')) {
            Schema::create('teachers', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('teacher_number');
                $table->string('name');
                $table->string('status')->default('active');
            });
        }
        if (! Schema::hasTable('students')) {
            Schema::create('students', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('student_number');
                $table->string('name');
                $table->string('status')->default('active');
            });
        }
        if (! Schema::hasTable('academic_years')) {
            Schema::create('academic_years', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
            });
        }
        if (! Schema::hasTable('semesters')) {
            Schema::create('semesters', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('academic_year_id');
                $table->string('name');
            });
        }
        if (! Schema::hasTable('subjects')) {
            Schema::create('subjects', function (Blueprint $table): void {
                $table->id();
                $table->string('code');
                $table->string('name');
                $table->string('status')->default('active');
            });
        }
        if (! Schema::hasTable('classrooms')) {
            Schema::create('classrooms', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('level');
                $table->unsignedBigInteger('academic_year_id');
                $table->string('status')->default('active');
            });
        }
        if (! Schema::hasTable('teaching_loads')) {
            Schema::create('teaching_loads', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id');
                $table->unsignedBigInteger('subject_id');
                $table->unsignedBigInteger('classroom_id');
                $table->unsignedBigInteger('semester_id');
                $table->unsignedSmallInteger('weekly_hours');
                $table->string('status')->default('active');
            });
        }
        if (! Schema::hasTable('class_student')) {
            Schema::create('class_student', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('classroom_id');
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('academic_year_id');
                $table->unsignedBigInteger('semester_id')->nullable();
                $table->string('status')->default('active');
            });
        }
    }
}
