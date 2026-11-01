<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\AttemptAnswer;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class PhaseFiveReportingTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('phase-five-reporting')->plainTextToken);
    }

    private function recordedAttempt(User $student, Quiz $quiz, ?string $grade, AttemptStatus $status = AttemptStatus::Finished, string $score = '10.00'): Attempt
    {
        // Deliberately retain a null legacy snapshot: reporting must use saved grades, not rescore.
        return Attempt::factory()->for($quiz)->for($student, 'student')->create([
            'status' => $status,
            'started_at' => now()->subMinutes(5),
            'finished_at' => $status === AttemptStatus::Finished ? now()->subMinute() : null,
            'final_grade' => $grade,
            'score' => $score,
            'scoring_rules' => null,
        ]);
    }

    /** @return array{Attempt, array<Question>} */
    private function reviewFixture(): array
    {
        $quiz = Quiz::factory()->published()->create();
        $questions = Question::factory()->count(3)->for($quiz)->withOptions()->create()->all();
        $student = User::factory()->create();
        $attempt = $this->recordedAttempt($student, $quiz, '33.33');
        foreach ([true, false] as $index => $correct) {
            $option = $questions[$index]->options()->where('is_correct', $correct)->firstOrFail();
            AttemptAnswer::factory()->for($attempt)->for($questions[$index])->create([
                'chosen_option_id' => $option->id,
                'is_correct' => $correct,
            ]);
        }

        return [$attempt, $questions];
    }

    public function test_student_can_review_only_a_finished_attempt_including_unanswered_questions(): void
    {
        [$attempt, $questions] = $this->reviewFixture();
        $this->signIn($attempt->student);

        $response = $this->getJson('/api/attempts/'.$attempt->id.'/review')->assertOk()
            ->assertJsonPath('data.attempt.id', $attempt->id)
            ->assertJsonPath('data.attempt.final_grade', '33.33')
            ->assertJsonCount(3, 'data.questions');
        $rows = collect($response->json('data.questions'))->keyBy('id');
        $this->assertTrue($rows[$questions[0]->id]['answer']['is_correct']);
        $this->assertFalse($rows[$questions[1]->id]['answer']['is_correct']);
        $this->assertNull($rows[$questions[2]->id]['answer']);
        foreach ($rows as $row) {
            $this->assertCount(4, $row['options']);
            $this->assertSame(1, collect($row['options'])->where('is_correct', true)->count());
        }
        $this->assertStringNotContainsString('scoring_rules', $response->getContent());
        $this->assertStringNotContainsString('password', $response->getContent());
    }

    public function test_an_ongoing_attempt_cannot_be_reviewed_by_student_or_teacher(): void
    {
        [$attempt] = $this->reviewFixture();
        $attempt->forceFill(['status' => AttemptStatus::Ongoing, 'finished_at' => null, 'final_grade' => null])->save();
        $this->signIn($attempt->student);
        $studentResponse = $this->getJson('/api/attempts/'.$attempt->id.'/review')->assertForbidden();
        $this->assertStringNotContainsString('is_correct', $studentResponse->getContent());

        $this->signIn($attempt->quiz->schoolClass->teacher);
        $teacherResponse = $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/attempts/'.$attempt->id.'/review')->assertForbidden();
        $this->assertStringNotContainsString('is_correct', $teacherResponse->getContent());
    }

    public function test_student_cannot_review_another_students_finished_attempt_even_in_the_same_class(): void
    {
        [$attempt] = $this->reviewFixture();
        $other = User::factory()->create();
        $attempt->quiz->schoolClass->students()->attach($other);
        $this->signIn($other);

        $this->getJson('/api/attempts/'.$attempt->id.'/review')->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_teacher_can_review_a_finished_attempt_only_through_its_own_quiz(): void
    {
        [$attempt] = $this->reviewFixture();
        $this->signIn($attempt->quiz->schoolClass->teacher);

        $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/attempts/'.$attempt->id.'/review')
            ->assertOk()->assertJsonPath('data.attempt.student_id', $attempt->student_id)
            ->assertJsonPath('data.attempt.final_grade', '33.33')
            ->assertJsonFragment(['is_correct' => true]);
    }

    public function test_teacher_cannot_read_another_teachers_gradebook_grades_or_answer_details(): void
    {
        [$attempt] = $this->reviewFixture();
        $this->signIn(User::factory()->create(['role' => Role::Teacher]));

        foreach ([
            '/api/classes/'.$attempt->quiz->class_id.'/gradebook',
            '/api/quizzes/'.$attempt->quiz_id.'/grades',
            '/api/quizzes/'.$attempt->quiz_id.'/attempts/'.$attempt->id.'/review',
        ] as $url) {
            $response = $this->getJson($url)->assertForbidden();
            $this->assertStringNotContainsString('is_correct', $response->getContent());
        }
    }

    public function test_teacher_review_cannot_use_an_attempt_from_a_different_quiz_in_the_url(): void
    {
        [$attempt] = $this->reviewFixture();
        $otherQuiz = Quiz::factory()->for($attempt->quiz->schoolClass, 'schoolClass')->published()->create();
        $this->signIn($attempt->quiz->schoolClass->teacher);

        $this->getJson('/api/quizzes/'.$otherQuiz->id.'/attempts/'.$attempt->id.'/review')->assertNotFound();
    }

    public function test_reporting_routes_require_authentication_and_the_correct_role(): void
    {
        [$attempt] = $this->reviewFixture();
        $this->getJson('/api/students/me/grades')->assertUnauthorized();
        $this->getJson('/api/attempts/'.$attempt->id.'/review')->assertUnauthorized();
        $this->getJson('/api/classes/'.$attempt->quiz->class_id.'/gradebook')->assertUnauthorized();
        $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/grades')->assertUnauthorized();

        $this->signIn($attempt->student);
        $this->getJson('/api/classes/'.$attempt->quiz->class_id.'/gradebook')->assertForbidden();
        $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/grades')->assertForbidden();
        $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/attempts/'.$attempt->id.'/review')->assertForbidden();

        foreach ([$attempt->quiz->schoolClass->teacher, User::factory()->create(['role' => Role::Admin])] as $user) {
            $this->signIn($user);
            $this->getJson('/api/students/me/grades')->assertForbidden();
            $this->getJson('/api/attempts/'.$attempt->id.'/review')->assertForbidden();
        }
    }

    public function test_personal_grades_preserve_retakes_and_summarize_all_pages_without_foreign_data(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $first = $this->recordedAttempt($student, $quiz, '20.00');
        $second = $this->recordedAttempt($student, $quiz, '80.00');
        $foreign = $this->recordedAttempt(User::factory()->create(), $quiz, '100.00');
        $this->signIn($student);

        $this->getJson('/api/students/me/grades?per_page=1')->assertOk()->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.pagination.total', 2)
            ->assertJsonPath('data.summary.attempts_count', 2)
            ->assertJsonPath('data.summary.graded_count', 2)
            ->assertJsonPath('data.summary.average_grade', '50.00');
        $response = $this->getJson('/api/students/me/grades')->assertOk()->assertJsonCount(2, 'data.items');
        $this->assertEqualsCanonicalizing([$first->id, $second->id], array_column($response->json('data.items'), 'id'));
        $this->assertNotContains($foreign->id, array_column($response->json('data.items'), 'id'));
    }

    public function test_zero_grade_is_real_but_legacy_missing_and_ongoing_grades_do_not_inflate_statistics(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $zero = $this->recordedAttempt($student, $quiz, '0.00');
        $this->recordedAttempt($student, $quiz, '100.00');
        $missing = $this->recordedAttempt($student, $quiz, null);
        $ongoing = $this->recordedAttempt($student, $quiz, '99.00', AttemptStatus::Ongoing);
        $this->signIn($student);

        $response = $this->getJson('/api/students/me/grades')->assertOk()
            ->assertJsonPath('data.summary.attempts_count', 4)
            ->assertJsonPath('data.summary.ongoing_count', 1)
            ->assertJsonPath('data.summary.finished_count', 3)
            ->assertJsonPath('data.summary.graded_count', 2)
            ->assertJsonPath('data.summary.ungraded_finished_count', 1)
            ->assertJsonPath('data.summary.average_grade', '50.00')
            ->assertJsonPath('data.summary.highest_grade', '100.00')
            ->assertJsonPath('data.summary.lowest_grade', '0.00');
        $rows = collect($response->json('data.items'))->keyBy('id');
        $this->assertSame('0.00', $rows[$zero->id]['final_grade']);
        $this->assertTrue($rows[$zero->id]['graded']);
        $this->assertNull($rows[$missing->id]['final_grade']);
        $this->assertFalse($rows[$missing->id]['graded']);
        $this->assertNull($rows[$ongoing->id]['final_grade']);
        $this->assertFalse($rows[$ongoing->id]['graded']);
    }

    public function test_empty_personal_reports_have_null_grade_statistics_instead_of_zero_grades(): void
    {
        $this->signIn(User::factory()->create());
        $this->getJson('/api/students/me/grades')->assertOk()->assertJsonCount(0, 'data.items')
            ->assertJsonPath('data.summary.attempts_count', 0)
            ->assertJsonPath('data.summary.graded_count', 0)
            ->assertJsonPath('data.summary.average_grade', null)
            ->assertJsonPath('data.summary.highest_grade', null)
            ->assertJsonPath('data.summary.lowest_grade', null);
    }

    public function test_personal_filters_are_intersected_with_authenticated_ownership(): void
    {
        $student = User::factory()->create();
        $firstQuiz = Quiz::factory()->published()->create();
        $secondQuiz = Quiz::factory()->published()->create();
        $first = $this->recordedAttempt($student, $firstQuiz, '40.00');
        $this->recordedAttempt($student, $firstQuiz, null, AttemptStatus::Ongoing);
        $this->recordedAttempt($student, $secondQuiz, '90.00');
        $foreignQuiz = Quiz::factory()->published()->create();
        $this->recordedAttempt(User::factory()->create(), $foreignQuiz, '100.00');
        $this->signIn($student);

        $this->getJson('/api/students/me/grades?status=finished&class_id='.$firstQuiz->class_id.'&quiz_id='.$firstQuiz->id)
            ->assertOk()->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.id', $first->id)
            ->assertJsonPath('data.summary.average_grade', '40.00');
        $this->getJson('/api/students/me/grades?quiz_id='.$foreignQuiz->id)->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/students/me/grades?student_id='.$firstQuiz->schoolClass->teacher_id)
            ->assertOk()->assertJsonPath('data.pagination.total', 3);
    }

    public function test_quiz_report_is_scoped_to_one_quiz_and_summary_covers_all_attempt_pages(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $this->recordedAttempt(User::factory()->create(), $quiz, '25.00');
        $this->recordedAttempt(User::factory()->create(), $quiz, '75.00');
        $otherQuiz = Quiz::factory()->for($quiz->schoolClass, 'schoolClass')->published()->create();
        $this->recordedAttempt(User::factory()->create(), $otherQuiz, '100.00');
        $this->signIn($quiz->schoolClass->teacher);

        $response = $this->getJson('/api/quizzes/'.$quiz->id.'/grades?per_page=1')->assertOk()
            ->assertJsonPath('data.quiz.id', $quiz->id)->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.pagination.total', 2)
            ->assertJsonPath('data.summary.average_grade', '50.00');
        $this->assertSame($quiz->id, $response->json('data.items.0.quiz_id'));
        $this->assertArrayHasKey('name', $response->json('data.items.0.student'));
    }

    public function test_quiz_report_student_and_status_filters_do_not_mix_other_students_or_ongoing_scores(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $this->recordedAttempt($student, $quiz, '20.00');
        $this->recordedAttempt($student, $quiz, '80.00');
        $this->recordedAttempt($student, $quiz, null, AttemptStatus::Ongoing);
        $this->recordedAttempt(User::factory()->create(), $quiz, '100.00');
        $this->signIn($quiz->schoolClass->teacher);

        $response = $this->getJson('/api/quizzes/'.$quiz->id.'/grades?student_id='.$student->id.'&status=finished')
            ->assertOk()->assertJsonCount(2, 'data.items')->assertJsonPath('data.summary.average_grade', '50.00')
            ->assertJsonPath('data.summary.ongoing_count', 0);
        foreach ($response->json('data.items') as $item) {
            $this->assertSame($student->id, $item['student_id']);
            $this->assertSame('finished', $item['status']);
        }
    }

    public function test_class_gradebook_includes_unattempted_roster_and_former_students_with_history(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $quiz = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        $enrolled = User::factory()->create();
        $unattempted = User::factory()->create();
        $former = User::factory()->create();
        $schoolClass->students()->attach($unattempted);
        $this->recordedAttempt($enrolled, $quiz, '30.00');
        $this->recordedAttempt($former, $quiz, '70.00');
        $schoolClass->students()->detach($former);
        $this->recordedAttempt($enrolled, Quiz::factory()->published()->create(), '100.00');
        $this->signIn($schoolClass->teacher);

        $response = $this->getJson('/api/classes/'.$schoolClass->id.'/gradebook')->assertOk()
            ->assertJsonPath('data.class.id', $schoolClass->id)->assertJsonCount(3, 'data.items')
            ->assertJsonPath('data.summary.attempts_count', 2)->assertJsonPath('data.summary.average_grade', '50.00');
        $rows = collect($response->json('data.items'))->keyBy('student.id');
        $this->assertSame('enrolled', $rows[$enrolled->id]['enrollment_status']);
        $this->assertSame('30.00', $rows[$enrolled->id]['summary']['average_grade']);
        $this->assertSame(0, $rows[$unattempted->id]['summary']['attempts_count']);
        $this->assertNull($rows[$unattempted->id]['summary']['average_grade']);
        $this->assertSame('former', $rows[$former->id]['enrollment_status']);
        $this->assertSame('70.00', $rows[$former->id]['summary']['average_grade']);
    }

    public function test_class_gradebook_quiz_filter_stays_within_the_class(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $firstQuiz = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        $secondQuiz = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        $student = User::factory()->create();
        $this->recordedAttempt($student, $firstQuiz, '20.00');
        $this->recordedAttempt($student, $secondQuiz, '80.00');
        $foreignQuiz = Quiz::factory()->published()->create();
        $this->signIn($schoolClass->teacher);

        $this->getJson('/api/classes/'.$schoolClass->id.'/gradebook?quiz_id='.$firstQuiz->id)
            ->assertOk()->assertJsonPath('data.quiz.id', $firstQuiz->id)
            ->assertJsonPath('data.summary.attempts_count', 1)->assertJsonPath('data.summary.average_grade', '20.00');
        $this->getJson('/api/classes/'.$schoolClass->id.'/gradebook?quiz_id='.$foreignQuiz->id)->assertNotFound();
    }

    public function test_class_gradebook_pagination_does_not_limit_summary_to_current_student_page(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $quiz = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        $this->recordedAttempt(User::factory()->create(), $quiz, '0.00');
        $this->recordedAttempt(User::factory()->create(), $quiz, '100.00');
        $schoolClass->students()->attach(User::factory()->create());
        $this->signIn($schoolClass->teacher);

        $this->getJson('/api/classes/'.$schoolClass->id.'/gradebook?per_page=1')->assertOk()
            ->assertJsonCount(1, 'data.items')->assertJsonPath('data.pagination.total', 3)
            ->assertJsonPath('data.summary.graded_count', 2)->assertJsonPath('data.summary.average_grade', '50.00');
    }

    public function test_reporting_uses_stored_legacy_grades_without_regrading_or_mutating_attempts(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $attempt = $this->recordedAttempt($student, $quiz, '45.67', score: '123.45');
        $original = $attempt->fresh()->getRawOriginal();
        config(['quiz.scoring' => []]);
        $this->signIn($student);
        $this->getJson('/api/students/me/grades')->assertOk()
            ->assertJsonPath('data.items.0.final_grade', '45.67')->assertJsonPath('data.items.0.score', '123.45');
        $this->signIn($quiz->schoolClass->teacher);
        $this->getJson('/api/quizzes/'.$quiz->id.'/grades')->assertOk()->assertJsonPath('data.summary.average_grade', '45.67');

        $this->assertSame($original, $attempt->fresh()->getRawOriginal());
    }

    public function test_all_grade_lists_omit_answer_keys_and_answer_payloads(): void
    {
        [$attempt] = $this->reviewFixture();
        $this->signIn($attempt->student);
        $responses = [$this->getJson('/api/students/me/grades')->assertOk()];
        $this->signIn($attempt->quiz->schoolClass->teacher);
        $responses[] = $this->getJson('/api/quizzes/'.$attempt->quiz_id.'/grades')->assertOk();
        $responses[] = $this->getJson('/api/classes/'.$attempt->quiz->class_id.'/gradebook')->assertOk();

        foreach ($responses as $response) {
            $this->assertStringNotContainsString('is_correct', $response->getContent());
            $this->assertStringNotContainsString('question_text', $response->getContent());
            $this->assertStringNotContainsString('chosen_option_id', $response->getContent());
            $this->assertStringNotContainsString('scoring_rules', $response->getContent());
        }
    }

    public function test_report_filters_and_pagination_are_validated_by_form_requests(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $quiz = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        $this->signIn(User::factory()->create());
        $this->getJson('/api/students/me/grades?page=0&per_page=101&status=invalid&class_id=-1&quiz_id[]=1')
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['page', 'per_page', 'status', 'class_id', 'quiz_id']]]);
        $this->signIn($schoolClass->teacher);
        $this->getJson('/api/classes/'.$schoolClass->id.'/gradebook?per_page=101&quiz_id=-1')->assertUnprocessable();
        $this->getJson('/api/quizzes/'.$quiz->id.'/grades?student_id=-1&status=invalid')->assertUnprocessable();
    }

    public function test_grade_averages_round_half_up_to_two_decimals(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $this->recordedAttempt($student, $quiz, '66.67');
        $this->recordedAttempt($student, $quiz, '66.68');
        $this->signIn($student);

        $this->getJson('/api/students/me/grades')->assertOk()->assertJsonPath('data.summary.average_grade', '66.68');
    }
}
