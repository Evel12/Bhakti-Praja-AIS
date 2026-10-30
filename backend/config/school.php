<?php

return [
    'name' => 'SMK Bhakti Praja Batang',
    'short_name' => 'SMK Bhakti Praja',
    'npsn' => '20322714',
    'address' => 'Jl. Ki Mangunsarkoro No. 45, Proyonanggan Selatan, Batang, Jawa Tengah 51211',
    'phone' => '02854496582',
    'email' => 'smkbhaktiprajabatang@yahoo.co.id',
    'website' => 'https://www.skabhaprabatang.sch.id/',
    'foundation' => 'Yayasan Bhakti Praja KORPRI Kabupaten Batang',
    'checked_at' => '2026-10-29',
    'program_source_year' => '2023/2024',
    'curriculum_note' => 'Katalog awal memakai rujukan publik. Kurikulum referensi belum disahkan sekolah. Lengkapi KOSP, tahun pelajaran, mata pelajaran pilihan, muatan lokal, dan alokasi JP sebelum mengaktifkannya.',
    'sources' => [
        ['label' => 'Identitas sekolah · Kemendikdasmen', 'url' => 'https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/20322714'],
        ['label' => 'Program dan konsentrasi · SK Dinas Pendidikan Jawa Tengah 420/03574 (2023/2024), hlm. PDF 235', 'url' => 'https://file.data.kemendikdasmen.go.id/sk/1157028-120985-219346-48555515-949222384.pdf'],
        ['label' => 'Rujukan mata pelajaran SMK · Kemendikdasmen', 'url' => 'https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/smk/sejarah/'],
        ['label' => 'Panduan kurikulum nasional', 'url' => 'https://kurikulum.kemendikdasmen.go.id/'],
        ['label' => 'Penyesuaian PKK menjadi KIK · Rencana Strategis Kemendikdasmen 2025–2029', 'url' => 'https://jdih.kemendikdasmen.go.id/sjdih/siperpu/dokumen/salinan/Permendikdasmen_Nomor_19_Tahun_2025_tentang_Rencana_Strategis_Kementerian_Pendidikan_Dasar_dan_Menengah_Tahun_2025_2029.pdf'],
    ],
    // Department = program keahlian; study program = konsentrasi keahlian.
    // Codes prefixed BP are application identifiers, not official Dapodik codes.
    'programs' => [
        ['code' => 'BP-TM', 'name' => 'Teknik Mesin', 'concentrations' => [
            ['code' => 'BP-TMI', 'name' => 'Teknik Mekanik Industri'],
        ]],
        ['code' => 'BP-TO', 'name' => 'Teknik Otomotif', 'concentrations' => [
            ['code' => 'BP-TKR', 'name' => 'Teknik Kendaraan Ringan'],
            ['code' => 'BP-TSM', 'name' => 'Teknik Sepeda Motor'],
        ]],
        ['code' => 'BP-PPLG', 'name' => 'Pengembangan Perangkat Lunak dan Gim', 'concentrations' => [
            ['code' => 'BP-RPL', 'name' => 'Rekayasa Perangkat Lunak'],
        ]],
    ],
];
