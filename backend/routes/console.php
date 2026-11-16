<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('academic:sync-users {--apply : Connect existing accounts and create missing academic profiles}', function () {
    if (! $this->option('apply')) {
        $this->info('Akun guru/murid: '.\App\Models\User::whereHas('role', fn ($q) => $q->whereIn('name', ['guru', 'murid']))->count());
        $this->info('Gunakan --apply untuk menghubungkan profil. Nomor sementara AKUN-ID tidak menggantikan NIS/NIP yang sudah ada.');
        return;
    }
    $this->info('Profil diperiksa: '.app(\App\Services\AcademicProfiles::class)->reconcile());
})->purpose('Connect student and teacher accounts to academic profiles');
