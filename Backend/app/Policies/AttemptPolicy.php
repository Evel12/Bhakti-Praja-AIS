<?php

namespace App\Policies;

use App\Enums\AttemptStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\User;

class AttemptPolicy
{
    public function create(User $user, Quiz $quiz): bool
    {
        return $user->role === Role::Student && (new QuizPolicy)->view($user, $quiz);
    }

    public function view(User $user, Attempt $attempt): bool
    {
        return $this->owns($user, $attempt)
            || (new SchoolClassPolicy)->update($user, $attempt->quiz->schoolClass);
    }

    public function answer(User $user, Attempt $attempt): bool
    {
        return $this->owns($user, $attempt) && $attempt->status === AttemptStatus::Ongoing;
    }

    public function finish(User $user, Attempt $attempt): bool
    {
        // Ownership also authorizes a retry after completion; the service returns stored results.
        return $this->owns($user, $attempt);
    }

    public function participate(User $user, Attempt $attempt): bool
    {
        return $this->owns($user, $attempt);
    }

    public function questions(User $user, Attempt $attempt): bool
    {
        return $this->owns($user, $attempt);
    }

    public function review(User $user, Attempt $attempt): bool
    {
        // Completion is necessary before any answer-key review, including teacher reports.
        return $attempt->status === AttemptStatus::Finished && $this->view($user, $attempt);
    }

    private function owns(User $user, Attempt $attempt): bool
    {
        return $user->role === Role::Student && $attempt->student_id === $user->id;
    }
}
