<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['title', 'description', 'deadline', 'status', 'published_at'])]
class Assignment extends Model
{
    protected function casts(): array
    {
        return [
            'deadline' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
        ];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
