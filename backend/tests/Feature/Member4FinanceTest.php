<?php

namespace Tests\Feature;

use App\Models\{Guardian, Invoice, Payment, Role, Student, User};
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Member4FinanceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $pupil;
    private User $parent;
    private User $stranger;
    private User $teacher;
    private Student $child;
    private Invoice $bill;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->pupil = $this->account('murid');
        $this->parent = $this->account('wali_murid');
        $this->stranger = $this->account('wali_murid');
        $this->teacher = $this->account('guru');
        $this->child = Student::create(['user_id' => $this->pupil->id, 'name' => 'Siswa Keuangan', 'student_number' => 'FIN-001', 'status' => 'active']);
        $guardian = Guardian::create(['user_id' => $this->parent->id, 'name' => 'Wali Keuangan', 'status' => 'active']);
        $guardian->students()->attach($this->child->id, ['relationship' => 'wali']);
        $this->bill = $this->invoice('125000.25', now()->subDay()->toDateString());
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active']);
    }

    private function invoice(string $amount, string $dueDate): Invoice
    {
        return Invoice::create(['student_id' => $this->child->id, 'created_by' => $this->admin->id, 'invoice_type' => 'spp', 'amount' => $amount, 'due_date' => $dueDate]);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace(['amount' => '125000.25', 'payment_date' => now()->toDateString(), 'payment_method' => 'Transfer bank', 'transaction_number' => 'FIN-TEST', 'proof' => UploadedFile::fake()->createWithContent('bukti.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF")], $overrides);
    }

    private function submit(User $user, ?Invoice $bill = null, array $overrides = [])
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/member4/invoices/'.($bill ?? $this->bill)->id.'/payments', $this->payload($overrides));
    }

    private function decide(int $id, string $decision)
    {
        return $this->actingAs($this->admin, 'sanctum')->patchJson('/api/member4/payments/'.$id.'/verification', ['decision' => $decision]);
    }

    public function test_upload_stays_pending_and_verification_updates_invoice_exactly_once(): void
    {
        $id = $this->submit($this->pupil)->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonMissingPath('data.proof_path')->json('data.id');
        $payment = Payment::findOrFail($id);
        Storage::disk('local')->assertExists($payment->proof_path);
        $this->assertSame($this->pupil->id, $payment->submitted_by);
        $this->assertSame('unpaid', $this->bill->fresh()->status);
        $this->getJson('/api/member4/invoices/'.$this->bill->id)->assertJsonPath('data.outstanding_amount', '125000.25')->assertJsonPath('data.pending_payments_count', 1);
        $this->submit($this->parent)->assertConflict();
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->decide($id, 'verified')->assertOk()->assertJsonPath('data.invoice.status', 'paid')->assertJsonPath('data.invoice.outstanding_amount', '0.00');
        $verifiedAt = $payment->fresh()->verified_at;
        $this->decide($id, 'verified')->assertOk();
        $this->assertEquals($verifiedAt, $payment->fresh()->verified_at);
        $this->decide($id, 'rejected')->assertConflict();
        $this->submit($this->parent)->assertConflict();
        $this->assertSame($this->admin->id, $payment->fresh()->verified_by);
        $this->assertSame('paid', $this->bill->fresh()->status);
    }

    public function test_rejected_payment_does_not_count_and_parent_can_resubmit(): void
    {
        $id = $this->submit($this->parent)->assertCreated()->json('data.id');
        $this->decide($id, 'rejected')->assertOk();
        $this->assertSame('unpaid', $this->bill->fresh()->status);
        $this->assertSame('125000.25', $this->bill->fresh()->outstanding_amount);
        $next = $this->submit($this->pupil)->assertCreated()->json('data.id');
        $this->decide($next, 'verified')->assertOk();
        foreach ([$this->parent, $this->pupil, $this->admin] as $user) {
            $this->actingAs($user, 'sanctum')->getJson('/api/member4/payments?invoice_id='.$this->bill->id)->assertOk()->assertJsonPath('meta.total', 2);
        }
    }

    public function test_ownership_and_roles_protect_submission_proofs_history_and_reports(): void
    {
        $id = $this->submit($this->pupil)->assertCreated()->json('data.id');
        $this->submit($this->stranger)->assertNotFound();
        $this->submit($this->admin)->assertForbidden();
        $this->submit($this->teacher)->assertForbidden();
        $this->actingAs($this->stranger, 'sanctum');
        $this->getJson('/api/member4/payments/'.$id.'/proof')->assertNotFound();
        $this->getJson('/api/member4/payments')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/member4/finance/summary')->assertJsonPath('data.invoice_count', 0)->assertJsonPath('data.outstanding_amount', '0.00');
        foreach ([$this->pupil, $this->parent, $this->stranger, $this->teacher] as $user) {
            $this->actingAs($user, 'sanctum');
            $this->patchJson('/api/member4/payments/'.$id.'/verification', ['decision' => 'verified'])->assertForbidden();
            $this->getJson('/api/member4/finance/reports')->assertForbidden();
        }
        foreach ([$this->pupil, $this->parent, $this->admin] as $user) {
            $this->actingAs($user, 'sanctum')->get('/api/member4/payments/'.$id.'/proof', ['Accept' => 'application/json'])->assertOk()->assertHeader('Content-Type', 'application/pdf')->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        }
        $this->parent->update(['status' => 'inactive']);
        $this->actingAs($this->parent, 'sanctum')->getJson('/api/member4/payments/'.$id.'/proof')->assertForbidden();
    }

    public function test_upload_validation_rejects_spoofing_oversize_and_invalid_amounts(): void
    {
        foreach ([
            ['proof' => null],
            ['proof' => UploadedFile::fake()->createWithContent('bukti.pdf', '<script>bad</script>')],
            ['proof' => UploadedFile::fake()->createWithContent('bukti.exe', "%PDF-1.4\n%%EOF")],
            ['proof' => UploadedFile::fake()->create('besar.pdf', 2049, 'application/pdf')],
            ['amount' => '1.00'], ['amount' => '125000.251'], ['amount' => '-1'],
            ['payment_date' => now(config('member4_finance.timezone'))->addDay()->toDateString()],
            ['payment_date' => '2026-02-30'], ['payment_method' => ''],
            ['status' => null], ['verified_by' => $this->admin->id], ['submitted_by' => $this->admin->id], ['proof_path' => 'evil'],
        ] as $index => $payload) {
            $response = $this->submit($this->pupil, null, $payload);
            $this->assertSame(422, $response->status(), 'Kasus validasi '.$index.': '.$response->getContent());
        }
        $this->assertDatabaseCount('payments', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_image_evidence_is_accepted_and_missing_evidence_is_handled(): void
    {
        // A real 1x1 PNG, independent of the optional GD extension.
        $image = UploadedFile::fake()->createWithContent('bukti.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII='));
        $id = $this->submit($this->parent, null, ['proof' => $image])->assertCreated()->json('data.id');
        $this->getJson('/api/member4/payments/'.$id.'/proof')->assertOk()->assertHeader('Content-Type', 'image/png');
        Storage::disk('local')->delete(Payment::find($id)->proof_path);
        $this->getJson('/api/member4/payments/'.$id.'/proof')->assertNotFound();
        $this->decide($id, 'verified')->assertConflict();
        $this->decide($id, 'rejected')->assertOk();
    }

    public function test_outstanding_reports_use_verified_payments_and_local_deadlines(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 1)->setTime(0, 30)->timezone('Asia/Jakarta'));
        $today = now(config('member4_finance.timezone'))->toDateString();
        $this->bill->update(['due_date' => now(config('member4_finance.timezone'))->subDay()->toDateString()]);
        $dueToday = $this->invoice('100.10', $today);
        $paid = $this->invoice('200.20', $today);
        $id = $this->submit($this->parent, $paid, ['amount' => '200.20'])->assertCreated()->json('data.id');
        $this->decide($id, 'verified')->assertOk();
        $id = $this->submit($this->pupil)->assertCreated()->json('data.id');
        $this->actingAs($this->admin, 'sanctum');
        $summary = $this->getJson('/api/member4/finance/summary')->assertOk()->assertJsonPath('data.invoice_count', 3)->assertJsonPath('data.billed_amount', '125300.55')->assertJsonPath('data.verified_amount', '200.20')->assertJsonPath('data.outstanding_amount', '125100.35')->assertJsonPath('data.overdue_amount', '125000.25')->assertJsonPath('data.overdue_count', 1)->assertJsonPath('data.pending_payment_count', 1)->json('data');
        $this->getJson('/api/member4/finance/reports')->assertOk()->assertJsonPath('data.summary.outstanding_amount', $summary['outstanding_amount'])->assertJsonCount(5, 'data.by_type')->assertJsonPath('data.by_type.0.verified_amount', '200.20');
        $this->getJson('/api/member4/invoices?outstanding=1')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/member4/invoices?overdue=1')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $this->bill->id);
        $this->getJson('/api/member4/invoices/'.$dueToday->id)->assertJsonPath('data.is_overdue', false);
        $this->getJson('/api/member4/invoices?search=FIN-001')->assertJsonPath('meta.total', 3);
        $this->getJson('/api/member4/invoices?overdue=invalid')->assertUnprocessable();
        $this->decide($id, 'rejected')->assertOk();
        $this->getJson('/api/member4/finance/summary')->assertJsonPath('data.outstanding_amount', '125100.35')->assertJsonPath('data.rejected_payment_count', 1);
    }

    public function test_verification_rejects_tampered_metadata_and_inconsistent_amounts(): void
    {
        $id = $this->submit($this->parent)->assertCreated()->json('data.id');
        $this->actingAs($this->admin, 'sanctum');
        foreach ([['decision' => 'paid'], ['decision' => 'verified', 'status' => 'verified'], ['decision' => 'verified', 'verified_by' => null], ['decision' => 'verified', 'amount' => '1']] as $payload) {
            $this->patchJson('/api/member4/payments/'.$id.'/verification', $payload)->assertUnprocessable();
        }
        Payment::find($id)->update(['amount' => '1.00']);
        $this->decide($id, 'verified')->assertConflict();
        $this->assertSame('unpaid', $this->bill->fresh()->status);
        $this->decide($id, 'rejected')->assertOk();
    }

    public function test_unlinked_or_detached_parent_cannot_access_finances(): void
    {
        $id = $this->submit($this->pupil)->assertCreated()->json('data.id');
        Guardian::where('user_id', $this->parent->id)->first()->students()->detach();
        $this->submit($this->parent)->assertNotFound();
        $this->getJson('/api/member4/payments/'.$id)->assertNotFound();
        $this->getJson('/api/member4/finance/summary')->assertJsonPath('data.billed_amount', '0.00');
    }

    public function test_failed_payment_insert_removes_uploaded_file_and_rolls_back(): void
    {
        Payment::creating(function () { throw new \RuntimeException('Simulasi kegagalan penyimpanan'); });
        try {
            $this->submit($this->parent)->assertStatus(500)->assertExactJson(['success' => false, 'message' => 'Pembayaran gagal disimpan. Silakan coba kembali.']);
            $this->assertDatabaseCount('payments', 0);
            $this->assertSame([], Storage::disk('local')->allFiles());
            $this->assertSame('unpaid', $this->bill->fresh()->status);
        } finally {
            Payment::flushEventListeners();
        }
    }

    public function test_finance_workflows_require_authentication(): void
    {
        foreach (['/api/member4/finance/summary', '/api/member4/finance/reports', '/api/member4/payments/1/proof'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->postJson('/api/member4/invoices/'.$this->bill->id.'/payments', [])->assertUnauthorized();
        $this->patchJson('/api/member4/payments/1/verification', ['decision' => 'verified'])->assertUnauthorized();
    }

    public function test_large_totals_and_small_decimal_payments_keep_precision(): void
    {
        $maximum = $this->invoice('9999999999.99', now()->toDateString());
        $this->invoice('0.01', now()->toDateString());
        $small = $this->invoice('0.02', now()->toDateString());
        foreach ([$maximum, $small] as $invoice) {
            $id = $this->submit($this->parent, $invoice, ['amount' => $invoice->amount])->assertCreated()->json('data.id');
            $this->decide($id, 'verified')->assertOk();
        }
        $this->getJson('/api/member4/finance/summary')->assertOk()->assertJsonPath('data.billed_amount', '10000125000.27')->assertJsonPath('data.verified_amount', '10000000000.01')->assertJsonPath('data.outstanding_amount', '125000.26');
    }
}
