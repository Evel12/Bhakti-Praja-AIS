<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\QuizStatus;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhaseFourGradingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['quiz.scoring' => [
            'version' => 1,
            'base_points' => '10.00',
            'streak_multiplier_step' => '0.10',
            'multiplier_cap' => '2.00',
            'wrong_answer_resets_streak' => true,
            'final_grade_formula' => 'percentage_correct',
        ]]);
    }

    /** @return array{Attempt, array<Question>} */
    private function startedAttempt(int $questionCount): array
    {
        $quiz = Quiz::factory()->published()->create();
        $questions = Question::factory()->count($questionCount)->for($quiz)->withOptions()->create()->all();
        $student = User::factory()->create();
        $quiz->schoolClass->students()->attach($student);
        Auth::forgetGuards();
        $this->withToken($student->createToken('phase-four-grading')->plainTextToken);
        $response = $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss', 'challenge_mode' => 'normal',
        ])->assertCreated();
        $this->assertArrayNotHasKey('final_grade', $response->json('data'));

        return [Attempt::findOrFail($response->json('data.id')), $questions];
    }

    private function answer(Attempt $attempt, Question $question, bool $correct = true): TestResponse
    {
        $option = $question->options()->where('is_correct', $correct)->firstOrFail();

        return $this->postJson('/api/attempts/'.$attempt->id.'/answers', [
            'question_id' => $question->id, 'chosen_option_id' => $option->id,
        ]);
    }

    public function test_points_streak_and_multiplier_are_computed_and_a_wrong_answer_resets_the_streak(): void
    {
        [$attempt, $questions] = $this->startedAttempt(5);
        $this->answer($attempt, $questions[0])->assertCreated()
            ->assertJsonPath('data.attempt.score', '10.00')->assertJsonPath('data.attempt.current_multiplier', '1.00');
        $this->answer($attempt, $questions[1])->assertCreated()
            ->assertJsonPath('data.attempt.score', '21.00')->assertJsonPath('data.attempt.current_streak', 2);
        $third = $this->answer($attempt, $questions[2])->assertCreated()
            ->assertJsonPath('data.attempt.score', '33.00')->assertJsonPath('data.attempt.current_streak', 3)
            ->assertJsonPath('data.attempt.streak_max', 3)->assertJsonPath('data.attempt.multiplier_max', '1.20');
        $this->assertArrayNotHasKey('final_grade', $third->json('data.attempt'));

        $this->answer($attempt, $questions[3], false)->assertCreated()
            ->assertJsonPath('data.answer.is_correct', false)->assertJsonPath('data.attempt.score', '33.00')
            ->assertJsonPath('data.attempt.current_streak', 0)->assertJsonPath('data.attempt.current_multiplier', '1.00');
        $this->answer($attempt, $questions[4])->assertCreated()
            ->assertJsonPath('data.attempt.score', '43.00')->assertJsonPath('data.attempt.current_streak', 1)
            ->assertJsonPath('data.attempt.streak_max', 3)->assertJsonPath('data.attempt.multiplier_max', '1.20');

        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.score', '43.00')->assertJsonPath('data.final_grade', '80.00')
            ->assertJsonPath('data.progress_percentage', '100.00');
        $this->assertSame('80.00', $attempt->fresh()->final_grade);
    }

    public function test_early_finish_counts_unanswered_questions_as_incorrect_without_forcing_progress_to_full(): void
    {
        [$attempt, $questions] = $this->startedAttempt(4);
        $this->answer($attempt, $questions[0])->assertCreated();
        $this->answer($attempt, $questions[1], false)->assertCreated();

        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.final_grade', '25.00')->assertJsonPath('data.score', '10.00')
            ->assertJsonPath('data.progress_percentage', '50.00')->assertJsonPath('data.status', 'finished');
        $this->assertDatabaseCount('attempt_answers', 2);
    }

    public function test_an_attempt_uses_its_saved_rules_when_live_scoring_configuration_changes(): void
    {
        [$attempt, $questions] = $this->startedAttempt(3);
        $this->assertSame('10.00', $attempt->scoring_rules['base_points']);
        $this->assertSame('0.10', $attempt->scoring_rules['streak_multiplier_step']);
        $this->assertSame(1, $attempt->scoring_rules['version']);
        $this->answer($attempt, $questions[0])->assertCreated();

        config([
            'quiz.scoring.base_points' => '90.00',
            'quiz.scoring.streak_multiplier_step' => '0.50',
            'quiz.scoring.multiplier_cap' => '8.00',
            'quiz.scoring.wrong_answer_resets_streak' => false,
        ]);
        $this->answer($attempt, $questions[1])->assertCreated()->assertJsonPath('data.attempt.score', '21.00');
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.score', '21.00')->assertJsonPath('data.final_grade', '66.67');
        $this->assertSame('10.00', $attempt->fresh()->scoring_rules['base_points']);
    }

    public static function unavailableAfterStart(): array
    {
        return ['closed by teacher' => ['closed'], 'deadline passed' => ['expired']];
    }

    #[DataProvider('unavailableAfterStart')]
    public function test_closure_or_expiry_stops_new_answers_but_allows_grading_saved_answers(string $condition): void
    {
        [$attempt, $questions] = $this->startedAttempt(4);
        $this->answer($attempt, $questions[0])->assertCreated();
        $quiz = $attempt->quiz;
        if ($condition === 'closed') {
            $quiz->status = QuizStatus::Closed;
        } else {
            $quiz->deadline = now()->subSecond();
        }
        $quiz->save();

        $this->answer($attempt, $questions[1])->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->assertDatabaseCount('attempt_answers', 1);
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.final_grade', '25.00')->assertJsonPath('data.score', '10.00')
            ->assertJsonPath('data.progress_percentage', '25.00');
    }

    public function test_repeated_finish_preserves_the_stored_result_after_time_and_configuration_changes(): void
    {
        [$attempt, $questions] = $this->startedAttempt(2);
        $this->answer($attempt, $questions[0])->assertCreated();
        $first = $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk();
        $original = $attempt->fresh()->getRawOriginal();
        $this->travel(2)->minutes();
        config(['quiz.scoring.base_points' => '500.00']);

        $second = $this->postJson('/api/attempts/'.$attempt->id.'/finish', [
            'score' => 999999, 'final_grade' => 100, 'finished_at' => now()->toIso8601String(),
        ])->assertOk();

        $this->assertSame($first->json('data'), $second->json('data'));
        $this->assertSame($original, $attempt->fresh()->getRawOriginal());
    }

    public function test_a_finished_attempt_cannot_accept_another_answer(): void
    {
        [$attempt, $questions] = $this->startedAttempt(2);
        $this->answer($attempt, $questions[0])->assertCreated();
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk();

        $this->answer($attempt, $questions[1])->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->assertDatabaseCount('attempt_answers', 1);
        $this->assertSame('50.00', $attempt->fresh()->final_grade);
    }

    public function test_answer_insert_failure_rolls_back_and_can_be_retried(): void
    {
        [$attempt, $questions] = $this->startedAttempt(1);
        $failNext = true;
        DB::listen(function ($query) use (&$failNext): void {
            if ($failNext && str_starts_with($query->sql, 'insert into "attempt_answers"')) {
                $failNext = false;
                throw new \RuntimeException('Simulated answer insertion failure');
            }
        });

        $this->answer($attempt, $questions[0])->assertStatus(500)->assertJsonPath('error.code', 'SERVER_ERROR');
        $this->assertDatabaseCount('attempt_answers', 0);
        $this->assertSame('0.00', $attempt->fresh()->score);
        $this->assertSame(AttemptStatus::Ongoing, $attempt->fresh()->status);
        $this->answer($attempt, $questions[0])->assertCreated()->assertJsonPath('data.attempt.score', '10.00');
        $this->assertDatabaseCount('attempt_answers', 1);
    }

    public function test_score_update_failure_rolls_back_the_answer_and_all_metrics(): void
    {
        [$attempt, $questions] = $this->startedAttempt(1);
        $before = $attempt->getRawOriginal();
        $failNext = true;
        DB::listen(function ($query) use (&$failNext): void {
            if ($failNext && str_starts_with($query->sql, 'update "attempts"')) {
                $failNext = false;
                throw new \RuntimeException('Simulated attempt update failure');
            }
        });

        $this->answer($attempt, $questions[0])->assertStatus(500);
        $this->assertDatabaseCount('attempt_answers', 0);
        $this->assertSame($before, $attempt->fresh()->getRawOriginal());
        $this->answer($attempt, $questions[0])->assertCreated()->assertJsonPath('data.attempt.score', '10.00');
    }

    public function test_finish_failure_does_not_leave_a_partial_grade_or_finished_timestamp(): void
    {
        [$attempt, $questions] = $this->startedAttempt(2);
        $this->answer($attempt, $questions[0])->assertCreated();
        $before = $attempt->fresh()->getRawOriginal();
        $failNext = true;
        DB::listen(function ($query) use (&$failNext): void {
            if ($failNext && str_starts_with($query->sql, 'update "attempts"')) {
                $failNext = false;
                throw new \RuntimeException('Simulated finish storage failure');
            }
        });

        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertStatus(500)
            ->assertJsonPath('error.code', 'SERVER_ERROR');
        $this->assertSame($before, $attempt->fresh()->getRawOriginal());
        $this->assertNull($attempt->fresh()->final_grade);
        $this->assertNull($attempt->fresh()->finished_at);
        $this->assertDatabaseCount('attempt_answers', 1);
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()->assertJsonPath('data.final_grade', '50.00');
    }

    public function test_replay_uses_received_answer_order_even_if_the_server_clock_moves_backwards(): void
    {
        [$attempt, $questions] = $this->startedAttempt(3);
        $this->answer($attempt, $questions[0])->assertCreated();
        $this->travel(-2)->minutes();
        $this->answer($attempt, $questions[1], false)->assertCreated();
        $this->travel(1)->minutes();
        $this->answer($attempt, $questions[2])->assertCreated()
            ->assertJsonPath('data.attempt.score', '20.00')->assertJsonPath('data.attempt.current_streak', 1);

        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.score', '20.00')->assertJsonPath('data.final_grade', '66.67');
    }

    public function test_configured_game_points_above_the_old_score_limit_are_persisted(): void
    {
        config(['quiz.scoring.base_points' => '200.00']);
        [$attempt, $questions] = $this->startedAttempt(5);
        foreach ($questions as $question) {
            $this->answer($attempt, $question)->assertCreated();
        }

        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertOk()
            ->assertJsonPath('data.score', '1200.00')->assertJsonPath('data.final_grade', '100.00');
        $this->assertSame('1200.00', $attempt->fresh()->score);
    }
}
