<?php

use App\Http\Controllers\Member4\AnnouncementController;
use App\Http\Controllers\Member4\InvoiceController;
use App\Http\Controllers\Member4\NotificationController;
use App\Http\Controllers\Member4\ParentPortalController;
use App\Http\Controllers\Member4\PaymentController;
use App\Http\Controllers\Member4\FinanceReportController;
use App\Http\Middleware\AdminOnly;
use App\Http\Middleware\Member4Role;
use Illuminate\Support\Facades\Route;

Route::prefix('member4')->middleware(['auth:sanctum', Member4Role::class.':admin,guru,murid,wali_murid'])->group(function () {
    Route::middleware(Member4Role::class.':admin,murid,wali_murid')->group(function () {
        Route::get('invoices', [InvoiceController::class, 'index']);
        Route::get('invoices/{id}', [InvoiceController::class, 'show'])->whereNumber('id');
        Route::get('payments', [PaymentController::class, 'index']);
        Route::get('payments/{id}', [PaymentController::class, 'show'])->whereNumber('id');
        Route::get('payments/{id}/proof', [PaymentController::class, 'proof'])->whereNumber('id');
        Route::get('finance/summary', [FinanceReportController::class, 'summary']);
    });

    Route::post('invoices/{id}/payments', [PaymentController::class, 'store'])->whereNumber('id')->middleware(Member4Role::class.':murid,wali_murid');

    Route::middleware(Member4Role::class.':wali_murid')->prefix('parent')->group(function () {
        Route::get('children', [ParentPortalController::class, 'index']);
        Route::get('children/{student}', [ParentPortalController::class, 'show'])->whereNumber('student');
        Route::get('children/{student}/schedules', [ParentPortalController::class, 'schedules'])->whereNumber('student');
        Route::get('children/{student}/dashboard', [ParentPortalController::class, 'dashboard'])->whereNumber('student');
        Route::get('children/{student}/{section}', [ParentPortalController::class, 'academic'])->whereNumber('student')->where('section', 'grades|attendance|assignments|progress');
    });

    Route::get('announcements', [AnnouncementController::class, 'index']);
    Route::get('announcements/{id}', [AnnouncementController::class, 'show'])->whereNumber('id');
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id');

    Route::middleware(AdminOnly::class)->group(function () {
        Route::post('invoices/{id}/reminders', [\App\Http\Controllers\Member4\PaymentReminderController::class, 'store'])->whereNumber('id');
        Route::patch('payments/{id}/verification', [PaymentController::class, 'verify'])->whereNumber('id');
        Route::get('finance/reports', [FinanceReportController::class, 'report']);
        Route::post('invoices', [InvoiceController::class, 'store']);
        Route::match(['put', 'patch'], 'invoices/{id}', [InvoiceController::class, 'update'])->whereNumber('id');
        Route::post('announcements', [AnnouncementController::class, 'store']);
        Route::match(['put', 'patch'], 'announcements/{id}', [AnnouncementController::class, 'update'])->whereNumber('id');
        Route::delete('announcements/{id}', [AnnouncementController::class, 'destroy'])->whereNumber('id');
    });
});
