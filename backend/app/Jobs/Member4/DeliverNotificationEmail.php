<?php

namespace App\Jobs\Member4;

use App\Mail\Member4\PortalNotificationMail;
use App\Models\PortalNotification;
use App\Services\Member4\NotificationAccess;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class DeliverNotificationEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public int $timeout = 60;
    public function backoff(): array { return [60, 300]; }
    public function __construct(public int $notificationId, public ?string $contentHash = null) {}

    public function handle(NotificationAccess $access): void
    {
        DB::transaction(function () use ($access) {
            $item = PortalNotification::whereKey($this->notificationId)->lockForUpdate()->first();
            // Failed jobs may be explicitly retried with Laravel's queue:retry.
            if (! $item || ! in_array($item->email_status, ['pending', 'failed'], true)) return;
            if ($this->contentHash !== null && ! hash_equals($this->contentHash, hash('sha256', $item->title."\0".$item->message))) return;
            $user = $item->user;
            if (! config('member4_communication.email_enabled') || ! in_array(config('mail.default'), ['smtp', 'sendmail'], true) || ! $user?->isActive() || ! filter_var($user->email, FILTER_VALIDATE_EMAIL) || ! $access->forUser($user)->whereKey($item->id)->exists()) {
                $item->email_status = 'skipped';
                $item->save();
                return;
            }
            Mail::to($user->email)->send(new PortalNotificationMail($item->title, $item->message));
            $item->email_status = 'sent';
            $item->email_sent_at = now();
            $item->save();
        });
    }

    public function failed(?\Throwable $exception): void
    {
        DB::transaction(function () {
            $item = PortalNotification::whereKey($this->notificationId)->lockForUpdate()->first();
            if (! $item || $item->email_status !== 'pending') return;
            if ($this->contentHash !== null && ! hash_equals($this->contentHash, hash('sha256', $item->title."\0".$item->message))) return;
            $item->email_status = 'failed';
            $item->save();
        });
    }
}
