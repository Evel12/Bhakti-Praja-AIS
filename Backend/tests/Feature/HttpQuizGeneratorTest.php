<?php

namespace Tests\Feature;

use App\Contracts\QuizGenerator;
use App\Enums\QuizGenerationStatus;
use App\Enums\QuizStatus;
use App\Exceptions\QuizGenerationException;
use App\Jobs\GenerateQuiz;
use App\Models\Module;
use App\Services\QuizGenerationService;
use Closure;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HttpQuizGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private const PDF = "%PDF-1.4\nA private test lesson.\n%%EOF";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Http::preventStrayRequests();
        config([
            'quiz_generation.base_url' => 'https://python.example.test/v1/',
            'quiz_generation.endpoint' => '/generate-quiz',
            'quiz_generation.api_key' => 'private-service-test-key',
            'quiz_generation.timeout' => 60,
            'quiz_generation.connect_timeout' => 10,
            'quiz_generation.disk' => 'local',
        ]);
    }

    private function module(): Module
    {
        $module = Module::factory()->create();
        Storage::disk('local')->put($module->path, self::PDF);

        return $module;
    }

    private function payload(): array
    {
        return [
            'title' => 'Addition review',
            'description' => 'A draft requiring teacher review.',
            'questions' => [[
                'question_text' => 'What is 2 + 3?',
                'options' => [
                    ['option_label' => 'A', 'option_text' => '4', 'is_correct' => false],
                    ['option_label' => 'B', 'option_text' => '5', 'is_correct' => true],
                    ['option_label' => 'C', 'option_text' => '6', 'is_correct' => false],
                    ['option_label' => 'D', 'option_text' => '7', 'is_correct' => false],
                ],
            ]],
        ];
    }

    private function assertSafeFailure(Closure $operation, string $code, bool $retryable = false): void
    {
        try {
            $operation();
            $this->fail('Expected a sanitized generation exception.');
        } catch (QuizGenerationException $exception) {
            $this->assertSame($code, $exception->errorCode);
            $this->assertSame($retryable, $exception->retryable);
            $this->assertNull($exception->getPrevious());
            foreach (['private-service-test-key', 'sensitive-response-body', 'python.example.test', self::PDF] as $private) {
                $this->assertStringNotContainsString($private, $exception->getMessage());
            }
        }
    }

    public function test_reference_adapter_sends_pdf_bytes_and_configured_authentication_with_bounded_request_options(): void
    {
        $module = $this->module();
        $payload = $this->payload();
        $captured = [];
        Http::fake(function (Request $request, array $options) use (&$captured, $payload) {
            // Capture the wire body before the adapter closes its temporary PDF stream.
            $captured = [
                'url' => $request->url(), 'method' => $request->method(),
                'headers' => $request->headers(), 'body' => $request->body(),
                'options' => $options,
            ];

            return Http::response($payload);
        });

        $result = app(QuizGenerator::class)->generate($module, 1, 42);

        $this->assertSame($payload, $result);
        $this->assertSame('https://python.example.test/v1/generate-quiz', $captured['url']);
        $this->assertSame('POST', $captured['method']);
        $this->assertSame(['Bearer private-service-test-key'], $captured['headers']['Authorization']);
        $this->assertSame(['application/json'], $captured['headers']['Accept']);
        $this->assertSame(['quiz-generation-42'], $captured['headers']['Idempotency-Key']);
        $this->assertStringContainsString('name="file"; filename="module-'.$module->id.'.pdf"', $captured['body']);
        $this->assertStringContainsString('Content-Type: application/pdf', $captured['body']);
        $this->assertStringContainsString(self::PDF, $captured['body']);
        $this->assertStringContainsString("name=\"question_count\"\r\n\r\n1\r\n", $captured['body']);
        $this->assertStringNotContainsString($module->path, $captured['body']);
        $this->assertStringNotContainsString(storage_path(), $captured['body']);
        $this->assertSame(60, $captured['options']['timeout']);
        $this->assertSame(10, $captured['options']['connect_timeout']);
        $this->assertFalse($captured['options']['allow_redirects']);
        Http::assertSentCount(1);
    }

    public static function invalidConfiguration(): array
    {
        return [
            'missing URL' => ['base_url', ''],
            'unsupported protocol' => ['base_url', 'file:///private/lesson.pdf'],
            'embedded credentials' => ['base_url', 'https://name:secret@python.example.test'],
            'query in base URL' => ['base_url', 'https://python.example.test?key=secret'],
            'missing API key' => ['api_key', ''],
            'header injection' => ['api_key', "key\r\nAnother-Header: injected"],
            'endpoint cannot change host' => ['endpoint', '//another.example.test/upload'],
            'endpoint must be a path' => ['endpoint', 'https://another.example.test/upload'],
            'timeout disabled' => ['timeout', 0],
            'HTTP timeout exceeds worker budget' => ['timeout', 76],
            'connection timeout disabled' => ['connect_timeout', 0],
            'connection timeout exceeds total' => ['connect_timeout', 61],
        ];
    }

    #[DataProvider('invalidConfiguration')]
    public function test_invalid_integration_configuration_fails_before_any_http_request(string $key, mixed $value): void
    {
        $module = $this->module();
        config(['quiz_generation.'.$key => $value]);

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'configuration_error');

        Http::assertNothingSent();
    }

    public static function invalidSources(): array
    {
        return [
            'traversal' => ['../outside.pdf', null],
            'Unix absolute path' => ['/private/lesson.pdf', null],
            'Windows absolute path' => ['C:\\private\\lesson.pdf', null],
            'wrong extension' => ['modules/lesson.txt', 'Plain text'],
            'missing source' => ['modules/missing.pdf', null],
            'invalid header' => ['modules/invalid.pdf', '<html>not a PDF</html>'],
            'truncated header' => ['modules/short.pdf', '%PDF'],
        ];
    }

    #[DataProvider('invalidSources')]
    public function test_unusable_or_unsafe_module_sources_never_reach_the_service(string $path, ?string $content): void
    {
        $module = Module::factory()->create(['path' => $path]);
        if ($content !== null) {
            Storage::disk('local')->put($path, $content);
        }

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'source_unavailable');

        Http::assertNothingSent();
    }

    public function test_oversized_source_is_rejected_before_upload(): void
    {
        $module = $this->module();
        config(['quiz_generation.max_pdf_bytes' => strlen(self::PDF) - 1]);

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'source_unavailable');

        Http::assertNothingSent();
    }

    public static function httpFailures(): array
    {
        return [
            'request timeout' => [408, 'ai_unavailable', true],
            'too early' => [425, 'ai_unavailable', true],
            'rate limit' => [429, 'ai_unavailable', true],
            'internal server error' => [500, 'ai_unavailable', true],
            'service unavailable' => [503, 'ai_unavailable', true],
            'invalid request' => [422, 'ai_rejected', false],
            'bad credentials' => [401, 'ai_rejected', false],
            'redirect' => [302, 'ai_rejected', false],
        ];
    }

    #[DataProvider('httpFailures')]
    public function test_http_failures_are_classified_without_leaking_the_response_or_retrying_inline(int $status, string $code, bool $retryable): void
    {
        $module = $this->module();
        Http::fake(['*' => Http::response('sensitive-response-body private-service-test-key', $status,
            ['Location' => 'https://another.example.test/collect'])]);

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), $code, $retryable);

        Http::assertSentCount(1);
    }

    public function test_connection_failures_are_retryable_and_discard_the_original_exception_chain(): void
    {
        $module = $this->module();
        Http::fake(Http::failedConnection('sensitive-response-body private-service-test-key python.example.test'));

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'ai_unavailable', true);
    }

    public static function invalidJson(): array
    {
        return [
            'invalid JSON' => ['{broken'],
            'empty response' => [''],
            'JSON null' => ['null'],
            'JSON string' => ['"sensitive-response-body"'],
            'JSON boolean' => ['true'],
        ];
    }

    #[DataProvider('invalidJson')]
    public function test_invalid_or_non_object_json_is_rejected(string $body): void
    {
        $module = $this->module();
        Http::fake(['*' => Http::response($body)]);

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'malformed_output');

        Http::assertSentCount(1);
    }

    public function test_a_response_larger_than_the_accepted_json_limit_is_rejected(): void
    {
        $module = $this->module();
        config(['quiz_generation.max_response_bytes' => 16]);
        Http::fake(['*' => Http::response(['title' => str_repeat('x', 32)])]);

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'malformed_output');
    }

    public static function transferLimits(): array
    {
        return ['oversized Content-Length' => ['headers'], 'oversized transfer progress' => ['progress']];
    }

    #[DataProvider('transferLimits')]
    public function test_transfer_limit_callbacks_abort_with_a_permanent_safe_error(string $callback): void
    {
        $module = $this->module();
        config(['quiz_generation.max_response_bytes' => 16]);
        Http::fake(function (Request $request, array $options) use ($callback) {
            if ($callback === 'headers') {
                $options['on_headers'](new Response(200, ['Content-Length' => '17']));
            } else {
                $options['progress'](0, 17, 0, 0);
            }

            return Http::response([]);
        });

        $this->assertSafeFailure(fn () => app(QuizGenerator::class)->generate($module, 1, 42), 'malformed_output');
    }

    public function test_database_worker_executes_the_serialized_job_and_saves_a_draft_through_the_real_adapter(): void
    {
        $module = $this->module();
        $generation = app(QuizGenerationService::class)->request($module->schoolClass->teacher, $module, 1);
        Http::fake(['*' => Http::response($this->payload())]);

        $this->assertDatabaseCount('jobs', 1);
        $this->artisan('queue:work', [
            'connection' => 'quiz-generation', '--queue' => 'quiz-generation',
            '--once' => true, '--sleep' => 0, '--tries' => 3, '--timeout' => 75,
        ])->assertSuccessful();

        $generation->refresh();
        $this->assertSame(QuizGenerationStatus::Completed, $generation->status);
        $this->assertSame(QuizStatus::Draft, $generation->quiz->status);
        $this->assertSame($module->class_id, $generation->quiz->class_id);
        $this->assertNull($generation->quiz->deadline);
        $this->assertDatabaseCount('quizzes', 1);
        $this->assertDatabaseCount('questions', 1);
        $this->assertDatabaseCount('options', 4);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame(1, $generation->quiz->questions->sole()->options()->where('is_correct', true)->count());
        Http::assertSentCount(1);
    }

    public function test_job_with_malformed_http_output_fails_without_any_partial_quiz(): void
    {
        $module = $this->module();
        $generation = app(QuizGenerationService::class)->request($module->schoolClass->teacher, $module, 1);
        $payload = $this->payload();
        $payload['questions'][0]['options'][0]['is_correct'] = true;
        Http::fake(['*' => Http::response($payload)]);

        app()->call([new GenerateQuiz($generation->id), 'handle']);

        $generation->refresh();
        $this->assertSame(QuizGenerationStatus::Failed, $generation->status);
        $this->assertSame('malformed_output', $generation->error_code);
        $this->assertNull($generation->quiz_id);
        $this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
        Http::assertSentCount(1);
    }

    public function test_database_worker_retries_with_backoff_and_records_a_safe_failure_after_three_calls(): void
    {
        $this->freezeTime();
        $module = $this->module();
        $generation = app(QuizGenerationService::class)->request($module->schoolClass->teacher, $module, 1);
        Http::fake(['*' => Http::response('sensitive-response-body private-service-test-key', 503)]);

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->artisan('queue:work', [
                'connection' => 'quiz-generation', '--queue' => 'quiz-generation',
                '--once' => true, '--sleep' => 0, '--tries' => 3, '--timeout' => 75,
            ])->assertSuccessful();
            if ($attempt < 3) {
                $delay = $attempt === 1 ? 10 : 30;
                $job = DB::table('jobs')->sole();
                $this->assertSame($attempt, $job->attempts);
                $this->assertSame(now()->timestamp + $delay, $job->available_at);
                $this->assertSame(QuizGenerationStatus::Queued, $generation->fresh()->status);
                $this->assertNull($generation->fresh()->finished_at);
                $this->travel($delay)->seconds();
            }
        }

        $this->assertSame(QuizGenerationStatus::Failed, $generation->fresh()->status);
        $this->assertSame('ai_unavailable', $generation->fresh()->error_code);
        $this->assertNotNull($generation->fresh()->finished_at);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('failed_jobs', 1);
        $this->assertDatabaseCount('quizzes', 0);
        $failure = DB::table('failed_jobs')->sole();
        $this->assertStringContainsString('ai_unavailable', $failure->exception);
        foreach (['sensitive-response-body', 'private-service-test-key', 'python.example.test', self::PDF] as $private) {
            $this->assertStringNotContainsString($private, $failure->exception.$failure->payload);
        }
        Http::assertSentCount(3);
    }
}
