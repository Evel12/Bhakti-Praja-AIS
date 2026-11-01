<?php

namespace App\Http\Requests\Reporting;

use App\Enums\AttemptStatus;
use Illuminate\Validation\Rule;

class QuizGradesRequest extends ReportRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'student_id' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', Rule::enum(AttemptStatus::class)],
        ];
    }
}
