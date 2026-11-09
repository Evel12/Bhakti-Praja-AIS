<?php

namespace Database\Factories;

use App\Enums\ModuleVisibility;
use App\Models\Module;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Module> */
class ModuleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'class_id' => SchoolClass::factory(),
            'file_name' => 'lesson.pdf',
            'path' => 'modules/'.fake()->uuid().'.pdf',
            'visibility' => ModuleVisibility::Private,
        ];
    }
}
