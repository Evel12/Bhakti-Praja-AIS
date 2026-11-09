<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuizResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Class lists are safe for both roles; no nested content or answer keys.
        return [
            'id' => $this->id,
            'class_id' => $this->class_id,
            'title' => $this->title,
            'description' => $this->description,
            'deadline' => $this->deadline?->toIso8601String(),
            'status' => $this->status->value,
            'questions_count' => $this->whenCounted('questions'),
        ];
    }
}
