<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SchoolClass> */
class SchoolClassFactory extends Factory
{
    public function definition(): array
    {
        return [
            'teacher_id' => User::factory()->state(['role' => Role::Teacher]),
            'name' => 'Class '.fake()->bothify('##??'),
        ];
    }
}
