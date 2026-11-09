<?php

namespace App\Http\Resources;

use App\Enums\QuizGenerationStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class QuizGenerationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        abort_unless($request->user(), 401);
        Gate::forUser($request->user())->authorize('view', $this->resource);

        return [
            'id' => $this->id,
            'module_id' => $this->module_id,
            'question_count' => $this->question_count,
            'status' => $this->status->value,
            'quiz_id' => $this->quiz_id,
            'error_code' => $this->status === QuizGenerationStatus::Failed ? $this->error_code : null,
            'started_at' => $this->started_at?->toISOString(),
            'finished_at' => $this->finished_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
