# Anggota 4 — Tahap 2: fondasi database dan API

## Batas implementasi

Sumber: `capsnew_Merged.pdf`, halaman PDF gabungan 10, 28, 37–41, 51–53, 59–61, 65, 80, 88–91, 102–104 dan 109. Tabel, relasi dan API akademik existing tetap digunakan. Tidak ada halaman frontend, tabel nilai/absensi/tugas/jadwal, autentikasi terpisah, role baru, payment gateway, atau data produksi fiktif.

Tahap ini menambahkan schema serta API dasar yang sudah dapat digunakan dan diuji. Pengajuan bukti, verifikasi pembayaran, penentuan saldo/status lunas, laporan/dashboard keuangan, dashboard wali lengkap, pengiriman notifikasi, reminder, email/push dan pesan belum diimplementasikan. Tidak ada endpoint palsu untuk alur tersebut.

## Kompatibilitas bersama

- Tidak mengubah schema `users`, `roles`, `students`, `parents`, `parent_student`, `class_student`, atau `schedules`.
- Foreign key catatan keuangan memakai `RESTRICT`: menghapus murid atau akun yang dirujuk tagihan/pembayaran akan ditolak. Ini mencegah hilangnya riwayat keuangan dan memengaruhi operasi hapus pada modul Member 1. Handler konflik database existing tetap digunakan.
- Login existing tetap admin-only secara default (`portal` dihilangkan atau `ais`). Konteks opsional `portal=member4` menerima akun aktif `admin`, `murid`, `wali_murid`. Tetap memakai endpoint, password, peran, dan token Sanctum yang sama.
- `/api/auth/me` dan `/api/auth/logout` dipindahkan keluar dari grup `AdminOnly`, tetapi tetap membutuhkan autentikasi dan akun aktif dengan peran existing. Semua endpoint AIS tetap `AdminOnly`. Guru belum mendapat alur login baru; integrasinya tetap milik anggota terkait.
- Perilaku existing yang mencabut token lama saat login tetap dipertahankan.
- Tidak mengubah frontend admin. Frontend belum mengirim konteks Member 4 dan belum memiliki halaman portal; jangan menganggap penambahan API sebagai UI multi-role yang sudah selesai.
- PDF memakai `notifications.user_id`; Laravel `Notifiable` bawaan menyediakan relasi database polymorphic dengan schema berbeda. Model khusus `PortalNotification` menggunakan satu tabel `notifications` sesuai PDF. Jangan memakai `$user->notifications()` atau channel `database` Laravel langsung pada tabel ini. Tahap 5 harus memakai adapter penyimpanan yang sesuai; channel mail dapat memakai infrastruktur Laravel tanpa membuat tabel notifikasi kedua.

## Schema baru

| Tabel | Kolom utama | Referensi PDF |
| --- | --- | --- |
| `invoices` | `student_id`, `created_by`, `invoice_type`, `amount DECIMAL(12,2)`, `due_date`, `status`, timestamps | 88, 102 |
| `payments` | `invoice_id`, `submitted_by`, `payment_date`, `amount DECIMAL(12,2)`, `payment_method`, `transaction_number`, `status`, metadata bukti, `verified_by`, `verified_at`, timestamps | 51–53, 59, 89, 103 |
| `announcements` | `created_by`, `title`, `content`, `target_role`, timestamps | 89 |
| `notifications` | `user_id`, `title`, `message`, `is_read`, timestamps | 89, 104 |

Jenis tagihan mengikuti PDF: `spp`, `exam`, `activity`, `book`, `uniform`. Status tagihan tersimpan `unpaid`/`paid`; status pembayaran `pending`/`verified`/`rejected`. Default tagihan belum dibayar dan pembayaran menunggu verifikasi. Tidak ada nilai `overdue` tersimpan atau penghitungan cicilan pada tahap ini. Penentuan tunggakan/saldo dan kebijakan pembayaran penuh/cicilan tetap untuk Tahap 3 setelah keputusan kebijakan.

Lokasi bukti, MIME/ukuran, pengunggah, pemeriksa dan waktu pemeriksaan merupakan metadata teknis untuk alur PDF, bukan fitur pembayaran baru. `proof_path` tersembunyi dari serialisasi JSON. Tahap ini belum menyediakan endpoint file atau mengklaim validasi unggahan sudah selesai.

`target_role=all` berarti seluruh peran existing, bukan role pengguna baru. Pengumuman adalah teks biasa; frontend berikutnya harus merendernya sebagai teks, bukan HTML mentah. API ini tidak menerima `course_id`; pengumuman course tetap milik Member 2.

## Keamanan dan perilaku dasar

