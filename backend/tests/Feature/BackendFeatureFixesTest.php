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
        ], $h)->assertCreated();

        $this->assertDatabaseHas('class_student', [
            'student_id' => $student->id,
            'classroom_id' => $cls2->id,
            'academic_year_id' => $year2->id,
        ]);

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

    public function test_classroom_update_syncs_shared_classes_rejects_year_change_with_children_and_guards_null_status(): void
    {
        ['headers' => $h] = $this->adminHeaders();
        $this->createSharedAssessmentBridgeTables();

        $teacherUser = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $studentUser = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);
        $teacher = Teacher::create(['user_id' => $teacherUser->id, 'teacher_number' => 'T-CLS', 'name' => 'Guru Kelas', 'status' => 'active']);
        $student = Student::create(['user_id' => $studentUser->id, 'student_number' => 'S-CLS', 'name' => 'Murid Kelas', 'status' => 'active']);

        $dept = Department::create(['code' => 'PPLG-C', 'name' => 'PPLG', 'status' => 'active']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'code' => 'RPL-C', 'name' => 'RPL', 'status' => 'active']);
        $year1 = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $year2 = AcademicYear::create(['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30', 'is_active' => false]);
        $semester = Semester::create(['academic_year_id' => $year1->id, 'name' => 'Ganjil', 'is_active' => true]);
        $subject = Subject::create(['study_program_id' => $prog->id, 'code' => 'BD-C', 'name' => 'Basis Data', 'status' => 'active']);

        // Store with explicit status: null defaults cleanly to active instead of 409 SQL failure
        $classroom = $this->postJson('/api/classrooms', [
            'name' => 'XII RPL 1',
            'level' => 'XII',
            'study_program_id' => $prog->id,
            'academic_year_id' => $year1->id,
            'homeroom_teacher_id' => $teacher->id,
            'status' => null,
        ], $h)->assertCreated()->assertJsonPath('data.status', 'active')->json('data');

        // Update with explicit status: null preserves current status cleanly
        $this->putJson('/api/classrooms/'.$classroom['id'], [
            'name' => 'XII RPL 1',
            'status' => null,
        ], $h)->assertOk()->assertJsonPath('data.status', 'active');

        $this->postJson('/api/class-students', [
            'student_id' => $student->id,
            'classroom_id' => $classroom['id'],
            'academic_year_id' => $year1->id,
            'semester_id' => $semester->id,
            'status' => 'active',
        ], $h)->assertCreated();

        $load = $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'classroom_id' => $classroom['id'],
            'semester_id' => $semester->id,
            'weekly_hours' => 4,
            'status' => 'active',
        ], $h)->assertCreated()->json('data');

        $assessmentClass = DB::table('classes')->where('ais_teaching_load_id', $load['id'])->first();
        $this->assertNotNull($assessmentClass);
        $this->assertSame('Basis Data · XII RPL 1', $assessmentClass->name);
        $this->assertDatabaseHas('class_members', ['class_id' => $assessmentClass->id, 'student_id' => $studentUser->id]);

        // Reject changing academic_year_id when children exist
        $this->putJson('/api/classrooms/'.$classroom['id'], [
            'academic_year_id' => $year2->id,
        ], $h)->assertUnprocessable();
        $this->assertSame($year1->id, (int) Classroom::findOrFail($classroom['id'])->academic_year_id);

        // Renaming classroom updates shared assessment class name
        $this->putJson('/api/classrooms/'.$classroom['id'], [
            'name' => 'XII RPL 2',
        ], $h)->assertOk();
        $this->assertSame('Basis Data · XII RPL 2', DB::table('classes')->where('id', $assessmentClass->id)->value('name'));

        // Deactivating classroom clears class_members, and reactivating restores them
        $this->putJson('/api/classrooms/'.$classroom['id'], ['status' => 'inactive'], $h)->assertOk();
        $this->assertDatabaseMissing('class_members', ['class_id' => $assessmentClass->id, 'student_id' => $studentUser->id]);

        $this->putJson('/api/classrooms/'.$classroom['id'], ['status' => 'active'], $h)->assertOk();
        $this->assertDatabaseHas('class_members', ['class_id' => $assessmentClass->id, 'student_id' => $studentUser->id]);
    }

    public function test_class_student_update_syncs_old_and_new_classrooms_rejects_duplicates_and_returns_class_id(): void
    {
        ['headers' => $h] = $this->adminHeaders();
        $this->createSharedAssessmentBridgeTables();

        $teacherUser = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $studentUser1 = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);
        $studentUser2 = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);

        $teacher = Teacher::create(['user_id' => $teacherUser->id, 'teacher_number' => 'T-CS', 'name' => 'Guru CS', 'status' => 'active']);
        $student1 = Student::create(['user_id' => $studentUser1->id, 'student_number' => 'S-CS1', 'name' => 'Murid Satu', 'status' => 'active']);
        $student2 = Student::create(['user_id' => $studentUser2->id, 'student_number' => 'S-CS2', 'name' => 'Murid Dua', 'status' => 'active']);

        $dept = Department::create(['code' => 'PPLG-CS', 'name' => 'PPLG', 'status' => 'active']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'code' => 'RPL-CS', 'name' => 'RPL', 'status' => 'active']);
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $semester = Semester::create(['academic_year_id' => $year->id, 'name' => 'Ganjil', 'is_active' => true]);
        $cls1 = Classroom::create(['name' => 'XI RPL 1', 'level' => 'XI', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $cls2 = Classroom::create(['name' => 'XI RPL 2', 'level' => 'XI', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $subj1 = Subject::create(['study_program_id' => $prog->id, 'code' => 'PBO-1', 'name' => 'PBO', 'status' => 'active']);
        $subj2 = Subject::create(['study_program_id' => $prog->id, 'code' => 'PWEB-1', 'name' => 'Pemrograman Web', 'status' => 'active']);

        $load1 = $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher->id, 'subject_id' => $subj1->id, 'classroom_id' => $cls1->id,
            'semester_id' => $semester->id, 'weekly_hours' => 4, 'status' => 'active',
        ], $h)->assertCreated()->json('data');

        $load2 = $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher->id, 'subject_id' => $subj2->id, 'classroom_id' => $cls2->id,
            'semester_id' => $semester->id, 'weekly_hours' => 4, 'status' => 'active',
        ], $h)->assertCreated()->json('data');

        $class1Id = DB::table('classes')->where('ais_teaching_load_id', $load1['id'])->value('id');
        $class2Id = DB::table('classes')->where('ais_teaching_load_id', $load2['id'])->value('id');

        // store() guards status: null and returns class_id + eager relations
        $placement1 = $this->postJson('/api/class-students', [
            'student_id' => $student1->id,
            'classroom_id' => $cls1->id,
            'academic_year_id' => $year->id,
            'semester_id' => $semester->id,
            'status' => null,
        ], $h)->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.class_id', $cls1->id)
            ->assertJsonPath('data.classroom.id', $cls1->id)
            ->assertJsonPath('data.student.id', $student1->id)
            ->assertJsonPath('data.academic_year.id', $year->id)
            ->assertJsonPath('data.semester.id', $semester->id)
            ->json('data');

        $this->assertDatabaseHas('class_members', ['class_id' => $class1Id, 'student_id' => $studentUser1->id]);

        // update() moves student from cls1 to cls2 -> syncs BOTH old and new classrooms, guards status: null, returns class_id + relations
        $this->putJson('/api/class-students/'.$placement1['id'], [
            'classroom_id' => $cls2->id,
            'status' => null,
        ], $h)->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.class_id', $cls2->id)
            ->assertJsonPath('data.classroom.id', $cls2->id)
            ->assertJsonPath('data.student.id', $student1->id)
            ->assertJsonPath('data.academic_year.id', $year->id)
            ->assertJsonPath('data.semester.id', $semester->id);

        $this->assertDatabaseMissing('class_members', ['class_id' => $class1Id, 'student_id' => $studentUser1->id]);
        $this->assertDatabaseHas('class_members', ['class_id' => $class2Id, 'student_id' => $studentUser1->id]);

        // Composite duplicate check on update() returns 422 instead of 409 (including nullable semester_id)
        $inactiveNullA = ClassStudent::create([
            'student_id' => $student2->id, 'classroom_id' => $cls1->id,
            'academic_year_id' => $year->id, 'semester_id' => null, 'status' => 'inactive',
        ]);
        $inactiveNullB = ClassStudent::create([
            'student_id' => $student2->id, 'classroom_id' => $cls2->id,
            'academic_year_id' => $year->id, 'semester_id' => null, 'status' => 'inactive',
        ]);

        $this->putJson('/api/class-students/'.$inactiveNullB->id, [
            'classroom_id' => $cls1->id,
        ], $h)->assertUnprocessable()->assertJsonPath('errors.classroom_id.0', 'Siswa sudah terdaftar di kelas ini pada periode tersebut.');
        $this->assertSame($cls1->id, (int) $inactiveNullA->fresh()->classroom_id);
    }

    public function test_teaching_load_filters_and_upstream_roster_sync(): void
    {
        ['headers' => $h] = $this->adminHeaders();
        $this->createSharedAssessmentBridgeTables();

        $teacherUser1 = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $teacherUser2 = User::factory()->create(['role_id' => Role::where('name', 'guru')->value('id'), 'status' => 'active']);
        $studentUser = User::factory()->create(['role_id' => Role::where('name', 'murid')->value('id'), 'status' => 'active']);

        $teacher1 = Teacher::create(['user_id' => $teacherUser1->id, 'teacher_number' => 'T-F1', 'name' => 'Guru Satu', 'status' => 'active']);
        $teacher2 = Teacher::create(['user_id' => $teacherUser2->id, 'teacher_number' => 'T-F2', 'name' => 'Guru Dua', 'status' => 'active']);
        $student = Student::create(['user_id' => $studentUser->id, 'student_number' => 'S-F1', 'name' => 'Murid Filter', 'status' => 'active']);

        $dept = Department::create(['code' => 'PPLG-F', 'name' => 'PPLG', 'status' => 'active']);
        $prog = StudyProgram::create(['department_id' => $dept->id, 'code' => 'RPL-F', 'name' => 'RPL', 'status' => 'active']);
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $semester = Semester::create(['academic_year_id' => $year->id, 'name' => 'Ganjil', 'is_active' => true]);
        $cls1 = Classroom::create(['name' => 'X RPL 1', 'level' => '10', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $cls2 = Classroom::create(['name' => 'X RPL 2', 'level' => '10', 'study_program_id' => $prog->id, 'academic_year_id' => $year->id, 'status' => 'active']);
        $subj1 = Subject::create(['study_program_id' => $prog->id, 'code' => 'INF-1', 'name' => 'Informatika', 'status' => 'active']);
        $subj2 = Subject::create(['study_program_id' => $prog->id, 'code' => 'MTK-1', 'name' => 'Matematika', 'status' => 'active']);

        $this->postJson('/api/class-students', [
            'student_id' => $student->id,
            'classroom_id' => $cls1->id,
            'academic_year_id' => $year->id,
            'semester_id' => $semester->id,
        ], $h)->assertCreated();

        $load1 = $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher1->id, 'subject_id' => $subj1->id, 'classroom_id' => $cls1->id,
            'semester_id' => $semester->id, 'weekly_hours' => 4, 'status' => 'active',
        ], $h)->assertCreated()->json('data');

        $this->postJson('/api/teaching-loads', [
            'teacher_id' => $teacher2->id, 'subject_id' => $subj2->id, 'classroom_id' => $cls2->id,
            'semester_id' => $semester->id, 'weekly_hours' => 3, 'status' => 'active',
        ], $h)->assertCreated();

        $this->getJson('/api/teaching-loads?classroom_id='.$cls1->id, $h)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $load1['id']);

        $this->getJson('/api/teaching-loads?subject_id='.$subj2->id, $h)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.subject_id', $subj2->id);

        $classId = DB::table('classes')->where('ais_teaching_load_id', $load1['id'])->value('id');
        $this->assertDatabaseHas('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);

        // Subject rename & status update propagates to shared assessment tables
        $this->putJson('/api/subjects/'.$subj1->id, ['name' => 'Informatika Terapan'], $h)->assertOk();
        $this->assertSame('Informatika Terapan · X RPL 1', DB::table('classes')->where('id', $classId)->value('name'));
        $this->putJson('/api/subjects/'.$subj1->id, ['status' => 'inactive'], $h)->assertOk();
        $this->assertDatabaseMissing('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);
        $this->putJson('/api/subjects/'.$subj1->id, ['status' => 'active'], $h)->assertOk();
        $this->assertDatabaseHas('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);

        // Student deactivation removes from class_members, reactivation restores
        $this->putJson('/api/students/'.$student->id, ['status' => 'inactive'], $h)->assertOk();
        $this->assertDatabaseMissing('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);
        $this->putJson('/api/students/'.$student->id, ['status' => 'active'], $h)->assertOk();
        $this->assertDatabaseHas('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);

        // Teacher deactivation clears class_members, reactivation restores
        $this->putJson('/api/teachers/'.$teacher1->id, ['status' => 'inactive'], $h)->assertOk();
        $this->assertDatabaseMissing('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);
        $this->putJson('/api/teachers/'.$teacher1->id, ['status' => 'active'], $h)->assertOk();
        $this->assertDatabaseHas('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);

        // Inactive teacher user deactivates assessment class members on syncTeachingLoad
        $teacherUser1->update(['status' => 'inactive']);
        app(\App\Services\AisAssessmentRosterBridge::class)->syncTeachingLoad($load1['id']);
        $this->assertDatabaseMissing('class_members', ['class_id' => $classId, 'student_id' => $studentUser->id]);
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
}
