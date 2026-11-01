<?php

namespace App\Http\Requests\Reporting;

use App\Http\Requests\Auth\AuthenticatedRequest;

class ReportRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ];
    }
}
