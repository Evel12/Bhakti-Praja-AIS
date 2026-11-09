<?php

namespace App\Policies;

use App\Models\QuizGeneration;
use App\Models\User;

class QuizGenerationPolicy
{
    public function view(User $user, QuizGeneration $generation): bool
    {
        return $generation->requested_by === $user->id
            && (new ModulePolicy)->generateQuiz($user, $generation->module);
    }
}
