<?php

namespace App\Http\Resources;

use App\Enums\Role;
use Illuminate\Http\Request;

class TeacherQuizResource extends QuizResource
{
    public function toArray(Request $request): array
    {
        abort_unless($request->user()?->role === Role::Teacher, 403);

        return [
            ...parent::toArray($request),
            'questions' => TeacherQuestionResource::collection($this->whenLoaded('questions')),
        ];
    }
}
