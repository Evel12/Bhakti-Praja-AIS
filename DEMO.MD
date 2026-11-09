# SMK Bhakti Praja Batang — Panduan Pengujian & Demo Website

Dokumen ini berisi panduan lengkap untuk menjalankan, menguji, dan mendemokan website assessment **SMK Bhakti Praja Batang** (*Sistem Pembelajaran E-Learning Interaktif Berbasis Web dengan Fitur Pembuatan Kuis Otomatis Menggunakan AI*), baik dalam mode **Full-Stack (Frontend Vue 3 + Backend Laravel 13 API)** maupun **Mode Mandiri (Frontend Local Fallback)**.

---

## 1. Menjalankan Aplikasi

### Opsi A — Mode Full-Stack (Backend API + Frontend SPA) *(Direkomendasikan)*

Gunakan **dua terminal PowerShell** terpisah.

#### Terminal 1: Menjalankan Backend Laravel API (`http://127.0.0.1:8000`)
Pastikan **PHP 8.4+**, Composer, dan ekstensi database (MySQL atau SQLite) aktif:

```powershell
cd Backend
composer install

# Salin konfigurasi .env jika belum ada
if (!(Test-Path .env)) { Copy-Item .env.example .env; php artisan key:generate }

# Jalankan migrasi & seeder akun demo
php artisan migrate
php artisan db:seed

# Jalankan server API di port 8000
php artisan serve --host=127.0.0.1 --port=8000
```

#### Terminal 2: Menjalankan Frontend Vue 3 SPA (`http://127.0.0.1:4173`)
Pastikan **Node.js 22.22.2+** (atau 24.15.0+ / 26+) terpasang:

```powershell
cd Frontend
npm ci
npm run dev
```
*(Atau gunakan `npm run check` lalu `npm run preview` untuk menjalankan hasil build produksi di port `4173`.)*

Buka browser ke: **`http://127.0.0.1:4173/`**

---

### Opsi B — Mode Mandiri (Frontend Tanpa Server Backend)
Jika server Backend (`127.0.0.1:8000`) tidak dinyalakan, Frontend otomatis beralih ke **Local Demo Fallback** (`localStorage` dengan kunci `kulon-assessment-v1`) sehingga seluruh alur **Login SSO/Email**, **Pembuatan Kuis**, **Pengerjaan Ujian**, dan **Penilaian** tetap dapat diuji tanpa error jaringan.

---

## 2. Daftar Akun Uji Coba (SSO Institusi & Email Akademik)

Seeder Backend (`DemoAssessmentSeeder`) dan akses cepat di halaman `/#/login` menyediakan akun berikut:

| Peran | Email Akademik | Kata Sandi Email | Identitas SSO Institusi (Undip) | Akses Ruang |
| :--- | :--- | :--- | :--- | :--- |
| **Pengajar (Dosen)** | `teacher@example.test` | `DemoPassword123!` | `dosen.pengampu@lecturer.undip.ac.id` | `/#/dashboard` (Ruang Pengajar) |
| **Peserta 1 (Mahasiswa)** | `student1@example.test` | `DemoPassword123!` | `21120122140044@students.undip.ac.id` | `/#/student` (Ruang Peserta) |
| **Peserta 2 (Mahasiswa)** | `student2@example.test` | `DemoPassword123!` | `21120122140045@students.undip.ac.id` | `/#/student` (Ruang Peserta) |
| **Admin** | `admin@example.test` | `DemoPassword123!` | — | Hanya API |

---

## 3. Skenario Pengujian Website di Browser (10–12 Menit)

### Skenario 1: Pengujian Sistem Login Opsi A (Email & Tombol SSO) (`/#/login`)
1. Saat pertama kali membuka **`http://127.0.0.1:4173/`**, aplikasi langsung mengarahkan pengguna ke **`http://127.0.0.1:4173/#/login`**.
2. Halaman menampilkan desain **Opsi A (Unified Card)** secara mandiri tanpa *sidebar* maupun dropdown peran, berisi logo & identitas **SMK Bhakti Praja Batang**, tombol **`SSO`**, pemisah `"ATAU MASUK DENGAN EMAIL"`, dan formulir **Email & Kata Sandi**.
3. **Uji Tombol `SSO`**:
   - Klik tombol **`SSO`** — muncul pemberitahuan bahwa fitur SSO sedang disiapkan dan fokus kursor diarahkan ke kolom input Email.
