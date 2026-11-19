<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new \RuntimeException('DemoAssessmentSeeder cannot run in production. Run ProductionAdminSeeder instead.');
        }

        if (\Illuminate\Support\Facades\Schema::hasTable('teaching_loads')) {
            $this->call(IntegratedAssessmentSeeder::class);

            return;
        }

        $this->call(DemoAssessmentSeeder::class);
    }
}
