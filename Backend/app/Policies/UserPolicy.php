<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;

class UserPolicy
{
    public function grades(User $user): bool
    {
        return $user->role === Role::Student;
    }

    public function view(User $actor, User $user): bool
    {
        return $actor->is($user) || $actor->role === Role::Admin;
    }
}
