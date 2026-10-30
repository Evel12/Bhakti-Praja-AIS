<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->unsignedTinyInteger('credit_hours')->nullable()->default(null)->change();
        });
        Schema::table('curricula', function (Blueprint $table) {
            $table->string('source_url', 2048)->nullable();
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        // Keep unknown JP values nullable; never replace them with invented hours.
        Schema::table('curricula', function (Blueprint $table) {
            $table->dropColumn(['source_url', 'notes']);
        });
    }
};
