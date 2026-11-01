<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function login(array $credentials, string $deviceName): array
    {
        return DB::transaction(function () use ($credentials, $deviceName): array {
            // once() validates and rehashes credentials without creating a browser session.
            if (! Auth::guard('web')->once($credentials)) {
                logSystemActivity('auth.login_failed');
                throw new AuthenticationException;
            }

            /** @var User $user */
            $user = Auth::guard('web')->user();
            $expiresAt = now()->addMinutes(config('auth.api_token_expiration', 120));
            $token = $user->createToken($deviceName, ['*'], $expiresAt);

            DB::afterCommit(fn () => logSystemActivity('auth.login', $user->id, [
                'entity_type' => 'api_token', 'entity_id' => $token->accessToken->id,
            ]));

            return ['user' => $user, 'token' => $token->plainTextToken, 'expires_at' => $expiresAt->toIso8601String()];
        });
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
        logSystemActivity('auth.logout', $user->id);
    }

    public function sendPasswordResetLink(string $email): void
    {
        // Do not reveal account existence or the broker's per-account throttle status.
        Password::sendResetLink(['email' => $email]);
        logSystemActivity('auth.password_reset_requested');
    }

    public function resetPassword(array $credentials): void
    {
        // Includes the broker's reset-token deletion, password update, and token revocation.
        $status = DB::transaction(fn () => Password::reset($credentials, function (User $user, string $password): void {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();

            DB::afterCommit(function () use ($user): void {
                event(new PasswordReset($user));
                logSystemActivity('auth.password_reset', $user->id);
            });
        }));

        if ($status !== Password::PasswordReset) {
            throw ValidationException::withMessages(['email' => ['The password reset token is invalid or expired.']]);
        }
    }
}
