<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Requests\Quiz\SaveQuestionRequest;
use App\Http\Resources\TeacherQuestionResource;
use App\Models\Question;
use App\Models\Quiz;
use App\Services\QuizManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class QuestionController extends Controller
{
    public function __construct(private readonly QuizManagementService $quizzes) {}

    public function index(AuthenticatedRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(TeacherQuestionResource::collection($this->quizzes->questions($request->user(), $quiz)));
    }

    public function store(SaveQuestionRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new TeacherQuestionResource($this->quizzes->createQuestion($request->user(), $quiz->id, $request->validated())), 'Question created.', 201);
    }

    public function show(AuthenticatedRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        return ApiResponse::success(new TeacherQuestionResource($this->quizzes->question($request->user(), $question)));
    }

    public function update(SaveQuestionRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        return ApiResponse::success(new TeacherQuestionResource($this->quizzes->updateQuestion($request->user(), $quiz->id, $question->id, $request->validated())), 'Question updated.');
    }

    public function destroy(AuthenticatedRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        $this->quizzes->deleteQuestion($request->user(), $quiz->id, $question->id);

        return ApiResponse::success(message: 'Question deleted.');
    }

    public function review(AuthenticatedRequest $request, Quiz $quiz, Question $question): JsonResponse
    {
        $validated = $request->validate([
            'reviewed' => ['sometimes', 'boolean'],
        ]);

        $updated = $this->quizzes->reviewQuestion(
            $request->user(),
            $quiz->id,
            $question->id,
            (bool) ($validated['reviewed'] ?? true),
        );

        return ApiResponse::success(new TeacherQuestionResource($updated), 'Question review updated.');
    }

    public function bankIndex(AuthenticatedRequest $request): JsonResponse
    {
        return ApiResponse::success([
            'items' => TeacherQuestionResource::collection($this->quizzes->listBankQuestions($request->user())),
        ], 'Question bank retrieved.');
    }

    public function bankStore(SaveQuestionRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new TeacherQuestionResource($this->quizzes->createBankQuestion($request->user(), $request->validated())),
            'Bank question created.',
            201,
        );
    }

    public function bankDestroy(AuthenticatedRequest $request, Question $question): JsonResponse
    {
        $this->quizzes->deleteBankQuestion($request->user(), $question);

        return ApiResponse::success(message: 'Bank question deleted.');
    }
}
