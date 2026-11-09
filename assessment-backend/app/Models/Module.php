<?php

namespace App\Models;

use App\Enums\ModuleVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['file_name', 'path', 'visibility'])]
class Module extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['visibility' => ModuleVisibility::class];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function quizGenerations(): HasMany
    {
        return $this->hasMany(QuizGeneration::class);
    }
}
