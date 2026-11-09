<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\ModuleVisibility;
use App\Enums\QuizStatus;
use App\Enums\Role;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Models\Attempt;
use App\Models\Module;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DomainPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_class_access_requires_owner_or_enrolled_student(): void
    {
        $schoolClass = SchoolClass::factory()->create();
        $student = User::factory()->create();
        $outsider = User::factory()->create();
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);
        $schoolClass->students()->attach($student);

        $this->assertTrue(Gate::forUser($schoolClass->teacher)->allows('view', $schoolClass));
        $this->assertTrue(Gate::forUser($student)->allows('view', $schoolClass));
        $this->assertFalse(Gate::forUser($outsider)->allows('view', $schoolClass));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('update', $schoolClass));
        $this->assertFalse(Gate::forUser($student)->allows('update', $schoolClass));
        $this->assertTrue(Gate::forUser($schoolClass->teacher)->allows('create', SchoolClass::class));
        $this->assertFalse(Gate::forUser($student)->allows('create', SchoolClass::class));
    }

    public function test_teachers_can_create_and_edit_only_their_own_class_quizzes(): void
    {
        $quiz = Quiz::factory()->create();
        $owner = $quiz->schoolClass->teacher;
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);

        $this->assertTrue(Gate::forUser($owner)->allows('create', [Quiz::class, $quiz->schoolClass]));
        $this->assertTrue(Gate::forUser($owner)->allows('update', $quiz));
        $this->assertTrue(Gate::forUser($owner)->allows('publish', $quiz));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('create', [Quiz::class, $quiz->schoolClass]));
        foreach (['view', 'update', 'delete', 'publish', 'close'] as $ability) {
            $this->assertFalse(Gate::forUser($otherTeacher)->allows($ability, $quiz));
        }
    }

    public function test_students_can_view_published_quizzes_only_in_their_own_classes(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $student = User::factory()->create();
        $outsider = User::factory()->create();
        $quiz->schoolClass->students()->attach($student);

        $this->assertTrue(Gate::forUser($student)->allows('viewAny', [Quiz::class, $quiz->schoolClass]));
        $this->assertTrue(Gate::forUser($student)->allows('view', $quiz));
        $this->assertFalse(Gate::forUser($outsider)->allows('view', $quiz));
        $this->assertFalse(Gate::forUser($student)->allows('update', $quiz));
        $quiz->status = QuizStatus::Draft;
        $this->assertFalse(Gate::forUser($student)->allows('view', $quiz));
        $quiz->status = QuizStatus::Closed;
        $this->assertFalse(Gate::forUser($student)->allows('view', $quiz));
    }

    public function test_only_drafts_allow_content_edits_and_only_published_quizzes_can_close(): void
    {
        $quiz = Quiz::factory()->published()->create();
        $owner = $quiz->schoolClass->teacher;
        $this->assertFalse(Gate::forUser($owner)->allows('update', $quiz));
        $this->assertFalse(Gate::forUser($owner)->allows('publish', $quiz));
        $this->assertTrue(Gate::forUser($owner)->allows('close', $quiz));
        $quiz->status = QuizStatus::Closed;
        $this->assertFalse(Gate::forUser($owner)->allows('close', $quiz));
    }

    public function test_question_and_option_edits_follow_quiz_ownership_and_draft_status(): void
    {
        $question = Question::factory()->withOptions()->create();
        $option = $question->options->first();
        $owner = $question->quiz->schoolClass->teacher;
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);

        $this->assertTrue(Gate::forUser($owner)->allows('create', [Question::class, $question->quiz]));
        $this->assertTrue(Gate::forUser($owner)->allows('create', [Option::class, $question]));
        $this->assertTrue(Gate::forUser($owner)->allows('update', $question));
        $this->assertTrue(Gate::forUser($owner)->allows('update', $option));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('delete', $question));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('update', $option));
        $question->quiz->status = QuizStatus::Published;
        $this->assertFalse(Gate::forUser($owner)->allows('update', $question));
    }

    public function test_module_visibility_does_not_bypass_class_membership(): void
    {
        $module = Module::factory()->create();
        $student = User::factory()->create();
        $outsider = User::factory()->create();
        $module->schoolClass->students()->attach($student);
        $owner = $module->schoolClass->teacher;
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);

        $this->assertTrue(Gate::forUser($owner)->allows('view', $module));
        $this->assertTrue(Gate::forUser($owner)->allows('generateQuiz', $module));
        $this->assertTrue(Gate::forUser($owner)->allows('create', [Module::class, $module->schoolClass]));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('update', $module));
        $this->assertFalse(Gate::forUser($student)->allows('view', $module));
        $module->visibility = ModuleVisibility::Public;
        $this->assertTrue(Gate::forUser($student)->allows('view', $module));
        $this->assertFalse(Gate::forUser($outsider)->allows('view', $module));
        $this->assertFalse(Gate::forUser($student)->allows('generateQuiz', $module));
    }

    public function test_attempt_creation_requires_a_student_in_the_published_quiz_class(): void
    {
        $attempt = Attempt::factory()->create();
        $this->assertTrue(Gate::forUser($attempt->student)->allows('create', [Attempt::class, $attempt->quiz]));
        $this->assertFalse(Gate::forUser($attempt->quiz->schoolClass->teacher)->allows('create', [Attempt::class, $attempt->quiz]));
        $this->assertFalse(Gate::forUser(User::factory()->create())->allows('create', [Attempt::class, $attempt->quiz]));
        $attempt->quiz->status = QuizStatus::Closed;
        $this->assertFalse(Gate::forUser($attempt->student)->allows('create', [Attempt::class, $attempt->quiz]));
    }

    public function test_students_cannot_read_or_modify_another_students_attempt(): void
    {
        $attempt = Attempt::factory()->create();
        $otherStudent = User::factory()->create();
        $attempt->quiz->schoolClass->students()->attach($otherStudent);

        foreach (['view', 'answer', 'finish', 'review'] as $ability) {
            $this->assertFalse(Gate::forUser($otherStudent)->allows($ability, $attempt));
        }
        $this->assertTrue(Gate::forUser($attempt->student)->allows('view', $attempt));
        $this->assertTrue(Gate::forUser($attempt->student)->allows('answer', $attempt));
        $this->assertFalse(Gate::forUser($attempt->student)->allows('review', $attempt));
    }

    public function test_only_the_owner_can_answer_and_review_waits_until_completion(): void
    {
        $attempt = Attempt::factory()->create();
        $teacher = $attempt->quiz->schoolClass->teacher;
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);
        $this->assertTrue(Gate::forUser($teacher)->allows('view', $attempt));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('view', $attempt));
        $this->assertFalse(Gate::forUser($teacher)->allows('answer', $attempt));
        $attempt->status = AttemptStatus::Finished;
        $this->assertFalse(Gate::forUser($attempt->student)->allows('answer', $attempt));
        $this->assertTrue(Gate::forUser($attempt->student)->allows('review', $attempt));
        $this->assertTrue(Gate::forUser($teacher)->allows('review', $attempt));
    }

    public function test_http_policy_middleware_denies_foreign_attempts(): void
    {
        Route::middleware(['api', 'auth:sanctum', 'can:view,attempt'])->get(
            '/api/phase-two-test/attempts/{attempt}',
            fn (AuthenticatedRequest $request, Attempt $attempt) => ApiResponse::success(['id' => $attempt->id]),
        );
        $attempt = Attempt::factory()->create();
        $otherStudent = User::factory()->create();
        $this->withToken($otherStudent->createToken('test')->plainTextToken)
            ->getJson('/api/phase-two-test/attempts/'.$attempt->id)
            ->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_http_policy_middleware_denies_editing_another_teachers_quiz(): void
    {
        Route::middleware(['api', 'auth:sanctum', 'role:teacher', 'can:update,quiz'])->patch(
            '/api/phase-two-test/quizzes/{quiz}',
            fn (AuthenticatedRequest $request, Quiz $quiz) => ApiResponse::success(['id' => $quiz->id]),
        );
        $quiz = Quiz::factory()->create();
        $otherTeacher = User::factory()->create(['role' => Role::Teacher]);
        $this->withToken($otherTeacher->createToken('test')->plainTextToken)
            ->patchJson('/api/phase-two-test/quizzes/'.$quiz->id, ['title' => 'Attempted takeover'])
            ->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertNotSame('Attempted takeover', $quiz->fresh()->title);
    }

    public function test_admin_does_not_implicitly_bypass_domain_ownership(): void
    {
        $quiz = Quiz::factory()->create();
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->assertFalse(Gate::forUser($admin)->allows('update', $quiz));
    }
}
