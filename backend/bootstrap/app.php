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
        // Member 4 responses must not expose stack traces or SQL even when a
        // developer runs the application with APP_DEBUG=true. Other modules keep
        // their existing exception behavior and integrity conflicts above stay 409.
        $exceptions->render(function (\Throwable $exception, \Illuminate\Http\Request $request) {
            if (! $request->is('api/member4', 'api/member4/*')) return null;
            if ($exception instanceof \Illuminate\Validation\ValidationException) return null;
            if ($exception instanceof \Illuminate\Http\Exceptions\HttpResponseException) return $exception->getResponse();
            $status = $exception instanceof \Illuminate\Auth\AuthenticationException ? 401
                : ($exception instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface ? $exception->getStatusCode() : 500);
            $messages = [
                401 => 'Silakan masuk terlebih dahulu.', 403 => 'Anda tidak memiliki hak akses untuk layanan ini.',
                404 => 'Data tidak ditemukan atau tidak dapat diakses.', 405 => 'Metode permintaan tidak diizinkan.',
                413 => 'Ukuran berkas permintaan terlalu besar.', 429 => 'Terlalu banyak permintaan. Silakan coba kembali nanti.',
            ];
            $message = $status >= 500 ? 'Layanan gagal memproses permintaan. Silakan coba kembali.' : ($messages[$status] ?? 'Permintaan tidak dapat diproses.');
            $headers = $exception instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface ? $exception->getHeaders() : [];
            return response()->json(['success' => false, 'message' => $message], $status, $headers);
        });
        // API AIS selalu balas JSON (jangan redirect ke route('login')).
        $exceptions->shouldRenderJsonWhen(function ($request) {
            return $request->is('api/*');
        });
    })->create();
