<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use App\Services\Member4\Money;

class Invoice extends Model
{
    public const TYPES = ['spp', 'exam', 'activity', 'book', 'uniform'];
    protected $fillable = ['student_id', 'created_by', 'invoice_type', 'amount', 'due_date'];
    protected $hidden = ['verified_total'];
    protected $appends = ['verified_amount', 'outstanding_amount', 'is_overdue', 'display_status'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'due_date' => 'date:Y-m-d'];
    }

    public function student(): BelongsTo { return $this->belongsTo(Student::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }

    public function scopeWithFinanceTotals(Builder $query): Builder
    {
        return $query->withSum(['payments as verified_total' => fn ($q) => $q->where('status', 'verified')], 'amount')
            ->withCount(['payments', 'payments as pending_payments_count' => fn ($q) => $q->where('status', 'pending')]);
    }

    public function scopeOutstanding(Builder $query): Builder
    {
        return $query->whereRaw("invoices.amount > COALESCE((SELECT SUM(payments.amount) FROM payments WHERE payments.invoice_id = invoices.id AND payments.status = 'verified'), 0)");
    }

    public function getVerifiedAmountAttribute(): string
    {
        $sum = array_key_exists('verified_total', $this->attributes) ? $this->attributes['verified_total'] : $this->payments()->where('status', 'verified')->sum('amount');
        return Money::decimal(Money::cents($sum));
    }

    public function getOutstandingAmountAttribute(): string
    {
        return Money::decimal(max(0, Money::cents($this->amount) - Money::cents($this->verified_amount)));
    }

    public function getIsOverdueAttribute(): bool
    {
        return Money::cents($this->outstanding_amount) > 0 && $this->due_date->format('Y-m-d') < now(config('member4_finance.timezone'))->format('Y-m-d');
    }

    public function getDisplayStatusAttribute(): string
    {
        return Money::cents($this->outstanding_amount) === 0 ? 'paid' : ($this->is_overdue ? 'overdue' : 'unpaid');
    }
}
