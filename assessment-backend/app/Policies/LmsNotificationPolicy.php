<?php

namespace App\Policies;

use App\Models\LmsNotification;
use App\Models\User;

class LmsNotificationPolicy
{
    public function view(User $user, LmsNotification $notification): bool
    {
        return $notification->user_id === $user->id;
    }

    public function update(User $user, LmsNotification $notification): bool
    {
        return $notification->user_id === $user->id;
    }
}
