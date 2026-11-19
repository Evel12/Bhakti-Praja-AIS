<?php

namespace App\Console\Commands;

use App\Services\AisRosterSyncService;
use Illuminate\Console\Command;

class SyncAisRosterCommand extends Command
{
    protected $signature = 'ais:sync-roster';

    protected $description = 'Synchronize active AIS teaching loads and student enrollments into Assessment classes.';

    public function handle(AisRosterSyncService $sync): int
    {
        $result = $sync->syncAll();

        if (! ($result['synced'] ?? false)) {
            $this->warn('AIS tables not found in shared database; skipped.');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Synced %d classes and %d membership updates from AIS.',
            $result['classes_synced'],
            $result['memberships_synced'],
        ));

        return self::SUCCESS;
    }
}
