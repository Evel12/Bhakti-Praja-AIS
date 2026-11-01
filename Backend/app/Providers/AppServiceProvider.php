<?php

namespace App\Providers;

use App\Contracts\QuizGenerator;
use App\Models\Attempt;
use App\Models\Module;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizGeneration;
use App\Models\SchoolClass;
use App\Models\User;
use App\Policies\AttemptPolicy;
use App\Policies\ModulePolicy;
use App\Policies\OptionPolicy;
use App\Policies\QuestionPolicy;
use App\Policies\QuizGenerationPolicy;
use App\Policies\QuizPolicy;
use App\Policies\SchoolClassPolicy;
use App\Policies\UserPolicy;
use App\Services\HttpQuizGenerator;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(QuizGenerator::class, HttpQuizGenerator::class);
    }

    public function boot(): void
    {
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(SchoolClass::class, SchoolClassPolicy::class);
        Gate::policy(Module::class, ModulePolicy::class);
        Gate::policy(Quiz::class, QuizPolicy::class);
        Gate::policy(Question::class, QuestionPolicy::class);
        Gate::policy(Option::class, OptionPolicy::class);
        Gate::policy(Attempt::class, AttemptPolicy::class);
        Gate::policy(QuizGeneration::class, QuizGenerationPolicy::class);

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.$this->emailRateKey($request)),
            Limit::perMinute(20)->by('login-ip:'.$request->ip()),
        ]);

        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(3)->by('reset:'.$this->emailRateKey($request)),
            Limit::perMinute(10)->by('reset-ip:'.$request->ip()),
        ]);

        foreach ([
            'assessment-api' => 'authenticated_per_minute',
            'quiz-writes' => 'teacher_writes_per_minute',
            'attempt-starts' => 'attempt_starts_per_minute',
            'reports' => 'reports_per_minute',
        ] as $name => $setting) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute(config('api.rate_limits.'.$setting))
                ->by($this->accountRateKey($request)));
        }

        RateLimiter::for('quiz-generation', fn (Request $request) => [
            // Different windows need different keys, otherwise Laravel shares their counters.
            Limit::perMinute(config('api.rate_limits.generation_per_minute'))->by('minute:'.$this->accountRateKey($request)),
            Limit::perHour(config('api.rate_limits.generation_per_hour'))->by('hour:'.$this->accountRateKey($request)),
        ]);

        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('auth.password_reset_url').'?'.http_build_query([
            'token' => $token, 'email' => $user->getEmailForPasswordReset(),
        ]));
    }

    private function emailRateKey(Request $request): string
    {
        $email = $request->input('email');

        // Limiting runs before Form Requests; malformed arrays must reach validation safely.
        return hash('sha256', Str::lower(is_string($email) ? $email : '').'|'.$request->ip());
    }

    private function accountRateKey(Request $request): string
    {
        // All tokens and source addresses for one account share its allowance.
        return $request->user() ? 'user:'.$request->user()->getAuthIdentifier() : 'ip:'.$request->ip();
    }
}
