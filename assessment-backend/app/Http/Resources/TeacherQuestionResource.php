<?php

namespace App\Http\Resources;

use App\Enums\QuestionSource;
use App\Enums\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeacherQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        abort_unless($request->user()?->role === Role::Teacher, 403);

        return [
            'id' => $this->id,
            'quiz_id' => $this->quiz_id,
            'question_text' => $this->question_text,
            'question_type' => $this->question_type->value,
            'source' => $this->source?->value ?? QuestionSource::Manual->value,
            'reviewed' => (bool) $this->reviewed,
            'options' => TeacherOptionResource::collection($this->whenLoaded('options')),
        ];
    }
}
