<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisTahap6Test extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        User::factory()->create([
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
            'role_id' => Role::where('name', 'admin')->value('id'),
            'status' => 'active',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
        ])->json('token');

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_dashboard_menggunakan_data_database(): void
    {
        $h = $this->adminHeaders();

        $this->postJson('/api/departments', ['code' => 'TK', 'name' => 'Teknik Komputer'], $h);
        $this->postJson('/api/students', ['student_number' => 'S001', 'name' => 'Andi'], $h);
        $this->postJson('/api/students', ['student_number' => 'S002', 'name' => 'Siti'], $h);
        $this->postJson('/api/teachers', ['teacher_number' => 'T001', 'name' => 'Budi'], $h);

        $tahun = $this->postJson('/api/academic-years', [
            'name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'status' => 'active',
        ], $h)->json('data');

        $sem = $this->postJson('/api/semesters', [
            'academic_year_id' => $tahun['id'], 'name' => 'Ganjil', 'status' => 'active',
        ], $h)->json('data');

        $data = $this->getJson('/api/dashboard', $h)->assertOk()->json('data');

        $stats = collect($data['stats'])->pluck('value', 'resource');

        $this->assertEquals(2, $stats['students']);
        $this->assertEquals(1, $stats['teachers']);
        $this->assertEquals($tahun['name'], $data['active_academic_year']['name']);
        $this->assertEquals($sem['name'], $data['active_semester']['name']);
        $this->assertArrayHasKey('summary', $data);
        $this->assertArrayHasKey('registrations_by_status', $data['summary']);

        // Tambah 1 siswa lagi, dashboard harus ikut berubah (tidak hard-code)
        $this->postJson('/api/students', ['student_number' => 'S003', 'name' => 'Citra'], $h);

        $stats2 = $this->getJson('/api/dashboard', $h)->json('data.stats');
        $this->assertEquals(3, collect($stats2)->firstWhere('resource', 'students')['value']);
    }

    public function test_pagination_search_filter_berfungsi(): void
    {
        $h = $this->adminHeaders();

        Student::create(['student_number' => 'S001', 'name' => 'Andi Pratama', 'status' => 'active']);
        Student::create(['student_number' => 'S002', 'name' => 'Budi Santoso', 'status' => 'inactive']);
        Student::create(['student_number' => 'S003', 'name' => 'Andi Wijaya', 'status' => 'active']);

        $page = $this->getJson('/api/students?per_page=2&page=1', $h)->assertOk()->json();

        $this->assertCount(2, $page['data']);
        $this->assertEquals(3, $page['meta']['total']);
        $this->assertEquals(2, $page['meta']['last_page']);

        $search = $this->getJson('/api/students?search=Andi', $h)->assertOk()->json();
        $this->assertEquals(2, $search['meta']['total']);

        $filter = $this->getJson('/api/students?status=inactive', $h)->assertOk()->json();
        $this->assertEquals(1, $filter['meta']['total']);
    }

    public function test_validasi_gagal_berbahasa_indonesia(): void
    {
        $h = $this->adminHeaders();

        $response = $this->postJson('/api/students', [
            'student_number' => '', 'name' => '',
        ], $h)->assertStatus(422)->json();

        $this->assertEquals('Validasi gagal.', $response['message']);
        $this->assertArrayHasKey('errors', $response);
    }
}
