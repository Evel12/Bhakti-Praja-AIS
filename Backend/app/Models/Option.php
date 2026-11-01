<?php

namespace App\Models;

use App\Enums\OptionLabel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['option_label', 'option_text', 'is_correct'])]
#[Hidden(['is_correct'])]
class Option extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['option_label' => OptionLabel::class, 'is_correct' => 'boolean'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class, 'chosen_option_id');
    }
}
