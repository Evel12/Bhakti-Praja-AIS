<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AcademicCalendarController;
use App\Http\Controllers\AcademicRegistrationController;
use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClassroomController;
use App\Http\Controllers\ClassStudentController;
use App\Http\Controllers\CurriculumController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\ParentController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SemesterController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudyProgramController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\AdminOnly;

/*
|--------------------------------------------------------------------------
| Authentication (publik)
|--------------------------------------------------------------------------
*/

Route::post(
    '/auth/login',
    [AuthController::class, 'login']
);

Route::get('/school-profile', \App\Http\Controllers\SchoolProfileController::class);

/*
|--------------------------------------------------------------------------
| Area admin AIS (wajib token Sanctum + role admin di backend)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', AdminOnly::class])
    ->group(function () {

        Route::post(
            '/auth/logout',
            [AuthController::class, 'logout']
        );

        Route::get(
            '/auth/me',
            [AuthController::class, 'me']
        );

        Route::get(
            '/roles',
            [RoleController::class, 'index']
        );

        /*
        |--------------------------------------------------------------------------
        | Pengguna (database nyata)
        |--------------------------------------------------------------------------
        */

        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::patch('/users/{id}', [UserController::class, 'update']);
        Route::patch('/users/{id}/status', [UserController::class, 'updateStatus']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        /*
        |--------------------------------------------------------------------------
        | Data master akademik (database nyata — Tahap 4)
        |--------------------------------------------------------------------------
        */

        Route::apiResource('departments', DepartmentController::class);
        Route::apiResource('study-programs', StudyProgramController::class);
        Route::apiResource('teachers', TeacherController::class);
        Route::apiResource('students', StudentController::class);
        Route::apiResource('parents', ParentController::class);
        Route::apiResource('academic-years', AcademicYearController::class);
        Route::apiResource('semesters', SemesterController::class);
        Route::apiResource('academic-calendars', AcademicCalendarController::class);
        Route::apiResource('subjects', SubjectController::class);
        Route::apiResource('curricula', CurriculumController::class);
        Route::apiResource('rooms', RoomController::class);
        Route::apiResource('classrooms', ClassroomController::class);

        // Alias lama: /classes -> controller yang sama dengan /classrooms
        Route::get('/classes', [ClassroomController::class, 'index']);
        Route::post('/classes', [ClassroomController::class, 'store']);
        Route::get('/classes/{id}', [ClassroomController::class, 'show']);
        Route::put('/classes/{id}', [ClassroomController::class, 'update']);
        Route::patch('/classes/{id}', [ClassroomController::class, 'update']);
        Route::delete('/classes/{id}', [ClassroomController::class, 'destroy']);

        /*
        |--------------------------------------------------------------------------
        | Dashboard (masih mock, diganti DB nyata pada Tahap 6)
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/dashboard',
            [DashboardController::class, 'index']
        );

        /*
        |--------------------------------------------------------------------------
        | Administrasi akademik (database nyata — Tahap 5)
        |--------------------------------------------------------------------------
        */

        Route::apiResource('class-students', ClassStudentController::class);
        Route::apiResource('academic-registrations', AcademicRegistrationController::class);
        Route::apiResource('schedules', ScheduleController::class);
        Route::apiResource('teaching-loads', \App\Http\Controllers\TeachingLoadController::class);
    });
