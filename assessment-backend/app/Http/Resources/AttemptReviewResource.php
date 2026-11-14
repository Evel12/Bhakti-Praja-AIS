<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class AttemptReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        abort_unless($user, 401);
        // Check completion and ownership before constructing any answer-key fields.
        Gate::forUser($user)->authorize('review', $this->resource);
        $answers = $this->answers->keyBy('question_id');
        $resultsVisible = $user->role->value === 'teacher'
            || ($this->quiz->release_mode ?? 'immediate') === 'immediate'
            || (bool) ($this->quiz->results_released ?? false);

        return [
            'attempt' => new StoredAttemptGradeResource($this->resource),
            'results_visible' => $resultsVisible,
            'student' => ['id' => $this->student->id, 'name' => $this->student->name, 'email' => $this->student->email],
            'quiz' => new QuizResource($this->quiz),
            // Questions come only from this quiz; malformed legacy answer links cannot
            // introduce foreign questions or options into the review.
            'questions' => $this->quiz->questions->map(function ($question) use ($answers, $resultsVisible): array {
                $answer = $answers->get($question->id);

                return [
                    'id' => $question->id,
                    'question_text' => $question->question_text,
                    'question_type' => $question->question_type->value,
                    'points' => (int) ($question->points ?? 10),
                    'explanation' => $resultsVisible ? $question->explanation : null,
                    'options' => $question->options->map(fn ($option) => [
                        'id' => $option->id,
                        'option_label' => $option->option_label->value,
                        'option_text' => $option->option_text,
                        ...($resultsVisible ? ['is_correct' => $option->is_correct] : []),
                    ])->all(),
                    'answer' => $answer ? [
                        'id' => $answer->id,
                        'chosen_option_id' => $answer->chosen_option_id,
                        'is_flagged' => (bool) ($answer->is_flagged ?? false),
                        ...($resultsVisible ? ['is_correct' => $answer->is_correct] : []),
                        'answered_at' => $answer->answered_at->toIso8601String(),
                    ] : null,
                ];
            })->all(),
        ];
    }
}
