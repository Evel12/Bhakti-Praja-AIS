<?php

namespace Tests\Feature;

use App\Contracts\QuizGenerator;
use App\Enums\QuizGenerationStatus;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Exceptions\QuizGenerationException;
use App\Jobs\GenerateQuiz;
use App\Models\Module;
use App\Models\Option;
use App\Models\QuizGeneration;
use App\Models\User;
use App\Services\QuizGenerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Events\JobQueueing;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class PhaseSixGenerationTest extends TestCase
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
        $this->withToken($user->createToken('phase-six-generation')->plainTextToken);
    }

    private function module(): Module
    {
        $module = Module::factory()->create();
        Storage::disk('local')->put($module->path, "%PDF-1.4\nA test module.\n%%EOF");

        return $module;
    }

    private function queued(Module $module, int $count = 5): QuizGeneration
    {
        return app(QuizGenerationService::class)->request($module->schoolClass->teacher, $module, $count);
    }

    private function payload(int $count = 5): array
    {
        return [
            'title' => 'Generated arithmetic quiz',
            'description' => 'Review the module before publishing.',
            'questions' => array_map(fn (int $index): array => [
                'question_text' => 'What is '.$index.' plus one?',
                'options' => array_map(fn (string $label, int $offset): array => [
                    'option_label' => $label,
                    'option_text' => (string) ($index + $offset),
                    'is_correct' => $label === 'B',
                ], ['A', 'B', 'C', 'D'], [0, 1, 2, 3]),
            ], range(1, $count)),
        ];
    }

    private function runJob(QuizGeneration $generation): void
    {
        app()->call([new GenerateQuiz($generation->id), 'handle']);
    }

    private function returnsPayload(QuizGeneration $generation, array $payload): void
    {
        $this->mock(QuizGenerator::class, function (MockInterface $mock) use ($generation, $payload): void {
            $mock->shouldReceive('generate')->once()
                ->withArgs(fn (Module $module, int $count, int $id): bool => $module->id === $generation->module_id
                    && $count === $generation->question_count && $id === $generation->id)
                ->andReturn($payload);
        });
    }

    public function test_generation_is_durably_queued_without_running_the_ai_even_when_the_default_connection_is_sync(): void
    {
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);
        config(['queue.default' => 'sync']);
        $this->mock(QuizGenerator::class, fn (MockInterface $mock) => $mock->shouldNotReceive('generate'));

        $response = $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertAccepted()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.module_id', $module->id)
            ->assertJsonPath('data.question_count', 5)
            ->assertJsonPath('data.status', 'queued')
            ->assertJsonPath('data.quiz_id', null)
            ->assertJsonPath('data.error_code', null);

        $generation = QuizGeneration::findOrFail($response->json('data.id'));
        $this->assertSame($module->schoolClass->teacher_id, $generation->requested_by);
        $this->assertDatabaseCount('quiz_generations', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseHas('jobs', ['queue' => 'quiz-generation']);
        Http::assertNothingSent();
    }

    public function test_request_uses_only_validated_inputs_and_ignores_spoofed_ownership_status_and_keys(): void
    {
        $module = $this->module();
        $other = User::factory()->create(['role' => Role::Teacher]);
        $this->signIn($module->schoolClass->teacher);

        $response = $this->postJson('/api/modules/'.$module->id.'/generate-quiz', [
            'question_count' => 2, 'requested_by' => $other->id, 'module_id' => 999999,
            'class_id' => 999999, 'status' => 'completed', 'quiz_id' => 999999,
            'error_code' => 'injected', 'is_correct' => true,
        ])->assertAccepted()->assertJsonPath('data.question_count', 2)->assertJsonPath('data.status', 'queued');

        $generation = QuizGeneration::findOrFail($response->json('data.id'));
        $this->assertSame($module->id, $generation->module_id);
        $this->assertSame($module->schoolClass->teacher_id, $generation->requested_by);
        $this->assertNull($generation->quiz_id);
        $this->assertNull($generation->error_code);
        $this->assertStringNotContainsString('is_correct', $response->getContent());
    }

    public function test_invalid_question_counts_are_rejected_before_any_work_is_enqueued(): void
    {
        // Exercise every invalid input here; Phase 7 independently tests the production request cap.
        config(['api.rate_limits.generation_per_minute' => 10]);
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);

        foreach ([0, 51, 1.5, 'many', null] as $invalid) {
            $this->postJson('/api/modules/'.$module->id.'/generate-quiz', ['question_count' => $invalid])
                ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        }
        $this->assertDatabaseCount('quiz_generations', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_enqueue_failure_rolls_back_the_tracking_row(): void
    {
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);
        Event::listen(JobQueueing::class, function (): never {
            throw new RuntimeException('Queue unavailable for this test.');
        });

        $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertServerError()
            ->assertJsonPath('error.code', 'SERVER_ERROR');

        $this->assertDatabaseCount('quiz_generations', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_an_unsafe_generation_queue_configuration_cannot_run_work_inline(): void
    {
        $module = $this->module();
        $this->signIn($module->schoolClass->teacher);
        config(['queue.connections.quiz-generation.driver' => 'sync']);
        $this->mock(QuizGenerator::class, fn (MockInterface $mock) => $mock->shouldNotReceive('generate'));

        $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertStatus(503)
            ->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE');

        $this->assertDatabaseCount('quiz_generations', 0);
        $this->assertDatabaseCount('jobs', 0);
        Http::assertNothingSent();
    }

    public function test_both_generation_endpoints_require_authentication(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);

        $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertUnauthorized();
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertUnauthorized();
    }

    public function test_students_and_admins_cannot_generate_or_poll_teacher_jobs(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);

        foreach ([Role::Student, Role::Admin] as $role) {
            $this->signIn(User::factory()->create(['role' => $role]));
            $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertForbidden();
            $response = $this->getJson('/api/quiz-generations/'.$generation->id)->assertForbidden();
            $this->assertStringNotContainsString('is_correct', $response->getContent());
        }
        $this->assertDatabaseCount('quiz_generations', 1);
        $this->assertDatabaseCount('jobs', 1);
    }

    public function test_another_teacher_cannot_generate_from_or_poll_the_owners_module(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);
        $this->signIn(User::factory()->create(['role' => Role::Teacher]));

        $this->postJson('/api/modules/'.$module->id.'/generate-quiz')->assertForbidden();
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseCount('quiz_generations', 1);
    }

    public function test_owner_can_poll_a_safe_status_without_paths_secrets_or_answers(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);
        $this->signIn($module->schoolClass->teacher);

        $response = $this->getJson('/api/quiz-generations/'.$generation->id)->assertOk()
            ->assertJsonPath('data.id', $generation->id)
            ->assertJsonPath('data.status', 'queued')
            ->assertJsonPath('data.quiz_id', null);

        foreach (['is_correct', 'requested_by', 'api_key', 'module.path', $module->path] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
    }

    public function test_missing_modules_and_generation_ids_return_the_consistent_not_found_error(): void
    {
        $this->signIn(User::factory()->create(['role' => Role::Teacher]));
        $this->postJson('/api/modules/999999/generate-quiz')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->getJson('/api/quiz-generations/999999')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_successful_job_saves_a_complete_draft_and_its_result_in_one_transaction(): void
    {
        $module = $this->module();
        $generation = $this->queued($module, 2);
        $this->returnsPayload($generation, $this->payload(2));

        $this->runJob($generation);

        $generation->refresh();
        $this->assertSame(QuizGenerationStatus::Completed, $generation->status);
        $this->assertNotNull($generation->started_at);
        $this->assertNotNull($generation->finished_at);
        $this->assertNull($generation->error_code);
        $quiz = $generation->quiz;
        $this->assertNotNull($quiz);
        $this->assertSame($module->class_id, $quiz->class_id);
        $this->assertSame(QuizStatus::Draft, $quiz->status);
        $this->assertNull($quiz->deadline);
        $this->assertDatabaseCount('quizzes', 1);
        $this->assertDatabaseCount('questions', 2);
        $this->assertDatabaseCount('options', 8);
        foreach ($quiz->questions as $question) {
            $this->assertSame('multiple_choice', $question->question_type->value);
            $this->assertSame(['A', 'B', 'C', 'D'], $question->options->pluck('option_label')->map(fn ($label) => $label->value)->all());
            $this->assertSame(1, $question->options->filter(fn (Option $option): bool => $option->is_correct)->count());
        }

        $this->signIn($module->schoolClass->teacher);
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertOk()
            ->assertJsonPath('data.status', 'completed')->assertJsonPath('data.quiz_id', $quiz->id);
        $this->getJson('/api/quizzes/'.$quiz->id)->assertOk()->assertJsonPath('data.status', 'draft');
    }

    public function test_duplicate_job_delivery_does_not_call_ai_again_or_create_a_second_quiz(): void
    {
        $generation = $this->queued($this->module(), 1);
        $this->returnsPayload($generation, $this->payload(1));
        $this->runJob($generation);
        $finished = $generation->fresh()->getRawOriginal();

        $this->runJob($generation);

        $this->assertSame($finished, $generation->fresh()->getRawOriginal());
        $this->assertDatabaseCount('quizzes', 1);
        $this->assertDatabaseCount('questions', 1);
        $this->assertDatabaseCount('options', 4);
    }

    public function test_generated_output_cannot_override_ownership_publication_or_record_ids(): void
    {
        $module = $this->module();
        $generation = $this->queued($module, 1);
        $payload = $this->payload(1);
        $payload['id'] = 999999;
        $payload['class_id'] = 999999;
        $payload['status'] = 'published';
        $payload['deadline'] = '2030-01-01T00:00:00Z';
        $payload['questions'][0]['id'] = 999999;
        $payload['questions'][0]['quiz_id'] = 999999;
        foreach ($payload['questions'][0]['options'] as &$option) {
            $option['id'] = 999999;
            $option['question_id'] = 999999;
        }
        unset($option);
        $this->returnsPayload($generation, $payload);

        $this->runJob($generation);

        $quiz = $generation->fresh()->quiz;
        $this->assertNotNull($quiz);
        $this->assertNotSame(999999, $quiz->id);
        $this->assertSame($module->class_id, $quiz->class_id);
        $this->assertSame(QuizStatus::Draft, $quiz->status);
        $this->assertNull($quiz->deadline);
        $question = $quiz->questions->sole();
        $this->assertNotSame(999999, $question->id);
        $this->assertSame($quiz->id, $question->quiz_id);
        foreach ($question->options as $option) {
            $this->assertNotSame(999999, $option->id);
            $this->assertSame($question->id, $option->question_id);
        }

        $student = User::factory()->create();
        $module->schoolClass->students()->attach($student);
        $this->signIn($student);
        $this->getJson('/api/classes/'.$module->class_id.'/quizzes')->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/quizzes/'.$quiz->id)->assertForbidden();
    }

    public static function malformedOutputs(): array
    {
        return [
            'missing title' => ['title', null],
            'blank title' => ['title', '  '],
            'missing questions' => ['questions', null],
            'no questions' => ['questions', []],
            'empty question text' => ['questions.0.question_text', '  '],
            'null question type' => ['questions.0.question_type', null],
            'three options' => ['questions.0.options', [
                ['option_label' => 'A', 'option_text' => 'one', 'is_correct' => true],
                ['option_label' => 'B', 'option_text' => 'two', 'is_correct' => false],
                ['option_label' => 'C', 'option_text' => 'three', 'is_correct' => false],
            ]],
            'empty option text' => ['questions.0.options.0.option_text', '  '],
            'two correct options' => ['questions.0.options.0.is_correct', true],
            'no correct option' => ['questions.0.options.1.is_correct', false],
            'string correctness' => ['questions.0.options.1.is_correct', 'true'],
            'duplicate labels' => ['questions.0.options.0.option_label', 'B'],
        ];
    }

    #[DataProvider('malformedOutputs')]
    public function test_malformed_generated_output_is_rejected_without_partial_quiz_records(string $path, mixed $value): void
    {
        $generation = $this->queued($this->module(), 1);
        $payload = $this->payload(1);
        data_set($payload, $path, $value);
        $this->returnsPayload($generation, $payload);

        $this->runJob($generation);

        $generation->refresh();
        $this->assertSame(QuizGenerationStatus::Failed, $generation->status);
        $this->assertSame('malformed_output', $generation->error_code);
        $this->assertNotNull($generation->finished_at);
        $this->assertNull($generation->quiz_id);
        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
    }

    public function test_a_failed_save_rolls_back_every_created_quiz_record_and_sanitizes_the_error(): void
    {
        $generation = $this->queued($this->module(), 2);
        $this->returnsPayload($generation, $this->payload(2));
        $created = 0;
        Event::listen('eloquent.creating: '.Option::class, function () use (&$created): void {
            if (++$created === 5) {
                throw new RuntimeException('Sensitive database detail that must not escape.');
            }
        });

        try {
            $this->runJob($generation);
            $this->fail('A temporary save failure must allow a queue retry.');
        } catch (QuizGenerationException $exception) {
            $this->assertTrue($exception->retryable);
            $this->assertNull($exception->getPrevious());
            $this->assertStringNotContainsString('Sensitive database detail', $exception->getMessage());
        }

        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
        $this->assertNull($generation->fresh()->quiz_id);
        $this->assertNotSame(QuizGenerationStatus::Completed, $generation->fresh()->status);
    }

    public function test_revoked_module_ownership_before_work_prevents_the_ai_call_and_draft_creation(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);
        $newTeacher = User::factory()->create(['role' => Role::Teacher]);
        $module->schoolClass->forceFill(['teacher_id' => $newTeacher->id])->save();
        $this->mock(QuizGenerator::class, fn (MockInterface $mock) => $mock->shouldNotReceive('generate'));

        $this->runJob($generation);

        $this->assertSame(QuizGenerationStatus::Failed, $generation->fresh()->status);
        $this->assertSame('ownership_changed', $generation->fresh()->error_code);
        $this->assertDatabaseCount('quizzes', 0);
        $this->signIn($generation->requester);
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertForbidden();
        $this->signIn($newTeacher);
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertForbidden();
    }

    public function test_ownership_is_rechecked_after_the_network_call_before_saving_the_draft(): void
    {
        $module = $this->module();
        $generation = $this->queued($module, 1);
        $newTeacher = User::factory()->create(['role' => Role::Teacher]);
        $payload = $this->payload(1);
        $this->mock(QuizGenerator::class, function (MockInterface $mock) use ($module, $newTeacher, $payload): void {
            $mock->shouldReceive('generate')->once()->andReturnUsing(function () use ($module, $newTeacher, $payload): array {
                $module->schoolClass->forceFill(['teacher_id' => $newTeacher->id])->save();

                return $payload;
            });
        });

        $this->runJob($generation);

        $this->assertSame(QuizGenerationStatus::Failed, $generation->fresh()->status);
        $this->assertSame('ownership_changed', $generation->fresh()->error_code);
        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
    }

    public function test_revoked_teacher_role_also_prevents_worker_access(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);
        $module->schoolClass->teacher->forceFill(['role' => Role::Student])->save();
        $this->mock(QuizGenerator::class, fn (MockInterface $mock) => $mock->shouldNotReceive('generate'));

        $this->runJob($generation);

        $this->assertSame(QuizGenerationStatus::Failed, $generation->fresh()->status);
        $this->assertSame('ownership_changed', $generation->fresh()->error_code);
        $this->assertDatabaseCount('quizzes', 0);
    }

    public function test_transient_ai_failure_is_retryable_then_the_terminal_failure_callback_updates_status(): void
    {
        $module = $this->module();
        $generation = $this->queued($module);
        $this->mock(QuizGenerator::class, function (MockInterface $mock): void {
            $mock->shouldReceive('generate')->once()->andThrow(new QuizGenerationException('ai_unavailable', true));
        });

        try {
            $this->runJob($generation);
            $this->fail('A transient AI failure must reach the queue worker for retry.');
        } catch (QuizGenerationException $exception) {
            $this->assertTrue($exception->retryable);
            $this->assertSame('ai_unavailable', $exception->errorCode);
        }
        $this->assertNull($generation->fresh()->finished_at);
        $this->assertNull($generation->fresh()->quiz_id);
        $this->assertDatabaseCount('quizzes', 0);

        (new GenerateQuiz($generation->id))->failed(new QuizGenerationException('ai_unavailable', true));

        $this->assertSame(QuizGenerationStatus::Failed, $generation->fresh()->status);
        $this->assertSame('ai_unavailable', $generation->fresh()->error_code);
        $this->assertNotNull($generation->fresh()->finished_at);
        $this->signIn($module->schoolClass->teacher);
        $this->getJson('/api/quiz-generations/'.$generation->id)->assertOk()
            ->assertJsonPath('data.status', 'failed')->assertJsonPath('data.error_code', 'ai_unavailable');
    }

    public function test_worker_reclaims_processing_status_after_a_previous_worker_was_interrupted(): void
    {
        $generation = $this->queued($this->module(), 1);
        $generation->forceFill(['status' => QuizGenerationStatus::Processing, 'started_at' => now()->subMinutes(3)])->save();
        $this->returnsPayload($generation, $this->payload(1));

        $this->runJob($generation);

        $this->assertSame(QuizGenerationStatus::Completed, $generation->fresh()->status);
        $this->assertDatabaseCount('quizzes', 1);
    }

    public function test_a_late_failure_cannot_overwrite_a_completed_generation(): void
    {
        $generation = $this->queued($this->module(), 1);
        $this->returnsPayload($generation, $this->payload(1));
        $this->runJob($generation);
        $completed = $generation->fresh()->getRawOriginal();

        (new GenerateQuiz($generation->id))->failed(new RuntimeException('Do not expose this detail.'));
        app(QuizGenerationService::class)->fail($generation->id, 'ai_unavailable');

        $this->assertSame($completed, $generation->fresh()->getRawOriginal());
        $this->assertDatabaseCount('quizzes', 1);
    }

    public function test_a_terminal_failed_generation_is_not_restarted_by_duplicate_delivery(): void
    {
        $generation = $this->queued($this->module(), 1);
        app(QuizGenerationService::class)->fail($generation->id, 'malformed_output');
        $failed = $generation->fresh()->getRawOriginal();
        $this->mock(QuizGenerator::class, fn (MockInterface $mock) => $mock->shouldNotReceive('generate'));

        $this->runJob($generation);

        $this->assertSame($failed, $generation->fresh()->getRawOriginal());
        $this->assertDatabaseCount('quizzes', 0);
    }

    public function test_deleting_the_generated_draft_preserves_tracking_history_and_does_not_regenerate_it(): void
    {
        $generation = $this->queued($this->module(), 1);
        $this->returnsPayload($generation, $this->payload(1));
        $this->runJob($generation);
        $generation->fresh()->quiz->delete();

        $this->runJob($generation);

        $this->assertSame(QuizGenerationStatus::Completed, $generation->fresh()->status);
        $this->assertNull($generation->fresh()->quiz_id);
        $this->assertDatabaseCount('quiz_generations', 1);
        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
    }
}
