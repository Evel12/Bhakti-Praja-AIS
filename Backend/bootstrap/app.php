<?php

use App\Http\Middleware\ApiSecurityHeaders;
use App\Http\Middleware\EnsureRole;
use App\Support\ApiExceptionRenderer;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Global placement also covers unmatched API URLs and preflight/error responses.
        $middleware->prepend(ApiSecurityHeaders::class);
        $middleware->alias(['role' => EnsureRole::class]);
        $middleware->appendToPriorityList(AuthenticatesRequests::class, EnsureRole::class);
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_PORT);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api', 'api/*') || $request->expectsJson());
        $exceptions->render(fn (Throwable $exception, Request $request) => ApiExceptionRenderer::render($exception, $request));
    })->create();
