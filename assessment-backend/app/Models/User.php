<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    private const ASSESSMENT_TO_AIS_ROLE = [
        'admin' => 'admin',
        'teacher' => 'guru',
        'student' => 'murid',
        'parent' => 'wali_murid',
    ];

    protected static function booted(): void
    {
        static::saving(function (User $user): void {
            if (Schema::hasColumn('users', 'status') && empty($user->status)) {
                $user->attributes['status'] = 'active';
            }

            if (! Schema::hasTable('roles') || ! Schema::hasColumn('users', 'role_id')) {
                return;
            }

            $roleValue = $user->role instanceof Role ? $user->role->value : (string) $user->role;
            $aisName = self::ASSESSMENT_TO_AIS_ROLE[$roleValue] ?? null;

            if ($aisName !== null && ($user->isDirty('role') || empty($user->role_id))) {
                $aisRoleId = DB::table('roles')->where('name', $aisName)->value('id');
                if ($aisRoleId !== null) {
                    $user->attributes['role_id'] = $aisRoleId;
                }
            }
        });
    }

    public function isActive(): bool
    {
        return ($this->status ?? 'active') === 'active';
    }

    public function ownedClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'teacher_id');
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(SchoolClass::class, 'class_members', 'student_id', 'class_id')
            ->using(ClassMember::class)->withPivot('id')->withTimestamps();
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassMember::class, 'student_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class, 'student_id');
    }

    public function lmsNotifications(): HasMany
    {
        return $this->hasMany(LmsNotification::class, 'user_id');
    }

    public function moduleReads(): HasMany
    {
        return $this->hasMany(ModuleRead::class, 'student_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }
}
