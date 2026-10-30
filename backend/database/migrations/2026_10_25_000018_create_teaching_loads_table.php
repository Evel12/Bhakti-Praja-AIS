<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('teaching_loads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained()->restrictOnDelete();
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('classroom_id')->constrained()->restrictOnDelete();
            $table->foreignId('semester_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('weekly_hours');
            $table->string('status')->default('active');
            $table->timestamps();
            $table->unique(['teacher_id', 'subject_id', 'classroom_id', 'semester_id'], 'teaching_load_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_loads');
    }
};
