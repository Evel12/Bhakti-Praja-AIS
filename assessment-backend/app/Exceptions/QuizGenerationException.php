<?php

namespace App\Exceptions;

use RuntimeException;

class QuizGenerationException extends RuntimeException
{
    public readonly string $errorCode;

    public function __construct(string $errorCode, public readonly bool $retryable = false)
    {
        $this->errorCode = self::safeCode($errorCode);
        // Never chain HTTP exceptions: their messages can contain response bodies or credentials.
        parent::__construct('Quiz generation failed: '.$this->errorCode.'.');
    }

    public static function safeCode(string $code): string
    {
        return in_array($code, [
            'configuration_error', 'source_unavailable', 'malformed_output', 'ai_unavailable',
            'ai_rejected', 'ownership_changed', 'generation_failed',
        ], true) ? $code : 'generation_failed';
    }
}
