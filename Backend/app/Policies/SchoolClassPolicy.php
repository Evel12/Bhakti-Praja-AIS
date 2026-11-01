<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\SchoolClass;
use App\Models\User;

class SchoolClassPolicy
{
    public function gradebook(User $user, SchoolClass $schoolClass): bool
    {
        return $this->update($user, $schoolClass);
    }

    public function view(User $user, SchoolClass $schoolClass): bool
    {
        return $this->update($user, $schoolClass)
            || ($user->role === Role::Student && $schoolClass->students()->whereKey($user->id)->exists());
    }

    public function create(User $user): bool
    {
        return $user->role === Role::Teacher;
    }

    public function update(User $user, SchoolClass $schoolClass): bool
    {
        return $user->role === Role::Teacher && $schoolClass->teacher_id === $user->id;
    }

    public function delete(User $user, SchoolClass $schoolClass): bool
    {
        return $this->update($user, $schoolClass);
    }
}
