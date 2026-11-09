<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function credentials(User $user, string $token): array
    {
        return [
            'email' => $user->email, 'token' => $token,
            'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!',
        ];
    }

    public function test_reset_link_request_does_not_disclose_account_existence(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $known = $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'missing@example.com'])->assertOk();

        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertDatabaseCount('password_reset_tokens', 1);
        $this->assertArrayNotHasKey('token', $known->json());
    }

    public function test_reset_notification_uses_the_configured_frontend_url(): void
    {
        config(['auth.password_reset_url' => 'https://school.example/reset-password']);
        $user = User::factory()->create();
        $message = (new ResetPassword('test-token'))->toMail($user);
        $this->assertSame('https://school.example/reset-password?'.http_build_query([
            'token' => 'test-token', 'email' => $user->email,
        ]), $message->actionUrl);
    }

    public function test_password_reset_consumes_reset_token_and_revokes_all_api_tokens(): void
    {
        $user = User::factory()->create();
        $user->createToken('browser');
        $user->createToken('phone');
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', $this->credentials($user, $token))->assertOk();

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->postJson('/api/auth/reset-password', $this->credentials($user, $token))
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_invalid_reset_token_does_not_change_password_or_revoke_tokens(): void
    {
        $user = User::factory()->create();
        $user->createToken('browser');
        Password::createToken($user);

        $this->postJson('/api/auth/reset-password', $this->credentials($user, 'invalid'))->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_expired_reset_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = Password::createToken($user);
        $this->travel(61)->minutes();
        $this->postJson('/api/auth/reset-password', $this->credentials($user, $token))->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_reset_requests_validate_email_token_and_password_confirmation(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'invalid'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->postJson('/api/auth/reset-password', [
            'email' => 'student@example.com', 'password' => 'short', 'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['token', 'password']]]);
    }

    public function test_password_and_tokens_roll_back_together_if_revocation_fails(): void
    {
        $user = User::factory()->create();
        $user->createToken('browser');
        $token = Password::createToken($user);
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'delete from "personal_access_tokens"')) {
                throw new \RuntimeException('Simulated token storage failure');
            }
        });

        $this->postJson('/api/auth/reset-password', $this->credentials($user, $token))
            ->assertStatus(500)->assertJsonPath('error.code', 'SERVER_ERROR');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    }
}
