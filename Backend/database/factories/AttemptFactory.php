<?php

namespace Database\Factories;

use App\Enums\AttemptStatus;
use App\Enums\ChallengeMode;
use App\Enums\GameMode;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Attempt> */
class AttemptFactory extends Factory
{
    public function definition(): array
    {
        return [
            'quiz_id' => Quiz::factory()->published(),
            'student_id' => User::factory(),
            'game_mode' => GameMode::Boss,
            'challenge_mode' => ChallengeMode::Normal,
            'started_at' => now(),
            'status' => AttemptStatus::Ongoing,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(fn (Attempt $attempt) => $attempt->quiz->schoolClass->students()->syncWithoutDetaching([$attempt->student_id]));
    }
}
