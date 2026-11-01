<?php

namespace App\Http\Resources;

use App\Enums\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeacherOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Fail closed if this authoring resource is accidentally used for a student.
        abort_unless($request->user()?->role === Role::Teacher, 403);

        return [
            'id' => $this->id,
            'option_label' => $this->option_label->value,
            'option_text' => $this->option_text,
            'is_correct' => $this->is_correct,
        ];
    }
}
