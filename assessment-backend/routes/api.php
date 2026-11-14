<?php

use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AssignmentController;
use App\Http\Controllers\Api\AttemptController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClassModuleController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OptionController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\QuizGenerationController;
use App\Http\Controllers\Api\ReportingController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->name('auth.')->group(function (): void {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login')->name('login');
    Route::post('sso', [AuthController::class, 'sso'])->middleware('throttle:login')->name('sso');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset')->name('forgot-password');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset')->name('reset-password');

    Route::middleware(['auth:sanctum', 'throttle:assessment-api'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    });
});

Route::middleware(['auth:sanctum', 'role:teacher,student', 'throttle:assessment-api'])->group(function (): void {
    Route::get('classes', [ClassModuleController::class, 'index'])->name('classes.index');
    Route::get('classes/{schoolClass}', [ClassModuleController::class, 'showClass'])->whereNumber('schoolClass')->name('classes.show');
    Route::get('classes/{schoolClass}/modules', [ClassModuleController::class, 'modules'])->whereNumber('schoolClass')->name('classes.modules.index');
    Route::get('classes/{schoolClass}/progress', [ClassModuleController::class, 'classProgress'])->whereNumber('schoolClass')->name('classes.progress');
    Route::get('classes/{schoolClass}/assignments', [AssignmentController::class, 'index'])->whereNumber('schoolClass')->name('classes.assignments.index');
    Route::get('assignments/{assignment}', [AssignmentController::class, 'show'])->whereNumber('assignment')->name('assignments.show');
    Route::get('classes/{schoolClass}/announcements', [AnnouncementController::class, 'index'])->whereNumber('schoolClass')->name('classes.announcements.index');
    Route::get('modules/{module}/download', [ClassModuleController::class, 'downloadModule'])->whereNumber('module')->name('modules.download');
    Route::get('classes/{schoolClass}/quizzes', [QuizController::class, 'index'])->whereNumber('schoolClass')->name('classes.quizzes.index');

    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead'])->middleware('throttle:quiz-writes')->name('notifications.read-all');
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->whereNumber('notification')->middleware('throttle:quiz-writes')->name('notifications.read');
});

Route::middleware(['auth:sanctum', 'role:student', 'throttle:assessment-api'])->group(function (): void {
    Route::post('classes/join', [ClassModuleController::class, 'joinClass'])->middleware('throttle:quiz-writes')->name('classes.join');
    Route::delete('classes/{schoolClass}/leave', [ClassModuleController::class, 'leaveClass'])->whereNumber('schoolClass')->middleware('throttle:quiz-writes')->name('classes.leave');
    Route::post('modules/{module}/read', [ClassModuleController::class, 'markModuleRead'])->whereNumber('module')->middleware('throttle:quiz-writes')->name('modules.read');

    Route::get('students/me/grades', [ReportingController::class, 'personal'])->middleware('throttle:reports')->name('reports.personal');
    Route::get('attempts/{attempt}/review', [ReportingController::class, 'studentReview'])->middleware('throttle:reports')->name('reports.student-review');
    Route::post('quizzes/{quiz}/attempts', [AttemptController::class, 'store'])->middleware('throttle:attempt-starts')->name('attempts.store');
    Route::get('attempts/{attempt}', [AttemptController::class, 'show'])->name('attempts.show');
    Route::get('attempts/{attempt}/questions', [AttemptController::class, 'questions'])->name('attempts.questions');
    Route::post('attempts/{attempt}/answers', [AttemptController::class, 'answer'])->name('attempts.answer');
    Route::post('attempts/{attempt}/finish', [AttemptController::class, 'finish'])->name('attempts.finish');
});

