<?php

namespace App\Models;

use App\Enums\AttemptStatus;
use App\Enums\ChallengeMode;
use App\Enums\GameMode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['game_mode', 'challenge_mode', 'boss_id', 'map_id'])]
#[Hidden(['scoring_rules'])]
class Attempt extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'game_mode' => GameMode::class,
            'challenge_mode' => ChallengeMode::class,
            'started_at' => 'immutable_datetime',
            'finished_at' => 'immutable_datetime',
            'score' => 'decimal:2',
            'final_grade' => 'decimal:2',
            'scoring_rules' => 'array',
            'streak_max' => 'integer',
            'multiplier_max' => 'decimal:2',
            'progress_percentage' => 'decimal:2',
            'status' => AttemptStatus::class,
        ];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class)->orderBy('answered_at')->orderBy('id');
    }
}
