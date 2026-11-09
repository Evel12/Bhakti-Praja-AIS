<?php

namespace App\Services;

use App\Data\ScoringResult;
use InvalidArgumentException;

final readonly class ScoringService
{
    private const int MAX_SCORE_CENTS = 999999999999;

    private array $snapshot;

    private int $basePointsCents;

    private int $multiplierStepHundredths;

    private int $multiplierCapHundredths;

    private bool $wrongAnswerResetsStreak;

    public function __construct(array $rules)
    {
        if (PHP_INT_SIZE < 8) {
            throw new InvalidArgumentException('Scoring requires a 64-bit PHP runtime.');
        }

        foreach (['version', 'base_points', 'streak_multiplier_step', 'multiplier_cap', 'wrong_answer_resets_streak', 'final_grade_formula'] as $key) {
            if (! array_key_exists($key, $rules)) {
                throw new InvalidArgumentException('Missing scoring rule: '.$key.'.');
            }
        }

        if ($rules['version'] !== 1 || $rules['final_grade_formula'] !== 'percentage_correct') {
            throw new InvalidArgumentException('Unsupported scoring rules version or final grade formula.');
        }
        if (! is_bool($rules['wrong_answer_resets_streak'])) {
            throw new InvalidArgumentException('wrong_answer_resets_streak must be a boolean.');
        }

        $this->basePointsCents = self::hundredths($rules['base_points'], 'base_points', 1, 10000000);
        $this->multiplierStepHundredths = self::hundredths($rules['streak_multiplier_step'], 'streak_multiplier_step', 0, 100000);
        $this->multiplierCapHundredths = self::hundredths($rules['multiplier_cap'], 'multiplier_cap', 100, 10000000);
        $this->wrongAnswerResetsStreak = $rules['wrong_answer_resets_streak'];
        $this->snapshot = [
            'version' => 1,
            'base_points' => self::decimal($this->basePointsCents),
            'streak_multiplier_step' => self::decimal($this->multiplierStepHundredths),
            'multiplier_cap' => self::decimal($this->multiplierCapHundredths),
            'wrong_answer_resets_streak' => $this->wrongAnswerResetsStreak,
            'final_grade_formula' => 'percentage_correct',
        ];
    }

    public function rules(): array
    {
        return $this->snapshot;
    }

    public function calculate(iterable $correctness, int $totalQuestions): ScoringResult
    {
        if ($totalQuestions < 1) {
            throw new InvalidArgumentException('The quiz must have at least one question.');
        }

        // Bound the worst case before replay, so every addition fits DECIMAL(12,2).
        $maximumAward = intdiv($this->basePointsCents * $this->multiplierCapHundredths + 50, 100);
        if ($totalQuestions > intdiv(self::MAX_SCORE_CENTS, $maximumAward)) {
            throw new InvalidArgumentException('The quiz exceeds the configured scoring storage capacity.');
        }

        $scoreCents = 0;
        $answeredCount = 0;
        $correctCount = 0;
        $streak = 0;
        $streakMax = 0;
        $multiplierMax = 0;

        // The caller supplies receipt order; this service does not inspect client timestamps.
        foreach ($correctness as $isCorrect) {
            if (! is_bool($isCorrect)) {
                throw new InvalidArgumentException('Answer correctness must contain only booleans.');
            }
            if (++$answeredCount > $totalQuestions) {
                throw new InvalidArgumentException('Answer count cannot exceed the quiz question count.');
            }

            if ($isCorrect) {
                $correctCount++;
                $streak++;
                $multiplier = $this->multiplierFor($streak);
                // Round each awarded answer to cents, half up, using integer arithmetic.
                $scoreCents += intdiv($this->basePointsCents * $multiplier + 50, 100);
                $streakMax = max($streakMax, $streak);
                $multiplierMax = max($multiplierMax, $multiplier);
            } elseif ($this->wrongAnswerResetsStreak) {
                $streak = 0;
            }
        }

        return new ScoringResult(
            score: self::decimal($scoreCents),
            currentMultiplier: self::decimal($this->multiplierFor($streak)),
            multiplierMax: self::decimal($multiplierMax),
            progressPercentage: self::percentage($answeredCount, $totalQuestions),
            finalGrade: self::percentage($correctCount, $totalQuestions),
            streak: $streak,
            streakMax: $streakMax,
            answeredCount: $answeredCount,
            correctCount: $correctCount,
        );
    }

    private function multiplierFor(int $streak): int
    {
        if ($streak <= 1 || $this->multiplierStepHundredths === 0) {
            return 100;
        }

        $headroom = $this->multiplierCapHundredths - 100;
        $stepsToCap = intdiv($headroom + $this->multiplierStepHundredths - 1, $this->multiplierStepHundredths);
        $steps = $streak - 1;

        // Compare first: a very long streak must not overflow a multiplication.
        return $steps >= $stepsToCap
            ? $this->multiplierCapHundredths
            : 100 + $steps * $this->multiplierStepHundredths;
    }

    private static function hundredths(mixed $value, string $name, int $minimum, int $maximum): int
    {
        if ((! is_string($value) && ! is_int($value))
            || ! preg_match('/^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/D', (string) $value, $matches)) {
            throw new InvalidArgumentException($name.' must be an integer or decimal string with at most two decimal places.');
        }

        // Length is checked before integer conversion to prevent saturated/overflowed input.
        if (strlen($matches[1]) > 6) {
            throw new InvalidArgumentException($name.' is outside the supported range.');
        }
        $scaled = (int) $matches[1] * 100 + (int) str_pad($matches[2] ?? '', 2, '0');
        if ($scaled < $minimum || $scaled > $maximum) {
            throw new InvalidArgumentException($name.' is outside the supported range.');
        }

        return $scaled;
    }

    private static function decimal(int $hundredths): string
    {
        return intdiv($hundredths, 100).'.'.str_pad((string) ($hundredths % 100), 2, '0', STR_PAD_LEFT);
    }

    private static function percentage(int $count, int $total): string
    {
        // Capacity validation above bounds count, so count * 10000 remains a safe integer.
        return self::decimal(intdiv($count * 10000 + intdiv($total, 2), $total));
    }
}
