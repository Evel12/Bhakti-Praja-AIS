<?php

namespace Database\Factories;

use App\Models\ClassMember;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ClassMember> */
class ClassMemberFactory extends Factory
{
    public function definition(): array
    {
        return ['class_id' => SchoolClass::factory(), 'student_id' => User::factory()];
    }
}
