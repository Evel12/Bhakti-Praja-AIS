<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisTahap4Test extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $adminRole = Role::where('name', 'admin')->value('id');

        User::factory()->create([
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
            'role_id' => $adminRole,
            'status' => 'active',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
        ])->json('token');

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_master_departments_dan_study_programs(): void
    {
        $h = $this->adminHeaders();

        $dep = $this->postJson('/api/departments', [
            'code' => 'TK', 'name' => 'Teknik Komputer',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/departments', [
            'code' => 'TK', 'name' => 'Duplikat',
        ], $h)->assertStatus(422);

        $this->postJson('/api/study-programs', [
            'department_id' => 999999, 'code' => 'X', 'name' => 'X',
        ], $h)->assertStatus(422);

        $prodi = $this->postJson('/api/study-programs', [
            'department_id' => $dep['id'], 'code' => 'TK-S1', 'name' => 'S1 Teknik Komputer',
        ], $h)->assertStatus(201)->json('data');

        $this->getJson('/api/study-programs?department_id=' . $dep['id'], $h)->assertOk();

        // Hapus ditolak karena masih dipakai
        $this->deleteJson('/api/departments/' . $dep['id'], [], $h)->assertStatus(422);

        $this->assertEquals($dep['id'], $prodi['department_id']);
    }

    public function test_master_siswa_guru_wali(): void
    {
        $h = $this->adminHeaders();

        $siswa = $this->postJson('/api/students', [
            'student_number' => 'S001', 'name' => 'Andi',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/students', [
            'student_number' => 'S001', 'name' => 'Duplikat',
        ], $h)->assertStatus(422);

        $guru = $this->postJson('/api/teachers', [
            'teacher_number' => 'T001', 'name' => 'Budi',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/teachers', [
            'teacher_number' => 'T001', 'name' => 'Duplikat',
        ], $h)->assertStatus(422);

        $wali = $this->postJson('/api/parents', [
            'name' => 'Agus', 'email' => 'agus@example.test',
            'student_ids' => [$siswa['id']], 'relationship' => 'ayah',
        ], $h)->assertStatus(201)->json('data');

        $detail = $this->getJson('/api/parents/' . $wali['id'], $h)->assertOk()->json('data');

        $this->assertCount(1, $detail['students']);
        $this->assertEquals('T001', $guru['teacher_number']);
    }

    public function test_tahun_semester_kalender(): void
    {
        $h = $this->adminHeaders();

        $this->postJson('/api/academic-years', [
            'name' => '2026/2027', 'start_date' => '2027-06-30', 'end_date' => '2026-07-01',
        ], $h)->assertStatus(422);

        $tahun = $this->postJson('/api/academic-years', [
            'name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'status' => 'active',
        ], $h)->assertStatus(201)->json('data');

        $this->assertEquals('active', $tahun['status']);

        $sem = $this->postJson('/api/semesters', [
            'academic_year_id' => $tahun['id'], 'name' => 'Ganjil',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/semesters', [
            'academic_year_id' => $tahun['id'], 'name' => 'Ganjil',
        ], $h)->assertStatus(422);

        // Semester beda tahun tidak boleh dipakai untuk kalender tahun ini
        $tahun2 = $this->postJson('/api/academic-years', [
            'name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30',
        ], $h)->assertStatus(201)->json('data');

        $sem2 = $this->postJson('/api/semesters', [
            'academic_year_id' => $tahun2['id'], 'name' => 'Ganjil',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/academic-calendars', [
            'academic_year_id' => $tahun['id'],
            'semester_id' => $sem2['id'],
            'name' => 'Salah Relasi',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-02',
        ], $h)->assertStatus(422);

        $this->postJson('/api/academic-calendars', [
            'academic_year_id' => $tahun['id'],
            'semester_id' => $sem['id'],
            'name' => 'MPLS',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-03',
        ], $h)->assertStatus(201);
    }

    public function test_mapel_kurikulum_ruang_kelas(): void
    {
        $h = $this->adminHeaders();

        $dep = $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Teknik Komputer'], $h)->json('data');
        $prodi = $this->postJson('/api/study-programs', ['department_id' => $dep['id'], 'code' => 'TK-S1', 'name' => 'S1 TK'], $h)->json('data');

        $mapel = $this->postJson('/api/subjects', [
            'study_program_id' => $prodi['id'], 'code' => 'TK101', 'name' => 'Pemrograman Dasar',
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/subjects', [
            'code' => 'TK101', 'name' => 'Duplikat',
        ], $h)->assertStatus(422);

        $kur = $this->postJson('/api/curricula', [
            'study_program_id' => $prodi['id'], 'name' => 'Kurikulum 2026', 'period' => '2026',
            'subject_ids' => [$mapel['id']],
        ], $h)->assertStatus(201)->json('data');

        $this->assertEquals('2026', $kur['period']);

        $this->postJson('/api/rooms', [
            'code' => 'R-101', 'name' => 'Ruang 101', 'capacity' => 0,
        ], $h)->assertStatus(422);

        $this->postJson('/api/rooms', [
            'code' => 'R-101', 'name' => 'Ruang 101', 'capacity' => 30,
        ], $h)->assertStatus(201);

        $tahun = $this->postJson('/api/academic-years', [
            'name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30',
        ], $h)->json('data');

        $kelas = $this->postJson('/api/classrooms', [
            'name' => 'TK-A', 'level' => '10',
            'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id'],
        ], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/classrooms', [
            'name' => 'TK-A', 'level' => '10',
            'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id'],
        ], $h)->assertStatus(422);

        // Alias /classes harus sama dengan /classrooms
        $this->getJson('/api/classes/' . $kelas['id'], $h)->assertOk();
    }

    public function test_rbac_master_ditolak_untuk_guru(): void
    {
        $h = $this->adminHeaders();

        $guruRole = Role::where('name', 'guru')->value('id');

        User::factory()->create([
            'email' => 'guru@akademik.test',
            'role_id' => $guruRole,
            'status' => 'active',
        ]);

        $guruToken = $this->postJson('/api/auth/login', [
            'email' => 'guru@akademik.test',
            'password' => 'password',
        ]);

        // Guru bahkan tidak bisa login ke area admin
        $guruToken->assertStatus(403);
    }
}
