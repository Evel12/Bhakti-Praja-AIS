<?php

namespace App\Contracts;

use App\Models\Module;

interface QuizGenerator
{
    /** Return the canonical draft structure described in docs/phase-6-implementation.md. */
    public function generate(Module $module, int $questionCount, int $generationId): array;
}
