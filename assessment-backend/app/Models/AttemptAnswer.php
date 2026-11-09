<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['question_id', 'chosen_option_id'])]
#[Hidden(['is_correct'])]
class AttemptAnswer extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['is_correct' => 'boolean', 'answered_at' => 'immutable_datetime'];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function chosenOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'chosen_option_id');
    }
}
