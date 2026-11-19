<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\Classroom;
use App\Models\ClassStudent;
use App\Models\Department;
use App\Models\Guardian;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudyProgram;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\Member4\ParentAcademicData;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BackendFeatureFixesTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'admin')->value('id'),
            'status' => 'active',
        ]);

        return [
            'headers' => ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken],
            'admin' => $admin,
        ];
    }

    public function test_students_index_returns_placement_fields_filters_and_promotes(): void
    {
        ['headers' => $h] = $this->adminHeaders();

        $dept = Department::create(['code' => 'PPLG', 'name' => 'RPL', 'status' => 'active']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'code' => 'RPL', 'name' => 'RPL', 'status' => 'active']);
        $year1 = AcademicYear::create(['name' => '2025/2026', 'start_date' => '2025-07-01', 'end_date' => '2026-06-30', 'is_active' => true]);
        $sem1 = Semester::create(['academic_year_id' => $year1->id, 'name' => 'Genap', 'is_active' => true]);
        $year2 = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => false]);
        $sem2 = Semester::create(['academic_year_id' => $year2->id, 'name' => 'Ganjil', 'is_active' => false]);

        $cls1 = Classroom::create(['name' => 'X RPL 1', 'level' => 'X', 'study_program_id' => $prog->id, 'academic_year_id' => $year1->id, 'status' => 'active']);
        $cls2 = Classroom::create(['name' => 'XI RPL 1', 'level' => 'XI', 'study_program_id' => $prog->id, 'academic_year_id' => $year2->id, 'status' => 'active']);

        $student = Student::create(['student_number' => 'S-01', 'name' => 'Siswa Uji', 'status' => 'active']);
        ClassStudent::create([
            'student_id' => $student->id,
            'classroom_id' => $cls1->id,
            'academic_year_id' => $year1->id,
            'semester_id' => $sem1->id,
            'status' => 'active',
        ]);

        $this->getJson('/api/students?level=10&study_program_id='.$prog->id.'&academic_year_id='.$year1->id, $h)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.class_name', 'X RPL 1')
            ->assertJsonPath('data.0.level', 'X')
            ->assertJsonPath('data.0.study_program_id', $prog->id);

        $this->getJson('/api/students?level=11', $h)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->postJson('/api/students/'.$student->id.'/promote', [
            'academic_year_id' => $year2->id,
            'semester_id' => $sem2->id,
            'classroom_id' => $cls2->id,
        ], $h)->assertCreated()
            ->assertJsonPath('data.class_name', 'XI RPL 1')
            ->assertJsonPath('data.academic_year_id', $year2->id);

        $this->assertDatabaseHas('class_student', [
            'student_id' => $student->id,
            'classroom_id' => $cls2->id,
            'academic_year_id' => $year2->id,
        ]);

        // Promotion must be visible even while the previous school year is active.
        $this->getJson('/api/students/'.$student->id, $h)
            ->assertOk()
            ->assertJsonPath('data.class_name', 'XI RPL 1');
        $this->getJson('/api/students', $h)
            ->assertOk()
            ->assertJsonPath('data.0.class_name', 'XI RPL 1');

        // Explicit historical filters must display the matching placement.
        $this->getJson('/api/students?academic_year_id='.$year1->id, $h)
            ->assertOk()
            ->assertJsonPath('data.0.class_name', 'X RPL 1');
        $this->getJson('/api/students?level=10', $h)
            ->assertOk()
            ->assertJsonPath('data.0.class_name', 'X RPL 1');

        // Duplicate promotion to the same active period returns 422 instead of creating duplicate
        $this->postJson('/api/students/'.$student->id.'/promote', [
            'academic_year_id' => $year2->id,
            'semester_id' => $sem2->id,
            'classroom_id' => $cls2->id,
        ], $h)->assertUnprocessable();
    }

    public function test_user_profile_sync_and_delete_constraints_return_422(): void
    {
        ['headers' => $h, 'admin' => $admin] = $this->adminHeaders();

        $guruUser = $this->postJson('/api/users', [
            'name' => 'Pak Guru',
            'email' => 'pak.guru@bhaktiprajabatang.sch.id',
            'password' => 'Password123!',
            'role' => 'guru',
            'status' => 'active',
            'sync_profile' => true,
        ], $h)->assertCreated()->json('data');

        $this->assertDatabaseHas('teachers', [
            'user_id' => $guruUser['id'],
            'teacher_number' => 'AKUN-'.$guruUser['id'],
            'name' => 'Pak Guru',
            'status' => 'active',
        ]);

        $this->putJson('/api/users/'.$guruUser['id'], [
            'name' => 'Pak Guru Updated',
            'status' => 'inactive',
        ], $h)->assertOk();

        $this->assertDatabaseHas('teachers', [
            'user_id' => $guruUser['id'],
            'name' => 'Pak Guru Updated',
            'status' => 'inactive',
        ]);

        // FK delete protection returns 422 across resources instead of SQL 500
        $dept = Department::create(['code' => 'TO', 'name' => 'Otomotif', 'status' => 'active']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'code' => 'TKR', 'name' => 'TKR', 'status' => 'active']);
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $sem = Semester::create(['academic_year_id' => $year->id, 'name' => 'Ganjil', 'is_active' => true]);
        $teacher = Teacher::where('user_id', $guruUser['id'])->firstOrFail();
        $subj = Subject::create(['study_program_id' => $prog->id, 'code' => 'MTK', 'name' => 'Matematika', 'status' => 'active']);
        $room = Room::create(['code' => 'R1', 'name' => 'Ruang 1', 'capacity' => 30, 'status' => 'active']);
        $cls = Classroom::create(['name' => 'X TKR 1', 'level' => 'X', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $student = Student::create(['student_number' => 'S-02', 'name' => 'Anak Tagihan', 'status' => 'active']);
        ClassStudent::create(['student_id' => $student->id, 'classroom_id' => $cls->id, 'academic_year_id' => $year->id, 'semester_id' => $sem->id, 'status' => 'active']);
        TeachingLoad::create(['teacher_id' => $teacher->id, 'subject_id' => $subj->id, 'classroom_id' => $cls->id, 'semester_id' => $sem->id, 'weekly_hours' => 4, 'status' => 'active']);
        Schedule::create(['subject_id' => $subj->id, 'classroom_id' => $cls->id, 'teacher_id' => $teacher->id, 'room_id' => $room->id, 'semester_id' => $sem->id, 'academic_year_id' => $year->id, 'day' => 'monday', 'start_time' => '08:00', 'end_time' => '09:00', 'status' => 'active']);
        Invoice::create(['student_id' => $student->id, 'created_by' => $admin->id, 'invoice_type' => 'spp', 'amount' => '100000.00', 'due_date' => now()->addDays(7)->toDateString()]);

        $this->deleteJson('/api/teachers/'.$teacher->id, $h)->assertUnprocessable();
        $this->deleteJson('/api/classrooms/'.$cls->id, $h)->assertUnprocessable();
        $this->deleteJson('/api/semesters/'.$sem->id, $h)->assertUnprocessable();
        $this->deleteJson('/api/subjects/'.$subj->id, $h)->assertUnprocessable();
        $this->deleteJson('/api/rooms/'.$room->id, $h)->assertUnprocessable();
        $this->deleteJson('/api/students/'.$student->id, $h)->assertUnprocessable();

        $author = User::factory()->create(['role_id' => $admin->role_id, 'status' => 'active']);
        Announcement::create(['created_by' => $author->id, 'title' => 'Info', 'content' => 'Isi', 'target_role' => 'all']);
        $this->deleteJson('/api/users/'.$author->id, $h)->assertUnprocessable();
    }

    public function test_parent_academic_data_reads_published_lms_assignments_when_present(): void
    {
        $this->seed(RoleSeeder::class);
        $pupil = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);
        $teacher = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $student = Student::create(['user_id' => $pupil->id, 'student_number' => 'S-LMS', 'name' => 'Murid LMS', 'status' => 'active']);

        Schema::create('classes', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('teacher_id');
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('class_members', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('student_id');
            $table->timestamps();
        });
        Schema::create('assignments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('deadline')->nullable();
            $table->string('status', 32)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        $classId = DB::table('classes')->insertGetId(['teacher_id' => $teacher->id, 'name' => 'RPL XI']);
        DB::table('class_members')->insert(['class_id' => $classId, 'student_id' => $pupil->id]);
        DB::table('assignments')->insert([
            ['class_id' => $classId, 'title' => 'Tugas Terbit', 'status' => 'published', 'deadline' => now()->addDays(2)],
            ['class_id' => $classId, 'title' => 'Draft Tugas', 'status' => 'draft', 'deadline' => now()->addDays(3)],
        ]);

        $res = app(ParentAcademicData::class)->read('assignments', $student);
        $this->assertTrue($res['available']);
        $this->assertCount(1, $res['data']['items']);
        $this->assertSame('Tugas Terbit', $res['data']['items'][0]['title']);
    }
}
