<?php

namespace App\Enums;

enum NotificationType: string
{
    case QuizPublished = 'quiz_published';
    case AssignmentPublished = 'assignment_published';
    case AnnouncementPosted = 'announcement_posted';
    case GradeReleased = 'grade_released';
}
