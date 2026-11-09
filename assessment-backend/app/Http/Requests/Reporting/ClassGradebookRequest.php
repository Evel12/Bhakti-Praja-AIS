<?php

namespace App\Http\Requests\Reporting;

class ClassGradebookRequest extends ReportRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'quiz_id' => ['sometimes', 'integer', 'min:1']];
    }
}
