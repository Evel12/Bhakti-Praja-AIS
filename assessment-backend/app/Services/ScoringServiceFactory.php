<?php

namespace App\Services;

use App\Models\Attempt;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ScoringServiceFactory
{
    public function current(): ScoringService
    {
        return new ScoringService(config('quiz.scoring'));
    }

    public function forAttempt(Attempt $attempt): ScoringService
    {
        if (! is_array($attempt->scoring_rules)) {
            throw new ConflictHttpException('This legacy attempt has no scoring rules snapshot.');
        }

        try {
            return new ScoringService($attempt->scoring_rules);
        } catch (InvalidArgumentException $exception) {
            throw new ConflictHttpException('The saved scoring rules are unavailable.', $exception);
        }
    }
}
