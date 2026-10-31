<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use App\Services\Member4\StudentAccess;
use Illuminate\Auth\Access\Response;

class InvoicePolicy
{
    public function view(User $user, Invoice $invoice): Response
    {
        return $user->isActive() && app(StudentAccess::class)->invoices($user)->whereKey($invoice->id)->exists()
            ? Response::allow() : Response::deny('Tagihan tidak dapat diakses.');
    }

    public function create(User $user): Response
    {
        return $user->isAdmin() ? Response::allow() : Response::deny('Hanya admin yang dapat mengelola tagihan.');
    }

    public function update(User $user, Invoice $invoice): Response { return $this->create($user); }

    public function submitPayment(User $user, Invoice $invoice): Response
    {
        return in_array($user->role?->name, ['murid', 'wali_murid'], true) && $this->view($user, $invoice)->allowed()
            ? Response::allow() : Response::deny('Pembayaran hanya dapat diajukan oleh murid atau wali yang berhak.');
    }
}
