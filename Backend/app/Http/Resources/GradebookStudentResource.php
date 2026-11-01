<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GradebookStudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $student = $this->resource['student'];

        return [
            'student' => ['id' => $student->id, 'name' => $student->name, 'email' => $student->email],
            'enrollment_status' => $student->enrolled ? 'enrolled' : 'former',
            'summary' => $this->resource['summary'],
        ];
    }
}
