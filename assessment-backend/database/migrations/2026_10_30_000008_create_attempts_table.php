<?php

use App\Enums\AttemptStatus;
use App\Enums\ChallengeMode;
use App\Enums\GameMode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_id')->index()->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->index()->constrained('users')->restrictOnDelete();
            $table->enum('game_mode', GameMode::cases());
            $table->enum('challenge_mode', ChallengeMode::cases());
            // Parent game tables are deliberately deferred, as agreed with the user.
            $table->unsignedBigInteger('boss_id')->nullable();
            $table->unsignedBigInteger('map_id')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->decimal('score', 5, 2)->default(0);
            $table->unsignedInteger('streak_max')->default(0);
            // Zero means no multiplier has been recorded, not an agreed scoring rule.
            $table->decimal('multiplier_max', 8, 2)->default(0);
            $table->decimal('progress_percentage', 5, 2)->default(0);
            $table->enum('status', AttemptStatus::cases())->default(AttemptStatus::Ongoing->value);
            $table->timestamps();
            $table->index(['quiz_id', 'student_id', 'status']);
            $table->index(['student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempts');
    }
};
