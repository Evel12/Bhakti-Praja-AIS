# EXAMNIA — Panduan demo 

## Mulai demo

Jalankan dari folder `assessment-web/Frontend` dengan Node **22.22.2+ pada jalur 22**, **24.15.0+ pada jalur 24**, atau **26+**, serta npm. Versi dasar ada di `.node-version`; rentang yang didukung ada di `package.json`.

```powershell
npm ci
npm run check
npm run preview
```

Buka **http://127.0.0.1:4173/**. `check` menjalankan pengecekan motion, semua tes frontend, lalu build produksi. Untuk mengedit sambil melihat perubahan, pakai `npm run dev` sebagai pengganti `preview`. Keduanya menggunakan port 4173; jalankan salah satu saja.

API, database, dan worker tidak perlu dinyalakan untuk demo frontend ini.

## Alur demo, sekitar 8–10 menit

Gunakan **satu tab dan satu browser** agar data Pengajar dan Peserta tetap sama. Mulai dari profil browser khusus demo bila ingin data contoh baru. Data contoh dibuat saat penyimpanan masih kosong; jadwalnya tidak otomatis bergeser pada kunjungan berikutnya.

1. **Ringkasan pengajar.** Tunjukkan assessment aktif, pekerjaan yang perlu dicek, tenggat, dan nilai per kelas. Buka **Cek sekarang** untuk melihat antrean penilaian.
2. **Buat kuis.** Klik **Buat assessment**, isi judul seperti “Kuis Demo EXAMNIA”, pilih **Kuis** dan **Kelas A**. Peserta contoh adalah Rani Ayu di Kelas A.
3. **Susun soal.** Pada langkah **Konten**, pilih soal dari bank soal atau tulis sendiri. Isi pertanyaan, pilihan jawaban, kunci, dan poin. Tombol **Bantu dengan AI** hanya memasukkan soal contoh dari bank soal; PDF belum dianalisis. Cek soal contoh dan centang konfirmasi pengecekannya sebelum lanjut.
4. **Atur jadwal.** Gunakan waktu buka yang sudah lewat dan waktu tutup yang masih akan datang. Semua jadwal ditampilkan dalam **WIB**. Pilih rilis nilai **Manual oleh pengajar** supaya alur rilis bisa ditunjukkan.
5. **Cek sebelum terbit.** Buka **Preview**. Klik salah satu pesan validasi untuk langsung memperbaiki isian yang kurang. Setelah lengkap, klik **Terbitkan assessment** lalu konfirmasi. Konten terkunci setelah terbit; buat salinan untuk mengeditnya.
6. **Coba sebagai peserta.** Ganti pilihan di kanan atas menjadi **Peserta**. Buka kuis tadi, baca petunjuk, centang persetujuan, lalu mulai. Jawab soal, tandai satu soal yang masih ragu, dan buka **Cek & kirim**. Dari ringkasan, klik nomor soal untuk mengecek jawaban lagi, lalu kirim. Memuat ulang halaman tidak mengulang timer.
7. **Rilis nilai.** Kembali ke **Pengajar → Hasil & penilaian**, buka kuis tadi, lalu klik **Rilis hasil** dan konfirmasi. Kembali ke Peserta untuk melihat nilai dan jawaban. Tunjukkan **Download CSV** pada halaman hasil pengajar.
8. **Opsional: tugas file.** Buat assessment jenis **Tugas** untuk Kelas A dengan instruksi dan jadwal aktif. Sebagai Peserta, pilih PDF, DOCX, JPG, atau PNG maksimal **2 MB**, lalu klik **Kirim tugas**. Kembali ke Pengajar, buka **Nilai tugas**, isi nilai 0–100 dan feedback, simpan penilaian, lalu rilis hasil. File ini disimpan lokal di browser, bukan di server.

Jangan mengandalkan jadwal data contoh lama yang mungkin sudah ditutup. Buat assessment baru dengan jadwal aktif untuk demo langsung. Gunakan file dan data contoh.

## Penyimpanan dan pemulihan

