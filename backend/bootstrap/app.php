<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Database\QueryException $exception, \Illuminate\Http\Request $request) {
            if ($request->is('api/*') && in_array((string) $exception->getCode(), ['23000', '23503', '23505'])) {
                return response()->json(['success' => false, 'message' => 'Data masih digunakan oleh data lain atau sudah terdaftar. Periksa relasi sebelum melanjutkan.'], 409);
            }
        });
        // API AIS selalu balas JSON (jangan redirect ke route('login')).
        $exceptions->shouldRenderJsonWhen(function ($request) {
            return $request->is('api/*');
        });
    })->create();
