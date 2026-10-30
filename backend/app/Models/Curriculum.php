<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Curriculum extends Model
{
    use HasFactory;

    protected $fillable = ['study_program_id', 'name', 'year', 'is_active', 'source_url', 'notes'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function studyProgram(): BelongsTo
    {
        return $this->belongsTo(StudyProgram::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'curriculum_subjects')
            ->withPivot('semester_number')
            ->withTimestamps();
    }
}
