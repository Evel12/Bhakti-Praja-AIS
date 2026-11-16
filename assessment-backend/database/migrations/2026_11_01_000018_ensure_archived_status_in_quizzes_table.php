<?php

use App\Enums\QuizStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            $cases = implode("','", array_map(
                static fn (QuizStatus $case): string => $case->value,
                QuizStatus::cases(),
            ));

            DB::statement(
                "ALTER TABLE quizzes MODIFY COLUMN status ENUM('{$cases}') NOT NULL DEFAULT 'draft'"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            $hasArchived = DB::table('quizzes')
                ->where('status', QuizStatus::Archived->value)
                ->exists();

            if (! $hasArchived) {
                DB::statement(
                    "ALTER TABLE quizzes MODIFY COLUMN status ENUM('draft','published','closed') NOT NULL DEFAULT 'draft'"
                );
            }
        }
    }
};
