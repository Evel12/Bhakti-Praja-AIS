<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Requests\Quiz\ReplaceOptionsRequest;
use App\Http\Requests\Quiz\UpdateOptionRequest;
use App\Http\Resources\TeacherOptionResource;
use App\Http\Resources\TeacherQuestionResource;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Services\QuizManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class OptionController extends Controller
{
    public function __construct(private readonly QuizManagementService $quizzes) {}

    public function index(AuthenticatedRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        $question = $this->quizzes->question($request->user(), $question);

        return ApiResponse::success(TeacherOptionResource::collection($question->options));
    }

    public function show(AuthenticatedRequest $request, Quiz $quiz, Question $question, Option $option): JsonResponse
    {
        return ApiResponse::success(new TeacherOptionResource($this->quizzes->option($request->user(), $option)));
    }

    public function replace(ReplaceOptionsRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        return ApiResponse::success(new TeacherQuestionResource($this->quizzes->replaceOptions($request->user(), $quiz->id, $question->id, $request->validated('options'))), 'Options replaced.');
    }

    public function update(UpdateOptionRequest $request, Quiz $quiz, Question $question, Option $option): JsonResponse
    {
        return ApiResponse::success(new TeacherOptionResource($this->quizzes->updateOption($request->user(), $quiz->id, $question->id, $option->id, $request->validated())), 'Option updated.');
    }
}
