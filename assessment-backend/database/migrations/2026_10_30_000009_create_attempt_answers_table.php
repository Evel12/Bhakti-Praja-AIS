<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempt_answers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->index()->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('chosen_option_id');
            $table->boolean('is_correct');
            $table->timestamp('answered_at');
            $table->timestamps();
            $table->unique(['attempt_id', 'question_id']);
            $table->index(['chosen_option_id', 'question_id']);
            $table->foreign(['chosen_option_id', 'question_id'])
                ->references(['id', 'question_id'])->on('options')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempt_answers');
    }
};
