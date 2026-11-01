<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:150'],
            'password' => ['required', 'string', 'min:6'],
            'portal' => ['nullable', \Illuminate\Validation\Rule::in(['ais', 'member4', 'communication'])],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 6 karakter.',
            'portal.in' => 'Konteks portal tidak valid.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::with('role')
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau kata sandi salah.',
            ], 401);
        }

        if (! $user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        $portal = $request->input('portal') ?? 'ais';
        $allowedRoles = match ($portal) { 'communication' => ['admin', 'guru', 'murid', 'wali_murid'], 'member4' => ['admin', 'murid', 'wali_murid'], default => ['admin'] };
        if (! in_array($user->role?->name, $allowedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => $portal === 'ais' ? 'Akses ditolak. Halaman ini khusus admin AIS.' : 'Peran akun tidak memiliki akses ke portal wali dan keuangan.',
            ], 403);
        }

        $user->tokens()->delete();

        $token = $user->createToken($portal === 'ais' ? 'ais-admin' : $portal)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Masuk berhasil. Selamat datang.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->name,
                'status' => $user->status,
            ],
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('role');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->name ?? null,
                'status' => $user->status,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Keluar berhasil.',
        ]);
    }
}
