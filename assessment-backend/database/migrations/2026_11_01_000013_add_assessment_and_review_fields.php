<?php

use App\Enums\QuestionSource;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            $table->string('assessment_type', 32)->default('quiz');
            $table->string('course_name')->nullable();
            $table->text('instructions')->nullable();
            $table->timestamp('open_at')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->default(30);
            $table->string('release_mode', 32)->default('immediate');
            $table->boolean('results_released')->default(false);
        });

        Schema::table('questions', function (Blueprint $table): void {
            $table->string('source', 32)->default(QuestionSource::Manual->value);
            $table->boolean('reviewed')->default(true);
            $table->unsignedSmallInteger('points')->default(10);
            $table->text('explanation')->nullable();
            $table->string('topic')->nullable();
            $table->boolean('is_bank_item')->default(false);
        });

        Schema::table('attempts', function (Blueprint $table): void {
            $table->timestamp('expires_at')->nullable();
            $table->text('teacher_feedback')->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->json('flagged_question_ids')->nullable();
        });

        Schema::table('attempt_answers', function (Blueprint $table): void {
            $table->boolean('is_flagged')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('attempt_answers', function (Blueprint $table): void {
            $table->dropColumn(['is_flagged']);
        });

        Schema::table('attempts', function (Blueprint $table): void {
            $table->dropColumn(['expires_at', 'teacher_feedback', 'graded_at', 'flagged_question_ids']);
        });

        Schema::table('questions', function (Blueprint $table): void {
            $table->dropColumn(['source', 'reviewed', 'points', 'explanation', 'topic', 'is_bank_item']);
        });

        Schema::table('quizzes', function (Blueprint $table): void {
            $table->dropColumn([
                'assessment_type',
                'course_name',
                'instructions',
                'open_at',
                'duration_minutes',
                'release_mode',
                'results_released',
            ]);
        });
    }
};
