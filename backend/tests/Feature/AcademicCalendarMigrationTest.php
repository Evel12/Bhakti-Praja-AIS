<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AcademicCalendarMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_partial_calendar_migration_resumes_without_losing_records(): void
    {
        Schema::drop('academic_calendars');
        Schema::create('academic_calendars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id');
            $table->foreignId('semester_id')->nullable();
            $table->string('name', 150);
            $table->date('start_date');
            $table->date('end_date');
            $table->text('description')->nullable();
            $table->timestamps();
        });
        $year = DB::table('academic_years')->insertGetId(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $id = DB::table('academic_calendars')->insertGetId(['academic_year_id' => $year, 'name' => 'Existing event', 'start_date' => '2026-07-01', 'end_date' => '2026-07-02']);
        $migration = require database_path('migrations/2026_10_15_000010_create_academic_calendars_table.php');
        $migration->up();
        $migration->up();
        $this->assertDatabaseHas('academic_calendars', ['id' => $id, 'name' => 'Existing event']);
        $this->assertCount(2, Schema::getForeignKeys('academic_calendars'));
    }
}
