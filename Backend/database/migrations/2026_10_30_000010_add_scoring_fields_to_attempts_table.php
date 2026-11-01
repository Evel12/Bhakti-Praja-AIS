<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->decimal('score', 12, 2)->default(0)->change();
            $table->decimal('final_grade', 5, 2)->nullable();
            // Nullable for legacy rows; their historical scoring rules cannot be invented.
            $table->json('scoring_rules')->nullable();
        });
    }

    public function down(): void
    {
        if (DB::table('attempts')->where('score', '>', '999.99')->orWhere('score', '<', '-999.99')->exists()) {
            throw new RuntimeException('Cannot narrow attempt scores while values exceed DECIMAL(5,2).');
        }

        Schema::table('attempts', function (Blueprint $table): void {
            $table->decimal('score', 5, 2)->default(0)->change();
            $table->dropColumn(['final_grade', 'scoring_rules']);
        });
    }
};
