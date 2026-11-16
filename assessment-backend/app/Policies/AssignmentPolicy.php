<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Assignment;
use App\Models\SchoolClass;
use App\Models\User;

class AssignmentPolicy
{
    public function viewAny(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->view($user, $schoolClass);
    }

    public function view(User $user, Assignment $assignment): bool
    {
        return (new SchoolClassPolicy)->update($user, $assignment->schoolClass)
            || ($user->role === Role::Student
                && $assignment->status === 'published'
                && (new SchoolClassPolicy)->view($user, $assignment->schoolClass));
    }

    public function create(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->update($user, $schoolClass);
    }

    public function update(User $user, Assignment $assignment): bool
    {
        return (new SchoolClassPolicy)->update($user, $assignment->schoolClass);
    }

    public function delete(User $user, Assignment $assignment): bool
    {
        return $this->update($user, $assignment);
    }
}
