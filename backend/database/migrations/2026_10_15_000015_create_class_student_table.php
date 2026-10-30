<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('classroom_id')->constrained('classrooms')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->foreignId('semester_id')->nullable()->constrained('semesters')->restrictOnDelete();
            $table->string('status', 20)->default('active')->index();
            $table->date('assigned_at')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'academic_year_id', 'semester_id', 'classroom_id'], 'class_student_unique');
            $table->index(['classroom_id', 'status']);
            $table->index(['student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_student');
    }
};
