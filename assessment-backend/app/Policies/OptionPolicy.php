<?php

namespace App\Policies;

use App\Models\Option;
use App\Models\Question;
use App\Models\User;

class OptionPolicy
{
    public function view(User $user, Option $option): bool
    {
        return (new QuestionPolicy)->view($user, $option->question);
    }

    public function create(User $user, Question $question): bool
    {
        return (new QuestionPolicy)->update($user, $question);
    }

    public function update(User $user, Option $option): bool
    {
        return (new QuestionPolicy)->update($user, $option->question);
    }

    public function delete(User $user, Option $option): bool
    {
        return $this->update($user, $option);
    }
}
