<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Models\Attempt;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LegacyAttemptTest extends TestCase
{
    use RefreshDatabase;

    public static function unavailableSnapshots(): array
    {
        return ['missing rules' => [null], 'unsupported rules' => [['version' => 999]]];
    }

    #[DataProvider('unavailableSnapshots')]
    public function test_legacy_attempts_fail_closed_without_mutating_saved_state(?array $snapshot): void
    {
        $attempt = Attempt::factory()->create(['score' => '12.34', 'scoring_rules' => $snapshot]);
        $question = Question::factory()->for($attempt->quiz)->withOptions()->create();
        $this->withToken($attempt->student->createToken('legacy-test')->plainTextToken);

        $this->getJson('/api/attempts/'.$attempt->id)->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
        $this->getJson('/api/attempts/'.$attempt->id.'/questions')->assertStatus(409);
        $this->postJson('/api/attempts/'.$attempt->id.'/answers', [
            'question_id' => $question->id, 'chosen_option_id' => $question->options->first()->id,
        ])->assertStatus(409);
        $this->postJson('/api/attempts/'.$attempt->id.'/finish')->assertStatus(409);

        $unchanged = $attempt->fresh();
        $this->assertSame('12.34', $unchanged->score);
        $this->assertSame(AttemptStatus::Ongoing, $unchanged->status);
        $this->assertNull($unchanged->finished_at);
        $this->assertNull($unchanged->final_grade);
        $this->assertSame($snapshot, $unchanged->scoring_rules);
        $this->assertDatabaseCount('attempt_answers', 0);
    }
}
