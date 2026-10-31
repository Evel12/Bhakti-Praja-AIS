<?php

namespace App\Services\Member4;

use App\Models\Invoice;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class StudentAccess
{
    public function students(User $user): Builder
    {
        $role = $user->role?->name;
        $query = Student::query();
        if ($role === 'admin') return $query;
        if ($role === 'murid') return $query->where('user_id', $user->id);
        if ($role === 'wali_murid') {
            return $query->whereHas('guardians', fn ($q) => $q->where('parents.user_id', $user->id)->where('parents.status', 'active'));
        }
        return $query->whereRaw('1 = 0');
    }

    public function invoices(User $user): Builder
    {
        return Invoice::whereIn('student_id', $this->students($user)->select('students.id'));
    }
}
