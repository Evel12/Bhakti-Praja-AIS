<?php

namespace Tests\Feature;

use App\Jobs\Member4\DeliverNotificationEmail;
use App\Mail\Member4\PortalNotificationMail;
use App\Models\{Announcement, Guardian, Invoice, PortalNotification, Role, Student, User};
use App\Services\Member4\{CommunicationService, NotificationAccess};
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Mail, Queue};
use Tests\TestCase;

class Member4CommunicationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $teacher;
    private User $pupil;
    private User $parentUser;
    private User $otherParent;
    private Guardian $guardian;
    private Student $child;
    private Invoice $bill;

    protected function setUp(): void
    {
        parent::setUp();
        config(['member4_communication.email_enabled' => false]);
        $this->seed(RoleSeeder::class);
        $this->admin = $this->account('admin');
        $this->teacher = $this->account('guru');
        $this->pupil = $this->account('murid');
        $this->parentUser = $this->account('wali_murid');
        $this->otherParent = $this->account('wali_murid');
        $this->child = Student::create(['user_id' => $this->pupil->id, 'student_number' => 'COMM-001', 'name' => 'Anak Komunikasi', 'status' => 'active']);
        $this->guardian = Guardian::create(['user_id' => $this->parentUser->id, 'name' => 'Wali Komunikasi', 'status' => 'active']);
        $this->guardian->students()->attach($this->child->id, ['relationship' => 'wali']);
        $this->bill = Invoice::create(['student_id' => $this->child->id, 'created_by' => $this->admin->id, 'invoice_type' => 'spp', 'amount' => '125000.25', 'due_date' => now()->subDay()->toDateString()]);
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active', 'password' => 'password123']);
    }

    private function announce(string $role = 'all'): int
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson('/api/member4/announcements', ['title' => 'Informasi Sekolah', 'content' => 'Informasi administrasi.', 'target_role' => $role])->assertCreated()->json('data.id');
    }

    private function remind()
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson('/api/member4/invoices/'.$this->bill->id.'/reminders');
    }

    public function test_teacher_uses_existing_auth_with_communication_context_only(): void
    {
        $this->postJson('/api/auth/login', ['email' => $this->teacher->email, 'password' => 'password123', 'portal' => 'communication'])->assertOk()->assertJsonPath('data.role', 'guru');
        foreach (['ais', 'member4'] as $portal) $this->postJson('/api/auth/login', ['email' => $this->teacher->email, 'password' => 'password123', 'portal' => $portal])->assertForbidden();
        $this->actingAs($this->teacher, 'sanctum');
        $this->getJson('/api/member4/announcements')->assertOk();
        $this->getJson('/api/member4/notifications')->assertOk();
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/member4/invoices')->assertForbidden();
    }

    public function test_announcements_notify_only_active_target_roles_and_withdraw_on_audience_change(): void
    {
        $id = $this->announce('murid');
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->pupil->id, 'source_id' => $id, 'category' => 'announcement', 'email_status' => 'skipped']);
        $this->actingAs($this->parentUser, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
        $this->actingAs($this->admin, 'sanctum')->patchJson('/api/member4/announcements/'.$id, ['target_role' => 'guru', 'content' => 'Informasi guru.'])->assertOk();
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->teacher->id, 'message' => 'Informasi guru.']);
        $this->actingAs($this->pupil, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
        $this->actingAs($this->teacher, 'sanctum')->getJson('/api/member4/announcements/'.$id)->assertOk();
        $this->actingAs($this->admin, 'sanctum')->deleteJson('/api/member4/announcements/'.$id)->assertOk();
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_all_roles_audience_excludes_inactive_accounts_and_identical_edits_do_not_duplicate(): void
    {
        $inactive = $this->account('murid');
        $inactive->update(['status' => 'inactive']);
        $id = $this->announce();
        $this->assertDatabaseCount('notifications', 5);
        $this->assertDatabaseMissing('notifications', ['user_id' => $inactive->id]);
        $this->patchJson('/api/member4/announcements/'.$id, ['title' => 'Informasi Sekolah'])->assertOk();
        $this->assertDatabaseCount('notifications', 5);
        $this->actingAs($this->teacher, 'sanctum');
        $this->postJson('/api/member4/announcements', [])->assertForbidden();
        $this->patchJson('/api/member4/announcements/'.$id, ['content' => 'Diubah guru'])->assertForbidden();
    }

    public function test_payment_reminders_are_owned_deduplicated_and_do_not_modify_finance(): void
    {
        $this->remind()->assertOk()->assertJsonPath('data.created', 2);
        $this->remind()->assertOk()->assertJsonPath('data.created', 0);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertSame('unpaid', $this->bill->fresh()->status);
        $this->assertDatabaseCount('payments', 0);
        foreach ([$this->pupil, $this->parentUser] as $user) {
            $this->actingAs($user, 'sanctum')->getJson('/api/member4/notifications?category=payment_reminder')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.source_id', $this->bill->id);
            $this->postJson('/api/member4/invoices/'.$this->bill->id.'/reminders')->assertForbidden();
        }
        $this->actingAs($this->otherParent, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
    }

    public function test_reminder_access_is_revoked_after_detachment_and_payment(): void
    {
        $this->remind()->assertOk();
        $parentNotification = PortalNotification::where('user_id', $this->parentUser->id)->firstOrFail();
        $this->guardian->students()->detach();
        $this->actingAs($this->parentUser, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
        $this->patchJson('/api/member4/notifications/'.$parentNotification->id.'/read')->assertNotFound();
        $this->bill->status = 'paid'; $this->bill->save();
        $this->actingAs($this->pupil, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
        $this->remind()->assertConflict();
    }

    public function test_no_unrelated_or_wrong_role_recipient_is_created(): void
    {
        $this->guardian->update(['status' => 'inactive']);
        $this->child->update(['user_id' => $this->teacher->id]);
        $this->remind()->assertOk()->assertJsonPath('data.created', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_notification_read_and_filters_never_accept_another_user_identity(): void
    {
        $this->remind()->assertOk();
        $own = PortalNotification::where('user_id', $this->parentUser->id)->firstOrFail();
        $other = PortalNotification::where('user_id', $this->pupil->id)->firstOrFail();
        $this->actingAs($this->parentUser, 'sanctum');
        $this->patchJson('/api/member4/notifications/'.$other->id.'/read', ['user_id' => $this->pupil->id])->assertNotFound();
        $this->patchJson('/api/member4/notifications/'.$own->id.'/read')->assertOk()->assertJsonPath('data.is_read', true);
        $this->getJson('/api/member4/notifications?is_read=0')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/member4/notifications?category=invalid')->assertUnprocessable();
        $this->getJson('/api/member4/notifications?per_page=101')->assertUnprocessable();
        $this->assertFalse($other->fresh()->is_read);
    }

    public function test_email_disabled_or_log_transport_does_not_claim_delivery(): void
    {
        Queue::fake(); Mail::fake();
        $this->announce('guru');
        $this->assertDatabaseHas('notifications', ['email_status' => 'skipped']);
        Queue::assertNothingPushed(); Mail::assertNothingSent();
        config(['member4_communication.email_enabled' => true, 'mail.default' => 'log']);
        $this->remind()->assertOk();
        $this->assertDatabaseMissing('notifications', ['email_status' => 'sent']);
        Queue::assertNothingPushed();
    }

    public function test_email_delivery_job_uses_current_recipient_and_handles_duplicate_jobs(): void
    {
        Queue::fake(); Mail::fake();
        config(['member4_communication.email_enabled' => true, 'mail.default' => 'smtp']);
        $this->announce('guru');
        $item = PortalNotification::firstOrFail();
        $this->assertSame('pending', $item->email_status);
        Queue::assertPushed(DeliverNotificationEmail::class, fn ($job) => $job->notificationId === $item->id && $job->contentHash !== null);
        $job = new DeliverNotificationEmail($item->id);
        $job->handle(app(NotificationAccess::class));
        $job->handle(app(NotificationAccess::class));
        Mail::assertSent(PortalNotificationMail::class, fn ($mail) => $mail->hasTo($this->teacher->email));
        Mail::assertSentCount(1);
        $this->assertSame('sent', $item->fresh()->email_status);
        $this->assertNotNull($item->fresh()->email_sent_at);
    }

    public function test_queued_email_skips_revoked_recipient_and_stale_content(): void
    {
        Queue::fake(); Mail::fake();
        config(['member4_communication.email_enabled' => true, 'mail.default' => 'smtp']);
        $this->remind()->assertOk();
        $item = PortalNotification::where('user_id', $this->parentUser->id)->firstOrFail();
        $oldHash = hash('sha256', $item->title."\0".$item->message);
        $item->message = 'Isi diperbarui.'; $item->save();
        $oldJob = new DeliverNotificationEmail($item->id, $oldHash);
        $oldJob->handle(app(NotificationAccess::class));
        $oldJob->failed(new \RuntimeException('Gagal lama'));
        $this->assertSame('pending', $item->fresh()->email_status);
        $this->guardian->students()->detach();
        (new DeliverNotificationEmail($item->id))->handle(app(NotificationAccess::class));
        Mail::assertNothingSent();
        $this->assertSame('skipped', $item->fresh()->email_status);
        $this->announce('all');
        $teacherItem = PortalNotification::where('category', 'announcement')->where('user_id', $this->teacher->id)->firstOrFail();
        $this->teacher->role->update(['name' => 'unrecognized']);
        (new DeliverNotificationEmail($teacherItem->id))->handle(app(NotificationAccess::class));
        $this->assertSame('skipped', $teacherItem->fresh()->email_status);
        Mail::assertNothingSent();
    }

    public function test_mail_failure_preserves_in_app_notification_and_tracks_exhausted_delivery(): void
    {
        Queue::fake();
        config(['member4_communication.email_enabled' => true, 'mail.default' => 'smtp']);
        $this->announce('guru');
        $item = PortalNotification::firstOrFail();
        Mail::shouldReceive('to')->once()->with($this->teacher->email)->andThrow(new \RuntimeException('SMTP tidak tersedia'));
        $job = new DeliverNotificationEmail($item->id);
        try { $job->handle(app(NotificationAccess::class)); $this->fail('Pengiriman seharusnya gagal.'); }
        catch (\RuntimeException $e) { $this->assertSame('SMTP tidak tersedia', $e->getMessage()); }
        $this->assertSame('pending', $item->fresh()->email_status);
        $job->failed(new \RuntimeException('Batas percobaan tercapai'));
        $this->assertSame('failed', $item->fresh()->email_status);
        $this->actingAs($this->teacher, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 1);
        Mail::swap(new \Illuminate\Mail\MailManager($this->app));
        Mail::fake();
        $job->handle(app(NotificationAccess::class));
        Mail::assertSentCount(1);
        $this->assertSame('sent', $item->fresh()->email_status);
    }

    public function test_email_template_escapes_untrusted_text_and_legacy_records_remain_visible(): void
    {
        $html = (new PortalNotificationMail('<script>alert(1)</script>', '<img src=x onerror=alert(1)>'))->render();
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        PortalNotification::create(['user_id' => $this->teacher->id, 'title' => 'Notifikasi lama', 'message' => 'Tetap tersedia']);
        $this->actingAs($this->teacher, 'sanctum')->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.category', null);
    }

    public function test_new_reminder_endpoint_requires_authentication_and_cannot_create_academic_data(): void
    {
        $this->postJson('/api/member4/invoices/'.$this->bill->id.'/reminders')->assertUnauthorized();
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/member4/invoices/999999/reminders')->assertNotFound();
        $this->postJson('/api/member4/notifications', ['user_id' => $this->teacher->id])->assertStatus(405);
    }

    public function test_announcement_notification_access_tracks_current_role_and_source(): void
    {
        $id = $this->announce('guru');
        $item = PortalNotification::firstOrFail();
        $this->teacher->update(['role_id' => Role::where('name', 'murid')->value('id')]);
        $this->teacher->unsetRelation('role');
        $this->actingAs($this->teacher, 'sanctum');
        $this->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
        $this->patchJson('/api/member4/notifications/'.$item->id.'/read')->assertNotFound();
        Announcement::find($id)->delete();
        $this->getJson('/api/member4/notifications')->assertJsonPath('meta.total', 0);
    }

    public function test_multibyte_announcement_content_respects_mysql_text_capacity(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $tooLarge = str_repeat("\u{1F600}", 17000);
        $response = $this->postJson('/api/member4/announcements', ['title' => 'Batas penyimpanan', 'content' => $tooLarge, 'target_role' => 'guru']);
        $this->assertSame(422, $response->status(), 'Input di bawah batas karakter tetapi melebihi kapasitas byte TEXT harus ditolak sebelum query database.');
        $this->assertDatabaseCount('announcements', 0);
        $this->assertDatabaseCount('notifications', 0);
        $id = $this->announce('guru');
        $this->patchJson('/api/member4/announcements/'.$id, ['content' => $tooLarge])->assertUnprocessable()->assertJsonValidationErrors('content');
        $this->assertSame('Informasi administrasi.', Announcement::find($id)->content);
        $this->patchJson('/api/member4/announcements/'.$id, ['content' => ['invalid']])->assertUnprocessable();
        $this->patchJson('/api/member4/announcements/'.$id, ['content' => str_repeat("\u{1F600}", 15000)])->assertOk();
    }

    public function test_unexpected_member4_api_failure_never_exposes_debug_details(): void
    {
        config(['app.debug' => true]);
        $service = \Mockery::mock(CommunicationService::class);
        $service->shouldReceive('syncAnnouncement')->once()->andThrow(new \RuntimeException('SQLSTATE password=private-secret path=internal.php'));
        $this->app->instance(CommunicationService::class, $service);
        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/member4/announcements', ['title' => 'Kegagalan uji', 'content' => 'Isi valid', 'target_role' => 'guru']);
        $this->assertSame(500, $response->status());
        $this->assertSame('Layanan gagal memproses permintaan. Silakan coba kembali.', $response->json('message'));
        $response->assertExactJson(['success' => false, 'message' => 'Layanan gagal memproses permintaan. Silakan coba kembali.']);
        $this->assertDatabaseCount('announcements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_member4_http_errors_keep_status_and_headers_without_debug_trace(): void
    {
        config(['app.debug' => true]);
        $this->getJson('/api/member4/invoices')->assertUnauthorized()->assertExactJson(['success' => false, 'message' => 'Silakan masuk terlebih dahulu.']);
        $this->actingAs($this->teacher, 'sanctum');
        $this->getJson('/api/member4/invoices/not-a-number')->assertNotFound()->assertJsonMissingPath('trace')->assertJsonMissingPath('exception');
        $this->getJson('/api/member4')->assertNotFound()->assertJsonMissingPath('trace');
        $this->postJson('/api/member4/notifications')->assertStatus(405)->assertHeader('Allow')->assertJsonMissingPath('trace');
        $this->getJson('/api/member4/invoices')->assertForbidden();
    }
}
