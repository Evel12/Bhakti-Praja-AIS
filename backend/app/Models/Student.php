<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

class Student extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'student_number', 'name', 'gender', 'birth_date', 'address', 'status'];

    protected function casts(): array
    {
        return ['birth_date' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(Guardian::class, 'parent_student', 'student_id', 'parent_id')
            ->withPivot('relationship')
            ->withTimestamps();
    }

    public function currentPlacement(): HasOne
    {
        return $this->hasOne(ClassStudent::class)->where('status', 'active')
            ->whereHas('academicYear', fn ($query) => $query->where('is_active', true))
            ->with(['classroom.studyProgram', 'academicYear'])
            ->latestOfMany('id');
    }

    public static function syncPlacement(int $studentId, int $yearId): void
    {
        $placement = ClassStudent::with('classroom')->where('student_id', $studentId)
            ->where('academic_year_id', $yearId)->where('status', 'active')
            ->orderByDesc('semester_id')->orderByDesc('id')->first();
        if ($placement && $placement->classroom) {
            DB::table('students')->where('id', $studentId)->update(['updated_at' => now()]);
        }
    }
}
