<?php

namespace App\Http\Requests\Quiz;

use App\Enums\QuizStatus;
use App\Http\Requests\Auth\AuthenticatedRequest;
use Illuminate\Validation\Rule;

class ListQuizzesRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
            'status' => ['sometimes', Rule::enum(QuizStatus::class)],
        ];
    }
}
