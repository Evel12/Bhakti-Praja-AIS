<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Belum masuk. Silakan masuk terlebih dahulu.',
            ], 401);
        }

        $user->loadMissing('role');

        if (! $user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Akun dinonaktifkan.',
            ], 403);
        }

        if (($user->role->name ?? null) !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Khusus admin AIS.',
            ], 403);
        }

        return $next($request);
    }
}
