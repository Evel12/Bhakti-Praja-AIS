<?php

namespace App\Models;

use App\Enums\QuizStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['title', 'description', 'deadline'])]
class Quiz extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['deadline' => 'immutable_datetime', 'status' => QuizStatus::class];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class);
    }
}
