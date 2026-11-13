<?php

use App\Http\Controllers\Lms\LmsController;
use App\Http\Middleware\Member4Role;
use Illuminate\Support\Facades\Route;

Route::prefix('lms')->middleware(['auth:sanctum', Member4Role::class.':guru,murid,wali_murid', 'throttle:120,1,lms-'])->group(function () {
    Route::get('courses', [LmsController::class, 'index']);
    Route::get('schedules', [LmsController::class, 'schedules']);
    Route::get('models', [LmsController::class, 'models']);
    Route::post('courses', [LmsController::class, 'create']);
    Route::post('join', [LmsController::class, 'join']);
    Route::get('courses/{course}', [LmsController::class, 'show'])->whereNumber('course');
    Route::patch('courses/{course}', [LmsController::class, 'update'])->whereNumber('course');
    Route::post('courses/{course}/materials', [LmsController::class, 'upload'])->whereNumber('course');
    Route::get('materials/{material}/download', [LmsController::class, 'download'])->whereNumber('material');
    Route::patch('materials/{material}', [LmsController::class, 'visibility'])->whereNumber('material');
    Route::post('materials/{material}/read', [LmsController::class, 'read'])->whereNumber('material');
    Route::post('courses/{course}/assignments', [LmsController::class, 'assignment'])->whereNumber('course');
    Route::post('assignments/{assignment}/submit', [LmsController::class, 'submit'])->whereNumber('assignment');
    Route::post('assignments/{assignment}/status', [LmsController::class, 'assignmentStatus'])->whereNumber('assignment');
    Route::get('submissions/{submission}/download', [LmsController::class, 'submissionDownload'])->whereNumber('submission');
    Route::patch('submissions/{submission}/grade', [LmsController::class, 'grade'])->whereNumber('submission');
    Route::post('courses/{course}/attendance', [LmsController::class, 'attendance'])->whereNumber('course');
    Route::post('courses/{course}/announcements', [LmsController::class, 'announce'])->whereNumber('course');
    Route::post('materials/{material}/generate', [LmsController::class, 'generate'])->whereNumber('material')->middleware('throttle:5,1,lms-ai-');
    Route::get('drafts/{draft}', [LmsController::class, 'draft'])->whereNumber('draft');
    Route::patch('drafts/{draft}', [LmsController::class, 'saveDraft'])->whereNumber('draft');
    Route::post('drafts/{draft}/publish', [LmsController::class, 'publish'])->whereNumber('draft');
    Route::post('drafts/{draft}/close', [LmsController::class, 'close'])->whereNumber('draft');
    Route::post('drafts/{draft}/answers', [LmsController::class, 'answers'])->whereNumber('draft');
});
