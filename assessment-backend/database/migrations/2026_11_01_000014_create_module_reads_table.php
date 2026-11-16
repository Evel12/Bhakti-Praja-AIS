<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_reads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('module_id')->index()->constrained('modules')->cascadeOnDelete();
            $table->foreignId('student_id')->index()->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['module_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_reads');
    }
};
