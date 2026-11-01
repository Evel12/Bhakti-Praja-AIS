<?php

namespace App\Http\Requests\Generation;

use App\Http\Requests\Auth\AuthenticatedRequest;

class GenerateQuizRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return ['question_count' => ['sometimes', 'required', 'integer', 'between:1,50']];
    }
}
