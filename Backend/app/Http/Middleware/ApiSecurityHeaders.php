<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        if (! $request->is('api', 'api/*')) {
            return $response;
        }

        // Includes token, grade, answer-key and error responses; no shared/browser cache storage.
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');

        $maxAge = (int) config('api.hsts_max_age', 0);
        if ($request->isSecure() && $maxAge > 0) {
            $response->headers->set('Strict-Transport-Security', 'max-age='.$maxAge);
        }

        return $response;
    }
}
