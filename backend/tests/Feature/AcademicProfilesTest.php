<?php

namespace Tests\Feature;

use App\Models\{Role, Student, Teacher, User};
use App\Services\AcademicProfiles;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicProfilesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function account(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), 'status' => 'active', 'password' => 'password123']);
    }

    private function admin(): void { $this->actingAs($this->account('admin')); }

    public function test_all_roles_can_use_one_login_but_academic_admin_stays_protected(): void
    {
        foreach (['admin', 'guru', 'murid', 'wali_murid'] as $role) {
            $user = $this->account($role);
            $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123'])->assertOk();
            $headers = ['Authorization' => 'Bearer '.$response->json('token')];
            $this->app['auth']->forgetGuards();
            $result = $this->getJson('/api/users', $headers);
            $role === 'admin' ? $result->assertOk() : $result->assertForbidden();
            $this->app['auth']->forgetGuards();
            if ($role === 'admin') $this->getJson('/api/lms/courses', $headers)->assertForbidden();
            if ($role === 'guru') $this->getJson('/api/member4/finance/summary', $headers)->assertForbidden();
            $this->app['auth']->forgetGuards();
        }
    }

    public function test_user_creation_also_creates_a_profile_and_repeated_sync_keeps_the_same_record(): void
    {
        $this->admin();
        foreach (['murid' => Student::class, 'guru' => Teacher::class] as $role => $model) {
            $userId = $this->postJson('/api/users', ['name' => 'Akun '.$role, 'email' => $role.'@example.test', 'password' => 'password123', 'role' => $role])->assertCreated()->json('data.id');
            $profile = $model::where('user_id', $userId)->firstOrFail();
            $field = $role === 'murid' ? 'student_number' : 'teacher_number';
            $profile->update([$field => 'RESMI-'.$role]);
            $this->putJson('/api/users/'.$userId, ['name' => 'Nama baru'])->assertOk();
            $this->assertSame(1, $model::where('user_id', $userId)->count());
            $this->assertSame('RESMI-'.$role, $profile->fresh()->$field);
            $this->assertSame('Nama baru', $profile->fresh()->name);
        }
    }

    public function test_profile_edits_update_the_linked_account_and_status_endpoint_updates_profile(): void
    {
        $this->admin();
        $id = $this->postJson('/api/users', ['name' => 'Guru', 'email' => 'teacher@example.test', 'password' => 'password123', 'role' => 'guru'])->assertCreated()->json('data.id');
        $profile = Teacher::where('user_id', $id)->firstOrFail();
        $this->putJson('/api/teachers/'.$profile->id, ['name' => 'Guru baru', 'email' => 'teacher2@example.test', 'teacher_number' => 'NIP-RESMI'])->assertOk();
        $this->assertDatabaseHas('users', ['id' => $id, 'name' => 'Guru baru', 'email' => 'teacher2@example.test']);
        $this->patchJson('/api/users/'.$id.'/status', ['status' => 'inactive'])->assertOk();
        $this->assertSame('inactive', $profile->fresh()->status);
        $this->patchJson('/api/users/'.$id.'/status', ['status' => 'active'])->assertOk();
        $this->assertSame('active', $profile->fresh()->status);
        $this->assertSame('NIP-RESMI', $profile->fresh()->teacher_number);
    }

    public function test_role_changes_preserve_and_deactivate_old_academic_history(): void
    {
        $this->admin();
        $id = $this->postJson('/api/users', ['name' => 'Pengguna', 'email' => 'change@example.test', 'password' => 'password123', 'role' => 'murid'])->assertCreated()->json('data.id');
        $studentId = Student::where('user_id', $id)->value('id');
        $this->putJson('/api/users/'.$id, ['role' => 'guru'])->assertOk();
        $this->assertDatabaseHas('students', ['id' => $studentId, 'status' => 'inactive']);
        $this->assertDatabaseHas('teachers', ['user_id' => $id, 'status' => 'active']);
        $this->putJson('/api/users/'.$id, ['role' => 'murid'])->assertOk();
        $this->assertSame($studentId, Student::where('user_id', $id)->value('id'));
        $this->assertDatabaseHas('teachers', ['user_id' => $id, 'status' => 'inactive']);
    }

    public function test_reconciliation_links_existing_teacher_by_unique_email_and_does_not_guess_student_names(): void
    {
        $teacher = $this->account('guru');
        $student = $this->account('murid');
        $profile = Teacher::create(['name' => $teacher->name, 'email' => $teacher->email, 'teacher_number' => 'NIP-EXISTING']);
        $unrelated = Student::create(['name' => $student->name, 'student_number' => 'NIS-UNRELATED']);
        $this->artisan('academic:sync-users')->assertSuccessful();
        $this->assertNull($profile->fresh()->user_id);
        $this->artisan('academic:sync-users', ['--apply' => true])->assertSuccessful();
        $this->artisan('academic:sync-users', ['--apply' => true])->assertSuccessful();
        $this->assertSame($teacher->id, $profile->fresh()->user_id);
        $this->assertSame('NIP-EXISTING', $profile->fresh()->teacher_number);
        $this->assertNull($unrelated->fresh()->user_id);
        $this->assertSame(1, Student::where('user_id', $student->id)->count());
    }

    public function test_sync_conflict_rolls_back_both_account_and_profile_updates(): void
    {
        $this->admin();
        $id = $this->postJson('/api/users', ['name' => 'Guru', 'email' => 'first@example.test', 'password' => 'password123', 'role' => 'guru'])->assertCreated()->json('data.id');
        Teacher::create(['name' => 'Guru lain', 'email' => 'occupied@example.test', 'teacher_number' => 'NIP-OTHER']);
        $this->putJson('/api/users/'.$id, ['name' => 'Jangan tersimpan', 'email' => 'occupied@example.test'])->assertStatus(409);
        $this->assertDatabaseHas('users', ['id' => $id, 'name' => 'Guru', 'email' => 'first@example.test']);
        $this->assertDatabaseHas('teachers', ['user_id' => $id, 'name' => 'Guru', 'email' => 'first@example.test']);
    }

    public function test_student_profile_edits_keep_account_connected_and_preserve_graduation(): void
    {
        $this->admin();
        $id = $this->postJson('/api/users', ['name' => 'Siswa', 'email' => 'student@example.test', 'password' => 'password123', 'role' => 'murid'])->assertCreated()->json('data.id');
        $profile = Student::where('user_id', $id)->firstOrFail();
        $this->putJson('/api/students/'.$profile->id, ['name' => 'Siswa lulus', 'student_number' => 'NIS-42', 'status' => 'graduated'])->assertOk();
        $this->assertDatabaseHas('users', ['id' => $id, 'name' => 'Siswa lulus', 'status' => 'inactive']);
        app(AcademicProfiles::class)->sync(User::findOrFail($id));
        $this->assertSame('graduated', $profile->fresh()->status);
        $this->deleteJson('/api/students/'.$profile->id)->assertUnprocessable();
    }

    public function test_profile_cannot_be_linked_to_an_account_with_wrong_role(): void
    {
        $this->admin();
        $teacher = $this->account('guru');
        $this->postJson('/api/students', ['name' => 'Salah', 'student_number' => 'S-1', 'user_id' => $teacher->id])->assertUnprocessable();
        $this->assertDatabaseMissing('students', ['student_number' => 'S-1']);
    }
}
