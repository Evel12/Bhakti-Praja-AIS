<?php

namespace Database\Factories;

use App\Enums\OptionLabel;
use App\Enums\QuestionType;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Question> */
class QuestionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'quiz_id' => Quiz::factory(),
            'question_text' => fake()->sentence().'?',
            'question_type' => QuestionType::MultipleChoice,
        ];
    }

    public function withOptions(): static
    {
        return $this->afterCreating(function (Question $question): void {
            foreach (OptionLabel::cases() as $label) {
                Option::factory()->for($question)->create([
                    'option_label' => $label, 'is_correct' => $label === OptionLabel::A,
                ]);
            }
        });
    }
}
