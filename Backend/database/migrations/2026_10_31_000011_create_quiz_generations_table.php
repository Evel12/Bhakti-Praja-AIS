<?php

use App\Enums\QuizGenerationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_generations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('module_id')->constrained()->restrictOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            // Keep the generation history when its resulting draft is deleted.
            $table->foreignId('quiz_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('question_count');
            $table->enum('status', QuizGenerationStatus::cases())->default(QuizGenerationStatus::Queued->value);
            $table->string('error_code', 64)->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('finished_at')->nullable();
            $table->timestamps();
            $table->index(['module_id', 'status']);
            $table->index(['requested_by', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_generations');
    }
};
