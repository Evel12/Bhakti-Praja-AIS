<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('announcements')) {
            Schema::create('announcements', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('class_id')->index()->constrained('classes')->cascadeOnDelete();
                $table->foreignId('author_id')->index()->constrained('users')->cascadeOnDelete();
                $table->string('title');
                $table->text('content');
                $table->boolean('is_pinned')->default(false);
                $table->timestamps();
                $table->index(['class_id', 'is_pinned']);
            });

            return;
        }

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasColumn('announcements', 'created_by')) {
                DB::statement('ALTER TABLE announcements MODIFY COLUMN created_by BIGINT UNSIGNED NULL');
            }
            if (Schema::hasColumn('announcements', 'target_role')) {
                DB::statement('ALTER TABLE announcements MODIFY COLUMN target_role VARCHAR(50) NULL');
            }
        } else {
            Schema::table('announcements', function (Blueprint $table): void {
                if (Schema::hasColumn('announcements', 'created_by')) {
                    $table->unsignedBigInteger('created_by')->nullable()->change();
                }
                if (Schema::hasColumn('announcements', 'target_role')) {
                    $table->string('target_role', 50)->nullable()->change();
                }
            });
        }

        Schema::table('announcements', function (Blueprint $table): void {
            if (! Schema::hasColumn('announcements', 'class_id')) {
                $table->foreignId('class_id')->nullable()->after('id')->index()->constrained('classes')->cascadeOnDelete();
            }
            if (! Schema::hasColumn('announcements', 'author_id')) {
                $table->foreignId('author_id')->nullable()->after('class_id')->index()->constrained('users')->cascadeOnDelete();
            }
            if (! Schema::hasColumn('announcements', 'is_pinned')) {
                $table->boolean('is_pinned')->default(false)->after('content');
                $table->index(['class_id', 'is_pinned']);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('announcements', 'created_by')) {
            Schema::dropIfExists('announcements');
        }
    }
};
