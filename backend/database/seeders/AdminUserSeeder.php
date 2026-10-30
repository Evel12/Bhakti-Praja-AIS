<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminEmail = env('DEMO_ADMIN_EMAIL', 'admin@akademik.test');
        $adminPassword = env('DEMO_ADMIN_PASSWORD', 'admin123');

        $adminRole = Role::where('name', 'admin')->firstOrFail();

        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Administrator',
                'password' => $adminPassword,
                'role_id' => $adminRole->id,
                'status' => User::STATUS_ACTIVE,
            ]
        );

        $demo = [
            [
                'name' => 'Budi Guru',
                'email' => 'budi@akademik.test',
                'password' => 'guru12345',
                'role' => 'guru',
            ],
            [
                'name' => 'Andi Murid',
                'email' => 'andi@akademik.test',
                'password' => 'murid12345',
                'role' => 'murid',
            ],
            [
                'name' => 'Agus Wali',
                'email' => 'agus@akademik.test',
                'password' => 'wali12345',
                'role' => 'wali_murid',
            ],
        ];

        foreach ($demo as $row) {
            $role = Role::where('name', $row['role'])->first();

            if (! $role) {
                continue;
            }

            User::updateOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'password' => $row['password'],
                    'role_id' => $role->id,
                    'status' => User::STATUS_ACTIVE,
                ]
            );
        }
    }
}
