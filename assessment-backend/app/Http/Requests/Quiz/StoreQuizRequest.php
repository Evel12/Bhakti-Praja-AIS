<?php

namespace App\Http\Requests\Quiz;

use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Support\QuizValidationRules;

class StoreQuizRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'deadline' => QuizValidationRules::deadline(),
            'assessment_type' => ['sometimes', 'string', 'in:quiz,assignment,Kuis,Tugas,bank'],
            'course_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'instructions' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'open_at' => QuizValidationRules::deadline(),
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'release_mode' => ['sometimes', 'string', 'in:immediate,manual'],
            'results_released' => ['sometimes', 'boolean'],
        ];
    }
}
