<?php

namespace Tests\Unit;

use App\Services\ScoringService;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ScoringServiceTest extends TestCase
{
    private static function rules(array $overrides = []): array
    {
        return array_replace([
            'version' => 1,
            'base_points' => '10.00',
            'streak_multiplier_step' => '0.10',
            'multiplier_cap' => '2.00',
            'wrong_answer_resets_streak' => true,
            'final_grade_formula' => 'percentage_correct',
        ], $overrides);
    }

    public function test_empty_attempt_has_no_awarded_multiplier_or_points(): void
    {
        $result = (new ScoringService(self::rules()))->calculate([], 5);
        $this->assertSame('0.00', $result->score);
        $this->assertSame('1.00', $result->currentMultiplier);
        $this->assertSame('0.00', $result->multiplierMax);
        $this->assertSame('0.00', $result->progressPercentage);
        $this->assertSame('0.00', $result->finalGrade);
        $this->assertSame(0, $result->streak);
        $this->assertSame(0, $result->streakMax);
        $this->assertSame(0, $result->answeredCount);
        $this->assertSame(0, $result->correctCount);
    }

    public function test_first_correct_answer_earns_base_points_and_unanswered_questions_reduce_grade(): void
    {
        $result = (new ScoringService(self::rules()))->calculate([true], 5);
        $this->assertSame('10.00', $result->score);
        $this->assertSame('1.00', $result->currentMultiplier);
        $this->assertSame('1.00', $result->multiplierMax);
        $this->assertSame('20.00', $result->progressPercentage);
        $this->assertSame('20.00', $result->finalGrade);
        $this->assertSame(1, $result->streakMax);
    }

    public function test_streak_increases_points_and_wrong_answers_reset_it(): void
    {
        $result = (new ScoringService(self::rules()))->calculate([true, true, false, true], 4);
        $this->assertSame('31.00', $result->score);
        $this->assertSame('1.00', $result->currentMultiplier);
        $this->assertSame('1.10', $result->multiplierMax);
        $this->assertSame(1, $result->streak);
        $this->assertSame(2, $result->streakMax);
        $this->assertSame('75.00', $result->finalGrade);
        $this->assertSame('100.00', $result->progressPercentage);
    }

    public function test_streak_multiplier_never_exceeds_cap(): void
    {
        $result = (new ScoringService(self::rules()))->calculate(array_fill(0, 12, true), 12);
        $this->assertSame('185.00', $result->score);
        $this->assertSame('2.00', $result->currentMultiplier);
        $this->assertSame('2.00', $result->multiplierMax);
        $this->assertSame(12, $result->streakMax);
        $this->assertSame('100.00', $result->finalGrade);
    }

    public function test_wrong_answer_can_preserve_streak_when_configured(): void
    {
        $result = (new ScoringService(self::rules(['wrong_answer_resets_streak' => false])))
            ->calculate([true, false, true], 3);
        $this->assertSame('21.00', $result->score);
        $this->assertSame(2, $result->streak);
        $this->assertSame('1.10', $result->currentMultiplier);
        $this->assertSame('66.67', $result->finalGrade);
    }

    public function test_game_multiplier_does_not_inflate_the_final_grade(): void
    {
        $result = (new ScoringService(self::rules(['base_points' => '100.00', 'streak_multiplier_step' => '1.00', 'multiplier_cap' => '5.00'])))
            ->calculate([true, true, false], 4);
        $this->assertSame('300.00', $result->score);
        $this->assertSame('50.00', $result->finalGrade);
        $this->assertSame('75.00', $result->progressPercentage);
    }

    public function test_percentage_rounding_is_half_up_and_deterministic(): void
    {
        $scoring = new ScoringService(self::rules());
        $this->assertSame('33.33', $scoring->calculate([true], 3)->finalGrade);
        $this->assertSame('66.67', $scoring->calculate([true, true], 3)->progressPercentage);
        $this->assertSame('3.13', $scoring->calculate([true], 32)->finalGrade);
    }

    public function test_each_answer_award_is_rounded_half_up_without_binary_floats(): void
    {
        $result = (new ScoringService(self::rules(['base_points' => '0.01', 'streak_multiplier_step' => '0.50'])))
            ->calculate([true, true], 2);
        $this->assertSame('0.03', $result->score);
    }

    public function test_zero_step_and_unit_cap_work_without_streak_bonus(): void
    {
        $result = (new ScoringService(self::rules(['base_points' => '3.33', 'streak_multiplier_step' => 0, 'multiplier_cap' => 1])))
            ->calculate([true, true, false], 3);
        $this->assertSame('6.66', $result->score);
        $this->assertSame('1.00', $result->multiplierMax);
    }

    public function test_all_wrong_answers_keep_zero_awarded_multiplier(): void
    {
        $result = (new ScoringService(self::rules()))->calculate([false, false], 3);
        $this->assertSame('0.00', $result->score);
        $this->assertSame('0.00', $result->multiplierMax);
        $this->assertSame('1.00', $result->currentMultiplier);
        $this->assertSame(0, $result->streak);
        $this->assertSame('0.00', $result->finalGrade);
    }

    public function test_rules_are_canonical_and_exclude_unknown_fields(): void
    {
        $rules = self::rules(['base_points' => 10, 'streak_multiplier_step' => '0.1', 'multiplier_cap' => 2, 'client_score' => 999]);
        $scoring = new ScoringService($rules);
        $this->assertSame(self::rules(), $scoring->rules());
        $copy = $scoring->rules();
        $copy['base_points'] = '999.00';
        $this->assertSame('10.00', $scoring->rules()['base_points']);
    }

    public function test_receipt_order_is_preserved_for_any_iterable(): void
    {
        $correctness = (function () {
            yield true;
            yield false;
            yield true;
        })();
        $this->assertSame('20.00', (new ScoringService(self::rules()))->calculate($correctness, 3)->score);
    }

    public static function invalidRules(): array
    {
        return [
            'unknown version' => [['version' => 2]],
            'unknown formula' => [['final_grade_formula' => 'game_points']],
            'nonboolean reset' => [['wrong_answer_resets_streak' => 'true']],
            'zero base' => [['base_points' => '0.00']],
            'negative base' => [['base_points' => '-1.00']],
            'too large base' => [['base_points' => '100000.01']],
            'too precise step' => [['streak_multiplier_step' => '0.001']],
            'too large step' => [['streak_multiplier_step' => '1000.01']],
            'cap below one' => [['multiplier_cap' => '0.99']],
            'too large cap' => [['multiplier_cap' => '100000.01']],
            'binary float' => [['base_points' => 0.1]],
            'exponential input' => [['base_points' => '1e2']],
            'overflowing input' => [['base_points' => str_repeat('9', 100)]],
            'array value' => [['base_points' => []]],
        ];
    }

    #[DataProvider('invalidRules')]
    public function test_invalid_rules_are_rejected(array $overrides): void
    {
        $this->expectException(InvalidArgumentException::class);
        new ScoringService(self::rules($overrides));
    }

    public function test_missing_rules_are_rejected(): void
    {
        $rules = self::rules();
        unset($rules['base_points']);
        $this->expectException(InvalidArgumentException::class);
        new ScoringService($rules);
    }

    public function test_empty_quiz_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScoringService(self::rules()))->calculate([], 0);
    }

    public function test_extra_answers_are_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScoringService(self::rules()))->calculate([true, false], 1);
    }

    public function test_nonboolean_correctness_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScoringService(self::rules()))->calculate([1], 1);
    }

    public function test_quiz_capacity_is_checked_before_calculation(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('storage capacity');
        (new ScoringService(self::rules(['base_points' => '100000.00', 'multiplier_cap' => '100000.00'])))
            ->calculate([], 1);
    }

    public function test_large_quiz_count_is_rejected_without_integer_overflow(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScoringService(self::rules()))->calculate([], PHP_INT_MAX);
    }
}
