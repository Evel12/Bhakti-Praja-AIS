<?php

$positiveLimit = static function (string $name, int $default): int {
    $value = filter_var(env($name, $default), FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 1000000],
    ]);

    // A typo or zero must not silently disable protection.
    return $value === false ? $default : $value;
};

return [
    'rate_limits' => [
        'authenticated_per_minute' => $positiveLimit('API_RATE_PER_MINUTE', 120),
        'teacher_writes_per_minute' => $positiveLimit('API_TEACHER_WRITES_PER_MINUTE', 30),
        'attempt_starts_per_minute' => $positiveLimit('API_ATTEMPT_STARTS_PER_MINUTE', 10),
        'reports_per_minute' => $positiveLimit('API_REPORTS_PER_MINUTE', 30),
        'generation_per_minute' => $positiveLimit('API_GENERATION_PER_MINUTE', 3),
        'generation_per_hour' => $positiveLimit('API_GENERATION_PER_HOUR', 20),
    ],

    // Enable only after HTTPS is working for the deployed API host.
    'hsts_max_age' => max(0, min((int) env('API_HSTS_MAX_AGE', 0), 63072000)),
];
