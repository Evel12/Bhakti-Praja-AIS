<?php

namespace Database\Factories;

use App\Enums\QuizStatus;
use App\Models\Quiz;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Quiz> */
class QuizFactory extends Factory
{
    public function definition(): array
    {
        return [
            'class_id' => SchoolClass::factory(),
            'title' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'deadline' => null,
            'status' => QuizStatus::Draft,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => QuizStatus::Published, 'deadline' => now()->addWeek()]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => QuizStatus::Closed, 'deadline' => now()->subDay()]);
    }
}
