<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Module;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use stdClass;
use Tests\TestCase;

class PhaseSevenHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Http::preventStrayRequests();
    }

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('phase-seven-hardening')->plainTextToken);
    }

    private function module(?SchoolClass $schoolClass = null): Module
    {
        $module = Module::factory()->for($schoolClass ?? SchoolClass::factory(), 'schoolClass')->create();
        Storage::disk('local')->put($module->path, "%PDF-1.4\nA private local lesson.\n%%EOF");

        return $module;
    }

    private function assertLimited(TestResponse $response): void
    {
        $response->assertStatus(429)->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Limit')->assertHeader('X-RateLimit-Remaining', '0')
            ->assertJsonPath('success', false)->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');
        $this->assertGreaterThan(0, (int) $response->headers->get('Retry-After'));
        $this->assertInstanceOf(stdClass::class, json_decode($response->getContent())->error->details);
        $this->assertStringNotContainsString('is_correct', $response->getContent());
    }

    public function test_authenticated_budget_is_shared_across_endpoints_and_returns_the_standard_error(): void
    {
        config(['api.rate_limits.authenticated_per_minute' => 2]);
        $this->signIn(User::factory()->create());

        $this->getJson('/api/auth/me')->assertOk();
        $this->getJson('/api/students/me/grades')->assertOk();
        $this->assertLimited($this->getJson('/api/auth/me'));
    }

    public function test_a_new_token_and_different_ip_cannot_reset_the_same_accounts_budget(): void
    {
        config(['api.rate_limits.authenticated_per_minute' => 1]);
        $student = User::factory()->create();
        $this->signIn($student);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.11']);
        $this->getJson('/api/auth/me')->assertOk();

        $this->signIn($student);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.12']);

        $this->assertLimited($this->getJson('/api/auth/me'));
    }

    public function test_different_students_sharing_a_school_ip_have_separate_allowances(): void
    {
        config(['api.rate_limits.authenticated_per_minute' => 1]);
        $first = User::factory()->create();
        $second = User::factory()->create();
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.15']);

        $this->signIn($first);
        $this->getJson('/api/auth/me')->assertOk();
        $this->assertLimited($this->getJson('/api/auth/me'));

        $this->signIn($second);
        $this->getJson('/api/auth/me')->assertOk();
        $this->assertLimited($this->getJson('/api/auth/me'));
    }

    public function test_the_authenticated_allowance_recovers_after_its_window_expires(): void
    {
        $this->freezeTime();
        config(['api.rate_limits.authenticated_per_minute' => 1]);
        $this->signIn(User::factory()->create());
        $this->getJson('/api/auth/me')->assertOk();
        $this->assertLimited($this->getJson('/api/auth/me'));

        $this->travel(61)->seconds();

        $this->getJson('/api/auth/me')->assertOk();
    }

    public function test_teacher_write_budget_is_shared_across_crud_actions_and_class_ids(): void
    {
        config(['api.rate_limits.teacher_writes_per_minute' => 1]);
        $schoolClass = SchoolClass::factory()->create();
        $otherClass = SchoolClass::factory()->for($schoolClass->teacher, 'teacher')->create();
        $this->signIn($schoolClass->teacher);
        $created = $this->postJson('/api/quizzes', ['class_id' => $schoolClass->id, 'title' => 'Allowed draft'])
            ->assertCreated();
        $quizId = $created->json('data.id');

        $this->assertLimited($this->patchJson('/api/quizzes/'.$quizId, ['title' => 'Blocked edit']));
        $this->assertLimited($this->postJson('/api/quizzes', ['class_id' => $otherClass->id, 'title' => 'Blocked draft']));

        $this->getJson('/api/quizzes/'.$quizId)->assertOk()->assertJsonPath('data.title', 'Allowed draft');
        $this->assertDatabaseCount('quizzes', 1);
    }

    public function test_invalid_authoring_requests_still_consume_the_write_allowance(): void
    {
        config(['api.rate_limits.teacher_writes_per_minute' => 1]);
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        $this->postJson('/api/quizzes', ['class_id' => $schoolClass->id, 'title' => ' '])->assertUnprocessable();
        $this->assertLimited($this->postJson('/api/quizzes', ['class_id' => $schoolClass->id, 'title' => 'Too soon']));
        $this->assertDatabaseCount('quizzes', 0);
    }

    public function test_attempt_start_limit_spans_quizzes_and_blocks_database_changes(): void
    {
        config(['api.rate_limits.attempt_starts_per_minute' => 1]);
        $first = Quiz::factory()->published()->create();
        $second = Quiz::factory()->published()->for($first->schoolClass, 'schoolClass')->create();
        Question::factory()->for($first)->withOptions()->create();
        Question::factory()->for($second)->withOptions()->create();
        $student = User::factory()->create();
        $first->schoolClass->students()->attach($student);
        $this->signIn($student);
        $input = ['game_mode' => 'boss', 'challenge_mode' => 'normal'];

        $this->postJson('/api/quizzes/'.$first->id.'/attempts', $input)->assertCreated();
        $this->assertLimited($this->postJson('/api/quizzes/'.$second->id.'/attempts', $input));

        $this->assertDatabaseCount('attempts', 1);
        $this->assertDatabaseMissing('attempts', ['quiz_id' => $second->id]);
    }

    public function test_teacher_report_budget_is_shared_between_class_and_quiz_reports(): void
    {
        config(['api.rate_limits.reports_per_minute' => 1]);
        $quiz = Quiz::factory()->create();
        $this->signIn($quiz->schoolClass->teacher);

        $this->getJson('/api/classes/'.$quiz->class_id.'/gradebook')->assertOk();
        $this->assertLimited($this->getJson('/api/quizzes/'.$quiz->id.'/grades'));

        $this->getJson('/api/quizzes/'.$quiz->id)->assertOk();
    }

    public function test_personal_report_limits_do_not_block_other_students(): void
    {
        config(['api.rate_limits.reports_per_minute' => 1]);
        $first = User::factory()->create();
        $second = User::factory()->create();

        $this->signIn($first);
        $this->getJson('/api/students/me/grades')->assertOk();
        $this->assertLimited($this->getJson('/api/students/me/grades'));

        $this->signIn($second);
        $this->getJson('/api/students/me/grades')->assertOk();
    }

    public function test_generation_minute_budget_spans_modules_and_blocks_additional_jobs(): void
    {
        config(['api.rate_limits.generation_per_minute' => 2, 'api.rate_limits.generation_per_hour' => 20]);
        $first = $this->module();
        $second = $this->module($first->schoolClass);
        $this->signIn($first->schoolClass->teacher);

        $this->postJson('/api/modules/'.$first->id.'/generate-quiz')->assertAccepted();
        $this->postJson('/api/modules/'.$second->id.'/generate-quiz')->assertAccepted();
        $this->assertLimited($this->postJson('/api/modules/'.$first->id.'/generate-quiz'));

        $this->assertDatabaseCount('quiz_generations', 2);
        $this->assertDatabaseCount('jobs', 2);
        Http::assertNothingSent();
    }

    public function test_generation_hour_window_is_independent_and_survives_a_minute_reset(): void
    {
        $this->freezeTime();
        config(['api.rate_limits.generation_per_minute' => 3, 'api.rate_limits.generation_per_hour' => 2]);
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);
        $path = '/api/modules/'.$module->id.'/generate-quiz';

        $this->postJson($path)->assertAccepted();
        $this->postJson($path)->assertAccepted();
        $this->travel(61)->seconds();

        $limited = $this->postJson($path);
        $this->assertLimited($limited);
        $this->assertGreaterThan(60, (int) $limited->headers->get('Retry-After'));
        $this->assertDatabaseCount('quiz_generations', 2);
        $this->assertDatabaseCount('jobs', 2);
        Http::assertNothingSent();
    }

    public function test_generation_minute_window_recovers_without_resetting_status_polling(): void
    {
        $this->freezeTime();
        config(['api.rate_limits.generation_per_minute' => 1, 'api.rate_limits.generation_per_hour' => 20]);
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);
        $path = '/api/modules/'.$module->id.'/generate-quiz';

        $queued = $this->postJson($path)->assertAccepted();
        $this->assertLimited($this->postJson($path));
        $this->getJson('/api/quiz-generations/'.$queued->json('data.id'))->assertOk()->assertJsonPath('data.status', 'queued');
        $this->travel(61)->seconds();

        $this->postJson($path)->assertAccepted();
        $this->assertDatabaseCount('jobs', 2);
        Http::assertNothingSent();
    }

    public function test_missing_and_invalid_tokens_return_401_even_after_an_accounts_budget_is_used(): void
    {
        config(['api.rate_limits.authenticated_per_minute' => 1]);
        $this->signIn(User::factory()->create());
        $this->getJson('/api/auth/me')->assertOk();
        $this->assertLimited($this->getJson('/api/auth/me'));

        Auth::forgetGuards();
        $this->withoutToken()->getJson('/api/auth/me')->assertUnauthorized()->assertJsonPath('error.code', 'UNAUTHENTICATED');
        Auth::forgetGuards();
        $this->withToken('invalid-token')->getJson('/api/auth/me')->assertUnauthorized()->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_wrong_roles_return_403_before_rate_limit_handling(): void
    {
        config(['api.rate_limits.authenticated_per_minute' => 1]);
        $module = $this->module();

        foreach ([Role::Student, Role::Admin] as $role) {
            $this->signIn(User::factory()->create(['role' => $role]));
            $this->getJson('/api/auth/me')->assertOk();
            $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertForbidden()
                ->assertJsonPath('error.code', 'FORBIDDEN');
        }
        $this->assertDatabaseCount('quiz_generations', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public static function malformedEmailRequests(): array
    {
        return [
            'login' => ['/api/auth/login'],
            'request reset' => ['/api/auth/forgot-password'],
            'consume reset' => ['/api/auth/reset-password'],
        ];
    }

    #[DataProvider('malformedEmailRequests')]
    public function test_array_email_inputs_reach_form_validation_instead_of_causing_server_errors(string $path): void
    {
        $this->postJson($path, [
            'email' => ['nested' => 'student@example.test'],
            'password' => 'ValidPassword123!', 'password_confirmation' => 'ValidPassword123!',
            'token' => 'invalid-reset-token',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['email']]]);
    }
}
