<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Support\QuizValidationRules;

class PublishQuizRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return ['deadline' => QuizValidationRules::deadline(true)];
    }
}
