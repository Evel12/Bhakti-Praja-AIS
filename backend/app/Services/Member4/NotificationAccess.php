<?php

namespace App\Services\Member4;

use App\Models\{Announcement, PortalNotification, User};
use Illuminate\Database\Eloquent\Builder;

class NotificationAccess
{
    public function forUser(User $user): Builder
    {
        if (! $user->isActive() || ! in_array($user->role?->name, ['admin', 'guru', 'murid', 'wali_murid'], true)) {
            return PortalNotification::whereRaw('1 = 0');
        }
        return PortalNotification::where('user_id', $user->id)->where(function ($q) use ($user) {
            $q->whereNull('category')
                ->orWhere(fn ($q) => $q->where('category', 'announcement')->whereIn('source_id', Announcement::whereIn('target_role', ['all', $user->role?->name])->select('id')))
                ->orWhere(fn ($q) => $q->where('category', 'payment_reminder')->whereIn('source_id', app(StudentAccess::class)->invoices($user)->where('status', 'unpaid')->outstanding()->select('invoices.id')));
        });
    }
}
