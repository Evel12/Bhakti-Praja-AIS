<?php

return [
    // Reference adapter contract; replace QuizGenerator binding if the Python API differs.
    'base_url' => env('AI_SERVICE_BASE_URL', ''),
    'endpoint' => env('AI_SERVICE_QUIZ_ENDPOINT', '/generate-quiz'),
    'api_key' => env('AI_SERVICE_API_KEY', ''),
    'timeout' => (int) env('AI_SERVICE_TIMEOUT', 60),
    'connect_timeout' => (int) env('AI_SERVICE_CONNECT_TIMEOUT', 10),
    'disk' => env('AI_MODULE_DISK', 'local'),
    'max_pdf_bytes' => 20 * 1024 * 1024,
    'max_response_bytes' => 1024 * 1024,
];
