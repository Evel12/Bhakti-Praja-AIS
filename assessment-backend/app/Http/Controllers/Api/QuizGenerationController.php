<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthenticatedRequest;
use App\Http\Requests\Generation\GenerateQuizRequest;
use App\Http\Resources\QuizGenerationResource;
use App\Models\Module;
use App\Models\QuizGeneration;
use App\Services\QuizGenerationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class QuizGenerationController extends Controller
{
    public function __construct(private readonly QuizGenerationService $generations) {}

    public function store(GenerateQuizRequest $request, Module $module): JsonResponse
    {
        $generation = $this->generations->request($request->user(), $module, $request->integer('question_count', 5));

        return ApiResponse::success(new QuizGenerationResource($generation), 'Quiz generation queued.', 202);
    }

    public function show(AuthenticatedRequest $request, QuizGeneration $quizGeneration): JsonResponse
    {
        return ApiResponse::success(new QuizGenerationResource($this->generations->status($request->user(), $quizGeneration)));
    }
}
