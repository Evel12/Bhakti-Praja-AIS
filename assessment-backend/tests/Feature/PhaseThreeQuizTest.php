<?php

namespace Tests\Feature;

use App\Enums\OptionLabel;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhaseThreeQuizTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('phase-three-test')->plainTextToken);
    }

    private static function questionPayload(): array
    {
        return [
            'question_text' => 'What is 2 + 2?',
            'question_type' => 'multiple_choice',
            'options' => [
                ['option_label' => 'A', 'option_text' => '4', 'is_correct' => true],
                ['option_label' => 'B', 'option_text' => '5', 'is_correct' => false],
                ['option_label' => 'C', 'option_text' => '6', 'is_correct' => false],
                ['option_label' => 'D', 'option_text' => '7', 'is_correct' => false],
            ],
        ];
    }

    private function questionsPath(Quiz $quiz): string
    {
        return '/api/quizzes/'.$quiz->id.'/questions';
    }

    private function questionPath(Question $question): string
    {
        return $this->questionsPath($question->quiz).'/'.$question->id;
    }

    public function test_teacher_can_create_read_update_and_delete_a_draft_without_spoofing_state_or_ownership(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $otherClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        $response = $this->postJson('/api/quizzes', [
            'class_id' => $schoolClass->id, 'title' => 'My draft', 'description' => 'Instructions',
            'status' => 'published', 'teacher_id' => $otherClass->teacher_id, 'score' => 100,
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.class_id', $schoolClass->id);
        $quizId = $response->json('data.id');

        $this->getJson('/api/quizzes/'.$quizId)->assertOk()->assertJsonPath('data.title', 'My draft');
        $this->patchJson('/api/quizzes/'.$quizId, [
            'title' => 'Edited draft', 'class_id' => $otherClass->id, 'status' => 'published',
        ])->assertOk()->assertJsonPath('data.title', 'Edited draft')
            ->assertJsonPath('data.status', 'draft')->assertJsonPath('data.class_id', $schoolClass->id);
        $this->deleteJson('/api/quizzes/'.$quizId)->assertOk();
        $this->assertDatabaseMissing('quizzes', ['id' => $quizId]);
    }

    public function test_quiz_requests_validate_required_fields_and_class_existence(): void
    {
        $this->signIn(SchoolClass::factory()->create()->teacher);
        $this->postJson('/api/quizzes', ['class_id' => 999999, 'title' => ' '])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['class_id', 'title']]]);
        $this->assertDatabaseCount('quizzes', 0);
    }

    public function test_draft_deadlines_are_normalized_to_utc_on_create_update_and_can_be_cleared(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);

        $created = $this->postJson('/api/quizzes', [
            'class_id' => $schoolClass->id,
            'title' => 'Timezone-aware draft',
            'deadline' => '2030-01-01T09:00:00+07:00',
        ])->assertCreated()->assertJsonPath('data.deadline', '2030-01-01T02:00:00+00:00');
        $quiz = Quiz::findOrFail($created->json('data.id'));
        $this->assertDatabaseHas('quizzes', ['id' => $quiz->id, 'deadline' => '2030-01-01 02:00:00']);
        $this->assertTrue($quiz->deadline->equalTo('2030-01-01T02:00:00+00:00'));

        $this->patchJson('/api/quizzes/'.$quiz->id, ['deadline' => '2030-01-02T12:00:00-04:00'])
            ->assertOk()->assertJsonPath('data.deadline', '2030-01-02T16:00:00+00:00');
        $this->assertDatabaseHas('quizzes', ['id' => $quiz->id, 'deadline' => '2030-01-02 16:00:00']);
        $this->assertTrue($quiz->fresh()->deadline->equalTo('2030-01-02T16:00:00+00:00'));

        $this->patchJson('/api/quizzes/'.$quiz->id, ['deadline' => null])
            ->assertOk()->assertJsonPath('data.deadline', null);
        $this->assertNull($quiz->fresh()->deadline);
    }

    public function test_legacy_draft_with_a_recorded_attempt_cannot_be_edited_or_deleted(): void
    {
        $question = Question::factory()->withOptions()->create();
        $quiz = $question->quiz;
        Attempt::factory()->for($quiz)->create();
        $originalTitle = $quiz->title;
        $originalText = $question->question_text;
        $originalOptions = $question->options()->get()->map->getAttributes()->all();
        $this->signIn($quiz->schoolClass->teacher);

        $this->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Unsafe metadata edit'])
            ->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->deleteJson('/api/quizzes/'.$quiz->id)
            ->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->patchJson($this->questionPath($question), ['question_text' => 'Unsafe content edit'])
            ->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->putJson($this->questionPath($question).'/options', ['options' => self::questionPayload()['options']])
            ->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');

        $this->assertSame(QuizStatus::Draft, $quiz->fresh()->status);
        $this->assertSame($originalTitle, $quiz->fresh()->title);
        $this->assertSame($originalText, $question->fresh()->question_text);
        $this->assertSame($originalOptions, $question->options()->get()->map->getAttributes()->all());
        $this->assertDatabaseCount('questions', 1);
        $this->assertDatabaseCount('attempts', 1);
    }

    public function test_deadlines_outside_mysql_timestamp_range_return_validation_errors(): void
    {
        $question = Question::factory()->withOptions()->create();
        $quiz = $question->quiz;
        $this->signIn($quiz->schoolClass->teacher);
        $this->postJson('/api/quizzes', [
            'class_id' => $quiz->class_id, 'title' => 'Invalid deadline', 'deadline' => '1960-01-01T00:00:00+00:00',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['deadline']]]);
        $this->patchJson('/api/quizzes/'.$quiz->id, ['deadline' => '2099-01-01T00:00:00+00:00'])
            ->assertUnprocessable();
        $this->postJson('/api/quizzes/'.$quiz->id.'/publish', ['deadline' => '2099-01-01T00:00:00+00:00'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertNull($quiz->fresh()->deadline);
        $this->assertSame(QuizStatus::Draft, $quiz->fresh()->status);
        $this->assertDatabaseCount('quizzes', 1);
    }

    public function test_timestamp_upper_bound_is_checked_as_a_utc_instant(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $this->signIn($schoolClass->teacher);
        $created = $this->postJson('/api/quizzes', [
            'class_id' => $schoolClass->id, 'title' => 'Boundary deadline', 'deadline' => '2038-01-19T10:14:07+07:00',
        ])->assertCreated()->assertJsonPath('data.deadline', '2038-01-19T03:14:07+00:00');
        $this->patchJson('/api/quizzes/'.$created->json('data.id'), ['deadline' => '2038-01-19T10:14:08+07:00'])
            ->assertUnprocessable();
    }

    public function test_guests_and_students_cannot_use_authoring_endpoints_or_read_teacher_answer_keys(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->getJson('/api/quizzes/'.$question->quiz_id)->assertUnauthorized();
        $this->postJson('/api/quizzes', [])->assertUnauthorized();

        $student = User::factory()->create();
        $question->quiz->schoolClass->students()->attach($student);
        $this->signIn($student);
        foreach ([
            '/api/quizzes/'.$question->quiz_id,
            $this->questionsPath($question->quiz),
            $this->questionPath($question),
            $this->questionPath($question).'/options',
            $this->questionPath($question).'/options/'.$question->options->first()->id,
        ] as $url) {
            $response = $this->getJson($url)->assertForbidden();
            $this->assertStringNotContainsString('is_correct', $response->getContent());
        }
        $this->postJson('/api/quizzes', ['class_id' => $question->quiz->class_id, 'title' => 'Forbidden'])
            ->assertForbidden();
    }

    public function test_another_teacher_cannot_read_edit_delete_publish_or_close_a_quiz(): void
    {
        $quiz = Quiz::factory()->create();
        $this->signIn(User::factory()->create(['role' => Role::Teacher]));
        $this->getJson('/api/quizzes/'.$quiz->id)->assertForbidden();
        $this->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Hijack'])->assertForbidden();
        $this->deleteJson('/api/quizzes/'.$quiz->id)->assertForbidden();
        $this->postJson('/api/quizzes/'.$quiz->id.'/publish', ['deadline' => now()->addDay()->toIso8601String()])->assertForbidden();
        $this->postJson('/api/quizzes/'.$quiz->id.'/close')->assertForbidden();
        $this->postJson('/api/quizzes', ['class_id' => $quiz->class_id, 'title' => 'Foreign class'])->assertForbidden();
        $this->assertNotSame('Hijack', $quiz->fresh()->title);
        $this->assertSame(QuizStatus::Draft, $quiz->fresh()->status);
    }

    public function test_teacher_can_create_read_edit_and_delete_a_complete_question(): void
    {
        $quiz = Quiz::factory()->create();
        $this->signIn($quiz->schoolClass->teacher);
        $response = $this->postJson($this->questionsPath($quiz), self::questionPayload())->assertCreated();
        $question = Question::findOrFail($response->json('data.id'));

        $this->assertSame($quiz->id, $question->quiz_id);
        $this->assertSame(4, $question->options()->count());
        $this->assertSame(1, $question->options()->where('is_correct', true)->count());
        $this->getJson($this->questionsPath($quiz))->assertOk()->assertJsonFragment(['question_text' => 'What is 2 + 2?']);
        $this->getJson($this->questionPath($question))->assertOk()->assertJsonPath('data.options.0.is_correct', true);
        $this->getJson('/api/quizzes/'.$quiz->id)->assertOk()->assertJsonPath('data.questions.0.options.0.is_correct', true);
        $this->patchJson($this->questionPath($question), ['question_text' => 'Updated question'])
            ->assertOk()->assertJsonPath('data.question_text', 'Updated question');
        $this->deleteJson($this->questionPath($question))->assertOk();
        $this->assertDatabaseMissing('questions', ['id' => $question->id]);
        $this->assertDatabaseMissing('options', ['question_id' => $question->id]);
    }

    public static function invalidQuestionPayloads(): array
    {
        $cases = [];
        $payload = self::questionPayload();
        $payload['options'] = array_slice($payload['options'], 0, 3);
        $cases['three options'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][] = ['option_label' => 'A', 'option_text' => 'Extra', 'is_correct' => false];
        $cases['five options'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][1]['option_label'] = 'A';
        $cases['duplicate labels'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][0]['is_correct'] = false;
        $cases['no correct option'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][1]['is_correct'] = true;
        $cases['two correct options'] = [$payload];
        $payload = self::questionPayload();
        $payload['question_text'] = ' ';
        $cases['blank question'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][0]['option_text'] = ' ';
        $cases['blank option'] = [$payload];
        $payload = self::questionPayload();
        $payload['options'][0]['question_id'] = 99999;
        $cases['unexpected nested key'] = [$payload];

        return $cases;
    }

    #[DataProvider('invalidQuestionPayloads')]
    public function test_invalid_question_payloads_are_rejected_without_partial_records(array $payload): void
    {
        $quiz = Quiz::factory()->create();
        $this->signIn($quiz->schoolClass->teacher);
        $this->postJson($this->questionsPath($quiz), $payload)
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertDatabaseCount('questions', 0);
        $this->assertDatabaseCount('options', 0);
    }

    public function test_invalid_question_update_keeps_existing_text_options_and_key(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->signIn($question->quiz->schoolClass->teacher);
        $before = $question->options()->get()->map->getAttributes()->all();
        $payload = self::questionPayload();
        $payload['options'][0]['is_correct'] = false;

        $this->patchJson($this->questionPath($question), $payload)->assertUnprocessable();
        $this->assertNotSame($payload['question_text'], $question->fresh()->question_text);
        $this->assertSame($before, $question->options()->get()->map->getAttributes()->all());
    }

    public function test_child_routes_cannot_reparent_questions_or_options_through_a_different_parent_url(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $first = Question::factory()->withOptions()->for(Quiz::factory()->for($schoolClass, 'schoolClass'))->create();
        $second = Question::factory()->withOptions()->for(Quiz::factory()->for($schoolClass, 'schoolClass'))->create();
        $this->signIn($schoolClass->teacher);

        $wrongQuestionUrl = $this->questionsPath($first->quiz).'/'.$second->id;
        $this->getJson($wrongQuestionUrl)->assertNotFound();
        $this->patchJson($wrongQuestionUrl, ['question_text' => 'Reparented'])->assertNotFound();
        $this->deleteJson($wrongQuestionUrl)->assertNotFound();
        $wrongOptionUrl = $this->questionPath($first).'/options/'.$second->options->first()->id;
        $this->getJson($wrongOptionUrl)->assertNotFound();
        $this->patchJson($wrongOptionUrl, ['option_text' => 'Reparented'])->assertNotFound();
        $this->assertNotSame('Reparented', $second->fresh()->question_text);
    }

    public function test_foreign_teacher_cannot_mutate_question_or_options_even_with_valid_ids(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->signIn(User::factory()->create(['role' => Role::Teacher]));
        $this->postJson($this->questionsPath($question->quiz), self::questionPayload())->assertForbidden();
        $this->patchJson($this->questionPath($question), ['question_text' => 'Hijack'])->assertForbidden();
        $this->deleteJson($this->questionPath($question))->assertForbidden();
        $this->putJson($this->questionPath($question).'/options', ['options' => self::questionPayload()['options']])->assertForbidden();
        $this->patchJson($this->questionPath($question).'/options/'.$question->options->first()->id, ['option_text' => 'Hijack'])->assertForbidden();
    }

    public function test_bulk_option_replacement_creates_new_options_removes_old_ones_and_keeps_one_key(): void
    {
        $question = Question::factory()->withOptions()->create();
        $oldIds = $question->options()->pluck('id')->all();
        $this->signIn($question->quiz->schoolClass->teacher);
        $options = self::questionPayload()['options'];
        $options[0]['is_correct'] = false;
        $options[1]['is_correct'] = true;
        $this->putJson($this->questionPath($question).'/options', ['options' => $options])->assertOk();

        $this->assertSame(4, $question->options()->count());
        $this->assertSame(0, $question->options()->whereIn('id', $oldIds)->count());
        $this->assertSame(1, $question->options()->where('is_correct', true)->count());
        $this->assertSame(OptionLabel::B, $question->options()->where('is_correct', true)->sole()->option_label);
    }

    public function test_teacher_can_read_options_and_select_a_new_correct_option_atomically(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->signIn($question->quiz->schoolClass->teacher);
        $option = $question->options()->where('option_label', 'B')->sole();

        $this->getJson($this->questionPath($question).'/options')->assertOk()->assertJsonFragment(['is_correct' => true]);
        $this->getJson($this->questionPath($question).'/options/'.$option->id)->assertOk()->assertJsonPath('data.id', $option->id);
        $this->patchJson($this->questionPath($question).'/options/'.$option->id, ['option_text' => 'New choice', 'is_correct' => true])
            ->assertOk()->assertJsonPath('data.option_text', 'New choice')->assertJsonPath('data.is_correct', true);
        $this->assertSame(1, $question->options()->where('is_correct', true)->count());
        $this->assertSame($option->id, $question->options()->where('is_correct', true)->sole()->id);
    }

    public function test_single_option_update_cannot_remove_the_only_correct_answer(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->signIn($question->quiz->schoolClass->teacher);
        $correct = $question->options()->where('is_correct', true)->sole();
        $this->patchJson($this->questionPath($question).'/options/'.$correct->id, ['is_correct' => false])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertTrue($correct->fresh()->is_correct);
        $this->assertSame(1, $question->options()->where('is_correct', true)->count());
    }

    public function test_option_replacement_rolls_back_deletion_when_an_insert_fails(): void
    {
        $question = Question::factory()->withOptions()->create();
        $oldOptions = $question->options()->get()->map->getAttributes()->all();
        $this->signIn($question->quiz->schoolClass->teacher);
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'insert into "options"')) {
                throw new \RuntimeException('Simulated option storage failure');
            }
        });

        $this->putJson($this->questionPath($question).'/options', ['options' => self::questionPayload()['options']])
            ->assertStatus(500)->assertJsonPath('error.code', 'SERVER_ERROR');
        $this->assertSame($oldOptions, $question->options()->get()->map->getAttributes()->all());
    }

    public function test_teacher_can_publish_complete_draft_with_deadline_and_close_it(): void
    {
        $question = Question::factory()->withOptions()->create();
        $quiz = $question->quiz;
        $this->signIn($quiz->schoolClass->teacher);
        $deadline = now()->addDays(2)->startOfSecond();
        $this->postJson('/api/quizzes/'.$quiz->id.'/publish', ['deadline' => $deadline->toIso8601String()])
            ->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertTrue($deadline->equalTo($quiz->fresh()->deadline));
        $this->postJson('/api/quizzes/'.$quiz->id.'/close')->assertOk()->assertJsonPath('data.status', 'closed');
        $this->assertSame(QuizStatus::Closed, $quiz->fresh()->status);
    }

    public function test_publication_requires_a_future_deadline(): void
    {
        $question = Question::factory()->withOptions()->create();
        $this->signIn($question->quiz->schoolClass->teacher);
        $url = '/api/quizzes/'.$question->quiz_id.'/publish';
        $this->postJson($url, [])->assertUnprocessable();
        $this->postJson($url, ['deadline' => now()->subMinute()->toIso8601String()])->assertUnprocessable();
        $this->assertSame(QuizStatus::Draft, $question->quiz->fresh()->status);
        $this->assertNull($question->quiz->fresh()->deadline);
    }

    public function test_empty_or_malformed_quizzes_cannot_be_published(): void
    {
        $quiz = Quiz::factory()->create();
        $this->signIn($quiz->schoolClass->teacher);
        $url = '/api/quizzes/'.$quiz->id.'/publish';
        $body = ['deadline' => now()->addDay()->toIso8601String()];
        $this->postJson($url, $body)->assertUnprocessable();
        $question = Question::factory()->for($quiz)->withOptions()->create();
        $question->options()->where('option_label', 'B')->update(['is_correct' => true]);
        $this->postJson($url, $body)->assertUnprocessable();
        $this->assertSame(QuizStatus::Draft, $quiz->fresh()->status);
        $this->assertNull($quiz->fresh()->deadline);
    }

    public function test_published_and_closed_content_is_immutable_and_close_requires_publication(): void
    {
        $question = Question::factory()->withOptions()->create();
        $quiz = $question->quiz;
        $this->signIn($quiz->schoolClass->teacher);
        $this->postJson('/api/quizzes/'.$quiz->id.'/close')->assertForbidden();
        foreach ([QuizStatus::Published, QuizStatus::Closed] as $status) {
            $quiz->forceFill(['status' => $status])->save();
            $this->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Changed'])->assertForbidden();
            $this->deleteJson('/api/quizzes/'.$quiz->id)->assertForbidden();
            $this->postJson($this->questionsPath($quiz), self::questionPayload())->assertForbidden();
            $this->patchJson($this->questionPath($question), ['question_text' => 'Changed'])->assertForbidden();
            $this->deleteJson($this->questionPath($question))->assertForbidden();
            $this->putJson($this->questionPath($question).'/options', ['options' => self::questionPayload()['options']])->assertForbidden();
            $this->patchJson($this->questionPath($question).'/options/'.$question->options->first()->id, ['option_text' => 'Changed'])->assertForbidden();
        }
    }

    public function test_teacher_listing_is_scoped_paginated_and_can_filter_status(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        Quiz::factory()->for($schoolClass, 'schoolClass')->create();
        Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        Quiz::factory()->for($schoolClass, 'schoolClass')->closed()->create();
        $foreign = Quiz::factory()->create();
        $this->signIn($schoolClass->teacher);

        $url = '/api/classes/'.$schoolClass->id.'/quizzes';
        $this->getJson($url.'?per_page=2')->assertOk()->assertJsonCount(2, 'data.items')->assertJsonPath('data.pagination.total', 3);
        $this->getJson($url.'?status=draft')->assertOk()->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.status', 'draft');
        $this->getJson('/api/classes/'.$foreign->class_id.'/quizzes')->assertForbidden();
        $this->getJson($url.'?per_page=101&status=invalid')->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_student_listing_contains_published_summaries_only_and_no_answer_keys(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $published = Quiz::factory()->for($schoolClass, 'schoolClass')->published()->create();
        Question::factory()->for($published)->withOptions()->create();
        Quiz::factory()->for($schoolClass, 'schoolClass')->create();
        Quiz::factory()->for($schoolClass, 'schoolClass')->closed()->create();
        $student = User::factory()->create();
        $schoolClass->students()->attach($student);
        $this->signIn($student);
        $url = '/api/classes/'.$schoolClass->id.'/quizzes';

        $response = $this->getJson($url)->assertOk()->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $published->id)->assertJsonPath('data.items.0.questions_count', 1);
        $this->assertStringNotContainsString('is_correct', $response->getContent());
        $this->assertArrayNotHasKey('questions', $response->json('data.items.0'));
        $this->getJson($url.'?status=draft')->assertOk()->assertJsonCount(0, 'data.items');
        $this->getJson('/api/classes/'.SchoolClass::factory()->create()->id.'/quizzes')->assertForbidden();
    }
}
