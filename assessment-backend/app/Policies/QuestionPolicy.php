<?php

namespace App\Policies;

use App\Models\Question;
use App\Models\Quiz;
use App\Models\User;

class QuestionPolicy
{
    public function view(User $user, Question $question): bool
    {
        return (new SchoolClassPolicy)->update($user, $question->quiz->schoolClass);
    }

    public function create(User $user, Quiz $quiz): bool
    {
        return (new QuizPolicy)->update($user, $quiz);
    }

    public function update(User $user, Question $question): bool
    {
        return (new QuizPolicy)->update($user, $question->quiz);
    }

    public function delete(User $user, Question $question): bool
    {
        return $this->update($user, $question);
    }
}
