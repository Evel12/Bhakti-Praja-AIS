<?php

namespace Tests\Feature;

use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\User;
use Database\Seeders\DemoAssessmentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seed_creates_requested_accounts_memberships_and_a_valid_published_quiz(): void
    {
        $this->seed();
        $this->assertDatabaseCount('users', 4);
        $this->assertSame(1, User::where('role', Role::Admin)->count());
        $this->assertSame(1, User::where('role', Role::Teacher)->count());
        $this->assertSame(2, User::where('role', Role::Student)->count());
        $this->assertDatabaseCount('classes', 1);
        $this->assertDatabaseCount('class_members', 2);
        $this->assertDatabaseCount('quizzes', 1);
        $this->assertDatabaseCount('questions', 5);
        $this->assertDatabaseCount('options', 20);
        $quiz = Quiz::with('questions.options', 'schoolClass.teacher')->sole();
        $this->assertSame(QuizStatus::Published, $quiz->status);
        $this->assertTrue($quiz->deadline->isFuture());
        $this->assertSame('teacher@example.test', $quiz->schoolClass->teacher->email);
        foreach ($quiz->questions as $question) {
            $this->assertNotEmpty($question->question_text);
            $this->assertCount(4, $question->options);
            $this->assertSame(1, $question->options->where('is_correct', true)->count());
        }
        foreach (User::all() as $user) {
            $this->assertTrue(Hash::check(DemoAssessmentSeeder::PASSWORD, $user->password));
        }
    }

    public function test_rerunning_seed_does_not_duplicate_data_or_overwrite_changes(): void
    {
        $this->seed();
        $user = User::where('email', 'teacher@example.test')->sole();
        $user->password = 'ChangedPassword123!';
        $user->save();
        $question = Question::firstOrFail();
        $question->question_text = 'Locally edited question';
        $question->save();
        $quiz = Quiz::sole();
        $deadline = $quiz->deadline->subDays(60);
        $quiz->deadline = $deadline;
        $quiz->save();

        $this->seed();

        $this->assertDatabaseCount('users', 4);
        $this->assertDatabaseCount('class_members', 2);
        $this->assertDatabaseCount('quizzes', 1);
        $this->assertDatabaseCount('questions', 5);
        $this->assertDatabaseCount('options', 20);
        $this->assertTrue(Hash::check('ChangedPassword123!', $user->fresh()->password));
        $this->assertSame('Locally edited question', $question->fresh()->question_text);
        $this->assertTrue($deadline->equalTo($quiz->fresh()->deadline));
    }

    public function test_seed_rolls_back_all_new_data_if_an_existing_email_has_a_different_role(): void
    {
        User::factory()->create(['email' => 'teacher@example.test', 'role' => Role::Student]);

        try {
            $this->seed();
            $this->fail('Expected a conflicting demo role to abort seeding.');
        } catch (LogicException) {
            $this->assertDatabaseCount('users', 1);
            $this->assertDatabaseCount('classes', 0);
            $this->assertSame(Role::Student, User::sole()->role);
        }
    }

    public function test_question_storage_failure_leaves_no_partial_seed(): void
    {
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'insert into "questions"')) {
                throw new \RuntimeException('Simulated question storage failure');
            }
        });

        try {
            $this->seed();
            $this->fail('Expected seeding to fail.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated question storage failure', $exception->getMessage());
            foreach (['users', 'classes', 'class_members', 'quizzes', 'questions', 'options'] as $table) {
                $this->assertDatabaseCount($table, 0);
            }
        }
    }

    public function test_seeded_accounts_can_log_in_using_the_phase_one_api(): void
    {
        $this->seed();
        $this->postJson('/api/auth/login', [
            'email' => 'teacher@example.test', 'password' => DemoAssessmentSeeder::PASSWORD,
        ])->assertOk()->assertJsonPath('data.user.role', 'teacher');
    }
}
