<?php

return [
    'ai_url' => env('LMS_AI_URL', 'http://127.0.0.1:8001'),
    'ai_key' => env('LMS_AI_KEY', ''),
    'default_model' => env('LMS_AI_MODEL', 'qwen3.8:27b'),
    'models' => array_values(array_filter(array_map('trim', explode(',', env('LMS_AI_MODELS', 'qwen3.8:27b,llama3.1:8b'))))),
];
