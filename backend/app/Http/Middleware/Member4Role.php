<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Member4Role
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user) return response()->json(['success' => false, 'message' => 'Silakan masuk terlebih dahulu.'], 401);
        $user->loadMissing('role');
        if (! $user->isActive() || ! in_array($user->role?->name, $roles, true)) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki hak akses untuk layanan ini.'], 403);
        }
        return $next($request);
    }
}
