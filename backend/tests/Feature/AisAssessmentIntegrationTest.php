<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AisAssessmentGrade;
use App\Models\Classroom;
use App\Models\ClassStudent;
use App\Models\Department;
use App\Models\Guardian;
use App\Models\Role;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudyProgram;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeachingLoad;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AisAssessmentIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_shared_user_saving_keeps_ais_role_id_and_assessment_role_column_in_sync(): void
    {
        $this->seed(RoleSeeder::class);

        $teacher = User::create([
            'name' => 'Guru Sinkron',
            'email' => 'gurusinkron@test.id',
            'password' => 'password123',
            'role_id' => Role::where('name', 'guru')->value('id'),
            'status' => 'active',
        ]);

        $this->assertSame('guru', $teacher->fresh()->role->name);
        $this->assertSame('teacher', DB::table('users')->where('id', $teacher->id)->value('role'));

        $parent = User::create([
            'name' => 'Wali Sinkron',
            'email' => 'walisinkron@test.id',
            'password' => 'password123',
            'role_id' => Role::where('name', 'wali_murid')->value('id'),
            'status' => 'active',
        ]);

        $this->assertSame('wali_murid', $parent->fresh()->role->name);
        $this->assertSame('parent', DB::table('users')->where('id', $parent->id)->value('role'));
    }

    public function test_teaching_load_and_class_student_mutations_sync_into_shared_assessment_classes(): void
    {
        $this->seed(RoleSeeder::class);
        $this->createSharedAssessmentBridgeTables();

        $admin = User::factory()->create(['role_id' => Role::where('name', 'admin')->value('id'), 'status' => 'active']);
        $teacherUser = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $studentUser = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);

        $teacher = Teacher::create(['user_id' => $teacherUser->id, 'teacher_number' => 'T-10', 'name' => 'Guru Bridge', 'status' => 'active']);
        $student = Student::create(['user_id' => $studentUser->id, 'student_number' => 'S-10', 'name' => 'Murid Bridge', 'status' => 'active']);
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30']);
        $semester = Semester::create(['name' => 'Ganjil', 'academic_year_id' => $year->id]);
        $dept = Department::create(['name' => 'TIK', 'code' => 'INT-D']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'name' => 'RPL', 'code' => 'INT-P']);
        $classroom = Classroom::create(['name' => 'XII RPL 1', 'level' => '12', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $subject = Subject::create(['name' => 'Basis Data', 'code' => 'BD-12', 'status' => 'active']);

        $this->actingAs($admin, 'sanctum');

        $this->postJson('/api/class-students', [
            'student_id' => $student->id,
            'classroom_id' => $classroom->id,
            'academic_year_id' => $year->id,
            'semester_id' => $semester->id,
            'status' => 'active',
        ])->assertCreated();

        $loadRes = $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'classroom_id' => $classroom->id,
            'semester_id' => $semester->id,
            'weekly_hours' => 4,
            'status' => 'active',
        ])->assertCreated();

        $loadId = $loadRes->json('data.id');
        $assessmentClass = DB::table('classes')->where('ais_teaching_load_id', $loadId)->first();
        $this->assertNotNull($assessmentClass);
        $this->assertSame('Basis Data · XII RPL 1', $assessmentClass->name);
        $this->assertSame($teacherUser->id, (int) $assessmentClass->teacher_id);
        $this->assertSame('ais', $assessmentClass->sync_source);
        $this->assertNotEmpty($assessmentClass->class_code);

        $this->assertDatabaseHas('class_members', [
            'class_id' => $assessmentClass->id,
            'student_id' => $studentUser->id,
        ]);
    }

    public function test_exported_grades_endpoint_and_parent_portal_return_live_released_scores(): void
    {
        $this->seed(RoleSeeder::class);
        $this->createSharedAssessmentAcademicTables();

        $admin = User::factory()->create(['role_id' => Role::where('name', 'admin')->value('id'), 'status' => 'active']);
        $teacherUser = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $studentUser = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);
        $parentUser = User::factory()->create(['role_id' => Role::where('name', 'wali_murid')->value('id'), 'status' => 'active']);

        $teacher = Teacher::create(['user_id' => $teacherUser->id, 'teacher_number' => 'T-20', 'name' => 'Guru Nilai', 'status' => 'active']);
        $student = Student::create(['user_id' => $studentUser->id, 'student_number' => 'S-20', 'name' => 'Anak Nilai', 'status' => 'active']);
        $guardian = Guardian::create(['user_id' => $parentUser->id, 'name' => 'Wali Nilai', 'status' => 'active']);
        $guardian->students()->attach([$student->id], ['relationship' => 'ibu']);

        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30']);
        $semester = Semester::create(['name' => 'Ganjil', 'academic_year_id' => $year->id]);
        $dept = Department::create(['name' => 'TIK', 'code' => 'INT-D2']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'name' => 'TKJ', 'code' => 'INT-P2']);
        $classroom = Classroom::create(['name' => 'XI TKJ 1', 'level' => '11', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $subject = Subject::create(['name' => 'Jaringan Dasar', 'code' => 'JD-11', 'status' => 'active']);

        TeachingLoad::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'classroom_id' => $classroom->id,
            'semester_id' => $semester->id,
            'weekly_hours' => 4,
            'status' => 'active',
        ]);

        AisAssessmentGrade::create([
            'student_id' => $student->id,
            'user_id' => $studentUser->id,
            'classroom_id' => $classroom->id,
            'subject_id' => $subject->id,
            'source_type' => 'quiz',
            'source_quiz_id' => 501,
            'title' => 'Kuis Routing Dasar',
            'assessment_type' => 'quiz',
            'score' => 90.00,
            'max_score' => 100.00,
            'teacher_feedback' => 'Sangat baik',
            'released_at' => now(),
        ]);

        // Unrelated student grade should never leak to parent or teacher of another subject
        $otherStudent = Student::create(['student_number' => 'S-99', 'name' => 'Anak Lain', 'status' => 'active']);
        $otherUser = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);
        $otherSubject = Subject::create(['name' => 'Bahasa Inggris', 'code' => 'EN-11', 'status' => 'active']);
        AisAssessmentGrade::create([
            'student_id' => $otherStudent->id,
            'user_id' => $otherUser->id,
            'classroom_id' => $classroom->id,
            'subject_id' => $otherSubject->id,
            'source_type' => 'quiz',
            'source_quiz_id' => 502,
            'title' => 'Grammar Test',
            'assessment_type' => 'quiz',
            'score' => 75.00,
            'max_score' => 100.00,
            'released_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/assessment-grades')->assertOk()->assertJsonPath('meta.total', 2);
        $this->actingAs($teacherUser, 'sanctum')->getJson('/api/assessment-grades')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.title', 'Kuis Routing Dasar');
        $this->actingAs($studentUser, 'sanctum')->getJson('/api/assessment-grades')->assertForbidden();

        // Live Parent Portal reads released grades, assignments, and module progress, keeping attendance explicit unavailable
        $classId = DB::table('classes')->insertGetId([
            'teacher_id' => $teacherUser->id,
            'name' => 'Jaringan Dasar · XI TKJ 1',
            'ais_classroom_id' => $classroom->id,
            'ais_subject_id' => $subject->id,
            'sync_source' => 'ais',
        ]);
        DB::table('class_members')->insert(['class_id' => $classId, 'student_id' => $studentUser->id]);
        $modId = DB::table('modules')->insertGetId(['class_id' => $classId, 'file_name' => 'modul-routing.pdf', 'visibility' => 'public']);
        DB::table('module_reads')->insert(['module_id' => $modId, 'student_id' => $studentUser->id]);
        DB::table('quizzes')->insert([
            [
                'id' => 501,
                'class_id' => $classId,
                'title' => 'Kuis Routing Dasar',
                'assessment_type' => 'quiz',
                'status' => 'published',
                'release_mode' => 'manual',
                'results_released' => 1,
                'deadline' => now()->addDays(2),
            ],
            [
                'id' => 503,
                'class_id' => $classId,
                'title' => 'Tugas Belum Dirilis',
                'assessment_type' => 'assignment',
                'status' => 'published',
                'release_mode' => 'manual',
                'results_released' => 0,
                'deadline' => now()->addDays(5),
            ],
        ]);
        DB::table('attempts')->insert([
            'quiz_id' => 503,
            'student_id' => $studentUser->id,
            'status' => 'finished',
            'final_grade' => 88.00,
            'finished_at' => now(),
        ]);

        $this->actingAs($parentUser, 'sanctum')
            ->getJson("/api/member4/parent/children/{$student->id}/grades")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.summary.count', 1)
            ->assertJsonPath('data.summary.average_score', 90)
            ->assertJsonPath('data.items.0.title', 'Kuis Routing Dasar');

        $this->actingAs($parentUser, 'sanctum')
            ->getJson("/api/member4/parent/children/{$student->id}/assignments")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.items.0.completion_status', 'submitted')
            ->assertJsonPath('data.items.0.score', null);

        $this->actingAs($parentUser, 'sanctum')
            ->getJson("/api/member4/parent/children/{$student->id}/progress")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.total_modules', 1)
            ->assertJsonPath('data.read_modules', 1)
            ->assertJsonPath('data.module_completion_percentage', 100);

        $this->actingAs($parentUser, 'sanctum')
            ->getJson("/api/member4/parent/children/{$student->id}/attendance")
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null);
    }

    private function createSharedAssessmentBridgeTables(): void
    {
        if (! Schema::hasTable('classes')) {
            Schema::create('classes', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id');
                $table->string('name');
                $table->string('class_code', 16)->nullable();
                $table->unsignedBigInteger('ais_teaching_load_id')->nullable()->unique();
                $table->unsignedBigInteger('ais_classroom_id')->nullable();
                $table->unsignedBigInteger('ais_subject_id')->nullable();
                $table->string('sync_source', 20)->default('manual');
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('class_members')) {
            Schema::create('class_members', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('student_id');
                $table->timestamps();
            });
        }
    }

    private function createSharedAssessmentAcademicTables(): void
    {
        $this->createSharedAssessmentBridgeTables();
        if (! Schema::hasTable('modules')) {
            Schema::create('modules', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->string('file_name');
                $table->string('visibility')->default('public');
            });
        }
        if (! Schema::hasTable('module_reads')) {
            Schema::create('module_reads', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('module_id');
                $table->unsignedBigInteger('student_id');
            });
        }
        if (! Schema::hasTable('quizzes')) {
            Schema::create('quizzes', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->string('title');
                $table->string('assessment_type')->default('quiz');
                $table->string('course_name')->nullable();
                $table->string('status')->default('published');
                $table->string('release_mode')->default('immediate');
                $table->boolean('results_released')->default(false);
                $table->timestamp('deadline')->nullable();
            });
        }
        if (! Schema::hasTable('attempts')) {
            Schema::create('attempts', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('quiz_id');
                $table->unsignedBigInteger('student_id');
                $table->string('status')->default('finished');
                $table->decimal('final_grade', 6, 2)->nullable();
                $table->text('teacher_feedback')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->timestamp('graded_at')->nullable();
            });
        }
    }
}
