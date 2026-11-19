<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    private const AIS_TO_ASSESSMENT_ROLE = [
        'admin' => 'admin',
        'guru' => 'teacher',
        'murid' => 'student',
        'wali_murid' => 'parent',
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'status',
    ];

    protected static function booted(): void
    {
        static::saving(function (User $user): void {
            if (! Schema::hasColumn('users', 'role')) {
                return;
            }

            if ($user->role_id !== null) {
                $roleName = Role::query()->whereKey($user->role_id)->value('name');
                if ($roleName !== null && isset(self::AIS_TO_ASSESSMENT_ROLE[$roleName])) {
                    $user->attributes['role'] = self::AIS_TO_ASSESSMENT_ROLE[$roleName];
                }
            }
        });
    }

    public function getAttribute($key)
    {
        if ($key === 'role') {
            return $this->getRelationValue('role');
        }

        return parent::getAttribute($key);
    }

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function isAdmin(): bool
    {
        return $this->status === self::STATUS_ACTIVE
            && $this->role !== null
            && $this->role->name === 'admin';
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
