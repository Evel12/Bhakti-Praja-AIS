<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class PhaseSevenResponseSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // These routes exist only in this test application, never in the production route table.
        Route::get('/api/security-test/context', fn (Request $request) => ApiResponse::success([
            'secure' => $request->isSecure(), 'ip' => $request->ip(), 'host' => $request->getHost(),
        ]));
        Route::get('/api/security-test/error', fn () => throw new RuntimeException('private database credentials'));
        Route::get('/api/security-test/too-large', fn () => throw new PostTooLargeException('private upload detail'));
        Route::middleware('throttle:1,1')->get('/api/security-test/limited', fn () => ApiResponse::success());
    }

    private function assertPrivateApiHeaders(TestResponse $response): void
    {
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
        $response->assertHeader('Pragma', 'no-cache')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer');
    }

    public function test_authenticated_success_responses_are_not_cacheable_and_have_security_headers(): void
    {
        $user = User::factory()->create();
        $response = $this->withToken($user->createToken('security-test')->plainTextToken)
            ->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);

        $this->assertPrivateApiHeaders($response);
    }

    public static function apiErrors(): array
    {
        return [
            'unauthenticated' => [401, 'UNAUTHENTICATED'],
            'forbidden' => [403, 'FORBIDDEN'],
            'unmatched route' => [404, 'NOT_FOUND'],
            'method not allowed' => [405, 'METHOD_NOT_ALLOWED'],
            'payload too large' => [413, 'PAYLOAD_TOO_LARGE'],
            'validation error' => [422, 'VALIDATION_ERROR'],
            'rate limited' => [429, 'TOO_MANY_REQUESTS'],
            'unexpected exception' => [500, 'SERVER_ERROR'],
        ];
    }

    #[DataProvider('apiErrors')]
    public function test_api_errors_keep_security_headers_and_the_consistent_json_format(int $status, string $code): void
    {
        config(['app.debug' => true]);
        if ($status === 403) {
            $user = User::factory()->create();
            $this->withToken($user->createToken('security-test')->plainTextToken);
        }
        if ($status === 429) {
            $this->getJson('/api/security-test/limited')->assertOk();
        }
        $response = match ($status) {
            401 => $this->getJson('/api/auth/me'),
            403 => $this->postJson('/api/quizzes', []),
            404 => $this->get('/api/security-test/missing'),
            405 => $this->getJson('/api/auth/login'),
            413 => $this->getJson('/api/security-test/too-large'),
            422 => $this->postJson('/api/auth/login', []),
            429 => $this->getJson('/api/security-test/limited'),
            500 => $this->getJson('/api/security-test/error'),
        };

        $response->assertStatus($status)->assertJsonPath('success', false)
            ->assertJsonPath('error.code', $code)->assertJsonStructure(['message', 'error' => ['code', 'details']]);
        $this->assertIsObject(json_decode($response->getContent())->error->details);
        $this->assertPrivateApiHeaders($response);
        $this->assertStringNotContainsString('private database credentials', $response->getContent());
        $this->assertStringNotContainsString('private upload detail', $response->getContent());
        $response->assertHeaderMissing('Strict-Transport-Security');
        if ($status === 405) {
            $response->assertHeader('Allow', 'POST');
        }
        if ($status === 429) {
            $response->assertHeader('Retry-After');
            $this->assertGreaterThan(0, (int) $response->headers->get('Retry-After'));
        }
    }

    public function test_allowed_cors_preflight_keeps_private_security_headers_and_retry_after_is_exposed(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://127.0.0.1:4173', 'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'authorization,content-type',
        ])->options('/api/auth/login')->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173');

        $this->assertPrivateApiHeaders($response);
        $this->assertContains('Retry-After', config('cors.exposed_headers'));
    }

    public function test_cors_does_not_reflect_an_unapproved_origin(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'https://unapproved.example.test', 'Access-Control-Request-Method' => 'POST',
        ])->options('/api/auth/login')->assertNoContent()
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');

        $this->assertPrivateApiHeaders($response);
    }

    public function test_health_response_is_outside_the_api_header_policy(): void
    {
        $this->get('/up')->assertOk()->assertHeaderMissing('X-Frame-Options')
            ->assertHeaderMissing('Referrer-Policy')->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_hsts_is_opt_in_and_applies_only_to_secure_api_responses(): void
    {
        config(['api.hsts_max_age' => 0]);
        $this->getJson('https://api.example.test/api/security-test/context')->assertOk()
            ->assertHeaderMissing('Strict-Transport-Security');
        config(['api.hsts_max_age' => 3600]);

        $plain = $this->getJson('http://api.example.test/api/security-test/context')->assertOk()
            ->assertJsonPath('data.secure', false)->assertHeaderMissing('Strict-Transport-Security');
        $secure = $this->getJson('https://api.example.test/api/security-test/context')->assertOk()
            ->assertJsonPath('data.secure', true)->assertHeader('Strict-Transport-Security', 'max-age=3600');

        $this->assertPrivateApiHeaders($plain);
        $this->assertPrivateApiHeaders($secure);
    }

    public function test_secure_errors_receive_hsts_when_enabled(): void
    {
        config(['api.hsts_max_age' => 3600]);

        $response = $this->getJson('https://api.example.test/api/security-test/error')->assertServerError()
            ->assertHeader('Strict-Transport-Security', 'max-age=3600');

        $this->assertPrivateApiHeaders($response);
    }

    public function test_forwarded_headers_from_an_untrusted_peer_cannot_spoof_tls_or_the_client_ip(): void
    {
        config(['trustedproxy.proxies' => [], 'api.hsts_max_age' => 3600]);
        $response = $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.20'])->withHeaders([
            'X-Forwarded-For' => '203.0.113.45', 'X-Forwarded-Proto' => 'https',
        ])->getJson('http://api.example.test/api/security-test/context')->assertOk()
            ->assertJsonPath('data.secure', false)->assertJsonPath('data.ip', '198.51.100.20')
            ->assertHeaderMissing('Strict-Transport-Security');

        $this->assertPrivateApiHeaders($response);
    }

    public function test_configured_proxy_can_report_tls_and_ip_without_controlling_the_host(): void
    {
        config(['trustedproxy.proxies' => ['10.20.30.40'], 'api.hsts_max_age' => 3600]);
        $this->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])->withHeaders([
            'X-Forwarded-For' => '203.0.113.45', 'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Port' => '443', 'X-Forwarded-Host' => 'attacker.example.test',
        ])->getJson('http://api.example.test/api/security-test/context')->assertOk()
            ->assertJsonPath('data.secure', true)->assertJsonPath('data.ip', '203.0.113.45')
            ->assertJsonPath('data.host', 'api.example.test')
            ->assertHeader('Strict-Transport-Security', 'max-age=3600');
    }

    public function test_a_forge_looking_host_does_not_implicitly_trust_forwarded_headers(): void
    {
        config(['trustedproxy.proxies' => [], 'api.hsts_max_age' => 3600]);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.20'])->withHeaders([
            'X-Forwarded-For' => '203.0.113.45', 'X-Forwarded-Proto' => 'https',
        ])->getJson('http://untrusted.on-forge.com/api/security-test/context')->assertOk()
            ->assertJsonPath('data.secure', false)->assertJsonPath('data.ip', '198.51.100.20')
            ->assertHeaderMissing('Strict-Transport-Security');
    }
}
