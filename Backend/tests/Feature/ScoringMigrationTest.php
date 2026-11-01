<?php

namespace Tests\Feature;

use App\Models\Attempt;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ScoringMigrationTest extends TestCase
{
    use DatabaseMigrations;

    public function test_scoring_migration_preserves_existing_attempts_without_inventing_grades_or_rules(): void
    {
        $attempt = Attempt::factory()->create(['score' => '42.50']);
        // Exercise this migration directly; later phases can add newer migrations.
        $migration = require database_path('migrations/2026_10_30_000010_add_scoring_fields_to_attempts_table.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('attempts', 'final_grade'));
        $this->assertFalse(Schema::hasColumn('attempts', 'scoring_rules'));
        $this->assertSame('42.50', $attempt->fresh()->score);

        $migration->up();
        $this->assertTrue(Schema::hasColumn('attempts', 'final_grade'));
        $this->assertTrue(Schema::hasColumn('attempts', 'scoring_rules'));
        $preserved = $attempt->fresh();
        $this->assertSame('42.50', $preserved->score);
        $this->assertSame($attempt->student_id, $preserved->student_id);
        $this->assertTrue($attempt->started_at->equalTo($preserved->started_at));
        $this->assertNull($preserved->final_grade);
        $this->assertNull($preserved->scoring_rules);
    }

    public function test_rollback_refuses_to_truncate_game_points(): void
    {
        $attempt = Attempt::factory()->create(['score' => '1200.00']);
        $migration = require database_path('migrations/2026_10_30_000010_add_scoring_fields_to_attempts_table.php');

        try {
            $migration->down();
            $this->fail('Expected rollback to refuse an unrepresentable score.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('Cannot narrow attempt scores', $exception->getMessage());
            $this->assertSame('1200.00', $attempt->fresh()->score);
            $this->assertTrue(Schema::hasColumn('attempts', 'final_grade'));
            $this->assertTrue(Schema::hasColumn('attempts', 'scoring_rules'));
        } finally {
            // DatabaseMigrations also rolls back in teardown; keep test cleanup representable.
            $attempt->score = '0.00';
            $attempt->save();
        }
    }
}