- Data utama menggunakan localStorage dengan kunci `kulon-assessment-v1`. Draft penilaian juga tersimpan lokal. Menghapus data situs menghapus pekerjaan demo pada browser tersebut.
- Perubahan tidak tersinkron antarperangkat atau browser. Hindari mengedit data demo dari beberapa tab sekaligus.
- Untuk mengulang dari awal, gunakan profil browser demo yang baru. Jika perlu mempertahankan sesi lama, simpan salinan data sebelum menghapus penyimpanan situs.
- Jika data rusak/tidak cocok, aplikasi menampilkan layar pemulihan. Pilih **Download data asli** untuk menyimpan salinannya, lalu pulihkan file JSON cadangan yang valid. Aplikasi tidak diam-diam mengganti data yang rusak dengan data contoh.
- Browser bisa menolak penyimpanan saat kuota habis. Pesan gagal simpan berarti perubahan belum tersimpan; selesaikan masalah penyimpanan sebelum menutup halaman.

## Deploy demo frontend

Gunakan hosting statis dengan pengaturan berikut. Jika root repository adalah `assessment-web`, direktori build-nya `Frontend`; jika root hosting adalah folder luar project, gunakan `assessment-web/Frontend`.

| Pengaturan | Nilai |
| --- | --- |
| Versi Node | Sesuai `.node-version` / `engines` di `package.json` |
| Instalasi | `npm ci` |
| Build | `npm run build` |
| Folder yang dipublikasikan | `Frontend/dist` relatif terhadap root repository |
| URL aplikasi | Root domain, misalnya `https://demo.example/` |
| Navigasi | Hash router: `/#/dashboard`, `/#/student`, dan seterusnya |
| Backend untuk demo ini | Tidak dibutuhkan |

**Publikasikan hanya isi `dist`.** `npm run preview` dipakai untuk pengecekan lokal, bukan server produksi. Hash router tidak memerlukan rewrite setiap rute ke `index.html`. Jika ingin hosting dalam subfolder, atur Vite `base` dan sesuaikan path logo sebelum build; konfigurasi saat ini ditujukan untuk root domain.

Di hosting, aktifkan HTTPS. Sajikan `index.html` dengan revalidasi (`Cache-Control: no-cache`) dan aset bernama hash di `/assets/` dengan cache panjang (`public, max-age=31536000, immutable`). Pastikan tipe MIME JS/CSS benar. Setelah upload, cek logo, refresh halaman dengan hash route, pilihan peran, simpan draft, dan kirim jawaban pada domain tujuan. Pemeriksaan hosting/domain publik belum dilakukan di sesi ini.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| Frontend `npm run check` | Lulus: 18 tes domain/persistence + 198 tes komponen; motion guard dan build lulus |
| Instalasi bersih dari lockfile | Lulus dengan Node 22.22.2 setelah melengkapi dependency opsional yang sebelumnya hilang |
| Audit npm | 0 kerentanan setelah pembaruan dependensi test melalui overrides `glob` dan `minimatch` |
| Backend `php artisan test` | Lulus: 287 tes, 2.124 assertions; database SQLite terisolasi |
| Composer validate, audit, dan platform produksi | Lulus; 0 advisori dan 0 paket abandoned |
| Laravel Pint | Lulus |
| Cache konfigurasi dan route | Lulus; 33 route API; cache sementara dibersihkan setelah dicek |
| Tampilan browser | Lulus pada desktop 1440×1000 dan mobile 390×844; tidak ditemukan overflow horizontal pada halaman yang dicek |
| Deploy publik, MySQL langsung, SMTP, Redis multi-instance, dan AI sungguhan | Belum diverifikasi |

Tes dan build frontend terakhir dijalankan dari instalasi bersih dengan runtime sementara **Node 22.22.2**; Node yang terpasang di mesin tidak diubah. Untuk CI/deploy, gunakan versi yang tercantum di `.node-version` dan `engines`. Backend diverifikasi dengan PHP 8.4.0. Dependensi PHP terkunci membutuhkan **PHP 8.4+**, dan `composer.json` sudah disesuaikan.

Cakupan browser: dashboard pengajar, validasi builder/Preview, daftar hasil, navigasi mobile, pilihan peran, kartu peserta, petunjuk, sesi kuis, ringkasan sebelum kirim, serta halaman hasil. Uji langsung memakai assessment terpisah “Cek Deploy — Kuis 1 Nov 2026”: buat soal → terbitkan → jawab dan tandai ragu → refresh (jawaban/tanda tetap ada, timer tidak diulang) → kirim → cek nilai masih tersembunyi → rilis oleh pengajar → cek nilai 100/100 dan pembahasan sebagai peserta. CSV berhasil didownload dan isinya sesuai pengumpulan tersebut. Tidak ada warning/error browser pada alur ini. Uji ini memakai data lokal; alur API/AI sungguhan belum terhubung. Alur upload/penilaian tugas dicakup oleh tes otomatis, bukan uji browser langsung pada sesi ini.

