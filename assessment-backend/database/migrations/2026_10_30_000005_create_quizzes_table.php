<?php

use App\Enums\QuizStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('class_id')->index()->constrained('classes')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('deadline')->nullable();
            $table->enum('status', QuizStatus::cases())->default(QuizStatus::Draft->value);
            $table->timestamps();
            $table->index(['class_id', 'status', 'deadline']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quizzes');
    }
};
