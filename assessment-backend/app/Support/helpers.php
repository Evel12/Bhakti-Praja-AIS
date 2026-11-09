<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;

function logSystemActivity(string $action, ?int $actorId = null, array $context = []): void
{
    // Allow only audit metadata: request bodies, passwords, and tokens never belong here.
    Log::channel('activity')->info($action, [
        'actor_id' => $actorId,
        ...Arr::only($context, ['entity_type', 'entity_id', 'result', 'reason']),
    ]);
}
