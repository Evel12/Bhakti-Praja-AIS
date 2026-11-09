<?php

namespace Database\Seeders;

use App\Enums\OptionLabel;
use App\Enums\QuestionType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;

class DemoAssessmentSeeder extends Seeder
{
    public const PASSWORD = 'DemoPassword123!';

    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new LogicException('DemoAssessmentSeeder may only run in local or testing environments.');
        }

        DB::transaction(function (): void {
            $this->account('admin@example.test', 'Demo Admin', Role::Admin);
            $teacher = $this->account('teacher@example.test', 'Demo Teacher', Role::Teacher);
            $first = $this->account('student1@example.test', 'Demo Student One', Role::Student);
            $second = $this->account('student2@example.test', 'Demo Student Two', Role::Student);

            $schoolClass = $teacher->ownedClasses()->firstOrCreate(['name' => 'Demo Mathematics']);
            $schoolClass->students()->syncWithoutDetaching([$first->id, $second->id]);
            $quiz = $schoolClass->quizzes()->firstOrNew(['title' => 'Demo Arithmetic Quiz']);

            // Reruns preserve edited content, deadlines, passwords, and any existing attempts.
            if ($quiz->exists) {
                return;
            }

            $quiz->description = 'Five multiple-choice arithmetic questions for local API testing.';
            $quiz->deadline = now()->addDays(30);
            $quiz->status = QuizStatus::Published;
            $quiz->save();

            $questions = [
                ['Berapakah 2 + 3?', ['4', '5', '6', '7'], 'B'],
                ['Berapakah 10 - 4?', ['4', '5', '6', '7'], 'C'],
                ['Berapakah 3 x 4?', ['12', '10', '14', '16'], 'A'],
                ['Berapakah 20 / 5?', ['2', '3', '5', '4'], 'D'],
                ['Berapakah 6 + 7?', ['11', '12', '13', '14'], 'C'],
            ];

            foreach ($questions as [$text, $texts, $correct]) {
                $question = $quiz->questions()->create([
                    'question_text' => $text, 'question_type' => QuestionType::MultipleChoice,
                ]);
                foreach (OptionLabel::cases() as $index => $label) {
                    $question->options()->create([
                        'option_label' => $label,
                        'option_text' => $texts[$index],
                        'is_correct' => $label->value === $correct,
                    ]);
                }
            }

            DB::afterCommit(fn () => logSystemActivity('demo.seeded', $teacher->id, [
                'entity_type' => 'quiz', 'entity_id' => $quiz->id,
            ]));
        });
    }

    private function account(string $email, string $name, Role $role): User
    {
        $user = User::firstOrNew(['email' => $email]);
        if ($user->exists) {
            // Never elevate an existing account that happens to use a demo email address.
            if ($user->role !== $role) {
                throw new LogicException('An existing demo email has a different role; no seed data was changed.');
            }

            return $user;
        }

        $user->name = $name;
        $user->password = self::PASSWORD;
        $user->role = $role;
        $user->save();

        return $user;
    }
}
