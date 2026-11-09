<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Support\QuizValidationRules;

class SaveQuestionRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return QuizValidationRules::question(! $this->isMethod('POST'));
    }
}
