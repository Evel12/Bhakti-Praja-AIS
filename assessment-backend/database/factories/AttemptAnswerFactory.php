<?php

namespace Database\Factories;

use App\Models\Attempt;
use App\Models\AttemptAnswer;
use App\Models\Option;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AttemptAnswer> */
class AttemptAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'attempt_id' => Attempt::factory(),
            'question_id' => fn (array $attributes) => Question::factory()
                ->for(Attempt::findOrFail($attributes['attempt_id'])->quiz)->withOptions()->create()->id,
            'chosen_option_id' => fn (array $attributes) => Question::findOrFail($attributes['question_id'])->options()->firstOrFail()->id,
            'is_correct' => fn (array $attributes) => Option::findOrFail($attributes['chosen_option_id'])->is_correct,
            'answered_at' => now(),
        ];
    }
}
