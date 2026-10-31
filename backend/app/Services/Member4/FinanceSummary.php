<?php

namespace App\Services\Member4;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FinanceSummary
{
    public function __construct(private StudentAccess $access) {}

    public function forUser(User $user, ?int $studentId = null, ?string $type = null): array
    {
        $invoices = $this->access->invoices($user);
        if ($type) $invoices->where('invoice_type', $type);
        if ($studentId !== null) $invoices->where('student_id', $studentId);
        $base = (clone $invoices)->select('invoices.id', 'amount', 'due_date')
            ->selectSub(Payment::selectRaw('COALESCE(SUM(amount), 0)')->whereColumn('invoice_id', 'invoices.id')->where('status', 'verified'), 'verified');
        $remaining = '(CASE WHEN amount > verified THEN amount - verified ELSE 0 END)';
        $row = DB::query()->fromSub($base, 'bills')->selectRaw("COUNT(*) AS invoice_count, COALESCE(SUM(amount),0) AS billed_amount, COALESCE(SUM(verified),0) AS verified_amount, COALESCE(SUM($remaining),0) AS outstanding_amount, SUM(CASE WHEN amount > verified THEN 1 ELSE 0 END) AS unpaid_count, SUM(CASE WHEN amount <= verified THEN 1 ELSE 0 END) AS paid_count, SUM(CASE WHEN amount > verified AND due_date < ? THEN 1 ELSE 0 END) AS overdue_count, COALESCE(SUM(CASE WHEN due_date < ? THEN $remaining ELSE 0 END),0) AS overdue_amount", [now(config('member4_finance.timezone'))->toDateString(), now(config('member4_finance.timezone'))->toDateString()])->first();
        $result = [];
        foreach (['invoice_count', 'unpaid_count', 'paid_count', 'overdue_count'] as $key) $result[$key] = (int) ($row->$key ?? 0);
        foreach (['billed_amount', 'verified_amount', 'outstanding_amount', 'overdue_amount'] as $key) {
            // MySQL returns DECIMAL strings; SQLite's test driver can return a float.
            $value = $row->$key;
            $result[$key] = Money::decimal(Money::cents(is_float($value) ? number_format($value, 2, '.', '') : $value));
        }
        $counts = Payment::whereIn('invoice_id', (clone $invoices)->select('invoices.id'))->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        foreach (['pending', 'verified', 'rejected'] as $status) $result[$status.'_payment_count'] = (int) ($counts[$status] ?? 0);
        return $result;
    }

}
