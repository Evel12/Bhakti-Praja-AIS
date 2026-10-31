<?php

namespace Tests\Feature;

use App\Models\{AcademicYear, ClassStudent, Classroom, Guardian, Invoice, Payment, Role, Room, Schedule, Semester, Student, Subject, Teacher, User};
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Member4ParentPortalTest extends TestCase
{
    use RefreshDatabase;

    private User $parentUser;
    private User $admin;
    private Guardian $guardian;
    private Student $first;
    private Student $second;
    private Student $unrelated;
    private Invoice $firstBill;
    private Invoice $secondBill;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->parentUser = $this->account('wali_murid');
        $this->guardian = Guardian::create(['user_id' => $this->parentUser->id, 'name' => 'Wali Dua Anak', 'status' => 'active']);
        $this->first = Student::create(['name' => 'Anak Pertama', 'student_number' => 'PORTAL-1', 'gender' => 'L', 'birth_date' => '2010-01-05', 'status' => 'active']);
        $this->second = Student::create(['name' => 'Anak Kedua', 'student_number' => 'PORTAL-2', 'status' => 'active']);
        $this->unrelated = Student::create(['name' => 'Anak Lain', 'student_number' => 'PORTAL-3', 'status' => 'active']);
        $this->guardian->students()->attach([$this->first->id, $this->second->id], ['relationship' => 'wali']);
        $this->firstBill = $this->bill($this->first, '100.25');
        $this->secondBill = $this->bill($this->second, '200.50');
        $this->payment($this->firstBill, 'verified');
        $this->payment($this->secondBill, 'pending');
        $this->payment($this->bill($this->unrelated, '9000.00'), 'pending');
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    }

    private function bill(Student $student, string $amount): Invoice
    {
        return Invoice::create(['student_id' => $student->id, 'created_by' => $this->admin->id, 'invoice_type' => 'spp', 'amount' => $amount, 'due_date' => now()->subDay()->toDateString()]);
    }

    private function payment(Invoice $invoice, string $status): Payment
    {
        $payment = Payment::create(['invoice_id' => $invoice->id, 'submitted_by' => $this->parentUser->id, 'payment_date' => now(), 'amount' => $invoice->amount, 'payment_method' => 'Transfer bank', 'proof_path' => 'payment-proofs/test-only.pdf', 'proof_mime' => 'application/pdf', 'proof_size' => 10]);
        $payment->status = $status;
        if ($status === 'verified') {
            $payment->verified_by = $this->admin->id;
            $payment->verified_at = now();
            $invoice->status = 'paid';
            $invoice->save();
        }
        $payment->save();
        return $payment;
    }

    private function path(Student $student, string $suffix = ''): string
    {
        return '/api/member4/parent/children/'.$student->id.($suffix ? '/'.$suffix : '');
    }

    public function test_children_profile_and_dashboard_only_include_associated_children(): void
    {
        $this->actingAs($this->parentUser, 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonMissing(['student_number' => 'PORTAL-3']);
        $this->getJson($this->path($this->first))->assertOk()->assertJsonPath('data.gender', 'L')->assertJsonPath('data.name', $this->first->name)->assertJsonMissingPath('data.user_id')->assertJsonCount(0, 'data.placements');
        $this->getJson($this->path($this->first, 'dashboard'))->assertOk()->assertJsonPath('data.student.id', $this->first->id)->assertJsonPath('data.finance.invoice_count', 1)->assertJsonPath('data.finance.verified_amount', '100.25')->assertJsonPath('data.finance.outstanding_amount', '0.00')->assertJsonPath('data.schedule_count', 0);
        $this->getJson($this->path($this->second, 'dashboard'))->assertOk()->assertJsonPath('data.finance.outstanding_amount', '200.50')->assertJsonPath('data.finance.pending_payment_count', 1);
        $this->getJson($this->path($this->unrelated))->assertNotFound();
        $this->getJson($this->path($this->unrelated, 'dashboard'))->assertNotFound();
    }

    public function test_missing_academic_sources_are_explicit_and_never_fabricate_zero_scores(): void
    {
        $this->actingAs($this->parentUser, 'sanctum');
        foreach (['grades', 'attendance', 'assignments', 'progress'] as $section) {
            $this->getJson($this->path($this->first, $section))->assertOk()->assertJsonPath('available', false)->assertJsonPath('status', 'unavailable')->assertJsonPath('data', null)->assertJsonMissingPath('score');
            $this->getJson($this->path($this->first, 'dashboard'))->assertJsonPath('data.academic.'.$section.'.available', false)->assertJsonPath('data.academic.'.$section.'.data', null);
            $this->getJson($this->path($this->unrelated, $section))->assertNotFound();
        }
    }

    public function test_each_portal_request_rechecks_guardian_relationship(): void
    {
        $this->actingAs($this->parentUser, 'sanctum');
        $this->getJson($this->path($this->first, 'dashboard'))->assertOk();
        $this->guardian->students()->detach($this->first->id);
        foreach (['', 'dashboard', 'schedules', 'grades', 'attendance', 'assignments', 'progress'] as $suffix) $this->getJson($this->path($this->first, $suffix))->assertNotFound();
        $this->getJson('/api/member4/invoices/'.$this->firstBill->id)->assertNotFound();
        $id = $this->firstBill->payments()->value('id');
        $this->getJson('/api/member4/payments/'.$id)->assertNotFound();
        $this->getJson('/api/member4/payments/'.$id.'/proof')->assertNotFound();
        $this->getJson('/api/member4/payments?student_id='.$this->first->id)->assertJsonPath('meta.total', 0);
    }

    public function test_child_finance_filters_do_not_mix_siblings_or_leak_unrelated_records(): void
    {
        $this->actingAs($this->parentUser, 'sanctum');
        foreach ([$this->first, $this->second] as $child) {
            $this->getJson('/api/member4/invoices?student_id='.$child->id)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.student_id', $child->id);
            $this->getJson('/api/member4/payments?student_id='.$child->id)->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.invoice.student_id', $child->id);
        }
        $this->getJson('/api/member4/payments?student_id='.$this->unrelated->id)->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/member4/invoices?student_id='.$this->unrelated->id)->assertJsonPath('meta.total', 0);
        $this->getJson('/api/member4/payments?student_id='.$this->first->id.'&invoice_id='.$this->secondBill->id)->assertJsonPath('meta.total', 0);
        $this->getJson('/api/member4/payments?student_id=invalid')->assertUnprocessable();
        $this->getJson('/api/member4/payments?student_id=0')->assertUnprocessable();
        $studentUser = $this->account('murid');
        $this->first->update(['user_id' => $studentUser->id]);
        $this->actingAs($studentUser, 'sanctum');
        $this->getJson('/api/member4/payments?student_id='.$this->first->id)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/member4/payments?student_id='.$this->second->id)->assertJsonPath('meta.total', 0);
    }

    public function test_non_parent_roles_cannot_use_portal_even_when_authenticated(): void
    {
        foreach ([$this->admin, $this->account('murid'), $this->account('guru')] as $user) {
            $this->actingAs($user, 'sanctum');
            foreach (['', 'dashboard', 'grades', 'attendance', 'assignments', 'progress', 'schedules'] as $suffix) $this->getJson($this->path($this->first, $suffix))->assertForbidden();
            $this->getJson('/api/member4/parent/children')->assertForbidden();
        }
    }

    public function test_inactive_guardian_unlinked_account_and_inactive_user_are_rejected(): void
    {
        $this->actingAs($this->account('wali_murid'), 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson($this->path($this->first, 'dashboard'))->assertNotFound();
        $this->guardian->update(['status' => 'inactive']);
        $this->actingAs($this->parentUser, 'sanctum');
        $this->getJson('/api/member4/parent/children')->assertJsonPath('meta.total', 0);
        $this->getJson($this->path($this->first, 'grades'))->assertNotFound();
        $this->parentUser->update(['status' => 'inactive']);
        $this->getJson($this->path($this->first, 'dashboard'))->assertForbidden();
    }

    public function test_portal_is_read_only_and_parent_cannot_verify_payments(): void
    {
        $this->actingAs($this->parentUser, 'sanctum');
        foreach (['', 'grades', 'attendance', 'assignments', 'progress', 'schedules'] as $suffix) {
            $this->postJson($this->path($this->first, $suffix), [])->assertStatus(405);
            $this->patchJson($this->path($this->first, $suffix), [])->assertStatus(405);
        }
        $payment = $this->secondBill->payments()->value('id');
        $this->patchJson('/api/member4/payments/'.$payment.'/verification', ['decision' => 'verified'])->assertForbidden();
        $this->patchJson('/api/schedules/1', [])->assertForbidden();
        $this->assertSame('pending', Payment::find($payment)->status);
    }

    public function test_portal_requires_existing_authenticated_session(): void
    {
        foreach (['dashboard', 'grades', 'attendance', 'assignments', 'progress', 'schedules'] as $suffix) $this->getJson($this->path($this->first, $suffix))->assertUnauthorized();
    }

    public function test_schedules_and_class_information_follow_existing_year_and_semester_relationships(): void
    {
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30']);
        $otherYear = AcademicYear::create(['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30']);
        $semester = Semester::create(['name' => 'Ganjil', 'academic_year_id' => $year->id]);
        $otherSemester = Semester::create(['name' => 'Genap', 'academic_year_id' => $year->id]);
        $department = \App\Models\Department::create(['name' => 'Program Uji', 'code' => 'PORTAL-D']);
        $program = \App\Models\StudyProgram::create(['department_id' => $department->id, 'name' => 'Konsentrasi Uji', 'code' => 'PORTAL-P']);
        $class = Classroom::create(['name' => 'X Uji', 'level' => '10', 'study_program_id' => $program->id, 'academic_year_id' => $year->id]);
        $otherClass = Classroom::create(['name' => 'XI Lain', 'level' => '11', 'study_program_id' => $program->id, 'academic_year_id' => $year->id]);
        $teacher = Teacher::create(['name' => 'Guru Jadwal', 'teacher_number' => 'PORTAL-GURU', 'email' => 'private@example.test']);
        $subject = Subject::create(['name' => 'Matematika', 'code' => 'PORTAL-MTK']);
        $room = Room::create(['name' => 'Ruang Uji', 'code' => 'PORTAL-R', 'capacity' => 36]);
        $placement = ClassStudent::create(['student_id' => $this->first->id, 'classroom_id' => $class->id, 'academic_year_id' => $year->id, 'semester_id' => $semester->id, 'status' => 'active']);
        $base = ['subject_id' => $subject->id, 'classroom_id' => $class->id, 'teacher_id' => $teacher->id, 'room_id' => $room->id, 'academic_year_id' => $year->id, 'semester_id' => $semester->id, 'start_time' => '07:00', 'end_time' => '08:00', 'day' => 'friday', 'status' => 'active'];
        Schedule::create($base);
        $monday = Schedule::create(array_replace($base, ['day' => 'monday']));
        Schedule::create(array_replace($base, ['classroom_id' => $otherClass->id]));
        Schedule::create(array_replace($base, ['academic_year_id' => $otherYear->id]));
        Schedule::create(array_replace($base, ['semester_id' => $otherSemester->id]));
        Schedule::create(array_replace($base, ['status' => 'inactive']));
        $this->actingAs($this->parentUser, 'sanctum');
        $this->getJson($this->path($this->first))->assertOk()->assertJsonPath('data.placements.0.classroom.name', 'X Uji')->assertJsonPath('data.placements.0.academic_year.name', '2026/2027');
        $url = $this->path($this->first, 'schedules');
        $this->getJson($url)->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.id', $monday->id)->assertJsonPath('data.0.room.name', 'Ruang Uji')->assertJsonMissingPath('data.0.teacher.email');
        $this->getJson($this->path($this->first, 'dashboard'))->assertJsonPath('data.schedule_count', 2);
        $this->getJson($url.'?academic_year_id='.$otherYear->id)->assertJsonPath('meta.total', 0);
        $this->getJson($url.'?semester_id=invalid')->assertUnprocessable();
        $this->getJson($url.'?page=0')->assertUnprocessable();
        $placement->update(['semester_id' => null]);
        $this->getJson($url)->assertJsonPath('meta.total', 3);
        $placement->update(['status' => 'inactive']);
        $this->getJson($url)->assertJsonPath('meta.total', 0);
        $this->getJson($this->path($this->first))->assertJsonCount(0, 'data.placements');
    }
}
