<?php

return [
    // Phase 1 uses REST bearer tokens; cookie-based SPA auth is not enabled.
    'guard' => [],
    'stateful' => [],
    'expiration' => (int) env('API_TOKEN_EXPIRATION', 120),
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
];
