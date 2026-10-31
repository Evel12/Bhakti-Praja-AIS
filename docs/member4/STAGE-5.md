# Anggota 4 — Tahap 5: Komunikasi dan Notifikasi

## Hasil dan status

| Kebutuhan | Referensi PDF gabungan | Hasil |
| --- | --- | --- |
| Pengumuman sistem | 28, 41, 89, 109 SRS-47 | CRUD admin, audience peran, pembacaan terotorisasi, UI dan sinkronisasi notifikasi selesai |
| Notifikasi tersimpan/pusat notifikasi | 89, 104 markAsRead, 109 SRS-48 | Pembacaan milik sendiri, kategori, waktu, filter, mark-read, loading/error/empty selesai |
| Reminder pembayaran | 28, 109 SRS-55 | Pemicu admin per tagihan, penerima siswa/wali yang berhak, deduplikasi; tidak menambah jadwal berulang |
| Email | 10, 28 | Mail/Mailable dan queue terimplementasi; diuji ke SMTP lokal. Produksi menunggu konfigurasi/worker dan verifikasi mailbox |
| Pesan | 10, 28 | Aturan penerima/percakapan/aksi tidak ditentukan; klarifikasi diperlukan, belum membuat schema/API pesan |
| Reminder tugas/ujian | 10, 28 | Sumber Anggota 2/3 belum ada; timing juga belum ditentukan. Tidak membuat generator/record akademik palsu |
| Push | 28 | Infrastruktur web/mobile push tidak ditemukan. Belum diimplementasikan atau diklaim bekerja |

Stage 1–4 diperiksa melalui routes, model, controller, konfigurasi dan tes existing. PDF tidak memberikan use case atau schema percakapan, maupun frekuensi reminder. Klarifikasi aturan pesan dan timing telah diminta; tanpa jawaban, perilaku tersebut tidak diasumsikan. Pengumuman course tetap milik Anggota 2; `course_id` tetap ditolak API ini.

## Perilaku yang sudah bekerja

- Admin membuat/mengubah/menghapus pengumuman sistem untuk peran existing. Akun aktif pada audience mendapat notifikasi. Audience berubah menarik notifikasi penerima lama; source dihapus menghapus notifikasi terkait. Teks dirender sebagai teks biasa dan di-escape pada email.
- Semua empat peran dapat login pada konteks `communication` di endpoint auth existing. Default `ais` tetap admin-only dan `member4` tetap admin/siswa/wali. Guru tetap tidak dapat membuka data master, finance atau portal wali.
- Pusat notifikasi selalu memfilter pemilik. Filter source memeriksa audience/peran saat ini, serta kepemilikan/perwalian dan saldo tagihan. Pencabutan perwalian/perubahan peran/tagihan lunas menutup pembacaan reminder yang tidak lagi relevan. Tidak tersedia API menulis notifikasi ke user arbitrer.
- Admin memicu pengingat pada detail tagihan. Query memakai akun siswa berperan murid dan akun wali aktif dengan pivot yang sah. Identitas penerima tidak diterima dari client. Invoice dikunci sesuai urutan Stage 3; verifikasi/status pembayaran tidak diubah.
- Pengingat yang sama tidak digandakan. Tidak ada cron, scheduler, tanggal relatif seperti H-1, frekuensi harian, bulk campaign, atau pengiriman ulang periodik. Penentuan frekuensi menunggu aturan sekolah.

## File dibuat

- `backend/database/migrations/2026_10_31_000024_add_member4_notification_delivery_fields.php`
- `backend/config/member4_communication.php`
- `backend/app/Services/Member4/CommunicationService.php`
- `backend/app/Services/Member4/NotificationAccess.php`
- `backend/app/Jobs/Member4/DeliverNotificationEmail.php`
- `backend/app/Mail/Member4/PortalNotificationMail.php`
- `backend/resources/views/emails/member4-notification.blade.php`
- `backend/app/Http/Controllers/Member4/PaymentReminderController.php`
- `backend/tests/Feature/Member4CommunicationTest.php`
- `frontend/src/communication/CommunicationPages.jsx`
- `frontend/src/communication/PaymentReminder.jsx`
- `docs/member4/STAGE-5.md`

## File dimodifikasi

- `backend/app/Http/Controllers/Member4/AnnouncementController.php`: transaksi dan sinkronisasi notifikasi.
- `backend/app/Http/Controllers/Member4/NotificationController.php`: filter kategori dan pemeriksaan akses sumber.
- `backend/app/Models/PortalNotification.php`: metadata teknis sumber dan cast status baca/waktu email.
- `backend/app/Http/Controllers/AuthController.php`: konteks komunikasi opsional pada autentikasi existing; default lama dipertahankan.
- `backend/routes/member4.php`: endpoint reminder admin.
- `backend/.env.example`: flag email tanpa kredensial.
- `frontend/src/App.jsx`: routes komunikasi, landing guru, tujuan redirect login sesuai layanan.
- `frontend/src/layouts/Layout.jsx`: menu pengumuman/notifikasi untuk empat peran.
- `frontend/src/pages/Login.jsx`: pilihan layanan komunikasi existing.
- `frontend/src/finance/InvoicePages.jsx`: komponen reminder admin pada detail tagihan yang belum lunas.
- `docs/member4/API.md`, `docs/member4/INTEGRATION.md`, `README.md`: kontrak dan penggunaan terbaru.

