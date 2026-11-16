<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AssessmentWorkflowParityTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(User $user): void
    {
        Auth::forgetGuards();
        $this->withToken($user->createToken('workflow-parity-test')->plainTextToken);
    }

    public function test_teacher_can_manage_assessment_metadata_question_bank_duplicate_archive_and_release_results(): void
    {
        $schoolClass = SchoolClass::factory()->create(['name' => 'XI RPL 1']);
        $teacher = $schoolClass->teacher;
        $this->signIn($teacher);

        // 1. Question Bank CRUD
        $bankCreated = $this->postJson('/api/question-bank', [
            'question_text' => 'Apa fungsi indeks pada tabel relasional?',
            'question_type' => 'multiple_choice',
            'points' => 20,
            'topic' => 'Basis Data',
            'explanation' => 'Indeks mempercepat pencarian baris tanpa full table scan.',
            'options' => [
                ['option_label' => 'A', 'option_text' => 'Mempercepat query pencarian', 'is_correct' => true],
                ['option_label' => 'B', 'option_text' => 'Menambah ukuran baris', 'is_correct' => false],
                ['option_label' => 'C', 'option_text' => 'Menghapus duplikasi otomatis', 'is_correct' => false],
                ['option_label' => 'D', 'option_text' => 'Menggantikan primary key', 'is_correct' => false],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.points', 20)
            ->assertJsonPath('data.topic', 'Basis Data')
            ->assertJsonPath('data.is_bank_item', true);

        $bankId = $bankCreated->json('data.id');
        $this->getJson('/api/question-bank')->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $bankId);

        // Bank container quiz must not appear in class quiz listing
        $this->getJson('/api/classes/'.$schoolClass->id.'/quizzes')->assertOk()
            ->assertJsonCount(0, 'data.items');

        // 2. Create quiz with full assessment metadata
        $openAt = now()->subHour()->startOfSecond()->toIso8601String();
        $deadline = now()->addDays(2)->startOfSecond()->toIso8601String();

        $quizRes = $this->postJson('/api/quizzes', [
            'class_id' => $schoolClass->id,
            'title' => 'Evaluasi Basis Data',
            'description' => 'Evaluasi mingguan SQL',
            'assessment_type' => 'Kuis',
            'course_name' => 'Basis Data',
            'instructions' => 'Kerjakan mandiri dalam waktu 45 menit.',
            'open_at' => $openAt,
            'deadline' => $deadline,
            'duration_minutes' => 45,
            'release_mode' => 'manual',
        ])->assertCreated()
            ->assertJsonPath('data.assessment_type', 'quiz')
            ->assertJsonPath('data.course_name', 'Basis Data')
            ->assertJsonPath('data.duration_minutes', 45)
            ->assertJsonPath('data.release_mode', 'manual')
            ->assertJsonPath('data.results_released', false);

        $quizId = $quizRes->json('data.id');

        $this->postJson('/api/quizzes/'.$quizId.'/questions', [
            'question_text' => 'Manakah perintah DDL?',
            'question_type' => 'multiple_choice',
            'points' => 25,
            'explanation' => 'CREATE TABLE adalah perintah DDL.',
            'options' => [
                ['option_label' => 'A', 'option_text' => 'CREATE TABLE', 'is_correct' => true],
                ['option_label' => 'B', 'option_text' => 'SELECT', 'is_correct' => false],
                ['option_label' => 'C', 'option_text' => 'INSERT', 'is_correct' => false],
                ['option_label' => 'D', 'option_text' => 'UPDATE', 'is_correct' => false],
            ],
        ])->assertCreated()->assertJsonPath('data.points', 25);

        // 3. Duplicate quiz
        $dupRes = $this->postJson('/api/quizzes/'.$quizId.'/duplicate')->assertCreated()
            ->assertJsonPath('data.title', 'Evaluasi Basis Data (Salinan)')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(1, 'data.questions');

        $dupId = $dupRes->json('data.id');

        // 4. Archive duplicated quiz
        $this->postJson('/api/quizzes/'.$dupId.'/archive')->assertOk()
            ->assertJsonPath('data.status', 'archived');

        // 5. Delete bank question
        $this->deleteJson('/api/question-bank/'.$bankId)->assertOk();
        $this->getJson('/api/question-bank')->assertOk()->assertJsonCount(0, 'data.items');
    }

    public function test_student_can_resume_attempt_upsert_answers_flag_questions_and_teacher_can_grade_and_release(): void
    {
        $quiz = Quiz::factory()->published()->create([
            'duration_minutes' => 40,
            'release_mode' => 'manual',
            'results_released' => false,
        ]);
        $q1 = Question::factory()->for($quiz)->withOptions()->create([
            'points' => 50,
            'explanation' => 'Pembahasan soal 1',
        ]);
        $q2 = Question::factory()->for($quiz)->withOptions()->create([
            'points' => 50,
            'explanation' => 'Pembahasan soal 2',
        ]);

        $student = User::factory()->create(['role' => Role::Student]);
        $quiz->schoolClass->students()->attach($student);
        $this->signIn($student);

        // Start attempt & resume idempotently when resume=true
        $started = $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss',
            'challenge_mode' => 'normal',
            'resume' => true,
        ])->assertCreated();
        $attemptId = $started->json('data.id');
        $this->assertNotNull($started->json('data.expires_at'));

        $resumed = $this->postJson('/api/quizzes/'.$quiz->id.'/attempts', [
            'game_mode' => 'boss',
            'challenge_mode' => 'normal',
            'resume' => true,
        ])->assertCreated();
        $this->assertSame($attemptId, $resumed->json('data.id'));

        // Flag question 2 before answering
        $this->postJson('/api/attempts/'.$attemptId.'/answers', [
            'question_id' => $q2->id,
            'is_flagged' => true,
        ])->assertCreated()
            ->assertJsonPath('data.attempt.flagged_question_ids.0', $q2->id);

        // Answer question 1 wrong first, then replace with correct option
        $wrongOpt = $q1->options()->where('is_correct', false)->firstOrFail();
        $rightOpt = $q1->options()->where('is_correct', true)->firstOrFail();

        $this->postJson('/api/attempts/'.$attemptId.'/answers', [
            'question_id' => $q1->id,
            'chosen_option_id' => $wrongOpt->id,
            'replace' => true,
        ])->assertCreated()->assertJsonPath('data.answer.is_correct', false);

        $this->postJson('/api/attempts/'.$attemptId.'/answers', [
            'question_id' => $q1->id,
            'chosen_option_id' => $rightOpt->id,
            'replace' => true,
            'is_flagged' => true,
        ])->assertCreated()
            ->assertJsonPath('data.answer.is_correct', true)
            ->assertJsonPath('data.answer.is_flagged', true);

        // Questions endpoint returns saved_answers for session recovery
        $this->getJson('/api/attempts/'.$attemptId.'/questions')->assertOk()
            ->assertJsonCount(1, 'data.saved_answers')
            ->assertJsonPath('data.saved_answers.0.chosen_option_id', $rightOpt->id);

        // Finish attempt
        $this->postJson('/api/attempts/'.$attemptId.'/finish')->assertOk()
            ->assertJsonPath('data.status', 'finished')
            ->assertJsonPath('data.final_grade', '50.00');

        // Student review before teacher releases manual results hides final_grade, is_correct & explanation
        $unreleasedReview = $this->getJson('/api/attempts/'.$attemptId.'/review')->assertOk()
            ->assertJsonPath('data.results_visible', false)
            ->assertJsonPath('data.attempt.final_grade', null)
            ->assertJsonPath('data.questions.0.explanation', null);
        $this->assertStringNotContainsString('is_correct', $unreleasedReview->getContent());

        // Teacher overrides grade/feedback & releases results
        $this->signIn($quiz->schoolClass->teacher);
        $this->patchJson('/api/attempts/'.$attemptId.'/grade', [
            'final_grade' => 85,
            'teacher_feedback' => 'Pengerjaan sangat baik, tingkatkan ketelitian.',
        ])->assertOk()
            ->assertJsonPath('data.final_grade', '85.00')
            ->assertJsonPath('data.teacher_feedback', 'Pengerjaan sangat baik, tingkatkan ketelitian.');

        $this->postJson('/api/quizzes/'.$quiz->id.'/release-results')->assertOk()
            ->assertJsonPath('data.results_released', true);

        // Student review now shows released grade, feedback, answer keys, and explanation
        $this->signIn($student);
        $this->getJson('/api/attempts/'.$attemptId.'/review')->assertOk()
            ->assertJsonPath('data.results_visible', true)
            ->assertJsonPath('data.attempt.final_grade', '85.00')
            ->assertJsonPath('data.attempt.teacher_feedback', 'Pengerjaan sangat baik, tingkatkan ketelitian.')
            ->assertJsonPath('data.questions.0.explanation', 'Pembahasan soal 1');
    }
}
