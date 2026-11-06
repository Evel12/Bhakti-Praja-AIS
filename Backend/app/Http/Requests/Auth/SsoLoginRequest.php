<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class SsoLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'provider' => ['required', 'string', 'in:undip,microsoft,google'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'role' => ['sometimes', 'nullable', 'string', 'in:teacher,student'],
            'device_name' => ['sometimes', 'required', 'string', 'max:100'],
        ];
    }
}
