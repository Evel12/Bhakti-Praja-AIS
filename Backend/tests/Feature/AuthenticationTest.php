<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_a_safe_resource_and_a_hashed_expiring_token(): void
    {
        $user = User::factory()->create(['role' => Role::Teacher]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email, 'password' => 'password', 'device_name' => 'test-browser',
        ])->assertOk()->assertJsonPath('success', true)->assertJsonPath('data.user.role', 'teacher');

        $this->assertSame(['id', 'name', 'email', 'role'], array_keys($response->json('data.user')));
        $token = PersonalAccessToken::findToken($response->json('data.token'));
        $this->assertNotNull($token);
        $this->assertNotSame($response->json('data.token'), $token->token);
        $this->assertSame('test-browser', $token->name);
        $this->assertEqualsWithDelta(now()->addMinutes(120)->timestamp, $token->expires_at->timestamp, 2);
    }

    public function test_wrong_password_and_unknown_email_receive_the_same_error(): void
    {
        $user = User::factory()->create();
        $known = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnauthorized();
        $unknown = $this->postJson('/api/auth/login', ['email' => 'missing@example.com', 'password' => 'wrong'])->assertUnauthorized();

        $this->assertSame($known->json(), $unknown->json());
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_login_uses_form_request_validation(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'invalid', 'password' => [], 'device_name' => str_repeat('x', 101)])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['email', 'password', 'device_name']]]);
    }

    public function test_me_reads_the_token_owner_and_ignores_submitted_identity(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $this->withToken($owner->createToken('test')->plainTextToken)
            ->getJson('/api/auth/me?user_id='.$other->id.'&role=admin')
            ->assertOk()->assertJsonPath('data.id', $owner->id)->assertJsonPath('data.role', 'student');
    }

    public function test_logout_revokes_only_the_current_token_and_it_cannot_be_reused(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('current');
        $other = $user->createToken('other');

        $this->withToken($current->plainTextToken)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $current->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $other->accessToken->id]);

        Auth::forgetGuards();
        $this->withToken($current->plainTextToken)->getJson('/api/auth/me')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($other->plainTextToken)->getJson('/api/auth/me')->assertOk();
    }

    public function test_missing_invalid_and_expired_tokens_are_rejected(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken('invalid')->getJson('/api/auth/me')->assertUnauthorized();
        Auth::forgetGuards();
        $expired = User::factory()->create()->createToken('expired', ['*'], now()->subMinute());
        $this->withToken($expired->plainTextToken)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_login_does_not_accept_role_or_other_user_fields(): void
    {
        $user = User::factory()->create();
        $this->postJson('/api/auth/login', [
            'email' => $user->email, 'password' => 'password', 'role' => 'admin', 'id' => 999,
        ])->assertOk()->assertJsonPath('data.user.id', $user->id)->assertJsonPath('data.user.role', 'student');
        $this->assertSame(Role::Student, $user->fresh()->role);
    }

    public function test_a_web_guard_identity_without_a_bearer_token_cannot_access_the_api(): void
    {
        $this->actingAs(User::factory()->create(), 'web')->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_public_registration_is_not_exposed(): void
    {
        $this->postJson('/api/auth/register', ['role' => 'admin'])->assertNotFound();
    }
}
