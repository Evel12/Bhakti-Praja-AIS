<?php

namespace App\Services;

use App\Exceptions\QuizGenerationException;

class GeneratedQuizValidator
{
    public function validate(array $output, int $questionCount): array
    {
        $title = $this->text($output['title'] ?? null, 255);
        $description = isset($output['description']) ? $this->text($output['description'], 10000) : null;
        $questions = $output['questions'] ?? null;
        if ($questionCount < 1 || $questionCount > 50 || ! is_array($questions)
            || ! array_is_list($questions) || count($questions) !== $questionCount) {
            throw new QuizGenerationException('malformed_output');
        }

        $validated = [];
        foreach ($questions as $question) {
            if (! is_array($question) || (array_key_exists('question_type', $question) && $question['question_type'] !== 'multiple_choice')) {
                throw new QuizGenerationException('malformed_output');
            }
            $text = $this->text($question['question_text'] ?? null, 10000);
            $options = $question['options'] ?? null;
            if (! is_array($options) || ! array_is_list($options) || count($options) !== 4) {
                throw new QuizGenerationException('malformed_output');
            }
            $byLabel = [];
            $correct = 0;
            foreach ($options as $option) {
                if (! is_array($option) || ! in_array($option['option_label'] ?? null, ['A', 'B', 'C', 'D'], true)
                    || ! is_bool($option['is_correct'] ?? null) || isset($byLabel[$option['option_label']])) {
                    throw new QuizGenerationException('malformed_output');
                }
                $byLabel[$option['option_label']] = [
                    'option_label' => $option['option_label'],
                    'option_text' => $this->text($option['option_text'] ?? null, 5000),
                    'is_correct' => $option['is_correct'],
                ];
                $correct += (int) $option['is_correct'];
            }
            if ($correct !== 1) {
                throw new QuizGenerationException('malformed_output');
            }
            ksort($byLabel);
            $validated[] = ['question_text' => $text, 'options' => array_values($byLabel)];
        }

        // Only these fields can reach persistence; AI-supplied IDs, ownership and status are ignored.
        return ['title' => $title, 'description' => $description, 'questions' => $validated];
    }

    private function text(mixed $value, int $max): string
    {
        if (! is_string($value) || trim($value) === '' || mb_strlen($value) > $max) {
            throw new QuizGenerationException('malformed_output');
        }

        return trim($value);
    }
}
