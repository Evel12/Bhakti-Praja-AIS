<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'description'])]
class SchoolClass extends Model
{
    use HasFactory;

    protected $table = 'classes';

    protected static function booted(): void
    {
        static::creating(function (SchoolClass $schoolClass): void {
            if (! $schoolClass->class_code) {
                $schoolClass->class_code = static::generateUniqueClassCode();
            }
        });
    }

    public static function generateUniqueClassCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $maxIndex = strlen($alphabet) - 1;

        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, $maxIndex)];
            }
        } while (static::query()->where('class_code', $code)->exists());

        return $code;
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassMember::class, 'class_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'class_members', 'class_id', 'student_id')
            ->using(ClassMember::class)->withPivot('id')->withTimestamps();
    }

    public function modules(): HasMany
    {
        return $this->hasMany(Module::class, 'class_id');
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class, 'class_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'class_id');
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class, 'class_id');
    }
}
