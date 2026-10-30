<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisAuditTest extends TestCase
{
    use RefreshDatabase;

    private function headers(): array
    {
        $this->seed(\Database\Seeders\RoleSeeder::class);
        $admin = User::factory()->create(['role_id' => Role::where('name', 'admin')->value('id'), 'status' => 'active']);
        return ['Authorization' => 'Bearer '.$admin->createToken('audit')->plainTextToken];
    }

    public function test_every_ais_resource_can_be_created_read_updated_and_deleted(): void
    {
        $h = $this->headers();
        $records = [];
        $create = function ($resource, $payload) use ($h, &$records) {
            $item = $this->postJson('/api/'.$resource, $payload, $h)->assertCreated()->json('data');
            $this->getJson('/api/'.$resource.'/'.$item['id'], $h)->assertOk()->assertJsonPath('data.id', $item['id']);
            $this->getJson('/api/'.$resource.'?per_page=1', $h)->assertOk()->assertJsonPath('meta.total', $resource === 'users' ? 2 : 1);
            $this->putJson('/api/'.$resource.'/'.$item['id'], $payload, $h)->assertOk();
            $records[] = [$resource, $item['id']];
            return $item['id'];
        };
        $department = $create('departments', ['code' => 'SCI', 'name' => 'Sains']);
        $program = $create('study-programs', ['code' => 'IPA', 'name' => 'IPA', 'department_id' => $department]);
        $year = $create('academic-years', ['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'status' => 'active']);
        $semester = $create('semesters', ['name' => 'Ganjil', 'academic_year_id' => $year, 'status' => 'active']);
        $create('users', ['name' => 'Pengguna', 'email' => 'user@test.id', 'password' => 'password123', 'role' => 'murid', 'status' => 'active']);
        $teacher = $create('teachers', ['teacher_number' => 'T1', 'name' => 'Guru', 'status' => 'active']);
        $student = $create('students', ['student_number' => 'S1', 'name' => 'Siswa', 'status' => 'active']);
        $create('parents', ['name' => 'Wali', 'student_ids' => [$student], 'status' => 'active']);
        $subject = $create('subjects', ['code' => 'BIO', 'name' => 'Biologi', 'study_program_id' => $program, 'credit_hours' => 2]);
        $create('curricula', ['name' => 'Kurikulum', 'period' => '2026', 'study_program_id' => $program, 'subject_ids' => [$subject], 'status' => 'active']);
        $room = $create('rooms', ['code' => 'R1', 'name' => 'Ruang 1', 'capacity' => 30]);
        $class = $create('classrooms', ['name' => 'X IPA', 'level' => '10', 'study_program_id' => $program, 'academic_year_id' => $year, 'homeroom_teacher_id' => $teacher]);
        $create('academic-calendars', ['name' => 'Awal Semester', 'start_date' => '2026-07-01', 'end_date' => '2026-07-01', 'academic_year_id' => $year, 'semester_id' => $semester]);
        $create('class-students', ['student_id' => $student, 'classroom_id' => $class, 'academic_year_id' => $year, 'semester_id' => $semester, 'status' => 'active']);
        $create('academic-registrations', ['student_id' => $student, 'academic_year_id' => $year, 'semester_id' => $semester, 'status' => 'pending']);
        $load = ['teacher_id' => $teacher, 'subject_id' => $subject, 'classroom_id' => $class, 'semester_id' => $semester, 'weekly_hours' => 4, 'status' => 'active'];
        $loadId = $create('teaching-loads', $load);
        $this->postJson('/api/teaching-loads', $load, $h)->assertUnprocessable();
        $this->putJson('/api/teaching-loads/'.$loadId, ['weekly_hours' => 0], $h)->assertUnprocessable();
        $otherYear = \App\Models\AcademicYear::create(['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30']);
        $otherSemester = \App\Models\Semester::create(['name' => 'Ganjil', 'academic_year_id' => $otherYear->id]);
        $this->putJson('/api/teaching-loads/'.$loadId, ['semester_id' => $otherSemester->id], $h)->assertUnprocessable();
        $this->postJson('/api/class-students', ['student_id' => $student, 'classroom_id' => $class, 'academic_year_id' => $otherYear->id, 'semester_id' => $otherSemester->id], $h)->assertUnprocessable();
        $this->putJson('/api/class-students/'.\App\Models\ClassStudent::first()->id, ['academic_year_id' => $otherYear->id, 'semester_id' => $otherSemester->id], $h)->assertUnprocessable();
        $this->deleteJson('/api/teachers/'.$teacher, $h)->assertUnprocessable();
        $create('schedules', ['subject_id' => $subject, 'teacher_id' => $teacher, 'classroom_id' => $class, 'room_id' => $room, 'academic_year_id' => $year, 'semester_id' => $semester, 'day' => 'monday', 'start_time' => '08:00', 'end_time' => '09:00', 'status' => 'active']);
        $this->putJson('/api/schedules/'.\App\Models\Schedule::first()->id, ['academic_year_id' => $otherYear->id, 'semester_id' => $otherSemester->id], $h)->assertUnprocessable();
        foreach (array_reverse($records) as [$resource, $id]) {
            $this->deleteJson('/api/'.$resource.'/'.$id, $h)->assertOk();
            $this->getJson('/api/'.$resource.'/'.$id, $h)->assertNotFound();
        }
    }

    public function test_admin_cannot_demote_self_and_deactivation_revokes_tokens(): void
    {
        $h = $this->headers();
        $admin = User::first();
        $this->putJson('/api/users/'.$admin->id, ['role' => 'guru'], $h)->assertUnprocessable();
        $other = User::factory()->create(['role_id' => $admin->role_id, 'status' => 'active']);
        $other->createToken('other');
        $this->putJson('/api/users/'.$other->id, ['status' => 'inactive'], $h)->assertOk();
        $this->assertSame(0, $other->tokens()->count());
        $this->getJson('/api/roles', $h)->assertOk()->assertJsonCount(4, 'data');
    }

    public function test_teaching_loads_require_active_admin(): void
    {
        $this->getJson('/api/teaching-loads')->assertUnauthorized();
        $this->seed(\Database\Seeders\RoleSeeder::class);
        foreach (['guru', 'murid', 'wali_murid'] as $name) {
            $user = User::factory()->create(['role_id' => Role::where('name', $name)->value('id'), 'status' => 'active']);
            $h = ['Authorization' => 'Bearer '.$user->createToken('audit')->plainTextToken];
            $this->getJson('/api/teaching-loads', $h)->assertForbidden();
            $this->postJson('/api/teaching-loads', [], $h)->assertForbidden();
        }
    }
}