Tidak mengubah tabel/model akademik bersama atau implementasi penilaian, LMS, dan verifikasi pembayaran. Perubahan tahap sebelumnya yang belum di-commit dipertahankan.

## Perubahan database dan kompatibilitas

Hanya tabel `notifications` milik Member 4 ditambah field nullable:

| Field | Tujuan teknis |
| --- | --- |
| `category VARCHAR(32)` | Membedakan announcement/payment_reminder |
| `source_id BIGINT` | Memeriksa akses source saat dibaca/dikirim |
| `email_status VARCHAR(16)` | pending/sent/failed/skipped; tidak mengklaim log sebagai email terkirim |
| `email_sent_at TIMESTAMP` | Waktu transport menerima pengiriman |

Unique `(user_id, category, source_id)` mencegah duplikasi sumber per penerima. Source bersifat polimorfik pada dua tabel existing sehingga integritas dicek melalui layanan/transaksi/query source, bukan FK yang menunjuk tabel yang salah. Foreign key pengguna existing tetap dipakai. Record lama tanpa metadata dipertahankan dan tetap hanya dapat dibaca pemiliknya.

Risiko kompatibilitas dijelaskan sebelum perubahan: client harus menjalankan migrasi tambahan; seluruh field baru nullable, tidak mengganti schema notifikasi menjadi polymorphic bawaan Laravel, dan tidak membuat tabel kedua. Upgrade/down/up metadata diuji pada database uji dengan record lama tetap tersimpan.

Database sekolah dicadangkan ke `.recovery/before-member4-stage5-20261031-180326.sql` sebelum `php artisan migrate`. Migrasi tambahan berhasil. Setelah pengujian, database sekolah tetap 0 pengumuman, 0 notifikasi dan 0 invoice; fixture hanya di `bhakti_member4_stage5_test`. File backup/fixture tidak dimasukkan Git.

## API dan UI

Awalan `/api/member4`, token Sanctum dan akun aktif wajib.

| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/announcements`, `/announcements/{id}` | Existing, scope audience; admin dapat mengelola seluruh pengumuman sistem |
| POST | `/announcements` | Existing admin-only, kini menghasilkan notifikasi |
| PUT/PATCH | `/announcements/{id}` | Existing admin-only, menyinkronkan isi/audience |
| DELETE | `/announcements/{id}` | Existing admin-only, menarik notifikasi source |
| GET | `/notifications` | Existing, pemilik dan source berhak; filter category/is_read/page/per_page |
| PATCH | `/notifications/{id}/read` | Existing, hanya notifikasi yang masih berhak dilihat |
| POST | `/invoices/{id}/reminders` | Baru; admin membuat reminder manual untuk source valid |

Login existing menerima `portal=communication`; bukan endpoint auth baru. UI berada di `/communication/announcements`, `/communication/announcements/:id`, `/communication/notifications`. Tombol reminder ada pada detail invoice finance khusus admin. Tidak ada tombol pesan atau aktivasi push yang tidak berfungsi.

## Mekanisme email dan batas pengiriman

1. Notifikasi dalam aplikasi disimpan atomik dengan source. Jika email diaktifkan dan transport SMTP/sendmail dipakai, job baru dikirim setelah commit.
2. Job hanya membawa ID notifikasi dan hash konten. Worker mengambil recipient/source terbaru, memeriksa akun aktif/peran/relasi/saldo, serta mengabaikan job konten lama atau pengiriman yang sudah sent/skipped.
3. Mailable Blade meng-escape teks. SMTP/sendmail exception memicu retry transport Laravel (maksimal tiga percobaan per job, backoff 60/300 detik). Ini retry teknis untuk pengiriman yang sama, bukan jadwal bisnis reminder baru.
4. Setelah percobaan habis status failed tersimpan; notifikasi aplikasi tetap tersedia. Operator dapat memperbaiki konfigurasi dan memakai `php artisan queue:failed` / `php artisan queue:retry <id>` existing. Retry memeriksa ulang hak penerima sebelum mengirim.
5. Flag default false, transport log/array, recipient tidak sah atau source tidak lagi berhak menghasilkan skipped. Tidak ada email palsu yang dicatat sent karena hanya dilog.

Contoh konfigurasi tanpa kredensial:

```dotenv
MEMBER4_EMAIL_ENABLED=true
MAIL_MAILER=smtp
MAIL_HOST=alamat-server-smtp-sekolah
MAIL_PORT=587
MAIL_SCHEME=smtp
MAIL_USERNAME=akun-smtp-sekolah
MAIL_PASSWORD=isi-di-lingkungan
MAIL_FROM_ADDRESS=alamat-pengirim-yang-diizinkan-sekolah
QUEUE_CONNECTION=database
```

Gunakan TLS/port sesuai provider yang dimiliki sekolah dan jalankan worker `php artisan queue:work`. Jangan menyalin nilai contoh sebagai kredensial produksi. `.env` aplikasi tidak diganti dan saat pemeriksaan masih memakai MAIL_MAILER=log.

Uji nyata lokal memakai antrean database -> worker Laravel -> SMTP pada 127.0.0.1:1025 -> file penerimaan test -> status sent. Penampung tidak meneruskan pesan keluar. Hasil ini membuktikan transport lokal, **bukan penerimaan mailbox produksi**. SMTP menerima pesan pun tidak menjamin inbox akhir; SMTP produksi/worker/monitoring harus dikonfigurasi dan diverifikasi di lingkungan sekolah. Duplicate email masih mungkin pada kegagalan ambigu setelah SMTP menerima tetapi sebelum commit; tidak menjanjikan exactly-once mailbox delivery.

## Dependensi dan klarifikasi yang tersisa

### Pesan

PDF menyebut pesan pada ruang lingkup umum, tanpa model pesan atau aturan percakapan. Perlu ditetapkan siapa boleh menghubungi siapa (admin/guru/siswa/wali dan relasi kelas/perwalian), apakah satu-lawan-satu, serta aksi kirim/baca/balas/hapus yang diizinkan. Tidak memperkenalkan tabel pesan atau perilaku real-time sebelum jawaban tersedia.

### Reminder tugas dan ujian

Model/migrasi/API assignments/submissions/examinations belum ada di checkout. Kontrak minimum pemilik modul: ID source stabil, jenis, judul, status publikasi/pembatalan, tenggat/waktu dengan zona waktu, anggota/penerima siswa yang sah, serta status pengumpulan bila kebijakan memerlukannya. Perlu keputusan kapan reminder dikirim, frekuensi, pengecualian setelah selesai dan penerima wali bila diinginkan. Jangan menebak dari nama kelas/role atau membuat source pengganti. Belum diimplementasikan dan tidak diuji sebagai generation nyata.

### Push

Tidak ditemukan service worker, Web Push subscription/device registration, VAPID, token mobile atau layanan delivery. Minimum web push: keputusan platform, HTTPS, service worker, izin browser, endpoint subscription terautorisasi dengan penyimpanan yang sesuai, key VAPID dari environment dan pengirim Web Push yang kompatibel. Mobile memerlukan kontrak aplikasi/device yang dimiliki tim, bukan framework baru di Member 4. Implementasi dan verifikasi perangkat/browser ditunda sampai arsitektur/kontrak dipilih. Notifikasi database tidak disebut push.

## Pengujian

Perintah yang dijalankan:

```powershell
# backend, SQLite in-memory
php artisan test

