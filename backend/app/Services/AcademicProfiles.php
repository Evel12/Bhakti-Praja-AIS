<?php

namespace App\Services;

use App\Models\{Student, Teacher, User};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Keeps login identities and academic records connected without replacing academic IDs. */
class AcademicProfiles
{
    public function sync(User $user): void
    {
        $role = $user->role()->value('name');
        foreach (['murid' => Student::class, 'guru' => Teacher::class] as $kind => $model) {
            $profile = $model::where('user_id', $user->id)->first();
            if ($role !== $kind) {
                if ($profile && $profile->status === 'active') $profile->update(['status' => 'inactive']);
                continue;
            }
            // An existing teacher can be connected by their unique email, never by name.
            if (! $profile && $kind === 'guru') {
                $profile = Teacher::where('email', $user->email)->first();
                if ($profile?->user_id && $profile->user_id !== $user->id) {
                    throw ValidationException::withMessages(['email' => 'Email sudah terhubung dengan akun guru lain.']);
                }
            }
            $values = ['user_id' => $user->id, 'name' => $user->name];
            if ($kind === 'guru') $values['email'] = $user->email;
            if (! $profile || ! in_array($profile->status, ['graduated', 'transferred'])) $values['status'] = $user->status;
            if ($profile) {
                $profile->update($values);
            } else {
                $field = $kind === 'guru' ? 'teacher_number' : 'student_number';
                $number = 'AKUN-'.$user->id;
                for ($suffix = 1; $model::where($field, $number)->exists(); $suffix++) $number = 'AKUN-'.$user->id.'-'.$suffix;
                $model::create($values + [$field => $number]);
            }
        }
    }

    public function syncAccount(Student|Teacher $profile): void
    {
        if (! $profile->user_id) return;
        $user = User::findOrFail($profile->user_id);
        $expected = $profile instanceof Student ? 'murid' : 'guru';
        if ($user->role()->value('name') !== $expected) {
            throw ValidationException::withMessages(['user_id' => 'Peran akun tidak sesuai dengan profil akademik ini.']);
        }
        $values = ['name' => $profile->name, 'status' => $profile->status === 'active' ? 'active' : 'inactive'];
        if ($profile instanceof Teacher && $profile->email) $values['email'] = $profile->email;
        $user->update($values);
        if ($user->wasChanged(['email', 'status'])) $user->tokens()->delete();
    }

    public function reconcile(): int
    {
        return DB::transaction(function () {
            $count = 0;
            User::whereHas('role', fn ($q) => $q->whereIn('name', ['guru', 'murid']))->chunkById(100, function ($users) use (&$count) {
                foreach ($users as $user) { $this->sync($user); $count++; }
            });
            return $count;
        });
    }
}
