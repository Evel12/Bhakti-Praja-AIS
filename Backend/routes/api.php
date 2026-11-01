<?php

use App\Http\Controllers\Api\AttemptController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OptionController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\QuizGenerationController;
use App\Http\Controllers\Api\ReportingController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->name('auth.')->group(function (): void {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login')->name('login');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset')->name('forgot-password');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset')->name('reset-password');

    Route::middleware(['auth:sanctum', 'throttle:assessment-api'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    });
});

Route::middleware(['auth:sanctum', 'role:teacher,student', 'throttle:assessment-api'])->group(function (): void {
    Route::get('classes/{schoolClass}/quizzes', [QuizController::class, 'index'])->name('classes.quizzes.index');
});

Route::middleware(['auth:sanctum', 'role:student', 'throttle:assessment-api'])->group(function (): void {
    Route::get('students/me/grades', [ReportingController::class, 'personal'])->middleware('throttle:reports')->name('reports.personal');
    Route::get('attempts/{attempt}/review', [ReportingController::class, 'studentReview'])->middleware('throttle:reports')->name('reports.student-review');
    Route::post('quizzes/{quiz}/attempts', [AttemptController::class, 'store'])->middleware('throttle:attempt-starts')->name('attempts.store');
    Route::get('attempts/{attempt}', [AttemptController::class, 'show'])->name('attempts.show');
    Route::get('attempts/{attempt}/questions', [AttemptController::class, 'questions'])->name('attempts.questions');
    Route::post('attempts/{attempt}/answers', [AttemptController::class, 'answer'])->name('attempts.answer');
    Route::post('attempts/{attempt}/finish', [AttemptController::class, 'finish'])->name('attempts.finish');
});

Route::middleware(['auth:sanctum', 'role:teacher', 'throttle:assessment-api'])->scopeBindings()->group(function (): void {
    Route::post('modules/{module}/generate-quiz', [QuizGenerationController::class, 'store'])->middleware('throttle:quiz-generation')->name('quiz-generations.store');
    Route::get('quiz-generations/{quizGeneration}', [QuizGenerationController::class, 'show'])->name('quiz-generations.show');
    Route::get('classes/{schoolClass}/gradebook', [ReportingController::class, 'gradebook'])->middleware('throttle:reports')->name('reports.gradebook');
    Route::get('quizzes/{quiz}/grades', [ReportingController::class, 'quiz'])->middleware('throttle:reports')->name('reports.quiz');
    Route::get('quizzes/{quiz}/attempts/{attempt}/review', [ReportingController::class, 'teacherReview'])->middleware('throttle:reports')->name('reports.teacher-review');
    Route::post('quizzes', [QuizController::class, 'store'])->middleware('throttle:quiz-writes')->name('quizzes.store');
    Route::get('quizzes/{quiz}', [QuizController::class, 'show'])->name('quizzes.show');
    Route::match(['put', 'patch'], 'quizzes/{quiz}', [QuizController::class, 'update'])->middleware('throttle:quiz-writes')->name('quizzes.update');
    Route::delete('quizzes/{quiz}', [QuizController::class, 'destroy'])->middleware('throttle:quiz-writes')->name('quizzes.destroy');
    Route::post('quizzes/{quiz}/publish', [QuizController::class, 'publish'])->middleware('throttle:quiz-writes')->name('quizzes.publish');
    Route::post('quizzes/{quiz}/close', [QuizController::class, 'close'])->middleware('throttle:quiz-writes')->name('quizzes.close');

    Route::get('quizzes/{quiz}/questions', [QuestionController::class, 'index'])->name('questions.index');
    Route::post('quizzes/{quiz}/questions', [QuestionController::class, 'store'])->middleware('throttle:quiz-writes')->name('questions.store');
    Route::get('quizzes/{quiz}/questions/{question}', [QuestionController::class, 'show'])->name('questions.show');
    Route::match(['put', 'patch'], 'quizzes/{quiz}/questions/{question}', [QuestionController::class, 'update'])->middleware('throttle:quiz-writes')->name('questions.update');
    Route::delete('quizzes/{quiz}/questions/{question}', [QuestionController::class, 'destroy'])->middleware('throttle:quiz-writes')->name('questions.destroy');

    Route::get('quizzes/{quiz}/questions/{question}/options', [OptionController::class, 'index'])->name('options.index');
    Route::put('quizzes/{quiz}/questions/{question}/options', [OptionController::class, 'replace'])->middleware('throttle:quiz-writes')->name('options.replace');
    Route::get('quizzes/{quiz}/questions/{question}/options/{option}', [OptionController::class, 'show'])->name('options.show');
    Route::patch('quizzes/{quiz}/questions/{question}/options/{option}', [OptionController::class, 'update'])->middleware('throttle:quiz-writes')->name('options.update');
});
