<?php

namespace App\Http\Resources;

use App\Enums\AttemptStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttemptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $attempt = $this->resource['attempt'];
        $scoring = $this->resource['scoring'];

        return [
            'id' => $attempt->id,
            'quiz_id' => $attempt->quiz_id,
            'student_id' => $attempt->student_id,
            'game_mode' => $attempt->game_mode->value,
            'challenge_mode' => $attempt->challenge_mode->value,
            'boss_id' => $attempt->boss_id,
            'map_id' => $attempt->map_id,
            'started_at' => $attempt->started_at->toIso8601String(),
            'finished_at' => $attempt->finished_at?->toIso8601String(),
            'score' => $attempt->score,
            'current_streak' => $scoring->streak,
            'current_multiplier' => $scoring->currentMultiplier,
            'streak_max' => $attempt->streak_max,
            'multiplier_max' => $attempt->multiplier_max,
            'progress_percentage' => $attempt->progress_percentage,
            'status' => $attempt->status->value,
            'question_count' => $this->resource['question_count'],
            'answered_count' => $scoring->answeredCount,
            'final_grade' => $this->when($attempt->status === AttemptStatus::Finished, $attempt->final_grade),
        ];
    }
}
