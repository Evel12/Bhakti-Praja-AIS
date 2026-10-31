<?php

namespace App\Services\Member4;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class FinanceService
{
    private function conflict(string $message): never
    {
        throw new HttpResponseException(response()->json(['success' => false, 'message' => $message], 409));
    }

    public function submit(User $user, int $invoiceId, array $data, UploadedFile $proof): Payment
    {
        $path = null;
        try {
            return DB::transaction(function () use ($user, $invoiceId, $data, $proof, &$path) {
                $invoice = Invoice::whereKey($invoiceId)->lockForUpdate()->firstOrFail();
                Gate::forUser($user)->authorize('submitPayment', $invoice);
                if ($invoice->status === 'paid' || Money::cents($invoice->payments()->where('status', 'verified')->sum('amount')) > 0) {
                    $this->conflict('Tagihan sudah memiliki pembayaran terverifikasi dan tidak menerima pengajuan baru.');
                }
                if ($invoice->payments()->where('status', 'pending')->exists()) {
                    $this->conflict('Tagihan masih memiliki pembayaran yang menunggu verifikasi.');
                }
                if (Money::cents($data['amount']) !== Money::cents($invoice->amount)) {
                    throw ValidationException::withMessages(['amount' => 'Nominal pembayaran harus sama dengan jumlah tagihan. Cicilan belum didukung.']);
                }
                $path = $proof->store('payment-proofs', 'local');
                if (! is_string($path) || $path === '') throw new \RuntimeException('Bukti pembayaran gagal disimpan.');
                return Payment::create([
                    'invoice_id' => $invoice->id, 'submitted_by' => $user->id,
                    'payment_date' => CarbonImmutable::parse($data['payment_date'], config('member4_finance.timezone'))->utc(),
                    'amount' => $invoice->amount, 'payment_method' => $data['payment_method'],
                    'transaction_number' => $data['transaction_number'] ?? null,
                    'proof_path' => $path, 'proof_mime' => $proof->getMimeType(), 'proof_size' => $proof->getSize(),
                ])->fresh();
            });
        } catch (\Throwable $exception) {
            // Filesystem operations are not rolled back by the database transaction.
            if (is_string($path) && $path !== '') Storage::disk('local')->delete($path);
            throw $exception;
        }
    }

    public function verify(User $user, int $paymentId, string $decision): Payment
    {
        if (! in_array($decision, ['verified', 'rejected'], true)) {
            throw ValidationException::withMessages(['decision' => 'Keputusan verifikasi tidak valid.']);
        }
        $initial = Payment::findOrFail($paymentId);
        return DB::transaction(function () use ($user, $paymentId, $initial, $decision) {
            // Same lock order as submission and invoice edits: invoice, then payment.
            $invoice = Invoice::whereKey($initial->invoice_id)->lockForUpdate()->firstOrFail();
            $payment = Payment::whereKey($paymentId)->where('invoice_id', $invoice->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize('verify', $payment);
            if ($payment->status !== 'pending') {
                if ($payment->status === $decision) return $payment;
                $this->conflict('Pembayaran sudah diputuskan. Keputusan yang tersimpan tidak dapat diganti.');
            }
            if ($decision === 'verified') {
                if (! Storage::disk('local')->exists($payment->proof_path)) {
                    $this->conflict('Berkas bukti tidak tersedia. Pembayaran tidak dapat diterima.');
                }
                if ($invoice->status === 'paid' || Money::cents($invoice->payments()->where('status', 'verified')->sum('amount')) > 0) {
                    $this->conflict('Tagihan sudah memiliki pembayaran terverifikasi.');
                }
                if (Money::cents($payment->amount) !== Money::cents($invoice->amount)) {
                    $this->conflict('Nominal pembayaran tidak sesuai tagihan. Tolak pengajuan ini agar dapat diperbaiki.');
                }
            }
            $payment->status = $decision;
            $payment->verified_by = $user->id;
            $payment->verified_at = now();
            $payment->save();
            $verified = Money::cents($invoice->payments()->where('status', 'verified')->sum('amount'));
            $invoice->status = $verified >= Money::cents($invoice->amount) ? 'paid' : 'unpaid';
            $invoice->save();
            return $payment;
        });
    }
}
