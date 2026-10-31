<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('category', 32)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('email_status', 16)->nullable();
            $table->timestamp('email_sent_at')->nullable();
            $table->unique(['user_id', 'category', 'source_id'], 'notification_recipient_source_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique('notification_recipient_source_unique');
            $table->dropColumn(['category', 'source_id', 'email_status', 'email_sent_at']);
        });
    }
};
