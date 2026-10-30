<?php

namespace Tests\Feature;

use App\Models\Curriculum;
use App\Models\Department;
use App\Models\Role;
use App\Models\StudyProgram;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\BhaktiPrajaSchoolSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BhaktiPrajaSchoolTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_school_profile_identifies_the_correct_school(): void
    {
        $this->getJson('/api/school-profile')->assertOk()
            ->assertJsonPath('data.npsn', '20322714')
            ->assertJsonPath('data.name', 'SMK Bhakti Praja Batang')
            ->assertJsonCount(3, 'data.programs')
            ->assertJsonCount(2, 'data.programs.1.concentrations')
            ->assertJsonPath('data.program_source_year', '2023/2024');
    }

    public function test_school_catalog_is_repeatable_and_preserves_admin_changes(): void
    {
        $this->seed(BhaktiPrajaSchoolSeeder::class);
        $this->assertSame(3, Department::count());
        $this->assertSame(4, StudyProgram::count());
        $this->assertSame(17, Subject::count());
        $this->assertSame(4, Curriculum::count());
        $this->assertSame(0, Subject::whereNotNull('credit_hours')->count());
        $this->assertSame(0, Curriculum::where('is_active', true)->count());
        $this->assertSame(0, Subject::where('status', 'active')->count());
        $this->assertDatabaseHas('departments', ['code' => 'BP-PPLG', 'name' => 'Pengembangan Perangkat Lunak dan Gim']);
        $automotive = Department::where('code', 'BP-TO')->firstOrFail();
        $this->assertSame(['BP-TKR', 'BP-TSM'], $automotive->studyPrograms()->orderBy('code')->pluck('code')->all());
        foreach (Curriculum::with('subjects')->get() as $curriculum) {
            $this->assertCount(12, $curriculum->subjects);
            $this->assertStringContainsString('bukan KOSP', $curriculum->notes);
            $this->assertNotNull($curriculum->source_url);
        }
        $subject = Subject::where('code', 'BP-MTK')->firstOrFail();
        $subject->update(['credit_hours' => 4, 'status' => 'active']);
        $curriculum = Curriculum::firstOrFail();
        $curriculum->update(['notes' => 'School administrator edit']);
        $curriculum->subjects()->detach($subject->id);
        $this->seed(BhaktiPrajaSchoolSeeder::class);
        $this->assertSame(17, Subject::count());
        $this->assertSame(4, $subject->fresh()->credit_hours);
        $this->assertSame('School administrator edit', $curriculum->fresh()->notes);
        $this->assertFalse($curriculum->subjects()->whereKey($subject->id)->exists());
        $this->assertDatabaseCount('classrooms', 0);
        $this->assertDatabaseCount('teachers', 0);
        $this->assertDatabaseCount('students', 0);
        $this->assertDatabaseCount('academic_years', 0);
    }

    public function test_unknown_jp_and_curriculum_source_can_be_saved(): void
    {
        $role = Role::create(['name' => 'admin', 'display_name' => 'Administrator']);
        $admin = User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
        $this->actingAs($admin, 'sanctum');
        $this->seed(BhaktiPrajaSchoolSeeder::class);
        $subject = $this->postJson('/api/subjects', ['code' => 'LOCAL', 'name' => 'Alokasi menyusul', 'credit_hours' => null])->assertCreated();
        $subject->assertJsonPath('data.credit_hours', null);
        $this->putJson('/api/subjects/'.$subject->json('data.id'), ['credit_hours' => 18])->assertOk();
        $this->putJson('/api/subjects/'.$subject->json('data.id'), ['credit_hours' => 0])->assertUnprocessable();
        $curriculum = Curriculum::firstOrFail();
        $this->putJson('/api/curricula/'.$curriculum->id, ['notes' => 'KOSP akan dilengkapi', 'source_url' => 'https://example.sch.id/kosp.pdf'])->assertOk()
            ->assertJsonPath('data.notes', 'KOSP akan dilengkapi')
            ->assertJsonPath('data.source_url', 'https://example.sch.id/kosp.pdf');
        $this->putJson('/api/curricula/'.$curriculum->id, ['source_url' => 'javascript:alert(1)'])->assertUnprocessable();
    }
}
