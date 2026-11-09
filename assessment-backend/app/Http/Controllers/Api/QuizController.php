<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Requests\Quiz\ListQuizzesRequest;
use App\Http\Requests\Quiz\PublishQuizRequest;
use App\Http\Requests\Quiz\StoreQuizRequest;
use App\Http\Requests\Quiz\UpdateQuizRequest;
use App\Http\Resources\QuizResource;
use App\Http\Resources\TeacherQuizResource;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Services\QuizManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class QuizController extends Controller
{
    public function __construct(private readonly QuizManagementService $quizzes) {}

    public function index(ListQuizzesRequest $request, SchoolClass $schoolClass): JsonResponse
    {
        $page = $this->quizzes->list($request->user(), $schoolClass, $request->validated());

        return ApiResponse::success([
            'items' => QuizResource::collection($page->getCollection()),
            'pagination' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(), 'total' => $page->total(),
            ],
        ]);
    }

    public function store(StoreQuizRequest $request): JsonResponse
    {
        return ApiResponse::success(new TeacherQuizResource($this->quizzes->create($request->user(), $request->validated())), 'Quiz draft created.', 201);
    }

    public function show(AuthenticatedRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new TeacherQuizResource($this->quizzes->show($request->user(), $quiz)));
    }

    public function update(UpdateQuizRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new TeacherQuizResource($this->quizzes->update($request->user(), $quiz->id, $request->validated())), 'Quiz draft updated.');
    }

    public function destroy(AuthenticatedRequest $request, Quiz $quiz): JsonResponse
    {
        $this->quizzes->delete($request->user(), $quiz->id);

        return ApiResponse::success(message: 'Quiz draft deleted.');
    }

    public function publish(PublishQuizRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new TeacherQuizResource($this->quizzes->publish($request->user(), $quiz->id, $request->validated('deadline'))), 'Quiz published.');
    }

    public function close(AuthenticatedRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new TeacherQuizResource($this->quizzes->close($request->user(), $quiz->id)), 'Quiz closed.');
    }
}
