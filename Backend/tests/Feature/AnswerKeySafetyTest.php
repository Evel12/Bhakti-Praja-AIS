<?php

namespace Tests\Feature;

use App\Http\Resources\QuestionResource;
use App\Models\AttemptAnswer;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnswerKeySafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_question_resource_never_serializes_option_correctness(): void
    {
        $question = Question::factory()->withOptions()->create()->load('options');
        // The resource allowlist remains safe even if another caller unhides a model field.
        $question->options->each->makeVisible('is_correct');
        $data = (new QuestionResource($question))->response()->getData(true)['data'];

        $this->assertSame(['id', 'question_text', 'question_type', 'options'], array_keys($data));
        $this->assertCount(4, $data['options']);
        foreach ($data['options'] as $option) {
            $this->assertSame(['id', 'option_label', 'option_text'], array_keys($option));
        }
        $this->assertStringNotContainsString('is_correct', json_encode($data));
    }

    public function test_default_model_serialization_hides_answer_keys_recursively(): void
    {
        $question = Question::factory()->withOptions()->create()->load('options');
        $this->assertTrue($question->options->first()->is_correct);
        $this->assertStringNotContainsString('is_correct', $question->toJson());
        $this->assertArrayNotHasKey('is_correct', $question->options->first()->toArray());
    }

    public function test_serializing_an_attempt_answer_does_not_leak_keys_through_loaded_relations(): void
    {
        $answer = AttemptAnswer::factory()->create()->load('chosenOption', 'question.options');
        $this->assertStringNotContainsString('is_correct', $answer->toJson());
    }
}
