<?php

return [
    'scoring' => [
        'version' => 1,
        'base_points' => (string) env('QUIZ_BASE_POINTS', '10.00'),
        'streak_multiplier_step' => (string) env('QUIZ_STREAK_MULTIPLIER_STEP', '0.10'),
        'multiplier_cap' => (string) env('QUIZ_MULTIPLIER_CAP', '2.00'),
        'wrong_answer_resets_streak' => env('QUIZ_WRONG_ANSWER_RESETS_STREAK', true),
        'final_grade_formula' => env('QUIZ_FINAL_GRADE_FORMULA', 'percentage_correct'),
    ],
];
