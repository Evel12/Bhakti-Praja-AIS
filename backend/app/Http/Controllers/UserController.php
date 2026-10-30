<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private function resolveRoleId(Request $request, $currentId = null)
    {
        if ($request->filled('role_id')) {
            return (int) $request->input('role_id');
        }

        if ($request->filled('role')) {
            $role = Role::where('name', $request->input('role'))->first();

            return $role?->id ?? $currentId;
        }

        return $currentId;
    }

    private function format(User $user): array
    {
        $user->loadMissing('role');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->name ?? null,
            'role_id' => $user->role_id,
            'role_display' => $user->role->display_name ?? null,
            'status' => $user->status,
            'created_at' => $user->created_at,
        ];
    }

    public function index(Request $request)
    {
        $query = User::with('role')->orderBy('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->whereHas('role', fn ($q) => $q->where('name', $request->query('role')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($users->items())->map(fn ($u) => $this->format($u))->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    public function show(string $id)
    {
        $user = User::with('role')->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->format($user),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'role' => ['nullable', 'string', Rule::in(['admin', 'guru', 'murid', 'wali_murid'])],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_INACTIVE])],
        ], [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
            'role.in' => 'Role tidak valid.',
            'role_id.exists' => 'Role tidak ditemukan.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $roleId = $this->resolveRoleId($request);

        if (! $roleId) {
            $roleId = Role::where('name', 'murid')->value('id');
        }

        $user = User::create([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'password' => $request->input('password'),
            'role_id' => $roleId,
            'status' => $request->input('status', User::STATUS_ACTIVE),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dibuat.',
            'data' => $this->format($user),
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['sometimes', 'required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'role' => ['nullable', 'string', Rule::in(['admin', 'guru', 'murid', 'wali_murid'])],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_INACTIVE])],
        ], [
            'email.unique' => 'Email sudah digunakan.',
            'email.email' => 'Format email tidak valid.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->filled('name')) {
            $user->name = $request->input('name');
        }

        if ($request->filled('email')) {
            $user->email = $request->input('email');
        }

        if ($request->filled('password')) {
            $user->password = $request->input('password');
        }

        $newRoleId = $this->resolveRoleId($request, $user->role_id);

        if ($user->id === $request->user()->id && $newRoleId !== $user->role_id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak dapat mengubah peran akun sendiri.'], 422);
        }

        if ($newRoleId) {
            $user->role_id = $newRoleId;
        }

        if ($request->has('status')) {
            $newStatus = $request->input('status');

            if ($user->id === $request->user()->id && $newStatus === User::STATUS_INACTIVE) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak dapat menonaktifkan akun sendiri.',
                ], 422);
            }

            $user->status = $newStatus;
        }

        $user->save();

        if ($user->status === User::STATUS_INACTIVE || $user->wasChanged('role_id')) {
            $user->tokens()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil diperbarui.',
            'data' => $this->format($user),
        ]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_INACTIVE])],
        ], [
            'status.required' => 'Status wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat mengubah status akun sendiri.',
            ], 422);
        }

        $user->status = $request->input('status');
        $user->save();

        if ($user->status === User::STATUS_INACTIVE) {
            $user->tokens()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Status pengguna berhasil diubah.',
            'data' => $this->format($user),
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menghapus akun sendiri.',
            ], 422);
        }

        $user->loadMissing('role');

        if (($user->role->name ?? null) === 'admin' && $user->status === User::STATUS_ACTIVE) {
            $activeAdmins = User::where('status', User::STATUS_ACTIVE)
                ->whereHas('role', fn ($q) => $q->where('name', 'admin'))
                ->count();

            if ($activeAdmins <= 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tidak dapat menghapus satu-satunya admin aktif.',
                ], 422);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }
}