- Wali: `users.id → parents.user_id → parent_student → students.id`; profil wali harus aktif. Tidak ada pencocokan nama/email sebagai fallback. Akun yang belum ditautkan mendapat daftar kosong.
- Murid: `students.user_id` harus cocok dengan akun aktif. Admin dapat membaca semua catatan keuangan.
- Filter `student_id`/`invoice_id` tidak menghapus scope kepemilikan. Detail di luar scope mengembalikan 404 generik.
- Daftar notifikasi selalu milik pengguna yang sedang login, termasuk admin; admin tidak otomatis dapat membaca notifikasi pribadi pengguna lain.
- Status tagihan dan identitas pembuat tidak boleh dikirim client, termasuk nilai null. Pembuat diambil dari token.
- Tagihan yang sudah memiliki pembayaran atau sudah lunas tidak dapat diubah. Pembacaan dan pemeriksaan sebelum update berada dalam transaksi dengan kunci baris; Tahap 3 harus memakai kunci tagihan yang sama saat mengajukan/memverifikasi pembayaran.
- Nominal API berupa angka desimal positif, maksimal sepuluh digit bilangan bulat dan dua desimal; serialisasi monetary memakai string dua desimal. Belum ada aritmetika uang atau perhitungan saldo berbasis float.
- Jadwal wali hanya jadwal aktif untuk penempatan kelas aktif anak dengan tahun ajaran sama dan semester sesuai. Penempatan tanpa semester mencakup semester dalam tahun tersebut. Tidak ada endpoint edit jadwal di portal.
- Pagination: `page >= 1`, `per_page` 1–100, default 15. Validasi dan pesan controller Member 4 berbahasa Indonesia.

## Verifikasi

Pengujian API memakai dataset sintetis di database pengujian terisolasi, bukan data contoh pada database aplikasi.

Hasil yang benar-benar dijalankan:

| Pemeriksaan | Hasil |
| --- | --- |
| `php artisan test` dengan konfigurasi pengujian existing SQLite in-memory | 45 tes lulus, 509 assertion |
| `php artisan test --filter=Member4FoundationTest` memakai MySQL driver pada database terisolasi | 12 tes lulus, 160 assertion |
| `php artisan route:list --path=api/member4` | 16 route terdaftar |
| Migration seluruh schema pada database MySQL uji baru | Lulus |
| `php artisan migrate:rollback --step=4 --force` pada database uji | Hanya empat migration Member 4 dibatalkan; lulus |
| `php artisan migrate --force` pada database uji setelah rollback | Keempat tabel berhasil dibuat ulang |
| Pemeriksaan kolom pada MySQL | Nominal `decimal(12,2)` dan enum status sesuai schema |
| Migration aplikasi dengan empat argumen `--path` khusus Member 4 | Keempat migration berstatus Ran |

Server yang diuji adalah XAMPP MariaDB 10.4.32 melalui Laravel MySQL driver, bukan klaim pengujian terhadap semua versi Oracle MySQL. Database uji terpisah: `bhakti_member4_stage2_20261030_201504`; tidak mengubah `.env` aplikasi. Schema uji masih tersedia untuk pemeriksaan dan tidak dipakai aplikasi.

Backup sebelum migration aplikasi: `.recovery/before-member4-stage2-20261030-201920.sql` (diabaikan Git). Jumlah record yang dibandingkan sebelum/sesudah migration tetap sama untuk users, students, parents, parent_student, departments, study_programs, subjects, curricula, classrooms dan schedules. Tabel baru invoices, payments, announcements dan notifications semuanya kosong setelah migration aplikasi. Tidak menjalankan seeder produksi atau login yang mereset token akun aplikasi untuk verifikasi.

Status awal MySQL tidak aktif dan `migrate:status` pertama gagal karena koneksi ditolak. Setelah server XAMPP dijalankan normal, migration/tes MySQL di atas berhasil. Tidak dilakukan reset database sekolah.

Tidak ada perubahan frontend; build frontend tidak dijalankan pada tahap backend ini. Belum ada klaim uji email, push, upload, verifikasi pembayaran, atau integrasi akademik Member 2/3.

Jangan menjalankan `migrate:fresh`, `migrate:refresh`, atau rollback pada database sekolah berisi data. Uji rollback hanya pada database sementara yang dibuat khusus verifikasi.

## Inventaris file

File baru:

- `backend/database/migrations/2026_10_30_000020_create_member4_invoices_table.php`
- `backend/database/migrations/2026_10_30_000021_create_member4_payments_table.php`
- `backend/database/migrations/2026_10_30_000022_create_member4_announcements_table.php`
- `backend/database/migrations/2026_10_30_000023_create_member4_notifications_table.php`
- `backend/app/Models/Invoice.php`, `Payment.php`, `Announcement.php`, `PortalNotification.php`
- `backend/app/Http/Middleware/Member4Role.php`
- `backend/app/Services/Member4/StudentAccess.php`
- `backend/app/Http/Controllers/Member4/Member4Controller.php`
- `backend/app/Http/Controllers/Member4/InvoiceController.php`
- `backend/app/Http/Controllers/Member4/PaymentController.php`
- `backend/app/Http/Controllers/Member4/ParentPortalController.php`
- `backend/app/Http/Controllers/Member4/AnnouncementController.php`
- `backend/app/Http/Controllers/Member4/NotificationController.php`
- `backend/routes/member4.php`
- `backend/tests/Feature/Member4FoundationTest.php`
- `docs/member4/STAGE-2.md`, `API.md`, `INTEGRATION.md`

File existing yang diubah hanya `backend/app/Http/Controllers/AuthController.php` dan `backend/routes/api.php`. Models akademik, pengujian existing, konfigurasi stack/dependensi, dan seluruh frontend tidak diubah. Lihat `API.md` untuk kontrak endpoint dan `INTEGRATION.md` untuk dependensi serta keputusan yang masih tertunda.

Tahap 2 berhenti di fondasi ini. Tidak melakukan commit/push atau melanjutkan Tahap 3 secara otomatis.
