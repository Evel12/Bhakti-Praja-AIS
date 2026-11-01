<?php

namespace App\Policies;

use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;

class QuizPolicy
{
    public function grades(User $user, Quiz $quiz): bool
    {
        return (new SchoolClassPolicy)->gradebook($user, $quiz->schoolClass);
    }

    public function viewAny(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->view($user, $schoolClass);
    }

    public function view(User $user, Quiz $quiz): bool
    {
        return (new SchoolClassPolicy)->update($user, $quiz->schoolClass)
            || ($user->role === Role::Student && $quiz->status === QuizStatus::Published
                && (new SchoolClassPolicy)->view($user, $quiz->schoolClass));
    }

    public function create(User $user, SchoolClass $schoolClass): bool
    {
        return (new SchoolClassPolicy)->update($user, $schoolClass);
    }

    public function update(User $user, Quiz $quiz): bool
    {
        return $quiz->status === QuizStatus::Draft && (new SchoolClassPolicy)->update($user, $quiz->schoolClass);
    }

    public function delete(User $user, Quiz $quiz): bool
    {
        return $this->update($user, $quiz);
    }

    public function publish(User $user, Quiz $quiz): bool
    {
        return $this->update($user, $quiz);
    }

    public function close(User $user, Quiz $quiz): bool
    {
        return $quiz->status === QuizStatus::Published && (new SchoolClassPolicy)->update($user, $quiz->schoolClass);
    }
}
