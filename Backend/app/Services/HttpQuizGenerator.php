<?php

namespace App\Services;

use App\Contracts\QuizGenerator;
use App\Exceptions\QuizGenerationException;
use App\Models\Module;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use JsonException;
use Psr\Http\Message\ResponseInterface;
use Throwable;

/** Reference wire adapter. The separate Python team can implement it or replace this binding. */
class HttpQuizGenerator implements QuizGenerator
{
    public function generate(Module $module, int $questionCount, int $generationId): array
    {
        [$url, $key, $timeout, $connectTimeout] = $this->configuration();
        $pdf = $this->pdf($module);
        $tooLarge = false;
        $response = null;
        $max = config('quiz_generation.max_response_bytes');

        try {
            // A queue attempt makes one HTTP call. Retry/backoff belongs to GenerateQuiz.
            $response = Http::acceptJson()->withToken($key)->timeout($timeout)->connectTimeout($connectTimeout)
                ->withHeaders(['Idempotency-Key' => 'quiz-generation-'.$generationId])
                ->withOptions([
                    'allow_redirects' => false,
                    'on_headers' => static function (ResponseInterface $response) use ($max, &$tooLarge): void {
                        if ((int) $response->getHeaderLine('Content-Length') > $max) {
                            $tooLarge = true;
                            throw new QuizGenerationException('malformed_output');
                        }
                    },
                    'progress' => static function ($total, $downloaded) use ($max, &$tooLarge): void {
                        if ($total > $max || $downloaded > $max) {
                            $tooLarge = true;
                            throw new QuizGenerationException('malformed_output');
                        }
                    },
                ])
                ->attach('file', $pdf, 'module-'.$module->id.'.pdf', ['Content-Type' => 'application/pdf'])
                ->post($url, ['question_count' => (string) $questionCount]);

            if (in_array($response->status(), [408, 425, 429], true) || $response->serverError()) {
                throw new QuizGenerationException('ai_unavailable', true);
            }
            if (! $response->successful()) {
                // Includes redirects: do not forward the authenticated PDF to another address.
                throw new QuizGenerationException('ai_rejected');
            }
            $body = $response->body();
            if (strlen($body) > $max) {
                throw new QuizGenerationException('malformed_output');
            }
            try {
                $output = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw new QuizGenerationException('malformed_output');
            }
            if (! is_array($output)) {
                throw new QuizGenerationException('malformed_output');
            }

            return $output;
        } catch (Throwable $exception) {
            if ($exception instanceof QuizGenerationException) {
                throw $exception;
            }
            // Do not retain the original HTTP exception, body, URL, or request headers.
            throw new QuizGenerationException($tooLarge ? 'malformed_output' : 'ai_unavailable', ! $tooLarge);
        } finally {
            fclose($pdf);
            $response?->close();
        }
    }

    private function configuration(): array
    {
        $base = config('quiz_generation.base_url');
        $endpoint = config('quiz_generation.endpoint');
        $key = config('quiz_generation.api_key');
        $timeout = config('quiz_generation.timeout');
        $connectTimeout = config('quiz_generation.connect_timeout');
        $parts = is_string($base) ? parse_url($base) : false;
        if (! is_array($parts) || ! in_array($parts['scheme'] ?? null, ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])
            || ! is_string($endpoint) || ! str_starts_with($endpoint, '/') || str_starts_with($endpoint, '//')
            || preg_match('/[\x00-\x20\\\\?#]/', $endpoint)
            || ! is_string($key) || trim($key) === '' || preg_match('/[\r\n]/', $key)
            || ! is_int($timeout) || $timeout < 1 || $timeout > 60
            || ! is_int($connectTimeout) || $connectTimeout < 1 || $connectTimeout > $timeout) {
            throw new QuizGenerationException('configuration_error');
        }

        return [rtrim($base, '/').$endpoint, $key, $timeout, $connectTimeout];
    }

    /** Copy a bounded private PDF into a seekable stream; no local path is sent to Python. */
    private function pdf(Module $module)
    {
        $source = null;
        $copy = null;
        try {
            $path = str_replace('\\', '/', $module->path);
            if ($path === '' || str_starts_with($path, '/') || str_contains($path, ':')
                || str_contains($path, "\0") || preg_match('~(^|/)\.\.?(/|$)~', $path)
                || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'pdf') {
                throw new QuizGenerationException('source_unavailable');
            }
            $source = Storage::disk(config('quiz_generation.disk'))->readStream($path);
            $copy = fopen('php://temp/maxmemory:2097152', 'w+b');
            if (! is_resource($source) || ! is_resource($copy)) {
                throw new QuizGenerationException('source_unavailable');
            }
            $length = stream_copy_to_stream($source, $copy, config('quiz_generation.max_pdf_bytes') + 1);
            if ($length === false || $length > config('quiz_generation.max_pdf_bytes') || $length < 5) {
                throw new QuizGenerationException('source_unavailable');
            }
            rewind($copy);
            if (fread($copy, 5) !== '%PDF-') {
                throw new QuizGenerationException('source_unavailable');
            }
            rewind($copy);

            return $copy;
        } catch (Throwable) {
            if (is_resource($copy)) {
                fclose($copy);
            }
            throw new QuizGenerationException('source_unavailable');
        } finally {
            if (is_resource($source)) {
                fclose($source);
            }
        }
    }
}
