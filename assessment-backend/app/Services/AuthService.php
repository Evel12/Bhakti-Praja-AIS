<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

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
            if (! $user->isActive()) {
                logSystemActivity('auth.login_inactive', $user->id);
                throw new AuthorizationException('Account is inactive.');
            }
            if ($user->role === Role::Parent) {
                throw new AuthorizationException('Parent accounts cannot access the assessment workspace.');
            }
            $expiresAt = now()->addMinutes(config('auth.api_token_expiration', 120));
            $token = $user->createToken($deviceName, ['*'], $expiresAt);

            DB::afterCommit(fn () => logSystemActivity('auth.login', $user->id, [
                'entity_type' => 'api_token', 'entity_id' => $token->accessToken->id,
            ]));

            return ['user' => $user, 'token' => $token->plainTextToken, 'expires_at' => $expiresAt->toIso8601String()];
        });
    }

    public function aisExchange(string $aisToken, string $deviceName): array
    {
        $accessToken = PersonalAccessToken::findToken($aisToken);
        if (! $accessToken || ! ($accessToken->tokenable instanceof User)) {
            logSystemActivity('auth.ais_exchange_failed');
            throw new AuthenticationException('Invalid or expired AIS token.');
        }

        if ($accessToken->expires_at !== null && $accessToken->expires_at->isPast()) {
            throw new AuthenticationException('AIS session token has expired.');
        }

        /** @var User $user */
        $user = $accessToken->tokenable->fresh();
        if (! $user || ! $user->isActive()) {
            throw new AuthorizationException('Account is inactive.');
        }

        if (! in_array($user->role, [Role::Admin, Role::Teacher, Role::Student], true)) {
            throw new AuthorizationException('Account role does not have access to Assessment.');
        }

        return DB::transaction(function () use ($user, $deviceName): array {
            $expiresAt = now()->addMinutes(config('auth.api_token_expiration', 120));
            $token = $user->createToken($deviceName, ['*'], $expiresAt);

            DB::afterCommit(fn () => logSystemActivity('auth.ais_exchange', $user->id, [
                'entity_type' => 'api_token', 'entity_id' => $token->accessToken->id,
            ]));

            return [
                'user' => $user,
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt->toIso8601String(),
                'provider' => 'ais',
            ];
        });
    }

    public function ssoLogin(array $credentials, string $deviceName): array
    {
        return DB::transaction(function () use ($credentials, $deviceName): array {
            $email = isset($credentials['email']) ? strtolower(trim((string) $credentials['email'])) : '';
            $roleHint = $credentials['role'] ?? null;
            $provider = (string) ($credentials['provider'] ?? 'undip');
            $user = null;

            if ($email !== '') {
                $user = User::where('email', $email)->first();
            }

            if (! $user && app()->environment('local', 'testing')) {
                $resolvedRole = match (true) {
                    $roleHint === Role::Teacher->value || str_ends_with($email, '@lecturer.undip.ac.id') => Role::Teacher,
                    $roleHint === Role::Student->value || str_ends_with($email, '@students.undip.ac.id') => Role::Student,
                    default => null,
                };

                if ($resolvedRole !== null) {
                    $user = User::where('role', $resolvedRole)->orderBy('id')->first();
                }
            }

            if (! $user) {
                logSystemActivity('auth.sso_login_failed');
                throw new AuthenticationException;
            }

            if (! $user->isActive() || $user->role === Role::Parent) {
                throw new AuthorizationException('Account cannot access Assessment.');
            }

            $expiresAt = now()->addMinutes(config('auth.api_token_expiration', 120));
            $token = $user->createToken($deviceName, ['*'], $expiresAt);

            DB::afterCommit(fn () => logSystemActivity('auth.sso_login', $user->id, [
                'entity_type' => 'api_token', 'entity_id' => $token->accessToken->id,
            ]));

            return [
                'user' => $user,
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt->toIso8601String(),
                'provider' => $provider,
            ];
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
