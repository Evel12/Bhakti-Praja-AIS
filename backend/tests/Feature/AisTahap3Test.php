<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AisTahap3Test extends TestCase
{
    use RefreshDatabase;

    private function seedRoles(): void
    {
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $name) {
            Role::create([
                'name' => $name,
                'display_name' => ucfirst($name),
            ]);
        }
    }

    private function makeUser(string $role, array $overrides = []): User
    {
        $roleId = Role::where('name', $role)->value('id');

        return User::factory()->create(array_merge([
            'role_id' => $roleId,
            'status' => 'active',
        ], $overrides));
    }

    private function adminToken(): string
    {
        $admin = $this->makeUser('admin', [
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@akademik.test',
            'password' => 'admin123',
        ]);

        $response->assertOk();

        return $response->json('token');
    }

    public function test_admin_bisa_login_dan_melihat_profil(): void
    {
        $this->seedRoles();
        $token = $this->adminToken();

        $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$token}",
        ])->assertOk()->assertJsonPath('data.role', 'admin');
    }

    public function test_login_gagal_jika_password_salah(): void
    {
        $this->seedRoles();
        $this->makeUser('admin', ['email' => 'admin@akademik.test']);

        $this->postJson('/api/auth/login', [
            'email' => 'admin@akademik.test',
            'password' => 'salah-password',
        ])->assertStatus(401);
    }

    public function test_guru_ditolak_masuk_halaman_admin(): void
    {
        $this->seedRoles();
        $this->makeUser('guru', ['email' => 'budi@akademik.test']);

        $this->postJson('/api/auth/login', [
            'email' => 'budi@akademik.test',
            'password' => 'password',
        ])->assertStatus(403);
    }

    public function test_akun_nonaktif_ditolak(): void
    {
        $this->seedRoles();
        $this->makeUser('admin', [
            'email' => 'nonaktif@akademik.test',
            'status' => 'inactive',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'nonaktif@akademik.test',
            'password' => 'password',
        ])->assertStatus(403);
    }

    public function test_tanpa_token_tidak_bisa_akses_users(): void
    {
        $this->getJson('/api/users')->assertStatus(401);
    }

    public function test_guru_tidak_bisa_akses_users_walau_punya_token(): void
    {
        $this->seedRoles();
        $guru = $this->makeUser('guru');
        $token = $guru->createToken('t')->plainTextToken;

        $this->getJson('/api/users', [
            'Authorization' => "Bearer {$token}",
        ])->assertStatus(403);
    }

    public function test_admin_bisa_crud_pengguna_dan_validasi_duplikat(): void
    {
        $this->seedRoles();
        $token = $this->adminToken();
        $headers = ['Authorization' => "Bearer {$token}"];

        $create = $this->postJson('/api/users', [
            'name' => 'Guru Baru',
            'email' => 'guru.baru@akademik.test',
            'password' => 'rahasia123',
            'role' => 'guru',
        ], $headers)->assertStatus(201);

        $id = $create->json('data.id');

        $this->postJson('/api/users', [
            'name' => 'Duplikat',
            'email' => 'guru.baru@akademik.test',
            'password' => 'rahasia123',
            'role' => 'guru',
        ], $headers)->assertStatus(422);

        $this->postJson('/api/users', [
            'name' => 'Email Rusak',
            'email' => 'bukan-email',
            'password' => 'rahasia123',
            'role' => 'guru',
        ], $headers)->assertStatus(422);

        $this->postJson('/api/users', [
            'name' => 'Role Rusak',
            'email' => 'r@akademik.test',
            'password' => 'rahasia123',
            'role_id' => 999999,
        ], $headers)->assertStatus(422);

        $this->getJson("/api/users/{$id}", $headers)->assertOk();
        $this->putJson("/api/users/{$id}", ['name' => 'Guru Update'], $headers)->assertOk();
        $this->patchJson("/api/users/{$id}/status", ['status' => 'inactive'], $headers)->assertOk();
        $this->deleteJson("/api/users/{$id}", [], $headers)->assertOk();
    }

    public function test_admin_tidak_bisa_hapus_atau_nonaktifkan_akun_sendiri(): void
    {
        $this->seedRoles();
        $token = $this->adminToken();
        $headers = ['Authorization' => "Bearer {$token}"];

        $me = $this->getJson('/api/auth/me', $headers)->json('data');
        $myId = $me['id'];

        $this->deleteJson("/api/users/{$myId}", [], $headers)->assertStatus(422);
        $this->patchJson("/api/users/{$myId}/status", ['status' => 'inactive'], $headers)->assertStatus(422);
    }
}
