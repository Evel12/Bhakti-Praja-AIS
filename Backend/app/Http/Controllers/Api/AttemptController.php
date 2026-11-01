<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attempt\StartAttemptRequest;
use App\Http\Requests\Attempt\SubmitAnswerRequest;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Resources\AttemptResource;
use App\Http\Resources\QuestionResource;
use App\Http\Resources\SubmittedAnswerResource;
use App\Models\Attempt;
use App\Models\Quiz;
use App\Services\AttemptService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class AttemptController extends Controller
{
    public function __construct(private readonly AttemptService $attempts) {}

    public function store(StartAttemptRequest $request, Quiz $quiz): JsonResponse
    {
        return ApiResponse::success(new AttemptResource($this->attempts->start($request->user(), $quiz->id, $request->validated())), 'Attempt started.', 201);
    }

    public function show(AuthenticatedRequest $request, Attempt $attempt): JsonResponse
    {
        return ApiResponse::success(new AttemptResource($this->attempts->show($request->user(), $attempt)));
    }

    public function questions(AuthenticatedRequest $request, Attempt $attempt): JsonResponse
    {
        $result = $this->attempts->questions($request->user(), $attempt);

        return ApiResponse::success([
            'attempt' => new AttemptResource($result['state']),
            'questions' => QuestionResource::collection($result['questions']),
        ]);
    }

    public function answer(SubmitAnswerRequest $request, Attempt $attempt): JsonResponse
    {
        $result = $this->attempts->answer($request->user(), $attempt, $request->validated());

        return ApiResponse::success([
            'answer' => new SubmittedAnswerResource($result['answer']),
            'attempt' => new AttemptResource($result['state']),
        ], 'Answer saved.', 201);
    }

    public function finish(AuthenticatedRequest $request, Attempt $attempt): JsonResponse
    {
        return ApiResponse::success(new AttemptResource($this->attempts->finish($request->user(), $attempt)), 'Attempt finished.');
    }
}
