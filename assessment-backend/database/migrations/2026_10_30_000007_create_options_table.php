<?php

use App\Enums\OptionLabel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('question_id')->index()->constrained()->cascadeOnDelete();
            $table->enum('option_label', OptionLabel::cases());
            $table->text('option_text');
            $table->boolean('is_correct');
            $table->timestamps();
            $table->unique(['question_id', 'option_label']);
            // A submitted option must belong to the submitted question (composite FK).
            $table->unique(['id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('options');
    }
};
