<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('title');
                $table->text('message');
                $table->boolean('is_read')->default(false);
                $table->timestamps();
                $table->index(['user_id', 'is_read', 'created_at']);
            });

            return;
        }

        if (DB::getDriverName() === 'mysql' && Schema::hasColumn('notifications', 'type')) {
            DB::statement("ALTER TABLE notifications MODIFY COLUMN type VARCHAR(64) NOT NULL DEFAULT 'member4'");
        } elseif (Schema::hasColumn('notifications', 'type')) {
            Schema::table('notifications', function (Blueprint $table): void {
                $table->string('type', 64)->default('member4')->change();
            });
        }

        Schema::table('notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('notifications', 'message')) {
                $table->text('message')->nullable()->after('title');
            }
            if (! Schema::hasColumn('notifications', 'is_read')) {
                $table->boolean('is_read')->default(false)->after('message');
                $table->index(['user_id', 'is_read', 'created_at'], 'notifications_user_id_is_read_created_at_index');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('notifications', 'type')) {
            Schema::dropIfExists('notifications');
        }
    }
};
