<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->index()->constrained('users')->cascadeOnDelete();
                $table->foreignId('class_id')->nullable()->index()->constrained('classes')->cascadeOnDelete();
                $table->string('type', 64);
                $table->string('title');
                $table->text('body')->nullable();
                $table->json('data')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
                $table->index(['user_id', 'read_at']);
            });

            return;
        }

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasColumn('notifications', 'message')) {
                DB::statement('ALTER TABLE notifications MODIFY COLUMN message TEXT NULL');
            }
            if (Schema::hasColumn('notifications', 'is_read')) {
                DB::statement('ALTER TABLE notifications MODIFY COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0');
            }
        } else {
            Schema::table('notifications', function (Blueprint $table): void {
                if (Schema::hasColumn('notifications', 'message')) {
                    $table->text('message')->nullable()->change();
                }
            });
        }

        Schema::table('notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('notifications', 'class_id')) {
                $table->foreignId('class_id')->nullable()->after('user_id')->index()->constrained('classes')->cascadeOnDelete();
            }
            if (! Schema::hasColumn('notifications', 'type')) {
                $table->string('type', 64)->default('member4')->after('class_id');
            }
            if (! Schema::hasColumn('notifications', 'body')) {
                $table->text('body')->nullable()->after('title');
            }
            if (! Schema::hasColumn('notifications', 'data')) {
                $table->json('data')->nullable()->after('body');
            }
            if (! Schema::hasColumn('notifications', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('data');
                $table->index(['user_id', 'read_at']);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('notifications', 'message')) {
            Schema::dropIfExists('notifications');
        }
    }
};
