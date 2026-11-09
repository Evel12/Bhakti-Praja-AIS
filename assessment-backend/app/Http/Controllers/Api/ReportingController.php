<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Requests\Reporting\ClassGradebookRequest;
use App\Http\Requests\Reporting\PersonalGradesRequest;
use App\Http\Requests\Reporting\QuizGradesRequest;
use App\Http\Resources\AttemptReviewResource;
use App\Http\Resources\GradebookStudentResource;
use App\Http\Resources\QuizResource;
use App\Http\Resources\StoredAttemptGradeResource;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Models\SchoolClass;
use App\Services\ReportingService;
use App\Support\ApiResponse;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

class ReportingController extends Controller
{
    public function __construct(private readonly ReportingService $reports) {}

    public function personal(PersonalGradesRequest $request): JsonResponse
    {
        $result = $this->reports->personal($request->user(), $request->validated());

        return ApiResponse::success([
            'summary' => $result['summary'],
            'items' => StoredAttemptGradeResource::collection($result['page']->getCollection()),
            'pagination' => $this->pagination($result['page']),
        ]);
    }

    public function quiz(QuizGradesRequest $request, Quiz $quiz): JsonResponse
    {
        $result = $this->reports->quiz($request->user(), $quiz->id, $request->validated());

        return ApiResponse::success([
            'quiz' => new QuizResource($result['quiz']),
            'summary' => $result['summary'],
            'items' => StoredAttemptGradeResource::collection($result['page']->getCollection()),
            'pagination' => $this->pagination($result['page']),
        ]);
    }

    public function gradebook(ClassGradebookRequest $request, SchoolClass $schoolClass): JsonResponse
    {
        $result = $this->reports->gradebook($request->user(), $schoolClass->id, $request->validated());

        return ApiResponse::success([
            'class' => ['id' => $result['schoolClass']->id, 'name' => $result['schoolClass']->name],
            'quiz' => $result['quiz'] ? new QuizResource($result['quiz']) : null,
            'summary' => $result['summary'],
            'items' => GradebookStudentResource::collection($result['items']),
            'pagination' => $this->pagination($result['page']),
        ]);
    }

    public function studentReview(AuthenticatedRequest $request, Attempt $attempt): JsonResponse
    {
        return ApiResponse::success(new AttemptReviewResource($this->reports->review($request->user(), $attempt)));
    }

    public function teacherReview(AuthenticatedRequest $request, Quiz $quiz, Attempt $attempt): JsonResponse
    {
        return ApiResponse::success(new AttemptReviewResource($this->reports->review($request->user(), $attempt)));
    }

    private function pagination(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(), 'total' => $page->total(),
        ];
    }
}
