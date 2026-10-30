<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('curricula', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_program_id')->constrained('study_programs')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('year', 10);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['study_program_id', 'name', 'year']);
        });

        Schema::create('curriculum_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('curriculum_id')->constrained('curricula')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->unsignedTinyInteger('semester_number')->nullable();
            $table->timestamps();

            $table->unique(['curriculum_id', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('curriculum_subjects');
        Schema::dropIfExists('curricula');
    }
};