4. **Uji Login Email & Kata Sandi (`POST /api/auth/login`)**:
   - Masukkan `teacher@example.test` (atau klik pill **`Pengajar (teacher@example.test)`**) dan kata sandi `DemoPassword123!`, lalu klik **`Masuk dengan Email`**.
   - Pengguna berhasil masuk dan diarahkan ke **`/#/dashboard`** (Ruang Pengajar), serta *topbar* menampilkan tombol **`teacher@example.test · Keluar`** (dropdown tampilan peran telah dihapus).
5. **Uji Pemulihan Kata Sandi (`/#/reset-password`)**:
   - Di halaman `/#/login`, klik tautan **`Lupa kata sandi?`**.
   - Masukkan `teacher@example.test` lalu klik **`Kirim Tautan Pemulihan`** (`POST /api/auth/forgot-password`).
   - Pastikan muncul pesan konfirmasi pengiriman tautan reset kata sandi dan tab berganti ke langkah konfirmasi kata sandi baru.

---

### Skenario 2: Pengujian Alur Pengajar (Dosen)
1. **Home Pengajar (`/#/dashboard`)**:
   - Pastikan halaman **Home** menampilkan ringkasan assessment aktif, antrean tugas yang perlu dinilai (**Cek sekarang**), tenggat terdekat, dan rata-rata nilai per kelas.
2. **Membuat Assessment / Kuis Baru (`/#/builder/:id`)**:
   - Klik **`Buat assessment`** di halaman **Home** atau halaman **Assessment**.
   - **Langkah 1 (Identitas)**: Isi judul (mis. `"Kuis Evaluasi Jaringan & Protokol"`), pilih jenis **`Kuis`**, mata pelajaran **`Jaringan Komputer`**, dan kelas **`Kelas A`**.
   - **Langkah 2 (Konten — Manual, Bank Soal, & AI PDF)**:
     - Klik **`Tambah soal`** untuk menulis butir soal pilihan ganda beserta kunci jawaban dan bobot poin.
     - Klik **`Dari bank soal`** untuk menyalin soal dari bank soal ke draft.
     - Klik **`Bantu dengan AI`**, unggah file PDF materi pelajaran (maksimal 10 MB, memicu `POST /api/classes/{id}/modules` & `POST /api/modules/{id}/generate-quiz`), lalu klik **`Gunakan 3 soal contoh`**.
     - Perhatikan bahwa soal berlabel **AI** wajib ditinjau terlebih dahulu: buka soal hasil AI, periksa teks/opsi, lalu centang kotak **`Saya sudah mengecek soal dan kunci jawaban ini`** (mengubah teks atau kunci otomatis mereset status tinjauan agar tetap aman).
   - **Langkah 3 (Pengaturan)**:
     - Atur **Durasi** (mis. `30` menit), **Waktu buka (WIB)** (pilih waktu yang sudah lewat agar kuis langsung aktif), **Waktu tutup (WIB)** (pilih waktu di masa depan), dan kebijakan rilis nilai (**Manual oleh pengajar** atau **Langsung setelah peserta mengirim jawaban**).
   - **Langkah 4 (Preview & Validasi Kesiapan Publikasi)**:
     - Jika ada isian yang belum lengkap (atau soal AI belum dicentang), klik tautan pada daftar **`Belum siap diterbitkan`**—fokus kursor otomatis melompat ke field yang perlu diperbaiki.
     - Setelah status menunjukkan **`Siap diterbitkan`**, klik **`Terbitkan assessment`** $\rightarrow$ **`Ya, terbitkan`** (`POST /api/quizzes/{id}/publish`).

---

### Skenario 3: Pengujian Alur Peserta (Mahasiswa)
1. **Keluar & Masuk sebagai Peserta (`/#/login` $\rightarrow$ `/#/student`)**:
   - Klik tombol **`teacher@example.test · Keluar`** di kanan atas (*topbar*) untuk kembali ke halaman `/#/login`.
   - Pilih akun **`Peserta (student1@example.test)`** (kata sandi `DemoPassword123!`), lalu klik **`Masuk dengan Email`** untuk masuk ke **Ruang Peserta (`/#/student`)**.
2. **Melihat Daftar Assessment & Instruksi (`/#/instructions/:id`)**:
   - Pada halaman **Ruang Peserta**, pilih kuis yang berstatus **Aktif** (mis. kuis yang baru diterbitkan).
   - Baca rincian jumlah soal, durasi, dan petunjuk pengerjaan, centang kotak persetujuan, lalu klik **`Mulai kerjakan`** (`POST /api/quizzes/{id}/attempts`).
3. **Sesi Pengerjaan Ujian (`/#/attempt/:id`)**:
   - Pilih jawaban pada setiap nomor soal dan tandai satu soal dengan tombol **`Tandai ragu`**.
   - **Uji Ketahanan Sesi (Refresh Browser)**: Tekan `F5` / muat ulang halaman—pastikan jawaban yang sudah dipilih tetap tersimpan dan **timer hitung mundur tidak ter-reset**.
   - Klik **`Cek & kirim`**, periksa ringkasan soal yang sudah dijawab maupun yang ditandai ragu, lalu klik **`Kirim jawaban`** (`POST /api/attempts/{id}/finish`).
