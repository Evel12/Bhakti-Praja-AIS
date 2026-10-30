<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisTahap5Test extends TestCase
{
    use RefreshDatabase;

    private array $headers = [];

    private array $ids = [];

    protected function setUp(): void
    {
        parent::setUp();

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

        $this->headers = ['Authorization' => "Bearer {$token}"];

        $dep = $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Teknik Komputer'], $this->headers)->json('data');
        $prodi = $this->postJson('/api/study-programs', ['department_id' => $dep['id'], 'code' => 'TK-S1', 'name' => 'S1 TK'], $this->headers)->json('data');
        $tahun = $this->postJson('/api/academic-years', ['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'status' => 'active'], $this->headers)->json('data');
        $sem = $this->postJson('/api/semesters', ['academic_year_id' => $tahun['id'], 'name' => 'Ganjil', 'status' => 'active'], $this->headers)->json('data');
        $siswa = $this->postJson('/api/students', ['student_number' => 'S001', 'name' => 'Andi'], $this->headers)->json('data');
        $siswa2 = $this->postJson('/api/students', ['student_number' => 'S002', 'name' => 'Siti'], $this->headers)->json('data');
        $guru = $this->postJson('/api/teachers', ['teacher_number' => 'T001', 'name' => 'Budi'], $this->headers)->json('data');
        $guru2 = $this->postJson('/api/teachers', ['teacher_number' => 'T002', 'name' => 'Citra'], $this->headers)->json('data');
        $kelas = $this->postJson('/api/classrooms', ['name' => 'TK-A', 'level' => '10', 'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id']], $this->headers)->json('data');
        $kelas2 = $this->postJson('/api/classrooms', ['name' => 'TK-B', 'level' => '10', 'study_program_id' => $prodi['id'], 'academic_year_id' => $tahun['id']], $this->headers)->json('data');
        $mapel = $this->postJson('/api/subjects', ['study_program_id' => $prodi['id'], 'code' => 'TK101', 'name' => 'Pemrograman'], $this->headers)->json('data');
        $mapel2 = $this->postJson('/api/subjects', ['study_program_id' => $prodi['id'], 'code' => 'TK102', 'name' => 'Jaringan'], $this->headers)->json('data');
        $ruang = $this->postJson('/api/rooms', ['code' => 'R-101', 'name' => 'Ruang 101', 'capacity' => 30], $this->headers)->json('data');
        $ruang2 = $this->postJson('/api/rooms', ['code' => 'R-102', 'name' => 'Ruang 102', 'capacity' => 30], $this->headers)->json('data');

        $this->ids = compact('dep', 'prodi', 'tahun', 'sem', 'siswa', 'siswa2', 'guru', 'guru2', 'kelas', 'kelas2', 'mapel', 'mapel2', 'ruang', 'ruang2');
    }

    public function test_pembagian_kelas_tolak_penempatan_ganda_aktif(): void
    {
        $h = $this->headers;
        $ids = $this->ids;

        $this->postJson('/api/class-students', [
            'student_id' => $ids['siswa']['id'],
            'classroom_id' => $ids['kelas']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'semester_id' => $ids['sem']['id'],
        ], $h)->assertStatus(201);

        // Siswa sama, kelas beda, periode sama -> konflik
        $this->postJson('/api/class-students', [
            'student_id' => $ids['siswa']['id'],
            'classroom_id' => $ids['kelas2']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'semester_id' => $ids['sem']['id'],
        ], $h)->assertStatus(422);

        // Lihat anggota kelas
        $this->getJson('/api/class-students?classroom_id=' . $ids['kelas']['id'], $h)
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        // Pindah: nonaktifkan dulu lalu tempatkan ke kelas baru
        $first = $this->getJson('/api/class-students?student_id=' . $ids['siswa']['id'], $h)->json('data.0');

        $this->putJson('/api/class-students/' . $first['id'], ['status' => 'inactive'], $h)->assertOk();

        $this->postJson('/api/class-students', [
            'student_id' => $ids['siswa']['id'],
            'class_id' => $ids['kelas2']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'semester_id' => $ids['sem']['id'],
        ], $h)->assertStatus(201);
    }

    public function test_registrasi_tolak_duplikat_dan_bisa_ubah_status(): void
    {
        $h = $this->headers;
        $ids = $this->ids;

        $reg = $this->postJson('/api/academic-registrations', [
            'student_id' => $ids['siswa']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'semester_id' => $ids['sem']['id'],
        ], $h)->assertStatus(201)->json('data');

        $this->assertNotEmpty($reg['registration_number']);
        $this->assertEquals('pending', $reg['status']);

        $this->postJson('/api/academic-registrations', [
            'student_id' => $ids['siswa']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'semester_id' => $ids['sem']['id'],
        ], $h)->assertStatus(422);

        $this->putJson('/api/academic-registrations/' . $reg['id'], ['status' => 'approved'], $h)
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->getJson('/api/academic-registrations?status=approved', $h)->assertOk();
    }

    public function test_jadwal_validasi_waktu_dan_konflik(): void
    {
        $h = $this->headers;
        $ids = $this->ids;

        $payload = [
            'subject_id' => $ids['mapel']['id'],
            'classroom_id' => $ids['kelas']['id'],
            'teacher_id' => $ids['guru']['id'],
            'room_id' => $ids['ruang']['id'],
            'semester_id' => $ids['sem']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'day' => 'monday',
            'start_time' => '08:00',
            'end_time' => '09:30',
        ];

        // Jam selesai sebelum mulai
        $this->postJson('/api/schedules', array_merge($payload, ['end_time' => '07:00']), $h)->assertStatus(422);

        $this->postJson('/api/schedules', $payload, $h)->assertStatus(201);

        // Konflik guru (guru sama, kelas+ruang beda, waktu overlap)
        $this->postJson('/api/schedules', array_merge($payload, [
            'classroom_id' => $ids['kelas2']['id'],
            'room_id' => $ids['ruang2']['id'],
            'subject_id' => $ids['mapel2']['id'],
            'start_time' => '09:00',
            'end_time' => '10:00',
        ]), $h)->assertStatus(422)->assertJsonPath('success', false);

        // Konflik kelas
        $this->postJson('/api/schedules', array_merge($payload, [
            'teacher_id' => $ids['guru2']['id'],
            'room_id' => $ids['ruang2']['id'],
            'subject_id' => $ids['mapel2']['id'],
            'start_time' => '09:00',
            'end_time' => '10:00',
        ]), $h)->assertStatus(422);

        // Konflik ruang
        $this->postJson('/api/schedules', array_merge($payload, [
            'teacher_id' => $ids['guru2']['id'],
            'classroom_id' => $ids['kelas2']['id'],
            'subject_id' => $ids['mapel2']['id'],
            'start_time' => '09:00',
            'end_time' => '10:00',
        ]), $h)->assertStatus(422);

        // Tidak overlap -> lolos
        $this->postJson('/api/schedules', array_merge($payload, [
            'teacher_id' => $ids['guru2']['id'],
            'classroom_id' => $ids['kelas2']['id'],
            'room_id' => $ids['ruang2']['id'],
            'subject_id' => $ids['mapel2']['id'],
            'start_time' => '10:00',
            'end_time' => '11:00',
        ]), $h)->assertStatus(201);
    }

    public function test_jadwal_tolak_kapasitas_ruang_tidak_cukup(): void
    {
        $h = $this->headers;
        $ids = $this->ids;

        $kecil = $this->postJson('/api/rooms', ['code' => 'R-KECIL', 'name' => 'Ruang Kecil', 'capacity' => 1], $h)->json('data');

        foreach ([$ids['siswa']['id'], $ids['siswa2']['id']] as $sid) {
            $this->postJson('/api/class-students', [
                'student_id' => $sid,
                'classroom_id' => $ids['kelas']['id'],
                'academic_year_id' => $ids['tahun']['id'],
                'semester_id' => $ids['sem']['id'],
            ], $h)->assertStatus(201);
        }

        $this->postJson('/api/schedules', [
            'subject_id' => $ids['mapel']['id'],
            'classroom_id' => $ids['kelas']['id'],
            'teacher_id' => $ids['guru']['id'],
            'room_id' => $kecil['id'],
            'semester_id' => $ids['sem']['id'],
            'academic_year_id' => $ids['tahun']['id'],
            'day' => 'tuesday',
            'start_time' => '08:00',
            'end_time' => '09:00',
        ], $h)->assertStatus(422);
    }
}