Bukti tampilan: [hasil pengajar desktop](../outputs/deployment-desktop.png) dan [hasil peserta mobile](../outputs/deployment-mobile.png). Folder `outputs` berada satu tingkat di atas repository `assessment-web`.

## Yang masih menghalangi produksi

1. **Integrasi frontend dan API.** Repository frontend masih menggunakan localStorage. Login, logout, reset password, sesi, peran dari server, sinkronisasi kelas/assessment/jawaban/nilai, dan penanganan kegagalan API belum terpasang. URL reset password pada konfigurasi lokal belum memiliki halaman frontend.
2. **Kesamaan fitur dan data.** Frontend memakai ID/data contoh dan penilaian kuis berbobot poin. API memakai model tersendiri dan nilai akhir persentase jawaban benar. API menolak perubahan setelah satu jawaban dikirim, sedangkan UI membolehkan ganti jawaban sebelum sesi dikumpulkan. API hanya mengatur deadline; waktu buka dan durasi per sesi dari UI belum didukung. API juga belum punya flag/endpoint rilis manual: nilai dan review berkunci tersedia untuk pemilik sesi yang sudah selesai. Sepakati pemetaan data, pengiriman/perubahan jawaban, jadwal, aturan nilai, dan kapan hasil dibuka sebelum integrasi. Alur upload tugas, penilaian tugas manual, pengelolaan bank soal, dan pengelolaan modul/PDF di UI juga memerlukan endpoint yang sesuai; 33 route API yang ada belum mencakup seluruh alur tersebut.
3. **Keamanan ujian.** Soal dan kunci demo tersimpan di browser, dan peran bisa diganti bebas. UI ini belum menjadi batas otorisasi atau tempat penilaian tepercaya. Aplikasi produksi harus mengambil identitas/izin dari server dan memakai penilaian serta proteksi kunci jawaban dari API.
4. **AI sungguhan.** Service Python terpisah belum tersedia/terverifikasi. Pastikan kontrak request/response, pengelolaan sumber PDF, dan worker berjalan sebelum menampilkan pembuatan soal sebagai fitur aktif.
5. **Infrastruktur produksi.** Verifikasi migrasi dan konkurensi pada MySQL, SMTP untuk reset password, HTTPS/proxy, backup dan restore database/file, penyimpanan privat, shared cache limiter jika ada lebih dari satu instance, worker terawasi, scheduler, dan pemantauan error. Uji alur lengkap pada staging dengan akun pengajar/peserta yang berbeda.

## Menjalankan API secara terpisah

API ada di `Backend/`. Siapkan **PHP 8.4+ 64-bit**, Composer, MySQL, dan extension PHP yang dibutuhkan Laravel, termasuk PDO MySQL; PDO SQLite dibutuhkan untuk tes. Cek lingkungan dengan `composer check-platform-reqs`. HTTP adapter juga membutuhkan cURL, OpenSSL, dan fileinfo. Node bukan kebutuhan runtime API.

```powershell
cd Backend
composer install
# Hanya jika .env belum ada:
Copy-Item .env.example .env
# Hanya untuk instalasi baru:
php artisan key:generate
```

Buat database lokal `examnia`, lalu sesuaikan `DB_*` di `.env`. Jangan menimpa `.env` atau mengganti `APP_KEY` instalasi yang sudah ada.

```powershell
php artisan migrate
php artisan db:seed
php artisan serve --host=127.0.0.1 --port=8000
```

Base URL API: `http://127.0.0.1:8000/api`. Seeder hanya boleh berjalan pada lingkungan local/testing. Akun contoh: `admin@example.test`, `teacher@example.test`, `student1@example.test`, dan `student2@example.test`; password awal bersama **`DemoPassword123!`**. Akun API ini tidak dipakai oleh pilihan peran frontend saat ini. Seeder membuat kelas, anggota, dan kuis pilihan ganda; tidak membuat modul/PDF.

