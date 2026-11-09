<?php

namespace App\Enums;

enum AttemptStatus: string
{
    case Ongoing = 'ongoing';
    case Finished = 'finished';
}