4. **Rilis Nilai & Pembahasan (`/#/results` $\leftrightarrow$ `/#/my-results` & `/#/review/:id`)**:
   - Jika kuis menggunakan rilis nilai **Manual oleh pengajar**, nilai peserta berstatus menunggu rilis.
   - Beralih kembali ke **Pengajar** $\rightarrow$ buka menu **`Hasil & penilaian`** (`/#/results`), pilih kuis tersebut, klik **`Rilis hasil`** dan konfirmasi, serta uji tombol **`Download CSV`** untuk mengunduh rekap nilai kelas.
   - Kembali ke **Peserta** $\rightarrow$ buka **`Hasil saya`** (`/#/my-results`) dan klik **`Lihat pembahasan`** (`/#/review/:id`) untuk memeriksa skor akhir serta rincian jawaban per soal.

---

## 4. Pengujian Endpoint REST API secara Langsung (PowerShell)

Saat server Backend berjalan di `http://127.0.0.1:8000`, Anda juga dapat menguji kontrak API secara langsung dari PowerShell:

```powershell
# 1. Uji Login via SSO Institusi (Undip)
$sso = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/sso" `
  -ContentType "application/json" `
  -Body '{"provider":"undip","email":"dosen.pengampu@lecturer.undip.ac.id","role":"teacher"}'
$token = $sso.data.token
$sso.data

# 2. Uji Login via Email & Kata Sandi
$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"teacher@example.test","password":"DemoPassword123!","device_name":"powershell-demo"}'
$token = $login.data.token

# 3. Cek Profil Pengguna Aktif (GET /api/auth/me)
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json" }
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/auth/me" -Headers $headers

# 4. Ambil Daftar Kelas & Kuis
$classes = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/classes" -Headers $headers
$classId = $classes.data.items[0].id
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/classes/$classId/quizzes" -Headers $headers

# 5. Unggah Modul PDF Kelas & Cek Daftar Modul
$mod = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/classes/$classId/modules" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"file_name":"modul-bab-1-jaringan.pdf","visibility":"public"}'
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/classes/$classId/modules" -Headers $headers

# 6. Ambil Buku Nilai Kelas (Gradebook Pengajar)
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/classes/$classId/gradebook" -Headers $headers
```

---

## 5. Perintah Pengujian Otomatis (Automated Test Suites)

### Pemeriksaan Penuh Frontend
Menjalankan *motion guard* (`scripts/check-motion.mjs`), 18 *unit test* domain/persistensi, 24 berkas *Vitest component & authentication test* (201 *test cases*), serta *production build*:

```powershell
cd Frontend
npm run check
```

### Pemeriksaan Penuh Backend
Menjalankan 288 pengujian PHPUnit pada database SQLite terisolasi beserta pemeriksaan gaya kode Laravel Pint:

```powershell
cd Backend
php artisan test
php vendor/laravel/pint/builds/pint --test
php artisan route:list --path=api --except-vendor
```

---

## 6. Penyimpanan, Pemulihan, & Catatan Deployment

- **Penyimpanan Browser & Sesi**:
  - Data assessment lokal menggunakan `localStorage` dengan kunci `kulon-assessment-v1`.
  - Token autentikasi Sanctum disimpan pada `examnia-auth-token-v1`, sesi pengguna pada `examnia-auth-session-v1`, dan preferensi desain halaman login pada `examnia-auth-design-choice-v1`.
  - Untuk mereset seluruh state demo di browser ke kondisi awal, hapus *Local Storage* situs pada *Developer Tools* (`Application -> Local Storage -> Clear`) atau gunakan profil browser *Incognito/InPrivate*.
- **Konfigurasi URL API Frontend**:
  - Secara default Frontend menghubungi `http://127.0.0.1:8000/api`. Untuk mengarahkan ke URL API lain saat deployment, atur variabel lingkungan `VITE_API_BASE_URL=https://api-domain-anda.example/api` sebelum menjalankan `npm run build`.
- **Worker Antrean AI Quiz Generation**:
  - Untuk memproses job antrean `GenerateQuiz` secara asinkron di Backend dengan layanan AI Python (`AI_SERVICE_BASE_URL` pada `Backend/.env`), jalankan worker:
    ```powershell
    cd Backend
    php artisan queue:work quiz-generation --queue=quiz-generation --tries=3 --timeout=75
    ```
