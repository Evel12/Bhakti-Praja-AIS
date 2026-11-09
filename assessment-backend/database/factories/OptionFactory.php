<?php

namespace Database\Factories;

use App\Enums\OptionLabel;
use App\Models\Option;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Option> */
class OptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'question_id' => Question::factory(),
            'option_label' => OptionLabel::A,
            'option_text' => fake()->sentence(),
            'is_correct' => false,
        ];
    }

    public function correct(): static
    {
        return $this->state(fn () => ['is_correct' => true]);
    }
}
