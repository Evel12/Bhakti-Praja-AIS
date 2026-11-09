<?php

namespace App\Http\Requests\Attempt;

use App\Enums\ChallengeMode;
use App\Enums\GameMode;
use App\Http\Requests\Auth\AuthenticatedRequest;
use Illuminate\Validation\Rule;

class StartAttemptRequest extends AuthenticatedRequest
{
    public function rules(): array
    {
        return [
            'game_mode' => ['required', Rule::enum(GameMode::class)],
            'challenge_mode' => ['required', Rule::enum(ChallengeMode::class)],
            'boss_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'map_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }
}
