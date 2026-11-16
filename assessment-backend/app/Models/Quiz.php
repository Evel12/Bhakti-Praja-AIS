<?php

namespace App\Models;

use App\Enums\QuizStatus;
use App\Enums\Role;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'title',
    'description',
    'deadline',
    'assessment_type',
    'course_name',
    'instructions',
    'open_at',
    'duration_minutes',
    'release_mode',
    'results_released',
])]
class Quiz extends Model
{
    use HasFactory;

    protected $attributes = [
        'assessment_type' => 'quiz',
        'duration_minutes' => 30,
        'release_mode' => 'immediate',
        'results_released' => false,
    ];

    protected function casts(): array
    {
        return [
            'deadline' => 'immutable_datetime',
            'open_at' => 'immutable_datetime',
            'duration_minutes' => 'integer',
            'results_released' => 'boolean',
            'status' => QuizStatus::class,
        ];
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

    public function resultsVisibleFor(?User $user): bool
    {
        if ($user !== null && in_array($user->role, [Role::Teacher, Role::Admin], true)) {
            return true;
        }

        return ($this->release_mode ?? 'immediate') === 'immediate'
            || (bool) ($this->results_released ?? false);
    }
}
