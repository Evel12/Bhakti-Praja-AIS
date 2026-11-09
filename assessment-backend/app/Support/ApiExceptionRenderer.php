<?php

namespace App\Support;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ApiExceptionRenderer
{
    public static function render(Throwable $exception, Request $request): ?JsonResponse
    {
        if (! $request->is('api', 'api/*') && ! $request->expectsJson()) {
            return null;
        }

        if ($exception instanceof ValidationException) {
            return ApiResponse::error('VALIDATION_ERROR', 'The given data was invalid.', 422, $exception->errors());
        }

        if ($exception instanceof AuthenticationException) {
            return ApiResponse::error('UNAUTHENTICATED', 'Authentication required or credentials invalid.', 401);
        }

        if ($exception instanceof AuthorizationException) {
            return ApiResponse::error('FORBIDDEN', 'You are not allowed to perform this action.', 403);
        }

        $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
        [$code, $message] = match ($status) {
            400 => ['BAD_REQUEST', 'The request could not be processed.'],
            401 => ['UNAUTHENTICATED', 'Authentication required or credentials invalid.'],
            403 => ['FORBIDDEN', 'You are not allowed to perform this action.'],
            404 => ['NOT_FOUND', 'The requested resource was not found.'],
            405 => ['METHOD_NOT_ALLOWED', 'This HTTP method is not allowed.'],
            409 => ['CONFLICT', 'The request conflicts with the current resource state.'],
            413 => ['PAYLOAD_TOO_LARGE', 'The request body is too large.'],
            419 => ['SESSION_EXPIRED', 'Your session has expired.'],
            429 => ['TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'],
            503 => ['SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.'],
            default => ['SERVER_ERROR', 'An unexpected error occurred.'],
        };

        // Never return exception messages, SQL, or stack traces, even with APP_DEBUG=true.
        return ApiResponse::error($code, $message, $status, headers: $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : []);
    }
}
