<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;

class UpdateOptionRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'option_text' => ['sometimes', 'required', 'string', 'max:5000'],
            'is_correct' => ['sometimes', 'required', 'boolean'],
            'option_label' => ['prohibited'],
        ];
    }
}
