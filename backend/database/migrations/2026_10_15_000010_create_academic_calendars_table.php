<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL DDL can leave the table behind when a later foreign-key
        // statement fails. Resume that partial migration without losing rows.
        if (! Schema::hasTable('academic_calendars')) {
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
        }

        // Inspect only this table on MySQL instead of scanning information_schema.
        if (DB::getDriverName() === 'mysql') {
            $definition = (array) DB::selectOne('SHOW CREATE TABLE academic_calendars');
            $sql = $definition['Create Table'];
            $hasYearKey = str_contains($sql, 'FOREIGN KEY (`academic_year_id`)');
            $hasSemesterKey = str_contains($sql, 'FOREIGN KEY (`semester_id`)');
        } else {
            $foreignKeys = collect(Schema::getForeignKeys('academic_calendars'));
            $hasYearKey = $foreignKeys->contains(fn ($key) => $key['columns'] === ['academic_year_id']);
            $hasSemesterKey = $foreignKeys->contains(fn ($key) => $key['columns'] === ['semester_id']);
        }
        if (! $hasYearKey) {
            Schema::table('academic_calendars', function (Blueprint $table) {
                $table->foreign('academic_year_id')->references('id')->on('academic_years')->cascadeOnDelete();
            });
        }
        if (! $hasSemesterKey) {
            Schema::table('academic_calendars', function (Blueprint $table) {
                $table->foreign('semester_id')->references('id')->on('semesters')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_calendars');
    }
};
