<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Subject extends Model
{
    use HasFactory;

    protected $fillable = ['study_program_id', 'code', 'name', 'credit_hours', 'status'];

    public function studyProgram(): BelongsTo
    {
        return $this->belongsTo(StudyProgram::class);
    }

    public function curricula(): BelongsToMany
    {
        return $this->belongsToMany(Curriculum::class, 'curriculum_subjects')
            ->withPivot('semester_number')
            ->withTimestamps();
    }
}