# backend, database MySQL uji (bukan sistem_akademik)
$env:DB_CONNECTION='mysql'
$env:DB_DATABASE='bhakti_member4_stage5_test'
php artisan test

# backend, aplikasi existing
php artisan migrate
php artisan route:list --path=member4

# frontend
npm.cmd run lint
npm.cmd run build
```

Tes mencakup announcement CRUD/audience, akun nonaktif/peran berubah, sinkronisasi/penarikan source, reminder terotorisasi/dedup/tagihan lunas/perwalian dicabut, mark-read pribadi, filter, konteks guru tanpa membuka AIS/finance, queue setelah commit, email fake success/failure/retry/stale-content, template escaped dan legacy notification.

| Pemeriksaan final yang benar-benar dijalankan | Hasil |
| --- | --- |
| Seluruh suite Laravel, SQLite in-memory | 79 tes lulus, 902 assertion |
| Seluruh suite Laravel, MySQL uji terisolasi | 79 tes lulus, 902 assertion |
| Tes komunikasi khusus | 14 tes, termasuk email gagal/retry dan pencabutan akses |
| Frontend lint | Bersih tanpa warning |
| Frontend build | Berhasil, Vite 8.3.1 |
| Migrasi tambahan pada database aplikasi | Ran, batch 5; backup dibuat sebelum migrasi |
| Upgrade/down/up metadata pada record notifikasi lama di DB uji | Lulus, isi record tetap tersimpan |
| Antrean database -> worker -> SMTP lokal -> status sent | Lulus; penerima/subjek pada penampung diperiksa |
| Chrome alur komunikasi dan layout 390px | Lulus, tidak ada error JavaScript |

Server API, Vite, dan SMTP lokal khusus pengujian telah dihentikan. Konfigurasi email aplikasi tetap tidak diaktifkan dan tidak ada data fixture pada database sekolah.

Chrome/Playwright dengan API MySQL nyata telah lulus alur CRUD, perpindahan audience, login guru, notifikasi milik sendiri/mark-read/filter, reminder manual dan tidak berulang, siswa/wali serta akun tidak berhubungan, loading/empty/error/retry dan layout 390px tanpa error JavaScript. Redirect login layanan yang ditemukan oleh browser telah diperbaiki dan diuji ulang. Script/screenshot lokal `.tools/communication-*` diabaikan Git.

Push, messaging, assignment/examination reminder generation dan mailbox email produksi **tidak dinyatakan lulus**, karena dependensi/keputusan tersebut belum tersedia. Tidak memulai Tahap 6.
