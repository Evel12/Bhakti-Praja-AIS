<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ExactlyOneCorrectOption implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) {
            return;
        }

        // Match Laravel's boolean validation without treating arbitrary strings as true.
        $correct = array_filter($value, fn ($option) => is_array($option)
            && in_array($option['is_correct'] ?? null, [true, 1, '1'], true));

        if (count($correct) !== 1) {
            $fail('Each question must have exactly one correct option.');
        }
    }
}
