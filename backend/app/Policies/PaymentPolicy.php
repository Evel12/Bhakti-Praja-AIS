<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use App\Services\Member4\StudentAccess;
use Illuminate\Auth\Access\Response;

class PaymentPolicy
{
    public function view(User $user, Payment $payment): Response
    {
        return $user->isActive() && app(StudentAccess::class)->invoices($user)->whereKey($payment->invoice_id)->exists()
            ? Response::allow() : Response::deny('Bukti pembayaran tidak dapat diakses.');
    }

    public function verify(User $user, Payment $payment): Response
    {
        return $user->isAdmin() ? Response::allow() : Response::deny('Hanya admin yang dapat memverifikasi pembayaran.');
    }
}
