<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lms_courses', function (Blueprint $t) {
            $t->id(); $t->foreignId('teacher_id')->constrained('users');
            $t->string('name'); $t->text('description')->nullable(); $t->string('code', 12)->unique(); $t->timestamps();
        });
        Schema::create('lms_members', function (Blueprint $t) {
            $t->id(); $t->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users'); $t->timestamps(); $t->unique(['course_id', 'user_id']);
        });
        Schema::create('lms_materials', function (Blueprint $t) {
            $t->id(); $t->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $t->string('name'); $t->string('path'); $t->string('visibility', 10)->default('public'); $t->timestamps();
        });
        Schema::create('lms_reads', function (Blueprint $t) {
            $t->id(); $t->foreignId('material_id')->constrained('lms_materials')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users'); $t->timestamp('read_at'); $t->unique(['material_id', 'user_id']);
        });
        Schema::create('lms_assignments', function (Blueprint $t) {
            $t->id(); $t->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $t->string('title'); $t->text('instructions'); $t->timestamp('due_at'); $t->string('status', 12)->default('draft'); $t->timestamps();
        });
        Schema::create('lms_submissions', function (Blueprint $t) {
            $t->id(); $t->foreignId('assignment_id')->constrained('lms_assignments')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users'); $t->text('answer')->nullable();
            $t->string('file_path')->nullable(); $t->string('file_name')->nullable();
            $t->decimal('grade', 5, 2)->nullable(); $t->text('feedback')->nullable(); $t->timestamps();
            $t->unique(['assignment_id', 'user_id']);
        });
        Schema::create('lms_attendance', function (Blueprint $t) {
            $t->id(); $t->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users'); $t->date('meeting_date'); $t->string('status', 12); $t->timestamps();
            $t->unique(['course_id', 'user_id', 'meeting_date']);
        });
        Schema::create('lms_announcements', function (Blueprint $t) {
            $t->id(); $t->foreignId('course_id')->constrained('lms_courses')->cascadeOnDelete();
            $t->string('title'); $t->text('content'); $t->timestamps();
        });
        Schema::create('lms_ai_drafts', function (Blueprint $t) {
            $t->id(); $t->foreignId('material_id')->constrained('lms_materials');
            $t->foreignId('requested_by')->constrained('users'); $t->string('model'); $t->unsignedInteger('question_count');
            $t->string('status', 16)->default('queued'); $t->json('draft')->nullable();
            $t->timestamp('reviewed_at')->nullable(); $t->timestamp('deadline')->nullable();
            $t->string('error')->nullable(); $t->timestamps();
        });
        Schema::create('lms_quiz_results', function (Blueprint $t) {
            $t->id(); $t->foreignId('draft_id')->constrained('lms_ai_drafts'); $t->foreignId('user_id')->constrained('users');
            $t->json('answers'); $t->decimal('grade', 5, 2); $t->timestamps(); $t->unique(['draft_id', 'user_id']);
        });
    }

    public function down(): void
    {
        foreach (['lms_quiz_results', 'lms_ai_drafts', 'lms_announcements', 'lms_attendance', 'lms_submissions', 'lms_assignments', 'lms_reads', 'lms_materials', 'lms_members', 'lms_courses'] as $table) Schema::dropIfExists($table);
    }
};
