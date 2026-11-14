<?php

namespace App\Http\Requests\Attempt;

use App\Http\Requests\Auth\AuthenticatedRequest;

class SubmitAnswerRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'question_id' => ['required', 'integer', 'min:1'],
            'chosen_option_id' => ['required_without:is_flagged', 'nullable', 'integer', 'min:1'],
            'replace' => ['sometimes', 'boolean'],
            'is_flagged' => ['sometimes', 'boolean'],
        ];
    }
}
