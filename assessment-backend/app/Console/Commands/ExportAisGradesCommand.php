<?php

namespace App\Console\Commands;

use App\Services\AisGradebookExporter;
use Illuminate\Console\Command;

class ExportAisGradesCommand extends Command
{
    protected $signature = 'ais:export-grades';

    protected $description = 'Export all released Assessment quiz and assignment grades into AIS ais_assessment_grades.';

    public function handle(AisGradebookExporter $exporter): int
    {
        $count = $exporter->exportAllReleased();
        $this->info("Exported {$count} released grade record(s) to AIS.");

        return self::SUCCESS;
    }
}
