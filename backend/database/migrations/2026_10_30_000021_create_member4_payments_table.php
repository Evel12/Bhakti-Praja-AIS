<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('payment_date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 50);
            $table->string('transaction_number', 100)->nullable();
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->string('proof_path');
            $table->string('proof_mime', 100);
            $table->unsignedInteger('proof_size');
            $table->foreignId('verified_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->dateTime('verified_at')->nullable();
            $table->timestamps();
            $table->index(['invoice_id', 'status']);
            $table->index(['status', 'payment_date']);
        });
    }

    public function down(): void { Schema::dropIfExists('payments'); }
};
