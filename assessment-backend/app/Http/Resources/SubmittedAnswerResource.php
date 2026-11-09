<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubmittedAnswerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Only correctness of the submitted choice is returned, never an option's answer key.
        return [
            'id' => $this->id,
            'question_id' => $this->question_id,
            'chosen_option_id' => $this->chosen_option_id,
            'is_correct' => $this->is_correct,
            'answered_at' => $this->answered_at->toIso8601String(),
        ];
    }
}