Contoh request tetap ada di `Backend/docs/phase-1-api.http`, `phase-3-api.http`, `phase-4-api.http`, `phase-5-api.http`, `phase-6-api.http`, dan `phase-7-api.http`. Login mengembalikan token Sanctum; kirim sebagai `Authorization: Bearer <token>`. Token default berlaku 120 menit. API tidak menyediakan pendaftaran publik atau penggantian peran dari klien. Untuk integrasi browser, simpan bearer token di memori. Peralihan ke autentikasi cookie membutuhkan konfigurasi CSRF/CORS/session yang terkoordinasi.

```powershell
composer test
composer validate --strict
composer audit
php vendor/laravel/pint/builds/pint --test
php artisan route:list --path=api --except-vendor
```

## Catatan deploy API setelah integrasi siap

- Arahkan document root web server ke **`Backend/public`**, dengan hostname yang dibatasi. `.env`, `vendor`, `storage`, dan sumber kode tidak boleh disajikan dari web.
- Gunakan `APP_ENV=production`, `APP_DEBUG=false`, URL HTTPS, kredensial database produksi, SMTP sungguhan, dan `LOG_LEVEL=warning`. Contoh `.env` lokal bukan konfigurasi produksi.
- Atur `FRONTEND_ORIGINS` ke origin frontend yang sebenarnya, `PASSWORD_RESET_URL` ke halaman reset yang sudah dibuat, dan `TRUSTED_PROXIES` ke IP/CIDR proxy yang sebenarnya. Jangan gunakan wildcard proxy. Aktifkan `API_HSTS_MAX_AGE` hanya setelah HTTPS siap.
- Jika menjalankan beberapa instance, gunakan penyimpanan bersama untuk cache dan limiter, misalnya `CACHE_STORE=redis` dan `CACHE_LIMITER=redis`, dengan driver/kredensial yang sesuai. Default lokal menggunakan file dan tidak berbagi batas antarhost.
- Beri proses web akses tulis hanya ke `storage` dan `bootstrap/cache` sesuai kebutuhan. Jaga file modul, database, log, dan backup tetap persisten dan privat; atur batas ukuran request di proxy dan PHP.
- Backup database target dan cek migrasi sebelum release. Instalasi produksi menggunakan `composer install --no-dev --optimize-autoloader`, lalu `php artisan migrate --force`, `php artisan config:cache`, `php artisan route:cache`, dan `php artisan queue:restart` sesuai proses release host. Jangan menjalankan demo seeder pada produksi.
- Awasi worker `php artisan queue:work quiz-generation --queue=quiz-generation --tries=3 --timeout=75`. Jadwalkan `php artisan schedule:run` setiap menit. Restart worker saat kode/konfigurasi berubah.
- Health route `/up` menunjukkan aplikasi bisa boot; tetap cek koneksi database, antrean, SMTP, dan alur pengguna secara terpisah.

### Kontrak AI yang perlu dikonfirmasi

Konfigurasi ada di `Backend/config/quiz_generation.php` dan `AI_SERVICE_*` pada `.env.example`. Adapter referensi mengirim POST multipart ke `/generate-quiz`: `file` berisi PDF, `question_count` antara 1–50, header bearer untuk service, serta `Idempotency-Key: quiz-generation-<id>`. PDF maksimal 20 MiB; respons maksimal 1 MiB. Modul dan PDF privat harus sudah tersedia.

Respons berupa `title`, `description` opsional, dan `questions` sejumlah yang diminta. Tiap soal memiliki `question_text`, `question_type: multiple_choice`, dan empat opsi berlabel A–D dengan `option_text` serta boolean `is_correct`; tepat satu opsi benar. Hasil disimpan sebagai draft dan tidak pernah langsung diterbitkan. POST API mengembalikan 202; poll status sampai `completed` atau `failed`. Batas waktu HTTP default 60 detik, koneksi 10 detik, worker 75 detik, reservasi antrean 120 detik. Ada tiga percobaan dengan backoff 10/30 detik. Request terminal yang gagal perlu dibuat ulang setelah penyebabnya diperbaiki.

Panduan deployment mengacu pada [Vite static deployment](https://vite.dev/guide/static-deploy.html) dan [Laravel deployment](https://laravel.com/framework/docs/13.x/deployment). Dokumen ini menggantikan README, rencana lama, dan laporan fase Markdown yang sudah tersebar. Contoh HTTP, sumber aplikasi, tes, dan bukti gambar tetap tersedia.
