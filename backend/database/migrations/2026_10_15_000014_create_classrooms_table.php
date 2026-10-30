<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classrooms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->string('level', 10);
            $table->foreignId('study_program_id')->constrained('study_programs')->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->foreignId('homeroom_teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['name', 'academic_year_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classrooms');
    }
};
