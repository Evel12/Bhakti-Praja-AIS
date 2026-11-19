<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('announcements')) {
            Schema::create('announcements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
                $table->string('title');
                $table->text('content');
                $table->string('target_role', 50);
                $table->timestamps();
                $table->index(['target_role', 'created_at']);
            });

            return;
        }

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasColumn('announcements', 'class_id')) {
                DB::statement('ALTER TABLE announcements MODIFY COLUMN class_id BIGINT UNSIGNED NULL');
            }
            if (Schema::hasColumn('announcements', 'author_id')) {
                DB::statement('ALTER TABLE announcements MODIFY COLUMN author_id BIGINT UNSIGNED NULL');
            }
        } else {
            Schema::table('announcements', function (Blueprint $table): void {
                if (Schema::hasColumn('announcements', 'class_id')) {
                    $table->unsignedBigInteger('class_id')->nullable()->change();
                }
                if (Schema::hasColumn('announcements', 'author_id')) {
                    $table->unsignedBigInteger('author_id')->nullable()->change();
                }
            });
        }

        Schema::table('announcements', function (Blueprint $table): void {
            if (! Schema::hasColumn('announcements', 'created_by')) {
                $table->foreignId('created_by')->nullable()->constrained('users')->restrictOnDelete();
            }
            if (! Schema::hasColumn('announcements', 'target_role')) {
                $table->string('target_role', 50)->nullable();
                $table->index(['target_role', 'created_at'], 'announcements_target_role_created_at_index');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('announcements', 'class_id')) {
            Schema::dropIfExists('announcements');
        }
    }
};
