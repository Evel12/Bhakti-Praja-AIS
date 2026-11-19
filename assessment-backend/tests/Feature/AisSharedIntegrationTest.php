<?php

namespace Tests\Feature;

use App\Enums\QuestionType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AisSharedIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_ais_token_exchange_issues_assessment_session_and_blocks_inactive_or_parent_users(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher, 'status' => 'active']);
        $aisToken = $teacher->createToken('ais-portal')->plainTextToken;

        $this->postJson('/api/auth/ais-exchange', [
            'ais_token' => $aisToken,
            'device_name' => 'ais-iframe',
        ])
            ->assertOk()
            ->assertJsonPath('data.user.id', $teacher->id)
            ->assertJsonPath('data.user.role', 'teacher')
            ->assertJsonPath('data.auth_method', 'ais-sso')
            ->assertJsonStructure(['data' => ['token']]);

        $parent = User::factory()->create(['role' => Role::Parent, 'status' => 'active']);
        $parentToken = $parent->createToken('ais-portal')->plainTextToken;
        $this->postJson('/api/auth/ais-exchange', ['ais_token' => $parentToken])
            ->assertForbidden();

        $inactive = User::factory()->create(['role' => Role::Student, 'status' => 'inactive']);
        $inactiveToken = $inactive->createToken('ais-portal')->plainTextToken;
        $this->postJson('/api/auth/ais-exchange', ['ais_token' => $inactiveToken])
            ->assertForbidden();

        $this->actingAs($inactive, 'sanctum')
            ->getJson('/api/classes')
            ->assertForbidden();

        $this->postJson('/api/auth/ais-exchange', ['ais_token' => 'invalid-token'])
            ->assertUnauthorized();
    }

    public function test_ais_exchange_allows_more_than_five_exchanges_per_minute(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);

        for ($i = 0; $i < 7; $i++) {
            $token = $teacher->createToken('ais-login-'.$i)->plainTextToken;
            $this->postJson('/api/auth/ais-exchange', ['ais_token' => $token])
                ->assertOk()
                ->assertJsonPath('success', true);
        }
    }

    public function test_roster_sync_imports_ais_teaching_loads_and_preserves_manual_classes(): void
    {
        $this->createMinimalAisTables();

        $teacher = User::factory()->create(['role' => Role::Teacher, 'name' => 'Guru RPL']);
        $student1 = User::factory()->create(['role' => Role::Student, 'name' => 'Siswa Satu']);
        $student2 = User::factory()->create(['role' => Role::Student, 'name' => 'Siswa Dua']);

        $manualClass = $teacher->ownedClasses()->create([
            'name' => 'Ekskul Coding Manual',
        ]);
        $manualClass->forceFill(['sync_source' => 'manual'])->save();

        $teacherRowId = DB::table('teachers')->insertGetId([
            'user_id' => $teacher->id,
            'teacher_number' => 'NIP-01',
            'name' => $teacher->name,
            'status' => 'active',
        ]);
        $s1RowId = DB::table('students')->insertGetId([
            'user_id' => $student1->id,
            'student_number' => 'NIS-01',
            'name' => $student1->name,
            'status' => 'active',
        ]);
        $s2RowId = DB::table('students')->insertGetId([
            'user_id' => $student2->id,
            'student_number' => 'NIS-02',
            'name' => $student2->name,
            'status' => 'active',
        ]);
        $yearId = DB::table('academic_years')->insertGetId(['name' => '2026/2027']);
        $semId = DB::table('semesters')->insertGetId(['academic_year_id' => $yearId, 'name' => 'Ganjil']);
        $subjectId = DB::table('subjects')->insertGetId(['code' => 'RPL-01', 'name' => 'Pemrograman Web', 'status' => 'active']);
        $classroomId = DB::table('classrooms')->insertGetId([
            'name' => 'XII RPL 1',
            'level' => '12',
            'academic_year_id' => $yearId,
            'status' => 'active',
        ]);
        $loadId = DB::table('teaching_loads')->insertGetId([
            'teacher_id' => $teacherRowId,
            'subject_id' => $subjectId,
            'classroom_id' => $classroomId,
            'semester_id' => $semId,
            'weekly_hours' => 6,
            'status' => 'active',
        ]);
        DB::table('class_student')->insert([
            [
                'classroom_id' => $classroomId,
                'student_id' => $s1RowId,
                'academic_year_id' => $yearId,
                'semester_id' => null,
                'status' => 'active',
            ],
            [
                'classroom_id' => $classroomId,
                'student_id' => $s2RowId,
                'academic_year_id' => $yearId,
                'semester_id' => $semId,
                'status' => 'active',
            ],
        ]);

        $this->actingAs($teacher, 'sanctum')
            ->postJson('/api/integration/sync-roster')
            ->assertOk()
            ->assertJsonPath('data.synced', true)
            ->assertJsonPath('data.classes_synced', 1)
            ->assertJsonPath('data.memberships_synced', 2);

        $syncedClass = SchoolClass::query()->where('ais_teaching_load_id', $loadId)->first();
        $this->assertNotNull($syncedClass);
        $this->assertSame('Pemrograman Web · XII RPL 1', $syncedClass->name);
        $this->assertSame('ais', $syncedClass->sync_source);
        $this->assertEqualsCanonicalizing([$student1->id, $student2->id], $syncedClass->students()->pluck('users.id')->all());

        // Ad-hoc manual class must remain completely untouched
        $this->assertDatabaseHas('classes', ['id' => $manualClass->id, 'sync_source' => 'manual']);

        // Deactivating teaching load clears synced AIS memberships without touching manual classes
        DB::table('teaching_loads')->where('id', $loadId)->update(['status' => 'inactive']);
        $this->actingAs($teacher, 'sanctum')
            ->postJson('/api/integration/sync-roster')
            ->assertOk()
            ->assertJsonPath('data.classes_synced', 0);

        $this->assertSame([], $syncedClass->fresh()->students()->pluck('users.id')->all());
        $this->assertDatabaseHas('classes', ['id' => $manualClass->id, 'sync_source' => 'manual']);
    }

    public function test_released_and_immediate_quiz_results_export_to_ais_grades_while_unreleased_manual_stays_hidden(): void
    {
        $this->createMinimalAisTables();

        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $student = User::factory()->create(['role' => Role::Student]);
        $aisStudentId = DB::table('students')->insertGetId([
            'user_id' => $student->id,
            'student_number' => 'NIS-99',
            'name' => $student->name,
            'status' => 'active',
        ]);

        $class = new SchoolClass(['name' => 'Basis Data · XI RPL']);
        $class->forceFill([
            'teacher_id' => $teacher->id,
            'ais_classroom_id' => 12,
            'ais_subject_id' => 7,
        ])->save();
        $class->students()->attach($student->id);

        $quiz = $class->quizzes()->create([
            'title' => 'Kuis SQL Release',
            'deadline' => now()->addDay(),
            'release_mode' => 'manual',
            'results_released' => false,
        ]);
        $quiz->forceFill(['status' => QuizStatus::Published])->save();

        $question = $quiz->questions()->create([
            'question_text' => 'Keyword mengambil data?',
            'question_type' => QuestionType::MultipleChoice,
            'points' => 10,
        ]);
        $optA = $question->options()->create(['option_label' => 'A', 'option_text' => 'SELECT', 'is_correct' => true]);
        $question->options()->create(['option_label' => 'B', 'option_text' => 'DROP', 'is_correct' => false]);
        $question->options()->create(['option_label' => 'C', 'option_text' => 'DELETE', 'is_correct' => false]);
        $question->options()->create(['option_label' => 'D', 'option_text' => 'ALTER', 'is_correct' => false]);

        $attemptRes = $this->actingAs($student, 'sanctum')
            ->postJson("/api/quizzes/{$quiz->id}/attempts", [
                'game_mode' => \App\Enums\GameMode::cases()[0]->value,
                'challenge_mode' => \App\Enums\ChallengeMode::cases()[0]->value,
            ])
            ->assertCreated();
        $attemptId = $attemptRes->json('data.id');

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/attempts/{$attemptId}/answers", [
                'question_id' => $question->id,
                'chosen_option_id' => $optA->id,
            ])
            ->assertCreated();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/attempts/{$attemptId}/finish")
            ->assertOk();

        // Manual hold quiz must NOT export before release
        $this->assertDatabaseCount('ais_assessment_grades', 0);

        // Teacher releases results -> exports cleanly to AIS grades table
        $this->actingAs($teacher, 'sanctum')
            ->postJson("/api/quizzes/{$quiz->id}/release-results")
            ->assertOk();

        $this->assertDatabaseHas('ais_assessment_grades', [
            'student_id' => $aisStudentId,
            'user_id' => $student->id,
            'classroom_id' => 12,
            'subject_id' => 7,
            'source_quiz_id' => $quiz->id,
            'score' => 100.00,
        ]);
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
        if (! Schema::hasTable('ais_assessment_grades')) {
            Schema::create('ais_assessment_grades', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('classroom_id')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->unsignedBigInteger('assessment_class_id')->nullable();
                $table->string('source_type')->default('quiz');
                $table->unsignedBigInteger('source_quiz_id');
                $table->string('title');
                $table->string('assessment_type')->default('quiz');
                $table->decimal('score', 6, 2);
                $table->decimal('max_score', 6, 2)->default(100);
                $table->text('teacher_feedback')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('graded_at')->nullable();
                $table->timestamp('released_at')->nullable();
                $table->timestamps();
            });
        }
    }
}
