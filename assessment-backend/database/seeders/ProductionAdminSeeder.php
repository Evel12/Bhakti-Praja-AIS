<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use InvalidArgumentException;

class ProductionAdminSeeder extends Seeder
{
    /**
     * Create or verify a single initial administrator from environment variables.
     */
    public function run(): void
    {
        $name = trim((string) env('BOOTSTRAP_ADMIN_NAME', 'Administrator Sekolah'));
        $email = strtolower(trim((string) env('BOOTSTRAP_ADMIN_EMAIL', '')));
        $password = (string) env('BOOTSTRAP_ADMIN_PASSWORD', '');

        if ($email === '' || str_ends_with($email, '@example.test')) {
            throw new InvalidArgumentException('Set a non-demo BOOTSTRAP_ADMIN_EMAIL before running ProductionAdminSeeder.');
        }

        if (strlen($password) < 12 || $password === DemoAssessmentSeeder::PASSWORD) {
            throw new InvalidArgumentException('Set BOOTSTRAP_ADMIN_PASSWORD with at least 12 characters and never use demo passwords.');
        }

        User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name !== '' ? $name : 'Administrator Sekolah',
                'password' => $password,
                'role' => Role::Admin,
                'email_verified_at' => now(),
            ],
        );
    }
}
