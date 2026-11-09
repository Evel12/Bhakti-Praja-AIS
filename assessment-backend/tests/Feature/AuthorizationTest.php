<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Test-only routes exercise middleware and policies before quiz models exist.
        Route::middleware(['auth:sanctum', 'role:teacher'])->get('/api/test/teacher', fn () => ApiResponse::success());
        Route::middleware(['auth:sanctum', 'role:admin'])->get('/api/test/admin', fn () => ApiResponse::success());
        Route::middleware(['api', 'auth:sanctum', 'can:view,user'])->get('/api/test/users/{user}', fn (User $user) => ApiResponse::success(['id' => $user->id]));
    }

    public function test_student_cannot_claim_teacher_or_admin_access(): void
    {
        $student = User::factory()->create();
        $this->withToken($student->createToken('test', ['*'])->plainTextToken)
            ->getJson('/api/test/teacher?role=teacher')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->getJson('/api/test/admin')->assertForbidden();
    }

    public function test_teacher_can_access_teacher_routes_but_not_admin_routes(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $this->withToken($teacher->createToken('test')->plainTextToken)->getJson('/api/test/teacher')->assertOk();
        $this->getJson('/api/test/admin')->assertForbidden();
    }

    public function test_admin_access_requires_explicit_role_permission(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->withToken($admin->createToken('test')->plainTextToken)->getJson('/api/test/admin')->assertOk();
        $this->getJson('/api/test/teacher')->assertForbidden();
    }

    public function test_student_policy_allows_own_profile_but_denies_another_student(): void
    {
        $student = User::factory()->create();
        $other = User::factory()->create();
        $this->withToken($student->createToken('test')->plainTextToken)->getJson('/api/test/users/'.$student->id)->assertOk();
        $this->getJson('/api/test/users/'.$other->id)->assertForbidden();
    }

    public function test_teacher_cannot_read_another_teachers_profile(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $other = User::factory()->create(['role' => Role::Teacher]);
        $this->withToken($teacher->createToken('test')->plainTextToken)->getJson('/api/test/users/'.$other->id)->assertForbidden();
    }

    public function test_role_changes_take_effect_for_existing_tokens(): void
    {
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $token = $teacher->createToken('test')->plainTextToken;
        $this->withToken($token)->getJson('/api/test/teacher')->assertOk();
        $teacher->forceFill(['role' => Role::Student])->save();
        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/test/teacher')->assertForbidden();
    }

    public function test_role_is_not_mass_assignable(): void
    {
        $user = User::create(['name' => 'Student', 'email' => 'student@example.com', 'password' => 'password', 'role' => 'admin']);
        $this->assertSame(Role::Student, $user->fresh()->role);
    }

    public function test_role_protected_routes_require_authentication(): void
    {
        $this->getJson('/api/test/teacher')->assertUnauthorized();
    }
}
