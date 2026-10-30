<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisTahap7Test extends TestCase
{
    use RefreshDatabase;

    private function seedRoles(): void
    {
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function createUser(string $role, string $email, string $password = 'password123'): User
    {
        return User::factory()->create([
            'email' => $email,
            'password' => $password,
            'role_id' => Role::where('name', $role)->value('id'),
            'status' => 'active',
        ]);
    }

    private function adminHeaders(): array
    {
        $this->seedRoles();
        $this->createUser('admin', 'admin@akademik.test', 'admin123');

        $token = $this->postJson('/api/auth/login', [
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
        ])->assertOk()->json('token');

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_alur_end_to_end_ais(): void
    {
        $h = $this->adminHeaders();

        $dep = $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Teknik Komputer'], $h)->assertStatus(201)->json('data');
        $prodi = $this->postJson('/api/study-programs', ['department_id' => $dep['id'], 'code' => 'TK-S1', 'name' => 'S1 TK'], $h)->assertStatus(201)->json('data');
        $tahun = $this->postJson('/api/academic-years', ['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'status' => 'active'], $h)->assertStatus(201)->json('data');
        $sem = $this->postJson('/api/semesters', ['academic_year_id' => $tahun['id'], 'name' => 'Ganjil', 'period' => '2026/2027 Ganjil', 'status' => 'active'], $h)->assertStatus(201)->json('data');
        $guru = $this->postJson('/api/teachers', ['teacher_number' => 'T001', 'name' => 'Budi'], $h)->assertStatus(201)->json('data');
        $siswa = $this->postJson('/api/students', ['student_number' => 'S001', 'name' => 'Andi'], $h)->assertStatus(201)->json('data');
        $wali = $this->postJson('/api/parents', ['name' => 'Agus', 'student_ids' => [$siswa['id']]], $h)->assertStatus(201)->json('data');
        $mapel = $this->postJson('/api/subjects', ['study_program_id' => $prodi['id'], 'code' => 'TK101', 'name' => 'Pemrograman'], $h)->assertStatus(201)->json('data');
        $ruang = $this->postJson('/api/rooms', ['code' => 'R-101', 'name' => 'Ruang 101', 'capacity' => 30], $h)->assertStatus(201)->json('data');
        $kelas = $this->postJson('/api/classrooms', ['name' => 'TK-A', 'level' => '10', 'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id'], 'homeroom_teacher_id' => $guru['id']], $h)->assertStatus(201)->json('data');

        $this->postJson('/api/class-students', [
            'student_id' => $siswa['id'], 'classroom_id' => $kelas['id'],
            'academic_year_id' => $tahun['id'], 'semester_id' => $sem['id'],
        ], $h)->assertStatus(201);

        $reg = $this->postJson('/api/academic-registrations', [
            'student_id' => $siswa['id'], 'academic_year_id' => $tahun['id'], 'semester_id' => $sem['id'],
        ], $h)->assertStatus(201)->json('data');

        $this->putJson('/api/academic-registrations/' . $reg['id'], ['status' => 'approved'], $h)->assertOk();

        $this->postJson('/api/schedules', [
            'subject_id' => $mapel['id'], 'classroom_id' => $kelas['id'], 'teacher_id' => $guru['id'],
            'room_id' => $ruang['id'], 'semester_id' => $sem['id'], 'academic_year_id' => $tahun['id'],
            'day' => 'monday', 'start_time' => '08:00', 'end_time' => '09:30',
        ], $h)->assertStatus(201);

        $dashboard = $this->getJson('/api/dashboard', $h)->assertOk()->json('data');
        $stats = collect($dashboard['stats'])->pluck('value', 'resource');

        $this->assertEquals(1, $stats['students']);
        $this->assertEquals(1, $stats['teachers']);
        $this->assertEquals(1, $stats['parents']);
        $this->assertEquals(1, $stats['classrooms']);
        $this->assertEquals('2026/2027', $dashboard['active_academic_year']['name']);
        $this->assertEquals('Ganjil', $dashboard['active_semester']['name']);
        $this->assertNotEmpty($wali['id']);
    }

    public function test_otorisasi_empat_role_diblokir_backend(): void
    {
        $this->seedRoles();

        // Tamu (tanpa token) ditolak — dicek lebih dulu sebelum state auth apa pun
        $this->getJson('/api/users')->assertStatus(401);
        $this->getJson('/api/dashboard')->assertStatus(401);

        $admin = $this->createUser('admin', 'admin@akademik.test', 'admin123');
        $guru = $this->createUser('guru', 'guru@akademik.test');
        $murid = $this->createUser('murid', 'murid@akademik.test');
        $wali = $this->createUser('wali_murid', 'wali@akademik.test');

        // Login non-admin ditolak
        foreach (['guru@akademik.test', 'murid@akademik.test', 'wali@akademik.test'] as $email) {
            $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'password123'])->assertStatus(403);
        }

        // Token langsung pun tetap 403 di semua endpoint admin
        foreach ([$guru, $murid, $wali] as $user) {
            $headers = ['Authorization' => 'Bearer ' . $user->createToken('t')->plainTextToken];

            $this->getJson('/api/users', $headers)->assertStatus(403);
            $this->getJson('/api/students', $headers)->assertStatus(403);
            $this->getJson('/api/schedules', $headers)->assertStatus(403);
            $this->getJson('/api/dashboard', $headers)->assertStatus(403);
        }

        // Tanpa token 401 (tamu) sudah dicek di awal test.
    }

    public function test_foreign_key_dan_duplikat_ditolak(): void
    {
        $h = $this->adminHeaders();

        $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Teknik Komputer'], $h)->assertStatus(201);
        $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Lain'], $h)->assertStatus(422);

        $this->postJson('/api/study-programs', ['department_id' => 999999, 'code' => 'X', 'name' => 'X'], $h)->assertStatus(422);
        $this->postJson('/api/students', ['student_number' => 'S001', 'name' => 'Andi'], $h)->assertStatus(201);
        $this->postJson('/api/students', ['student_number' => 'S001', 'name' => 'Duplikat'], $h)->assertStatus(422);

        $this->postJson('/api/classrooms', [
            'name' => 'TK-A', 'level' => '10', 'study_program_id' => 999999, 'academic_year_id' => 999999,
        ], $h)->assertStatus(422);
    }

    public function test_matriks_konflik_jadwal(): void
    {
        $h = $this->adminHeaders();

        $dep = $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'TK'], $h)->json('data');
        $prodi = $this->postJson('/api/study-programs', ['department_id' => $dep['id'], 'code' => 'P1', 'name' => 'P1'], $h)->json('data');
        $tahun = $this->postJson('/api/academic-years', ['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30'], $h)->json('data');
        $sem = $this->postJson('/api/semesters', ['academic_year_id' => $tahun['id'], 'name' => 'Ganjil'], $h)->json('data');
        $g1 = $this->postJson('/api/teachers', ['teacher_number' => 'T1', 'name' => 'G1'], $h)->json('data');
        $g2 = $this->postJson('/api/teachers', ['teacher_number' => 'T2', 'name' => 'G2'], $h)->json('data');
        $k1 = $this->postJson('/api/classrooms', ['name' => 'A', 'level' => '10', 'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id']], $h)->json('data');
        $k2 = $this->postJson('/api/classrooms', ['name' => 'B', 'level' => '10', 'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id']], $h)->json('data');
        $m1 = $this->postJson('/api/subjects', ['code' => 'M1', 'name' => 'M1'], $h)->json('data');
        $m2 = $this->postJson('/api/subjects', ['code' => 'M2', 'name' => 'M2'], $h)->json('data');
        $r1 = $this->postJson('/api/rooms', ['code' => 'R1', 'name' => 'R1', 'capacity' => 30], $h)->json('data');
        $r2 = $this->postJson('/api/rooms', ['code' => 'R2', 'name' => 'R2', 'capacity' => 30], $h)->json('data');

        $base = [
            'subject_id' => $m1['id'], 'classroom_id' => $k1['id'], 'teacher_id' => $g1['id'],
            'room_id' => $r1['id'], 'semester_id' => $sem['id'], 'academic_year_id' => $tahun['id'],
            'day' => 'monday', 'start_time' => '08:00', 'end_time' => '09:00',
        ];

        $this->postJson('/api/schedules', $base, $h)->assertStatus(201);

        // Jadwal nonaktif yang overlap tidak menghalangi jadwal aktif baru di slot beda guru/kelas/ruang
        $this->postJson('/api/schedules', array_merge($base, [
            'subject_id' => $m2['id'], 'classroom_id' => $k2['id'], 'teacher_id' => $g2['id'],
            'room_id' => $r2['id'], 'status' => 'inactive',
        ]), $h)->assertStatus(201);

        // Overlap tepat di batas (09:00-10:00) boleh karena tidak beririsan:
        // start_lama(08:00) < end_baru(10:00) true, end_lama(09:00) > start_baru(09:00) false -> lolos
        $this->postJson('/api/schedules', array_merge($base, [
            'subject_id' => $m2['id'], 'start_time' => '09:00', 'end_time' => '10:00',
        ]), $h)->assertStatus(201);
    }
}
