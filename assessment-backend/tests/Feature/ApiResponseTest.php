<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiResponseTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_api_route_returns_json_without_an_accept_header(): void
    {
        $this->get('/api/missing')->assertNotFound()->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'NOT_FOUND')->assertJsonStructure(['message', 'error' => ['code', 'details']]);
    }

    public function test_unsupported_method_returns_a_consistent_error(): void
    {
        $this->getJson('/api/auth/login')->assertStatus(405)->assertJsonPath('error.code', 'METHOD_NOT_ALLOWED')
            ->assertHeader('Allow', 'POST');
    }

    public function test_unexpected_errors_do_not_expose_internal_details(): void
    {
        config(['app.debug' => true]);
        Route::get('/api/test/error', fn () => throw new \RuntimeException('secret database credentials'));
        $response = $this->getJson('/api/test/error')->assertStatus(500)->assertJsonPath('error.code', 'SERVER_ERROR');
        $this->assertStringNotContainsString('secret', $response->getContent());
        $this->assertArrayNotHasKey('trace', $response->json());
    }

    public function test_login_rate_limit_preserves_retry_after_header(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'missing@example.com', 'password' => 'wrong'])->assertUnauthorized();
        }

        $this->postJson('/api/auth/login', ['email' => 'missing@example.com', 'password' => 'wrong'])
            ->assertStatus(429)->assertHeader('Retry-After')->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');
    }

    public function test_cors_allows_the_configured_frontend_origin(): void
    {
        $this->withHeaders([
            'Origin' => 'http://127.0.0.1:4173',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'authorization,content-type',
        ])->options('/api/auth/login')->assertNoContent()->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173');
    }

    public function test_activity_logging_discards_secret_context(): void
    {
        $logger = \Mockery::mock();
        Log::shouldReceive('channel')->once()->with('activity')->andReturn($logger);
        $logger->shouldReceive('info')->once()->with('test.action', ['actor_id' => 1, 'entity_id' => 2]);
        logSystemActivity('test.action', 1, ['entity_id' => 2, 'password' => 'secret', 'token' => 'secret']);
    }
}
