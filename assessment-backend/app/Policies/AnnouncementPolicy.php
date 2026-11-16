<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\SchoolClass;
use App\Models\User;

class AnnouncementPolicy
{
    public function viewAny(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->view($user, $schoolClass);
    }

    public function create(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->update($user, $schoolClass);
    }

    public function delete(User $user, Announcement $announcement): bool
    {
        return (new SchoolClassPolicy)->update($user, $announcement->schoolClass);
    }
}
