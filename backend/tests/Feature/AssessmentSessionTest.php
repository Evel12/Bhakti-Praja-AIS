<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssessmentSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_assessment_reuses_existing_session_without_granting_academic_admin_permissions(): void
    {
        $this->seed(RoleSeeder::class);
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $role) {
            $this->app['auth']->forgetGuards();
            $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active', 'password' => 'password123']);
            $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123', 'portal' => 'assessment']);
            if ($role === 'wali_murid') {
                $response->assertForbidden();
                continue;
            }
            $response->assertOk()->assertJsonPath('data.role', $role);
            if ($role !== 'admin') {
                $this->withToken($response->json('token'))->getJson('/api/users')->assertForbidden();
                $this->withToken($response->json('token'))->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
            }
        }
    }
}
