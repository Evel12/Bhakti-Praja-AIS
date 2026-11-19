<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

#[Fillable(['user_id', 'class_id', 'type', 'title', 'body', 'data', 'read_at'])]
class LmsNotification extends Model
{
    protected $table = 'notifications';

    protected static function booted(): void
    {
        static::creating(function (LmsNotification $notification): void {
            if (Schema::hasColumn('notifications', 'message') && $notification->getAttribute('message') === null) {
                $notification->setAttribute('message', $notification->body ?? $notification->title ?? '');
            }
            if (Schema::hasColumn('notifications', 'category') && empty($notification->getAttribute('category'))) {
                $notification->setAttribute('category', 'lms');
            }
        });
    }

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
