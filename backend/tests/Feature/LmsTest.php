<?php

namespace Tests\Feature;

use App\Jobs\Lms\GenerateQuiz;
use App\Models\{Guardian, Role, Student, User};
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Http, Queue, Storage};
use Tests\TestCase;

class LmsTest extends TestCase
{
    use RefreshDatabase;
    private User $teacher;
    private User $student;
    private int $course;
    private string $code;

    protected function setUp(): void
    {
        parent::setUp(); $this->seed(RoleSeeder::class); Storage::fake('local');
        $this->teacher = $this->account('guru'); $this->student = $this->account('murid');
        $res = $this->actingAs($this->teacher)->postJson('/api/lms/courses', ['name' => 'Basis Data', 'description' => 'Materi kelas'])->assertCreated();
        $this->course = $res->json('data.id'); $this->code = $res->json('data.code');
        $this->actingAs($this->student)->postJson('/api/lms/join', ['code' => $this->code])->assertOk();
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    }

    private function material(string $visibility = 'public'): int
    {
        return $this->actingAs($this->teacher)->postJson("/api/lms/courses/{$this->course}/materials", [
            'file' => UploadedFile::fake()->createWithContent('materi.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"), 'visibility' => $visibility,
        ])->assertCreated()->json('data.id');
    }

    private function draft(int $material): int
    {
        $draft = ['title' => 'Kuis Basis Data', 'questions' => [['question' => 'Apa fungsi primary key?', 'options' => ['Identitas unik', 'Warna', 'Ukuran', 'Alamat server'], 'correct_index' => 0, 'explanation' => 'Primary key mengidentifikasi setiap baris secara unik.']]];
        return DB::table('lms_ai_drafts')->insertGetId(['material_id' => $material, 'requested_by' => $this->teacher->id, 'model' => 'qwen3.8:27b', 'question_count' => 1, 'status' => 'draft', 'draft' => json_encode($draft), 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_material_visibility_membership_and_progress_are_enforced(): void
    {
        $public = $this->material(); $private = $this->material('private');
        $this->actingAs($this->student)->getJson("/api/lms/courses/{$this->course}")->assertOk()->assertJsonCount(1, 'data.materials');
        $this->getJson("/api/lms/materials/$private/download")->assertNotFound();
        $this->postJson("/api/lms/materials/$public/read")->assertOk();
        $this->postJson("/api/lms/materials/$public/read")->assertOk();
        $this->getJson("/api/lms/courses/{$this->course}")->assertJsonPath('data.progress.0.percentage', 100);
        $stranger = $this->account('murid');
        $this->actingAs($stranger)->getJson("/api/lms/materials/$public/download")->assertForbidden();
        $this->actingAs($this->account('guru'))->patchJson("/api/lms/courses/{$this->course}", ['name' => 'Stolen'])->assertForbidden();
        $this->actingAs($this->student)->postJson('/api/lms/courses', ['name' => 'No'])->assertForbidden();
        $this->actingAs($this->teacher)->postJson("/api/lms/courses/{$this->course}/materials", ['file' => UploadedFile::fake()->createWithContent('bad.pdf', 'not pdf'), 'visibility' => 'public'])->assertUnprocessable();
    }

    public function test_assignments_grades_attendance_and_announcements_persist(): void
    {
        $a = $this->actingAs($this->teacher)->postJson("/api/lms/courses/{$this->course}/assignments", ['title' => 'Normalisasi', 'instructions' => 'Jelaskan 1NF', 'due_at' => now()->addDay()->toISOString()])->assertCreated()->json('data.id');
        $this->postJson("/api/lms/assignments/$a/status", ['status' => 'published'])->assertOk();
        $this->postJson("/api/lms/courses/{$this->course}/announcements", ['title' => 'Pertemuan', 'content' => 'Baca materi'])->assertCreated();
        $this->postJson("/api/lms/courses/{$this->course}/attendance", ['meeting_date' => now()->toDateString(), 'records' => [['user_id' => $this->student->id, 'status' => 'hadir']]])->assertOk();
        $this->actingAs($this->student)->postJson("/api/lms/assignments/$a/submit", ['answer' => 'Setiap nilai bersifat atomik.'])->assertOk();
        $s = DB::table('lms_submissions')->first()->id;
        $this->patchJson("/api/lms/submissions/$s/grade", ['grade' => 100])->assertForbidden();
        $this->actingAs($this->teacher)->patchJson("/api/lms/submissions/$s/grade", ['grade' => 90, 'feedback' => 'Baik'])->assertOk();
        $this->actingAs($this->student)->postJson("/api/lms/assignments/$a/submit", ['answer' => 'Changed'])->assertUnprocessable();
        $this->getJson("/api/lms/courses/{$this->course}")->assertOk()->assertJsonPath('data.progress.0.average_grade', 90)->assertJsonPath('data.progress.0.present', 1)->assertJsonCount(1, 'data.announcements');
        DB::table('lms_assignments')->where('id', $a)->update(['due_at' => now()->subMinute()]);
        $this->postJson("/api/lms/assignments/$a/submit", ['answer' => 'Late'])->assertUnprocessable();
    }

    public function test_ai_uses_durable_queue_default_and_selected_model_and_validates_worker_output(): void
    {
        Queue::fake(); $m = $this->material();
        $id = $this->postJson("/api/lms/materials/$m/generate", ['question_count' => 1])->assertStatus(202)->json('data.id');
        $this->assertDatabaseHas('lms_ai_drafts', ['id' => $id, 'model' => 'qwen3.8:27b', 'status' => 'queued']);
        Queue::assertPushedOn('lms-ai', GenerateQuiz::class);
        $this->postJson("/api/lms/materials/$m/generate", ['question_count' => 1, 'model' => 'llama3.1:8b'])->assertStatus(202);
        $this->postJson("/api/lms/materials/$m/generate", ['question_count' => 1, 'model' => 'arbitrary'])->assertUnprocessable();
        config(['lms.ai_key' => 'test-key']);
        $fixture = $this->draft($m); $output = json_decode(DB::table('lms_ai_drafts')->find($fixture)->draft, true);
        Http::fake(['*' => Http::sequence()->push($output)->push(['questions' => []])]); (new GenerateQuiz($id))->handle();
        $this->assertDatabaseHas('lms_ai_drafts', ['id' => $id, 'status' => 'draft', 'reviewed_at' => null]);
        Http::assertSent(fn ($request) => collect($request->data())->contains(fn ($part) => ($part['name'] ?? '') === 'model' && $part['contents'] === 'qwen3.8:27b') && $request->hasHeader('Authorization', 'Bearer test-key'));
        DB::table('lms_ai_drafts')->where('id', $id)->update(['status' => 'queued']);
        (new GenerateQuiz($id))->handle();
        $this->assertDatabaseHas('lms_ai_drafts', ['id' => $id, 'status' => 'failed']);
    }

    public function test_ai_draft_requires_review_and_students_never_receive_answer_keys(): void
    {
        $id = $this->draft($this->material());
        $this->postJson("/api/lms/drafts/$id/publish", ['deadline' => now()->addDay()->toISOString()])->assertUnprocessable();
        $draft = json_decode(DB::table('lms_ai_drafts')->find($id)->draft, true);
        $this->patchJson("/api/lms/drafts/$id", ['draft' => $draft, 'reviewed' => true])->assertOk();
        $this->postJson("/api/lms/drafts/$id/publish", ['deadline' => now()->addDay()->toISOString()])->assertOk();
        $this->patchJson("/api/lms/drafts/$id", ['draft' => $draft, 'reviewed' => true])->assertUnprocessable();
        $response = $this->actingAs($this->student)->getJson("/api/lms/drafts/$id")->assertOk();
        $this->assertArrayNotHasKey('correct_index', $response->json('data.draft.questions.0'));
        $this->assertArrayNotHasKey('explanation', $response->json('data.draft.questions.0'));
        $this->postJson("/api/lms/drafts/$id/answers", ['answers' => [0]])->assertOk()->assertJsonPath('data.grade', 100);
        $this->postJson("/api/lms/drafts/$id/answers", ['answers' => [0]])->assertUnprocessable();
        $this->actingAs($this->teacher)->postJson("/api/lms/drafts/$id/close")->assertOk();
    }

    public function test_parent_can_only_read_linked_child_and_cannot_write(): void
    {
        $child = Student::create(['user_id' => $this->student->id, 'name' => 'Child', 'student_number' => 'LMS-1', 'status' => 'active']);
        $parent = $this->account('wali_murid'); $guardian = Guardian::create(['user_id' => $parent->id, 'name' => 'Parent', 'status' => 'active']);
        $guardian->students()->attach($child->id, ['relationship' => 'wali']);
        $this->actingAs($parent)->getJson('/api/lms/courses?student_id='.$child->id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/lms/courses/{$this->course}?student_id={$child->id}")->assertOk();
        $this->getJson('/api/lms/courses?student_id=99999')->assertNotFound();
        $this->getJson('/api/lms/courses')->assertUnprocessable();
        $this->postJson("/api/lms/courses/{$this->course}/attendance", [])->assertForbidden();
        $this->actingAs($this->account('wali_murid'))->getJson('/api/lms/courses?student_id='.$child->id)->assertNotFound();
    }

    public function test_inactive_accounts_and_administrators_cannot_enter_lms(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/lms/courses')->assertForbidden();
        $this->student->update(['status' => 'inactive']);
        $this->actingAs($this->student)->getJson('/api/lms/courses')->assertForbidden();
    }

    public function test_lms_login_is_additive_and_does_not_grant_admin_access(): void
    {
        $this->teacher->update(['password' => 'password123']);
        $this->postJson('/api/auth/login', ['email' => $this->teacher->email, 'password' => 'password123', 'portal' => 'lms'])->assertOk()->assertJsonPath('data.role', 'guru');
        $this->actingAs($this->teacher)->getJson('/api/users')->assertForbidden();
    }

    public function test_submission_files_are_private_and_draft_or_closed_tasks_cannot_be_submitted(): void
    {
        $a = $this->actingAs($this->teacher)->postJson("/api/lms/courses/{$this->course}/assignments", ['title' => 'Dokumen', 'instructions' => 'Kumpulkan dokumen', 'due_at' => now()->addDay()->toISOString()])->assertCreated()->json('data.id');
        $this->actingAs($this->student)->postJson("/api/lms/assignments/$a/submit", ['answer' => 'Before publish'])->assertUnprocessable();
        $this->actingAs($this->teacher)->postJson("/api/lms/assignments/$a/status", ['status' => 'published'])->assertOk();
        $this->actingAs($this->student)->postJson("/api/lms/assignments/$a/submit", ['file' => UploadedFile::fake()->createWithContent('answer.txt', 'Jawaban tugas')])->assertOk();
        $s = DB::table('lms_submissions')->first();
        $this->getJson("/api/lms/submissions/{$s->id}/download")->assertOk();
        $other = $this->account('murid');
        $this->actingAs($other)->postJson('/api/lms/join', ['code' => $this->code])->assertOk();
        $this->getJson("/api/lms/submissions/{$s->id}/download")->assertForbidden();
        $this->actingAs($this->teacher)->getJson("/api/lms/submissions/{$s->id}/download")->assertOk();
        $this->postJson("/api/lms/assignments/$a/status", ['status' => 'closed'])->assertOk();
        $this->actingAs($this->student)->postJson("/api/lms/assignments/$a/submit", ['answer' => 'After close'])->assertUnprocessable();
    }
}
