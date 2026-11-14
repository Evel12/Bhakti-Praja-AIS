<?php

namespace App\Models;

use App\Enums\QuestionSource;
use App\Enums\QuestionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['question_text', 'question_type', 'points', 'explanation', 'topic', 'is_bank_item'])]
class Question extends Model
{
    use HasFactory;

    protected $attributes = [
        'source' => QuestionSource::Manual->value,
        'reviewed' => true,
        'points' => 10,
        'is_bank_item' => false,
    ];

    protected function casts(): array
    {
        return [
            'question_type' => QuestionType::class,
            'source' => QuestionSource::class,
            'reviewed' => 'boolean',
            'points' => 'integer',
            'is_bank_item' => 'boolean',
        ];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(Option::class)->orderBy('option_label');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class);
    }
}
