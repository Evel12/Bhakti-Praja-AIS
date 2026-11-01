<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    public const TARGET_ROLES = ['all', 'admin', 'guru', 'murid', 'wali_murid'];
    protected $fillable = ['created_by', 'title', 'content', 'target_role'];
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
