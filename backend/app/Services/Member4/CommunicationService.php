<?php

namespace App\Services\Member4;

use App\Jobs\Member4\DeliverNotificationEmail;
use App\Models\{Announcement, Guardian, Invoice, PortalNotification, User};
use Illuminate\Support\Facades\DB;

class CommunicationService
{
    private function store(User $user, string $category, int $sourceId, string $title, string $message): bool
    {
        $item = PortalNotification::firstOrNew(['user_id' => $user->id, 'category' => $category, 'source_id' => $sourceId]);
        $changed = ! $item->exists || $item->title !== $title || $item->message !== $message;
        if (! $changed) return false;
        $item->title = $title;
        $item->message = $message;
        $item->is_read = false;
        $item->email_sent_at = null;
        $mailEnabled = config('member4_communication.email_enabled') && in_array(config('mail.default'), ['smtp', 'sendmail'], true);
        $item->email_status = $mailEnabled ? 'pending' : 'skipped';
        $item->save();
        if ($mailEnabled) {
            $id = $item->id;
            $hash = hash('sha256', $item->title."\0".$item->message);
            DB::afterCommit(function () use ($id, $hash) {
                try { DeliverNotificationEmail::dispatch($id, $hash); }
                catch (\Throwable $e) {
                    PortalNotification::whereKey($id)->where('email_status', 'pending')->update(['email_status' => 'failed']);
                    report($e);
                }
            });
        }
        return true;
    }

    public function syncAnnouncement(Announcement $announcement): int
    {
        $recipients = User::where('status', 'active')->whereHas('role', fn ($q) => $q->whereIn('name', $announcement->target_role === 'all' ? ['admin', 'guru', 'murid', 'wali_murid'] : [$announcement->target_role]));
        PortalNotification::where('category', 'announcement')->where('source_id', $announcement->id)->whereNotIn('user_id', (clone $recipients)->select('users.id'))->delete();
        $count = 0;
        foreach ($recipients->lazyById(100) as $user) {
            $count += (int) $this->store($user, 'announcement', $announcement->id, $announcement->title, $announcement->content);
        }
        return $count;
    }

    public function remindPayment(int $invoiceId): array
    {
        return DB::transaction(function () use ($invoiceId) {
            $invoice = Invoice::whereKey($invoiceId)->lockForUpdate()->firstOrFail();
            if ($invoice->status === 'paid' || Money::cents($invoice->outstanding_amount) === 0) return ['eligible' => false, 'created' => 0];
            $student = $invoice->student;
            $parents = Guardian::where('status', 'active')->whereHas('students', fn ($q) => $q->where('students.id', $student->id))->select('user_id');
            $users = User::where('status', 'active')->where(fn ($q) => $q
                ->where(fn ($q) => $q->where('id', $student->user_id)->whereHas('role', fn ($q) => $q->where('name', 'murid')))
                ->orWhere(fn ($q) => $q->whereIn('id', $parents)->whereHas('role', fn ($q) => $q->where('name', 'wali_murid'))));
            [$whole, $decimal] = explode('.', $invoice->outstanding_amount);
            $formatted = preg_replace('/\B(?=(\d{3})+(?!\d))/', '.', $whole).','.$decimal;
            $message = 'Tagihan #'.$invoice->id.' untuk '.$student->name.' masih memiliki sisa Rp '.$formatted.'. Tenggat pembayaran '.$invoice->due_date->format('d-m-Y').'. Periksa tagihan dan status verifikasi pembayaran di layanan keuangan.';
            $count = 0;
            foreach ($users->lazyById(100) as $user) $count += (int) $this->store($user, 'payment_reminder', $invoice->id, 'Pengingat Tagihan Pendidikan #'.$invoice->id, $message);
            return ['eligible' => true, 'created' => $count];
        });
    }
}
