<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Support\QuizValidationRules;

class ReplaceOptionsRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return QuizValidationRules::options();
    }
}
