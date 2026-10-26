# EXAMNIA — Implementasi frontend

Tanggal: 26 Oktober 2026

## Hasil

- Migrasi halaman dan interaksi ke Vue 3 SFC, Composition API, Vue Router hash, serta Pinia.
- Vite menghasilkan dist; Tailwind CSS 4 mengelola token dan komponen dasar bersama stylesheet desain Star White.
- Branding EXAMNIA di sidebar, header, ruang ujian, footer, judul, deskripsi, favicon, dan package.
- Logo Tut Wuri Handayani lokal; sumber tercatat di branding.md.
- Sidebar desktop 248/80 px dengan tooltip dan submenu popover. Drawer mobile dengan overlay, fokus terjaga, Escape, dan route close.
- Builder dipisah ke IdentityStep, ContentStep, SettingsStep, dan PreviewStep; soal menggunakan editor dan preview bersama.
- Seluruh rute lama dipertahankan; halaman pengajar, bank soal, hasil, penilaian tugas, peserta, timer, review, dan hasil saya tersedia.
- Persistensi v1 memakai key legacy; data invalid membuka pemulihan, gagal tulis tidak menampilkan keberhasilan atau mengganti state.
- Timer memakai deadline lama, interval dibersihkan saat unmount, dan pengiriman tetap idempotent.

## Pembersihan

Sumber lama dalam dist telah dipindah ke src. Dist dan node_modules merupakan hasil yang diabaikan Git. Server statis server.mjs diganti scripts Vite. File percobaan assessment-preview-script.js, unduhan HTML untuk pencarian logo, dan archive deployment lama dihapus. README dan dokumentasi dipertahankan; sumber baseline tetap tersedia melalui Git.

## Verifikasi

- 7 aturan domain awal dipertahankan, ditambah 4 tes persistensi dan 6 tes Vue/store/lifecycle: total 17 tes.
- Uji browser lengkap: buat kuis, pilih bank soal, jadwal dan terbit, mulai sebagai peserta, jawab, tandai ragu, refresh, kirim, hasil tersembunyi, rilis oleh pengajar, nilai 100 dan pembahasan tampil.
- Uji browser tugas: buat dan terbit, unggah PNG uji, kirim, beri nilai 88/umpan balik, rilis, hasil tampil bagi peserta.
- Data assessment lama dan attempt dari 18 Oktober tetap terbaca. Tenggat lama tetap ditutup; tanggal lama tidak digeser.
- Sidebar ringkas bertahan setelah refresh, submenu dapat ditutup Escape. Drawer mobile menutup setelah navigasi dan fokus kembali ke pemicu saat Escape.
- Pemeriksaan bank soal pada lebar 360, 390, 768, 1024, dan 1440 px tidak menunjukkan overflow horizontal.
- Temuan CSS drawer visibility dan pengolahan static asset dalam Vitest Windows diperbaiki.
- npm audit pada lockfile yang diperbarui: 0 kerentanan. Vitest diperbarui ke 4.1.12.

Catatan lingkungan: Vitest 4 memerlukan eksekusi di luar sandbox Windows pada sesi ini karena operasi rename cache sementara diblokir. Tes dijalankan dengan Node 24.22.1. Pada lingkungan biasa, npm test digunakan langsung.

## Batas dan tindak lanjut backend

Implementasi mencakup fase frontend. API Laravel, autentikasi/otorisasi, MySQL, penyimpanan file server, sinkronisasi antarpengguna, dan AI PDF belum terhubung. Repository API mendatang harus menunggu acknowledgement server; transaksi lokal saat ini sinkron agar kegagalan tulis segera terdeteksi. Empat tahap editor terpisah; pengelolaan dialog memakai komponen native dialog bersama.

Origin Site dipertahankan untuk kompatibilitas localStorage. Rollback ke versi sebelumnya menggunakan schema v1 yang sama. Baseline commit: 62da71cca58fee69554fbdc78f50eddd7a8d44fc. Hindari menghapus localStorage saat pemulihan rilis.

Data pengujian browser diberi judul QA EXAMNIA dan hanya disimpan lokal, tidak disertakan dalam build maupun repository.
