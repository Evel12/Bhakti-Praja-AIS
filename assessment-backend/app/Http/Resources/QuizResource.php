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
            'assessment_type' => $this->assessment_type ?? 'quiz',
            'course_name' => $this->course_name,
            'instructions' => $this->instructions,
            'open_at' => $this->open_at?->toIso8601String(),
            'deadline' => $this->deadline?->toIso8601String(),
            'duration_minutes' => (int) ($this->duration_minutes ?? 30),
            'release_mode' => $this->release_mode ?? 'immediate',
            'results_released' => (bool) ($this->results_released ?? false),
            'status' => $this->status->value,
            'questions_count' => $this->whenCounted('questions'),
        ];
    }
}
