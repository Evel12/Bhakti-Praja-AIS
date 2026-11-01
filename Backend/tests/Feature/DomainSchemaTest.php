<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\ModuleVisibility;
use App\Enums\OptionLabel;
use App\Enums\QuestionType;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\AttemptAnswer;
use App\Models\ClassMember;
use App\Models\Module;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DomainSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_relationships_link_the_teacher_class_members_module_quiz_and_answers(): void
    {
        $answer = AttemptAnswer::factory()->create();
        $attempt = $answer->attempt;
        $quiz = $attempt->quiz;
        $schoolClass = $quiz->schoolClass;
        $module = Module::factory()->for($schoolClass, 'schoolClass')->create();

        $this->assertSame(Role::Teacher, $schoolClass->teacher->role);
        $this->assertTrue($schoolClass->teacher->ownedClasses->contains($schoolClass));
        $this->assertTrue($schoolClass->students->contains($attempt->student));
        $this->assertTrue($attempt->student->classes->contains($schoolClass));
        $this->assertTrue($attempt->student->memberships->first()->schoolClass->is($schoolClass));
        $this->assertTrue($schoolClass->memberships->first()->student->is($attempt->student));
        $this->assertTrue($schoolClass->modules->contains($module));
        $this->assertTrue($schoolClass->quizzes->contains($quiz));
        $this->assertTrue($module->schoolClass->is($schoolClass));
        $this->assertTrue($quiz->attempts->contains($attempt));
        $this->assertTrue($quiz->questions->contains($answer->question));
        $this->assertTrue($answer->question->answers->contains($answer));
        $this->assertTrue($answer->chosenOption->answers->contains($answer));
        $this->assertTrue($attempt->student->attempts->contains($attempt));
        $this->assertTrue($attempt->answers->contains($answer));
        $this->assertTrue($answer->chosenOption->question->is($answer->question));
    }

    public function test_default_states_and_casts_preserve_decimal_values_and_enums(): void
    {
        $quiz = Quiz::factory()->create()->refresh();
        $module = Module::factory()->create()->refresh();
        $attempt = Attempt::factory()->create()->refresh();
        $question = Question::factory()->withOptions()->create()->refresh();

        $this->assertSame(QuizStatus::Draft, $quiz->status);
        $this->assertNull($quiz->deadline);
        $this->assertSame(ModuleVisibility::Private, $module->visibility);
        $this->assertSame(AttemptStatus::Ongoing, $attempt->status);
        $this->assertSame('0.00', $attempt->score);
        $this->assertSame('0.00', $attempt->progress_percentage);
        $this->assertSame('0.00', $attempt->multiplier_max);
        $this->assertNull($attempt->finished_at);
        $this->assertNull($attempt->boss_id);
        $this->assertNull($attempt->map_id);
        $this->assertSame(QuestionType::MultipleChoice, $question->question_type);
        $this->assertSame([OptionLabel::A, OptionLabel::B, OptionLabel::C, OptionLabel::D], $question->options->pluck('option_label')->all());
    }

    public function test_duplicate_class_membership_is_rejected_by_the_database(): void
    {
        $membership = ClassMember::factory()->create();
        $this->expectException(QueryException::class);
        ClassMember::factory()->create(['class_id' => $membership->class_id, 'student_id' => $membership->student_id]);
    }

    public function test_duplicate_answers_are_rejected_by_the_database(): void
    {
        $answer = AttemptAnswer::factory()->create();
        $this->expectException(QueryException::class);
        AttemptAnswer::factory()->create([
            'attempt_id' => $answer->attempt_id, 'question_id' => $answer->question_id,
            'chosen_option_id' => $answer->chosen_option_id,
        ]);
    }

    public function test_an_option_from_another_question_is_rejected_by_the_database(): void
    {
        $answer = AttemptAnswer::factory()->create();
        $other = Question::factory()->withOptions()->create();
        $this->expectException(QueryException::class);
        DB::table('attempt_answers')->where('id', $answer->id)->update(['chosen_option_id' => $other->options->first()->id]);
    }

    public function test_option_labels_cannot_be_duplicated_within_a_question(): void
    {
        $option = Option::factory()->create();
        $this->expectException(QueryException::class);
        Option::factory()->create(['question_id' => $option->question_id, 'option_label' => $option->option_label]);
    }

    public function test_orphan_quizzes_are_rejected_by_the_database(): void
    {
        $this->expectException(QueryException::class);
        Quiz::factory()->create(['class_id' => 999999]);
    }

    public function test_recorded_attempts_prevent_quiz_deletion(): void
    {
        $attempt = Attempt::factory()->create();
        $this->expectException(QueryException::class);
        $attempt->quiz->delete();
    }

    public function test_answered_options_cannot_be_deleted(): void
    {
        $answer = AttemptAnswer::factory()->create();
        $this->expectException(QueryException::class);
        $answer->chosenOption->delete();
    }

    public function test_attempt_grade_fields_and_answer_correctness_are_not_mass_assignable(): void
    {
        $attempt = Attempt::factory()->create();
        $attempt->fill([
            'score' => 999, 'streak_max' => 999, 'multiplier_max' => 999,
            'progress_percentage' => 100, 'status' => 'finished', 'student_id' => 999,
        ])->save();
        $attempt->refresh();
        $this->assertSame('0.00', $attempt->score);
        $this->assertSame(0, $attempt->streak_max);
        $this->assertSame('0.00', $attempt->multiplier_max);
        $this->assertSame('0.00', $attempt->progress_percentage);
        $this->assertSame(AttemptStatus::Ongoing, $attempt->status);

        $answer = AttemptAnswer::factory()->create(['is_correct' => false]);
        $answer->fill(['is_correct' => true, 'answered_at' => now()->subYear()])->save();
        $this->assertFalse($answer->fresh()->is_correct);
    }

    public function test_required_query_indexes_exist(): void
    {
        $this->assertTrue(Schema::hasIndex('questions', ['quiz_id']));
        $this->assertTrue(Schema::hasIndex('attempts', ['quiz_id']));
        $this->assertTrue(Schema::hasIndex('attempts', ['student_id']));
        $this->assertTrue(Schema::hasIndex('attempts', ['quiz_id', 'student_id', 'status']));
        $this->assertTrue(Schema::hasIndex('attempt_answers', ['attempt_id']));
        $this->assertTrue(Schema::hasIndex('attempt_answers', ['attempt_id', 'question_id'], 'unique'));
    }

    public function test_enum_values_are_restricted_by_the_database(): void
    {
        $quiz = Quiz::factory()->create();
        $this->expectException(QueryException::class);
        DB::table('quizzes')->where('id', $quiz->id)->update(['status' => 'invalid']);
    }

    public function test_deleting_an_unattempted_draft_removes_its_questions_and_options(): void
    {
        $question = Question::factory()->withOptions()->create();
        $quiz = $question->quiz;
        $quiz->delete();
        $this->assertDatabaseMissing('questions', ['id' => $question->id]);
        $this->assertDatabaseMissing('options', ['question_id' => $question->id]);
    }
}
