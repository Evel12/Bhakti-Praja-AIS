<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AisAssessmentGrade extends Model
{
    protected $table = 'ais_assessment_grades';

    protected $fillable = [
        'student_id',
        'user_id',
        'classroom_id',
        'subject_id',
        'assessment_class_id',
        'source_type',
        'source_quiz_id',
        'title',
        'assessment_type',
        'score',
        'max_score',
        'teacher_feedback',
        'submitted_at',
        'graded_at',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'max_score' => 'decimal:2',
            'submitted_at' => 'datetime',
            'graded_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
