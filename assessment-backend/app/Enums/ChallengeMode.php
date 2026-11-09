<?php

namespace App\Enums;

enum ChallengeMode: string
{
    case Normal = 'normal';
    case Time = 'time';
    case Accuracy = 'accuracy';
    case Survival = 'survival';
    case Team = 'team';
}
