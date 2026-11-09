<?php

return [
    // An explicit empty array also prevents host-based proxy auto-detection.
    'proxies' => array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))))),
];
