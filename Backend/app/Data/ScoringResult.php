<?php

namespace App\Data;

final readonly class ScoringResult
{
    public function __construct(
        public string $score,
        public string $currentMultiplier,
        public string $multiplierMax,
        public string $progressPercentage,
        public string $finalGrade,
        public int $streak,
        public int $streakMax,
        public int $answeredCount,
        public int $correctCount,
    ) {}
}
