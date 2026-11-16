<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\LmsNotification;
use App\Models\SchoolClass;

class LmsNotificationService
{
    public function notifyClassStudents(
        SchoolClass $schoolClass,
        NotificationType|string $type,
        string $title,
        ?string $body = null,
        array $data = [],
    ): void {
        $typeValue = $type instanceof NotificationType ? $type->value : $type;
        $studentIds = $schoolClass->students()->pluck('users.id');

        foreach ($studentIds as $studentId) {
            LmsNotification::query()->create([
                'user_id' => $studentId,
                'class_id' => $schoolClass->id,
                'type' => $typeValue,
                'title' => $title,
                'body' => $body,
                'data' => $data,
            ]);
        }
    }

    public function notifyUser(
        int $userId,
        ?int $classId,
        NotificationType|string $type,
        string $title,
        ?string $body = null,
        array $data = [],
    ): LmsNotification {
        $typeValue = $type instanceof NotificationType ? $type->value : $type;

        return LmsNotification::query()->create([
            'user_id' => $userId,
            'class_id' => $classId,
            'type' => $typeValue,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }
}