Route::middleware(['auth:sanctum', 'role:teacher', 'throttle:assessment-api'])->scopeBindings()->group(function (): void {
    Route::post('classes', [ClassModuleController::class, 'storeClass'])->middleware('throttle:quiz-writes')->name('classes.store');
    Route::match(['put', 'patch'], 'classes/{schoolClass}', [ClassModuleController::class, 'updateClass'])->whereNumber('schoolClass')->middleware('throttle:quiz-writes')->name('classes.update');
    Route::post('classes/{schoolClass}/modules', [ClassModuleController::class, 'storeModule'])->whereNumber('schoolClass')->middleware('throttle:quiz-writes')->name('classes.modules.store');
    Route::patch('modules/{module}/visibility', [ClassModuleController::class, 'setModuleVisibility'])->whereNumber('module')->middleware('throttle:quiz-writes')->name('modules.visibility');
    Route::delete('modules/{module}', [ClassModuleController::class, 'destroyModule'])->whereNumber('module')->middleware('throttle:quiz-writes')->name('modules.destroy');

    Route::post('classes/{schoolClass}/assignments', [AssignmentController::class, 'store'])->whereNumber('schoolClass')->middleware('throttle:quiz-writes')->name('classes.assignments.store');
    Route::match(['put', 'patch'], 'assignments/{assignment}', [AssignmentController::class, 'update'])->whereNumber('assignment')->middleware('throttle:quiz-writes')->name('assignments.update');
    Route::post('assignments/{assignment}/publish', [AssignmentController::class, 'publish'])->whereNumber('assignment')->middleware('throttle:quiz-writes')->name('assignments.publish');
    Route::delete('assignments/{assignment}', [AssignmentController::class, 'destroy'])->whereNumber('assignment')->middleware('throttle:quiz-writes')->name('assignments.destroy');

    Route::post('classes/{schoolClass}/announcements', [AnnouncementController::class, 'store'])->whereNumber('schoolClass')->middleware('throttle:quiz-writes')->name('classes.announcements.store');
    Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy'])->whereNumber('announcement')->middleware('throttle:quiz-writes')->name('announcements.destroy');

    Route::post('modules/{module}/generate-quiz', [QuizGenerationController::class, 'store'])->middleware('throttle:quiz-generation')->name('quiz-generations.store');
    Route::get('quiz-generations/{quizGeneration}', [QuizGenerationController::class, 'show'])->name('quiz-generations.show');
    Route::get('classes/{schoolClass}/gradebook', [ReportingController::class, 'gradebook'])->middleware('throttle:reports')->name('reports.gradebook');
    Route::get('quizzes/{quiz}/grades', [ReportingController::class, 'quiz'])->middleware('throttle:reports')->name('reports.quiz');
    Route::get('quizzes/{quiz}/attempts/{attempt}/review', [ReportingController::class, 'teacherReview'])->middleware('throttle:reports')->name('reports.teacher-review');
    Route::patch('attempts/{attempt}/grade', [ReportingController::class, 'gradeAttempt'])->whereNumber('attempt')->middleware('throttle:quiz-writes')->name('reports.grade-attempt');
    Route::post('quizzes', [QuizController::class, 'store'])->middleware('throttle:quiz-writes')->name('quizzes.store');
    Route::get('quizzes/{quiz}', [QuizController::class, 'show'])->name('quizzes.show');
    Route::match(['put', 'patch'], 'quizzes/{quiz}', [QuizController::class, 'update'])->middleware('throttle:quiz-writes')->name('quizzes.update');
    Route::delete('quizzes/{quiz}', [QuizController::class, 'destroy'])->middleware('throttle:quiz-writes')->name('quizzes.destroy');
    Route::post('quizzes/{quiz}/publish', [QuizController::class, 'publish'])->middleware('throttle:quiz-writes')->name('quizzes.publish');
    Route::post('quizzes/{quiz}/close', [QuizController::class, 'close'])->middleware('throttle:quiz-writes')->name('quizzes.close');
    Route::post('quizzes/{quiz}/archive', [QuizController::class, 'archive'])->middleware('throttle:quiz-writes')->name('quizzes.archive');
    Route::post('quizzes/{quiz}/duplicate', [QuizController::class, 'duplicate'])->middleware('throttle:quiz-writes')->name('quizzes.duplicate');
    Route::post('quizzes/{quiz}/release-results', [QuizController::class, 'releaseResults'])->middleware('throttle:quiz-writes')->name('quizzes.release-results');

    Route::get('question-bank', [QuestionController::class, 'bankIndex'])->name('question-bank.index');
    Route::post('question-bank', [QuestionController::class, 'bankStore'])->middleware('throttle:quiz-writes')->name('question-bank.store');
    Route::delete('question-bank/{question}', [QuestionController::class, 'bankDestroy'])->whereNumber('question')->middleware('throttle:quiz-writes')->name('question-bank.destroy');

    Route::get('quizzes/{quiz}/questions', [QuestionController::class, 'index'])->name('questions.index');
    Route::post('quizzes/{quiz}/questions', [QuestionController::class, 'store'])->middleware('throttle:quiz-writes')->name('questions.store');
    Route::get('quizzes/{quiz}/questions/{question}', [QuestionController::class, 'show'])->name('questions.show');
    Route::match(['put', 'patch'], 'quizzes/{quiz}/questions/{question}', [QuestionController::class, 'update'])->middleware('throttle:quiz-writes')->name('questions.update');
    Route::post('quizzes/{quiz}/questions/{question}/review', [QuestionController::class, 'review'])->middleware('throttle:quiz-writes')->name('questions.review');
    Route::delete('quizzes/{quiz}/questions/{question}', [QuestionController::class, 'destroy'])->middleware('throttle:quiz-writes')->name('questions.destroy');

    Route::get('quizzes/{quiz}/questions/{question}/options', [OptionController::class, 'index'])->name('options.index');
    Route::put('quizzes/{quiz}/questions/{question}/options', [OptionController::class, 'replace'])->middleware('throttle:quiz-writes')->name('options.replace');
    Route::get('quizzes/{quiz}/questions/{question}/options/{option}', [OptionController::class, 'show'])->name('options.show');
    Route::patch('quizzes/{quiz}/questions/{question}/options/{option}', [OptionController::class, 'update'])->middleware('throttle:quiz-writes')->name('options.update');
});
