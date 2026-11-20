<?php

namespace App\Jobs;

use App\Contracts\QuizGenerator;
use App\Exceptions\QuizGenerationException;
use App\Services\GeneratedQuizValidator;
use App\Services\QuizGenerationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class GenerateQuiz implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 135;

    public bool $failOnTimeout = true;

    public function __construct(
        public readonly int $generationId,
        public readonly ?string $customTitle = null,
    ) {}

    public function backoff(): array
    {
        return [10, 30];
    }

    public function handle(QuizGenerationService $generations, QuizGenerator $client, GeneratedQuizValidator $validator): void
    {
        try {
            $generation = $generations->begin($this->generationId);
            if (! $generation) {
                return;
            }
            // Network I/O must never keep the module/class/generation transaction open.
            $output = $client->generate($generation->module, $generation->question_count, $generation->id);
            $draft = $validator->validate($output, $generation->question_count);
            if (isset($this->customTitle) && is_string($this->customTitle) && trim($this->customTitle) !== '') {
                $draft['title'] = mb_substr(trim($this->customTitle), 0, 255);
            }
            $generations->complete($generation->id, $draft);
        } catch (Throwable $exception) {
            $safe = $exception instanceof QuizGenerationException
                ? $exception : new QuizGenerationException('generation_failed', true);
            try {
                if (! $safe->retryable) {
                    $generations->fail($this->generationId, $safe->errorCode);

                    return;
                }
                $generations->retrying($this->generationId, $safe->errorCode);
            } catch (Throwable) {
                // Database errors may include SQL; only the safe exception reaches failed_jobs.
                throw new QuizGenerationException('generation_failed', true);
            }
            throw $safe;
        }
    }

    public function failed(?Throwable $exception): void
    {
        try {
            // Laravel reconstructs this job for failed(); only the serialized ID is required.
            app(QuizGenerationService::class)->fail($this->generationId,
                $exception instanceof QuizGenerationException ? $exception->errorCode : 'generation_failed');
        } catch (Throwable) {
            throw new QuizGenerationException('generation_failed');
        }
    }
}
