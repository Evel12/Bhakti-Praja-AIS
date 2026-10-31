<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Guardian;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PortalNotification;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class Member4FoundationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $studentUser;
    private User $otherStudentUser;
    private User $parent;
    private User $otherParent;
    private User $teacher;
    private Student $child;
    private Student $otherChild;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->studentUser = $this->account('murid');
        $this->otherStudentUser = $this->account('murid');
        $this->parent = $this->account('wali_murid');
        $this->otherParent = $this->account('wali_murid');
        $this->teacher = $this->account('guru');
        $this->child = Student::create(['user_id' => $this->studentUser->id, 'student_number' => 'M4-001', 'name' => 'Anak Pertama', 'status' => 'active']);
        $this->otherChild = Student::create(['user_id' => $this->otherStudentUser->id, 'student_number' => 'M4-002', 'name' => 'Anak Lain', 'status' => 'active']);
        $this->guardian($this->parent, $this->child);
        $this->guardian($this->otherParent, $this->otherChild);
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active', 'password' => 'password123']);
    }

    private function guardian(User $user, Student $student): Guardian
    {
        $guardian = Guardian::create(['user_id' => $user->id, 'name' => $user->name, 'status' => 'active']);
        $guardian->students()->attach($student->id, ['relationship' => 'wali']);
        return $guardian;
    }

    private function invoice(Student $student): Invoice
    {
        return Invoice::create(['student_id' => $student->id, 'created_by' => $this->admin->id, 'invoice_type' => 'spp', 'amount' => '250000.25', 'due_date' => '2026-11-10']);
    }

    private function payment(Invoice $invoice, User $user): Payment
    {
        return Payment::create([
            'invoice_id' => $invoice->id, 'submitted_by' => $user->id, 'payment_date' => '2026-10-30 10:00:00',
            'amount' => '250000.25', 'payment_method' => 'transfer', 'transaction_number' => 'TEST-'.$invoice->id,
            'proof_path' => 'payment-proofs/private-test.jpg', 'proof_mime' => 'image/jpeg', 'proof_size' => 1024,
        ]);
    }

    public function test_member4_session_uses_existing_login_without_changing_default_admin_login(): void
    {
        $this->postJson('/api/auth/login', ['email' => $this->parent->email, 'password' => 'password123'])->assertForbidden();
        $response = $this->postJson('/api/auth/login', ['email' => $this->parent->email, 'password' => 'password123', 'portal' => 'member4'])->assertOk()->assertJsonPath('data.role', 'wali_murid');
        $headers = ['Authorization' => 'Bearer '.$response->json('token')];
        $this->getJson('/api/auth/me', $headers)->assertOk()->assertJsonPath('data.id', $this->parent->id);
        foreach (['users', 'students', 'parents', 'schedules', 'dashboard'] as $resource) {
            $this->getJson('/api/'.$resource, $headers)->assertForbidden();
        }
        $this->postJson('/api/auth/logout', [], $headers)->assertOk();
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $this->parent->id]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/member4/parent/children', $headers)->assertUnauthorized();
    }

    public function test_session_rejects_invalid_role_inactive_account_and_invalid_portal(): void
    {
        $this->postJson('/api/auth/login', ['email' => $this->teacher->email, 'password' => 'password123', 'portal' => 'member4'])->assertForbidden();
        $this->parent->update(['status' => 'inactive']);
        $this->postJson('/api/auth/login', ['email' => $this->parent->email, 'password' => 'password123', 'portal' => 'member4'])->assertForbidden();
        $this->postJson('/api/auth/login', ['email' => $this->admin->email, 'password' => 'password123', 'portal' => 'unknown'])->assertUnprocessable();
    }

    public function test_parent_and_student_financial_records_are_scoped_and_proof_paths_are_private(): void
    {
        $invoice = $this->invoice($this->child);
        $other = $this->invoice($this->otherChild);
        $payment = $this->payment($invoice, $this->studentUser);
        $otherPayment = $this->payment($other, $this->otherStudentUser);
        foreach ([$this->parent, $this->studentUser] as $user) {
            $this->actingAs($user, 'sanctum');
            $this->getJson('/api/member4/invoices')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $invoice->id);
            $this->getJson('/api/member4/invoices/'.$invoice->id)->assertOk()->assertJsonPath('data.amount', '250000.25');
            $this->getJson('/api/member4/invoices/'.$other->id)->assertNotFound();
            $this->getJson('/api/member4/invoices?student_id='.$this->otherChild->id)->assertOk()->assertJsonPath('meta.total', 0);
            $this->getJson('/api/member4/payments')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.status', 'pending')->assertJsonMissingPath('data.0.proof_path');
            $this->getJson('/api/member4/payments/'.$payment->id)->assertOk()->assertJsonMissingPath('data.proof_path');
            $this->getJson('/api/member4/payments/'.$otherPayment->id)->assertNotFound();
            $this->getJson('/api/member4/payments?invoice_id='.$other->id)->assertOk()->assertJsonPath('meta.total', 0);
        }
        $this->actingAs($this->admin, 'sanctum');
        $this->getJson('/api/member4/invoices')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/member4/payments')->assertOk()->assertJsonPath('meta.total', 2);
    }

    public function test_admin_invoice_validation_and_immutable_financial_fields(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $payload = ['student_id' => $this->child->id, 'invoice_type' => 'uniform', 'amount' => '300000.50', 'due_date' => '2026-11-15'];
        $item = $this->postJson('/api/member4/invoices', $payload)->assertCreated()->assertJsonPath('data.status', 'unpaid')->assertJsonPath('data.amount', '300000.50')->assertJsonPath('data.created_by', $this->admin->id)->json('data.id');
        $this->patchJson('/api/member4/invoices/'.$item, ['amount' => '325000.75'])->assertOk()->assertJsonPath('data.amount', '325000.75');
        foreach ([['amount' => '0'], ['amount' => '-1'], ['amount' => '1.001'], ['amount' => '10000000000'], ['invoice_type' => 'payroll'], ['due_date' => 'not-a-date'], ['student_id' => 99999], ['status' => 'paid'], ['status' => null], ['created_by' => null], ['created_by' => $this->otherParent->id]] as $invalid) {
            $this->postJson('/api/member4/invoices', array_merge($payload, $invalid))->assertUnprocessable();
        }
        $this->patchJson('/api/member4/invoices/'.$item, ['status' => 'paid'])->assertUnprocessable();
        $this->payment(Invoice::findOrFail($item), $this->parent);
        $this->patchJson('/api/member4/invoices/'.$item, ['amount' => '100'])->assertConflict();
        $this->patchJson('/api/member4/invoices/'.$item, ['student_id' => $this->otherChild->id])->assertConflict();
        $this->assertDatabaseHas('invoices', ['id' => $item, 'student_id' => $this->child->id, 'status' => 'unpaid']);
    }

    public function test_financial_writes_require_admin_and_unimplemented_payment_workflows_are_not_exposed(): void
    {
        $invoice = $this->invoice($this->child);
        foreach ([$this->parent, $this->studentUser, $this->teacher] as $user) {
            $this->actingAs($user, 'sanctum');
            $this->postJson('/api/member4/invoices', [])->assertForbidden();
            $this->patchJson('/api/member4/invoices/'.$invoice->id, ['amount' => '1'])->assertForbidden();
        }
        $this->getJson('/api/member4/invoices')->assertForbidden();
        $this->actingAs($this->admin, 'sanctum');
        $this->postJson('/api/member4/payments', [])->assertMethodNotAllowed();
        $this->postJson('/api/member4/payments/1/verify', [])->assertNotFound();
    }

    public function test_parent_relationship_is_checked_by_user_id_not_name_or_email(): void
    {
        $this->actingAs($this->parent, 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $this->child->id);
        $this->getJson('/api/member4/parent/children/'.$this->child->id)->assertOk()->assertJsonMissingPath('data.user_id');
        $this->getJson('/api/member4/parent/children/'.$this->otherChild->id)->assertNotFound();
        $this->getJson('/api/member4/parent/children/'.$this->otherChild->id.'/schedules')->assertNotFound();
        $unlinked = $this->account('wali_murid');
        $profile = Guardian::create(['name' => $unlinked->name, 'email' => $unlinked->email, 'status' => 'active']);
        $profile->students()->attach($this->otherChild->id);
        $this->actingAs($unlinked, 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($this->parent, 'sanctum');
        Guardian::where('user_id', $this->parent->id)->update(['status' => 'inactive']);
        $this->getJson('/api/member4/parent/children')->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($this->studentUser, 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertForbidden();
    }

    public function test_parent_schedules_use_existing_class_year_and_semester_membership(): void
    {
        $year = \App\Models\AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30']);
        $semester = \App\Models\Semester::create(['academic_year_id' => $year->id, 'name' => 'Ganjil']);
        $otherSemester = \App\Models\Semester::create(['academic_year_id' => $year->id, 'name' => 'Genap']);
        $department = \App\Models\Department::create(['code' => 'M4', 'name' => 'Program Uji']);
        $program = \App\Models\StudyProgram::create(['department_id' => $department->id, 'code' => 'M4-C', 'name' => 'Konsentrasi Uji']);
        $class = \App\Models\Classroom::create(['name' => 'X Uji', 'level' => '10', 'study_program_id' => $program->id, 'academic_year_id' => $year->id]);
        $otherClass = \App\Models\Classroom::create(['name' => 'X Lain', 'level' => '10', 'study_program_id' => $program->id, 'academic_year_id' => $year->id]);
        $teacher = \App\Models\Teacher::create(['name' => 'Guru Uji', 'teacher_number' => 'M4-GURU', 'email' => 'private-teacher@example.test']);
        $subject = \App\Models\Subject::create(['name' => 'Mapel Uji', 'code' => 'M4-MAPEL']);
        $placement = \App\Models\ClassStudent::create(['student_id' => $this->child->id, 'classroom_id' => $class->id, 'academic_year_id' => $year->id, 'semester_id' => $semester->id, 'status' => 'active']);
        $data = ['subject_id' => $subject->id, 'teacher_id' => $teacher->id, 'classroom_id' => $class->id, 'academic_year_id' => $year->id, 'semester_id' => $semester->id, 'day' => 'monday', 'start_time' => '08:00', 'end_time' => '09:00', 'status' => 'active'];
        $schedule = \App\Models\Schedule::create($data);
        \App\Models\Schedule::create(array_merge($data, ['classroom_id' => $otherClass->id]));
        \App\Models\Schedule::create(array_merge($data, ['semester_id' => $otherSemester->id]));
        \App\Models\Schedule::create(array_merge($data, ['status' => 'inactive']));
        $this->actingAs($this->parent, 'sanctum');
        $path = '/api/member4/parent/children/'.$this->child->id.'/schedules';
        $this->getJson($path)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $schedule->id)
            ->assertJsonPath('data.0.teacher.name', 'Guru Uji')->assertJsonMissingPath('data.0.teacher.email');
        $this->getJson($path.'?semester_id='.$otherSemester->id)->assertOk()->assertJsonPath('meta.total', 0);
        $placement->update(['semester_id' => null]);
        $this->getJson($path)->assertOk()->assertJsonPath('meta.total', 2);
        $placement->update(['status' => 'inactive']);
        $this->getJson($path)->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_lists_validate_pagination_and_domain_filters_in_indonesian(): void
    {
        $this->actingAs($this->parent, 'sanctum');
        $this->getJson('/api/member4/invoices?per_page=invalid')->assertUnprocessable()->assertJsonPath('message', 'Validasi gagal.');
        $this->getJson('/api/member4/payments?per_page=101')->assertUnprocessable();
        $this->getJson('/api/member4/announcements?page=0')->assertUnprocessable();
        $this->getJson('/api/member4/notifications?is_read=unknown')->assertUnprocessable();
        $this->getJson('/api/member4/invoices?status=overdue')->assertUnprocessable();
        $this->getJson('/api/member4/payments?status=approved')->assertUnprocessable();
    }

    public function test_announcements_respect_target_roles_and_cannot_duplicate_class_announcements(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $parentNotice = $this->postJson('/api/member4/announcements', ['title' => 'Informasi Wali', 'content' => 'Informasi administrasi sekolah.', 'target_role' => 'wali_murid'])->assertCreated()->json('data.id');
        $studentNotice = $this->postJson('/api/member4/announcements', ['title' => 'Informasi Murid', 'content' => 'Informasi murid.', 'target_role' => 'murid'])->assertCreated()->json('data.id');
        $publicNotice = $this->postJson('/api/member4/announcements', ['title' => 'Semua Pengguna', 'content' => 'Informasi sekolah.', 'target_role' => 'all'])->assertCreated()->json('data.id');
        $this->postJson('/api/member4/announcements', ['title' => 'Invalid', 'content' => 'Invalid', 'target_role' => 'parent'])->assertUnprocessable();
        $this->postJson('/api/member4/announcements', ['title' => 'Kelas', 'content' => 'Kelas', 'target_role' => 'all', 'course_id' => 1])->assertUnprocessable();
        $this->patchJson('/api/member4/announcements/'.$parentNotice, ['title' => 'Informasi Diperbarui'])->assertOk();
        $this->actingAs($this->parent, 'sanctum');
        $this->getJson('/api/member4/announcements')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/member4/announcements/'.$parentNotice)->assertOk();
        $this->getJson('/api/member4/announcements/'.$studentNotice)->assertNotFound();
        $this->patchJson('/api/member4/announcements/'.$parentNotice, ['title' => 'Diubah wali'])->assertForbidden();
        $this->deleteJson('/api/member4/announcements/'.$publicNotice)->assertForbidden();
        $this->actingAs($this->teacher, 'sanctum');
        $this->getJson('/api/member4/announcements')->assertOk()->assertJsonPath('meta.total', 1);
        $this->postJson('/api/member4/announcements', [])->assertForbidden();
        $this->actingAs($this->admin, 'sanctum');
        $this->deleteJson('/api/member4/announcements/'.$publicNotice)->assertOk();
    }

    public function test_notification_read_state_is_owned_and_idempotent(): void
    {
        $own = PortalNotification::create(['user_id' => $this->parent->id, 'title' => 'Tagihan', 'message' => 'Informasi tagihan.']);
        $other = PortalNotification::create(['user_id' => $this->otherParent->id, 'title' => 'Pribadi', 'message' => 'Informasi pribadi.']);
        $this->actingAs($this->parent, 'sanctum');
        $this->getJson('/api/member4/notifications?is_read=0')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $own->id);
        $this->patchJson('/api/member4/notifications/'.$other->id.'/read')->assertNotFound();
        $this->patchJson('/api/member4/notifications/'.$own->id.'/read', ['user_id' => $this->otherParent->id])->assertOk()->assertJsonPath('data.is_read', true);
        $this->patchJson('/api/member4/notifications/'.$own->id.'/read')->assertOk()->assertJsonPath('data.is_read', true);
        $this->getJson('/api/member4/notifications?is_read=0')->assertOk()->assertJsonPath('meta.total', 0);
        $this->assertFalse($other->fresh()->is_read);
        $this->actingAs($this->admin, 'sanctum');
        $this->getJson('/api/member4/notifications')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_member4_requires_authentication_and_active_accounts(): void
    {
        foreach (['invoices', 'payments', 'announcements', 'notifications', 'parent/children'] as $path) {
            $this->getJson('/api/member4/'.$path)->assertUnauthorized();
        }
        $this->parent->update(['status' => 'inactive']);
        $this->actingAs($this->parent, 'sanctum');
        $this->getJson('/api/member4/invoices')->assertForbidden();
        $this->getJson('/api/auth/me')->assertForbidden();
    }

    public function test_schema_uses_existing_student_and_parent_tables_and_payment_states(): void
    {
        foreach (['invoices', 'payments', 'announcements', 'notifications'] as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
        $invoice = $this->invoice($this->child);
        $payment = $this->payment($invoice, $this->parent);
        $this->assertSame('unpaid', $invoice->fresh()->status);
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertSame($this->child->id, $payment->invoice->student->id);
        $this->assertSame($this->parent->id, $payment->submitter->id);
        $this->assertDatabaseCount('parents', 2);
        $this->assertDatabaseCount('students', 2);
    }
}
