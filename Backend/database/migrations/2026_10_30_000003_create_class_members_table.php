<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('class_id')->index()->constrained('classes')->cascadeOnDelete();
            $table->foreignId('student_id')->index()->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['class_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_members');
    }
};
