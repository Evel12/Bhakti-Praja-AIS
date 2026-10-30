<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'admin',
                'display_name' => 'Admin',
                'description' => 'Administrator Core Academic Information System.',
            ],
            [
                'name' => 'guru',
                'display_name' => 'Guru',
                'description' => 'Guru pengampu pembelajaran (modul LMS).',
            ],
            [
                'name' => 'murid',
                'display_name' => 'Murid',
                'description' => 'Siswa/murid terdaftar.',
            ],
            [
                'name' => 'wali_murid',
                'display_name' => 'Wali Murid',
                'description' => 'Orang tua/wali murid (modul Parent Portal).',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}
