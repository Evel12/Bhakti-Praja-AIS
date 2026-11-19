<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasColumn('notifications', 'category')) {
                $table->string('category', 32)->nullable();
            }
            if (! Schema::hasColumn('notifications', 'source_id')) {
                $table->unsignedBigInteger('source_id')->nullable();
            }
            if (! Schema::hasColumn('notifications', 'email_status')) {
                $table->string('email_status', 16)->nullable();
            }
            if (! Schema::hasColumn('notifications', 'email_sent_at')) {
                $table->timestamp('email_sent_at')->nullable();
            }
            if (! Schema::hasIndex('notifications', 'notification_recipient_source_unique')) {
                $table->unique(['user_id', 'category', 'source_id'], 'notification_recipient_source_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasIndex('notifications', 'notification_recipient_source_unique')) {
                $table->dropUnique('notification_recipient_source_unique');
            }
            $dropCols = array_values(array_filter(
                ['category', 'source_id', 'email_status', 'email_sent_at'],
                static fn (string $col): bool => Schema::hasColumn('notifications', $col),
            ));
            if ($dropCols !== []) {
                $table->dropColumn($dropCols);
            }
        });
    }
};
