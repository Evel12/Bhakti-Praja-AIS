<?php

namespace App\Http\Resources;

use App\Enums\AttemptStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoredAttemptGradeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $finished = $this->status === AttemptStatus::Finished;

        // A report reads persisted results, including legitimate zero or missing grades.
        // It never replays scoring or serializes loaded answers/option keys.
        return [
            'id' => $this->id,
            'quiz_id' => $this->quiz_id,
            'student_id' => $this->student_id,
            'game_mode' => $this->game_mode->value,
            'challenge_mode' => $this->challenge_mode->value,
            'status' => $this->status->value,
            'started_at' => $this->started_at->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'score' => $this->score,
            'final_grade' => $finished ? $this->final_grade : null,
            'graded' => $finished && $this->final_grade !== null,
            'streak_max' => $this->streak_max,
            'multiplier_max' => $this->multiplier_max,
            'progress_percentage' => $this->progress_percentage,
            'answered_count' => $this->whenCounted('answers'),
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id, 'name' => $this->student->name, 'email' => $this->student->email,
            ]),
            'quiz' => $this->whenLoaded('quiz', fn () => [
                'id' => $this->quiz->id, 'class_id' => $this->quiz->class_id,
                'title' => $this->quiz->title, 'status' => $this->quiz->status->value,
            ]),
        ];
    }
}
