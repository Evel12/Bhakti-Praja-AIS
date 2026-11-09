<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Support\QuizValidationRules;

class UpdateQuizRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'deadline' => QuizValidationRules::deadline(),
        ];
    }
}
