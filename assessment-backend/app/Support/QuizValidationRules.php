<?php

namespace App\Support;

use App\Enums\OptionLabel;
use App\Enums\QuestionType;
use App\Rules\ExactlyOneCorrectOption;
use Illuminate\Validation\Rule;

class QuizValidationRules
{
    public static function deadline(bool $publishing = false): array
    {
        // Keep validation compatible with the existing MySQL TIMESTAMP column.
        return $publishing
            ? ['required', 'date', 'after:now', 'before_or_equal:2038-01-19T03:14:07+00:00']
            : ['sometimes', 'nullable', 'date', 'after_or_equal:1970-01-01T00:00:01+00:00', 'before_or_equal:2038-01-19T03:14:07+00:00'];
    }

    public static function options(string $presence = 'required'): array
    {
        return [
            'options' => [$presence, 'array', 'list', 'size:4', new ExactlyOneCorrectOption],
            'options.*' => ['required', 'array:option_label,option_text,is_correct'],
            'options.*.option_label' => ['required', Rule::enum(OptionLabel::class), 'distinct:strict'],
            'options.*.option_text' => ['required', 'string', 'max:5000'],
            'options.*.is_correct' => ['required', 'boolean'],
        ];
    }

    public static function question(bool $partial = false): array
    {
        return [
            'question_text' => [$partial ? 'sometimes' : 'required', 'required', 'string', 'max:10000'],
            'question_type' => ['sometimes', 'required', Rule::enum(QuestionType::class)],
            ...self::options($partial ? 'sometimes' : 'required'),
        ];
    }
}
