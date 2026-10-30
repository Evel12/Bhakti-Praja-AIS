<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeachingLoad extends Model
{
    protected $fillable = ['teacher_id', 'subject_id', 'classroom_id', 'semester_id', 'weekly_hours', 'status'];

    public function teacher() { return $this->belongsTo(Teacher::class); }
    public function subject() { return $this->belongsTo(Subject::class); }
    public function classroom() { return $this->belongsTo(Classroom::class); }
    public function semester() { return $this->belongsTo(Semester::class); }
}
