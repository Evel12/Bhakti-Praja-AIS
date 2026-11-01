<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('title');
            $table->text('content');
            $table->string('target_role', 50);
            $table->timestamps();
            $table->index(['target_role', 'created_at']);
        });
    }

    public function down(): void { Schema::dropIfExists('announcements'); }
};
