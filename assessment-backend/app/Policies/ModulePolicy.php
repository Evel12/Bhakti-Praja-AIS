<?php

namespace App\Policies;

use App\Enums\ModuleVisibility;
use App\Enums\Role;
use App\Models\Module;
use App\Models\SchoolClass;
use App\Models\User;

class ModulePolicy
{
    public function view(User $user, Module $module): bool
    {
        return $this->update($user, $module)
            || ($user->role === Role::Student && $module->visibility === ModuleVisibility::Public
                && (new SchoolClassPolicy)->view($user, $module->schoolClass));
    }

    public function create(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->update($user, $schoolClass);
    }

    public function update(User $user, Module $module): bool
    {
        return (new SchoolClassPolicy)->update($user, $module->schoolClass);
    }

    public function delete(User $user, Module $module): bool
    {
        return $this->update($user, $module);
    }

    public function generateQuiz(User $user, Module $module): bool
    {
        return $this->update($user, $module);
    }
}
