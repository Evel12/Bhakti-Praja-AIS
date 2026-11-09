<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhaseFourAttemptAccessTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('phase-four-access')->plainTextToken);
    }

    /** @return array{Quiz, User, Question} */
    private function preparedQuiz(): array
    {
        $quiz = Quiz::factory()->published()->create();
        $question = Question::factory()->for($quiz)->withOptions()->create();
        $student = User::factory()->create();
        $quiz->schoolClass->students()->attach($student);
        $this->signIn($student);

        return [$quiz, $student, $question];
    }

    private function start(Quiz $quiz): Attempt
    {
        $response = $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertCreated();

        return Attempt::findOrFail($response->json('data.id'));
    }

    public function test_start_uses_authenticated_identity_and_server_state(): void
    {
        [$quiz, $student] = $this->preparedQuiz();
        $other = User::factory()->create();

        $response = $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'expedition', 'challenge_mode' => 'accuracy',
            'student_id' => $other->id, 'score' => 987654, 'streak_max' => 999,
            'status' => 'finished', 'started_at' => '2030-01-01T00:00:00+00:00',
        ])->assertCreated()->assertJsonPath('data.student_id', $student->id)
            ->assertJsonPath('data.quiz_id', $quiz->id)->assertJsonPath('data.status', 'ongoing')
            ->assertJsonPath('data.game_mode', 'expedition')->assertJsonPath('data.challenge_mode', 'accuracy');

        $attempt = Attempt::findOrFail($response->json('data.id'));
        $this->assertSame($student->id, $attempt->student_id);
        $this->assertSame(AttemptStatus::Ongoing, $attempt->status);
        $this->assertNull($attempt->finished_at);
        $this->assertNotSame('987654.00', $attempt->score);
        $this->assertNotSame(999, $attempt->streak_max);
        $this->assertTrue($attempt->started_at->between(now()->subMinute(), now()->addMinute()));
    }

    public function test_attempt_routes_require_authentication_and_the_student_role(): void
    {
        $quiz = Quiz::factory()->published()->create();
        Question::factory()->for($quiz)->withOptions()->create();
        $payload = ['game_mode' => 'boss', 'challenge_mode' => 'normal'];
        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', $payload)->assertUnauthorized();

        foreach ([Role::Teacher, Role::Admin] as $role) {
            $this->signIn(User::factory()->create(['role' => $role]));
            $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', $payload)->assertForbidden();
        }
        $this->assertDatabaseCount('attempts', 0);
    }

    public static function unavailableQuizStates(): array
    {
        return ['draft' => ['draft'], 'closed' => ['closed'], 'expired' => ['expired']];
    }

    #[DataProvider('unavailableQuizStates')]
    public function test_unpublished_closed_and_expired_quizzes_cannot_be_attempted(string $state): void
    {
        [$quiz] = $this->preparedQuiz();
        $quiz->status = $state === 'expired' ? QuizStatus::Published : QuizStatus::from($state);
        $quiz->deadline = $state === 'expired' ? now()->subSecond() : now()->addDay();
        $quiz->save();

        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->assertDatabaseCount('attempts', 0);
    }

    public function test_student_cannot_start_a_quiz_outside_their_class(): void
    {
        [$quiz] = $this->preparedQuiz();
        $this->signIn(User::factory()->create());
        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertForbidden();
        $this->assertDatabaseCount('attempts', 0);
    }

    public function test_attempt_requests_validate_modes_and_game_reference_types(): void
    {
        [$quiz] = $this->preparedQuiz();
        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [])->assertUnprocessable()
            ->assertJsonStructure(['error' => ['details' => ['game_mode', 'challenge_mode']]]);
        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'unknown', 'challenge_mode' => 'unknown', 'boss_id' => -1, 'map_id' => 'invalid',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertDatabaseCount('attempts', 0);
    }

    public function test_start_rejects_an_existing_ongoing_attempt(): void
    {
        [$quiz] = $this->preparedQuiz();
        $this->start($quiz);
        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->assertDatabaseCount('attempts', 1);
    }

    public function test_attempt_questions_and_metadata_do_not_expose_answer_keys(): void
    {
        [$quiz, , $question] = $this->preparedQuiz();
        $attempt = $this->start($quiz);
        $this->getJson('/api/attempts/'.$attempt->id)->assertOk()->assertJsonPath('data.id', $attempt->id);
        $response = $this->getJson('/api/attempts/'.$attempt->id.'/questions')->assertOk()
            ->assertJsonPath('data.attempt.id', $attempt->id)->assertJsonCount(1, 'data.questions')
            ->assertJsonPath('data.questions.0.id', $question->id)->assertJsonCount(4, 'data.questions.0.options');

        $this->assertStringNotContainsString('is_correct', $response->getContent());
        $this->assertStringNotContainsString('correct_option_id', $response->getContent());
        foreach ($response->json('data.questions.0.options') as $option) {
            $this->assertSame(['id', 'option_label', 'option_text'], array_keys($option));
        }
    }

    public function test_students_cannot_read_answer_or_finish_another_students_attempt(): void
    {
        [$quiz, , $question] = $this->preparedQuiz();
        $attempt = $this->start($quiz);
        $other = User::factory()->create();
        $quiz->schoolClass->students()->attach($other);
        $this->signIn($other);

        $this->getJson('/api/attempts/'.$attempt->id)->assertForbidden();
        $this->getJson('/api/attempts/'.$attempt->id.'/questions')->assertForbidden();
        $this->postJson('/api/attempts/'.$attempt->id.'/answers', [
            'question_id' => $question->id, 'chosen_option_id' => $question->options->first()->id,
        ])->assertForbidden();
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertForbidden();
        $this->assertDatabaseCount('attempt_answers', 0);
        $this->assertSame(AttemptStatus::Ongoing, $attempt->fresh()->status);
    }

    public function test_answers_must_use_a_question_in_the_quiz_and_an_option_in_that_question(): void
    {
        [$quiz, , $question] = $this->preparedQuiz();
        $other = Question::factory()->withOptions()->create();
        $attempt = $this->start($quiz);
        $url = '/api/attempts/'.$attempt->id.'/answers';

        $this->postJson($url, [
            'question_id' => $other->id, 'chosen_option_id' => $other->options->first()->id,
        ])->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->postJson($url, [
            'question_id' => $question->id, 'chosen_option_id' => $other->options->first()->id,
        ])->assertUnprocessable();
        $this->postJson($url, ['question_id' => 'invalid', 'chosen_option_id' => null])->assertUnprocessable();
        $this->assertDatabaseCount('attempt_answers', 0);
    }

    public function test_duplicate_answers_are_rejected_without_creating_or_replacing_records(): void
    {
        [$quiz, , $question] = $this->preparedQuiz();
        $attempt = $this->start($quiz);
        $url = '/api/attempts/'.$attempt->id.'/answers';
        $correct = $question->options()->where('is_correct', true)->sole();
        $first = $this->postJson($url, [
            'question_id' => $question->id, 'chosen_option_id' => $correct->id,
        ])->assertCreated();
        $score = $attempt->fresh()->score;

        $this->postJson($url, [
            'question_id' => $question->id,
            'chosen_option_id' => $question->options()->where('is_correct', false)->firstOrFail()->id,
        ])->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');

        $this->assertDatabaseCount('attempt_answers', 1);
        $this->assertDatabaseHas('attempt_answers', [
            'id' => $first->json('data.answer.id'), 'attempt_id' => $attempt->id,
            'question_id' => $question->id, 'chosen_option_id' => $correct->id,
        ]);
        $this->assertSame($score, $attempt->fresh()->score);
    }

    public function test_answer_correctness_is_derived_from_database_keys_instead_of_client_flags(): void
    {
        [$quiz, , $firstQuestion] = $this->preparedQuiz();
        $secondQuestion = Question::factory()->for($quiz)->withOptions()->create();
        $attempt = $this->start($quiz);
        $url = '/api/attempts/'.$attempt->id.'/answers';
        $correct = $firstQuestion->options()->where('is_correct', true)->sole();
        $wrong = $secondQuestion->options()->where('is_correct', false)->firstOrFail();

        $this->postJson($url, [
            'question_id' => $firstQuestion->id, 'chosen_option_id' => $correct->id, 'is_correct' => false,
        ])->assertCreated()->assertJsonPath('data.answer.is_correct', true);
        $this->postJson($url, [
            'question_id' => $secondQuestion->id, 'chosen_option_id' => $wrong->id, 'is_correct' => true,
        ])->assertCreated()->assertJsonPath('data.answer.is_correct', false);

        $this->assertDatabaseHas('attempt_answers', ['question_id' => $firstQuestion->id, 'is_correct' => true]);
        $this->assertDatabaseHas('attempt_answers', ['question_id' => $secondQuestion->id, 'is_correct' => false]);
    }

    public function test_client_supplied_scores_streaks_and_timestamps_are_ignored_on_answer_and_finish(): void
    {
        [$quiz, , $question] = $this->preparedQuiz();
        $attempt = $this->start($quiz);
        $this->postJson('/api/attempts/'.$attempt->id.'/answers', [
            'question_id' => $question->id, 'chosen_option_id' => $question->options->first()->id,
            'score' => 987654, 'streak' => 999, 'streak_max' => 999, 'multiplier_max' => 999,
            'answered_at' => '2030-01-01T00:00:00+00:00',
        ])->assertCreated();
        $answer = $attempt->answers()->sole();
        $this->assertTrue($answer->answered_at->between(now()->subMinute(), now()->addMinute()));
        $this->assertNotSame('987654.00', $attempt->fresh()->score);
        $this->assertNotSame(999, $attempt->fresh()->streak_max);

        $this->postJson('/api/attempts/'.$attempt->id.'/finish', [
            'score' => 876543, 'final_grade' => 77, 'finished_at' => '2030-01-01T00:00:00+00:00',
        ])->assertOk()->assertJsonPath('data.status', 'finished');
        $attempt->refresh();
        $this->assertNotSame('876543.00', $attempt->score);
        $this->assertTrue($attempt->finished_at->between(now()->subMinute(), now()->addMinute()));
    }

    public function test_empty_published_quiz_is_rejected_without_an_attempt(): void
    {
        [$quiz] = $this->preparedQuiz();
        $quiz->questions()->delete();

        $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertUnprocessable();
        $this->assertDatabaseCount('attempts', 0);
    }

    public function test_finish_is_repeatable_and_returns_the_original_stored_result(): void
    {
        [$quiz] = $this->preparedQuiz();
        $attempt = $this->start($quiz);
        $first = $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.status', 'finished');
        $finishedAt = $attempt->fresh()->finished_at;
        $this->travel(2)->minutes();
        $second = $this->postJson('/api/attempts/'.$attempt->id.'/finish', ['score' => 987654])->assertOk();

        $this->assertSame($first->json('data'), $second->json('data'));
        $this->assertTrue($finishedAt->equalTo($attempt->fresh()->finished_at));
        $this->assertDatabaseCount('attempts', 1);
    }
}
