<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = ['invoice_id', 'submitted_by', 'payment_date', 'amount', 'payment_method', 'transaction_number', 'proof_path', 'proof_mime', 'proof_size'];
    protected $hidden = ['proof_path'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'payment_date' => 'datetime', 'verified_at' => 'datetime', 'proof_size' => 'integer'];
    }

    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }
    public function submitter(): BelongsTo { return $this->belongsTo(User::class, 'submitted_by'); }
    public function verifier(): BelongsTo { return $this->belongsTo(User::class, 'verified_by'); }
}
