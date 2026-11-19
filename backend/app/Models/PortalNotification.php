<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

// PDF user_id schema; intentionally separate from Laravel's polymorphic
// DatabaseNotification class. There is only one notifications table.
class PortalNotification extends Model
{
    protected $table = 'notifications';
    protected $fillable = ['user_id', 'title', 'message', 'category', 'source_id'];

    protected static function booted(): void
    {
        static::creating(function (PortalNotification $notification): void {
            if (Schema::hasColumn('notifications', 'type') && empty($notification->getAttribute('type'))) {
                $notification->setAttribute('type', 'member4');
            }
        });
    }
    protected function casts(): array { return ['is_read' => 'boolean', 'email_sent_at' => 'datetime']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
