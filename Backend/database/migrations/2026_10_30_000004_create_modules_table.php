<?php

use App\Enums\ModuleVisibility;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('class_id')->index()->constrained('classes')->restrictOnDelete();
            $table->string('file_name');
            $table->string('path');
            $table->enum('visibility', ModuleVisibility::cases())->default(ModuleVisibility::Private->value);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modules');
    }
};
