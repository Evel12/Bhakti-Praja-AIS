# Anggota 4 — Tahap 3: Manajemen Keuangan

## Hasil dan cakupan PDF

Implementasi menggunakan Laravel/Sanctum/MySQL dan React/Vite/Tailwind existing. Seluruh UI keuangan berbahasa Indonesia. Tidak menambah framework, payment gateway, data akademik, atau fitur akuntansi.

| Kebutuhan | Referensi halaman PDF gabungan | Implementasi |
| --- | --- | --- |
| Kelola tagihan pendidikan | 28, 38, 88, 109 (SRS-51) | Admin membuat, membaca, mengubah tagihan; siswa existing, jenis, nominal, tenggat |
| Akses tagihan siswa/wali | 39, 51, 88 | Scope akun siswa dan perwalian existing di backend |
| Unggah bukti, status menunggu | 51–52, 59, 89 | JPG/JPEG/PNG/PDF privat, validasi, status pending |
| Verifikasi admin dan riwayat keputusan | 52–53, 89, 109 (SRS-52) | Terima/tolak, pemeriksa/waktu tersimpan, transaksi atomik |
| Riwayat pembayaran | 39, 89, 109 (SRS-53) | Riwayat terotorisasi untuk admin/siswa/wali |
| Tunggakan dan laporan keuangan | 28, 88–89, 109 (SRS-54) | Sisa, tenggat, total tagihan/diterima, ringkasan per jenis |
| Integritas dan akses aman | 59–61, 65 | Policy, middleware, scope kepemilikan, file privat, nominal eksak |

Dashboard keuangan menyajikan data finance yang sama. Dashboard akademik wali, komunikasi, reminder/email/push tidak dikerjakan pada tahap ini.

## Aturan teknis

- Satu pembayaran penuh per tagihan. Cicilan/kelebihan bayar tidak didefinisikan PDF sehingga tidak diimplementasikan. Tidak ada biaya/denda tambahan atau nominal sekolah yang dikarang.
- Satu pengajuan pending per tagihan. Penolakan tidak mengurangi saldo dan memungkinkan pengajuan baru.
- Hanya verified mengurangi sisa tagihan. Status paid ditulis backend dalam transaksi yang sama dengan verifikasi.
- Pengajuan, verifikasi, dan perubahan invoice mengunci invoice lebih dahulu; verifikasi kemudian mengunci payment. Keputusan identik idempoten; keputusan final berbeda ditolak 409.
- Tagihan yang memiliki catatan pembayaran tidak dapat diubah, termasuk setelah penolakan, untuk mempertahankan riwayat nominal.
- Integer sen untuk operasi per pembayaran dan SQL DECIMAL untuk agregat MySQL. JSON nominal berupa string dua desimal. Tunggakan memakai tanggal Asia/Jakarta, bukan jam UTC server.
- File disimpan pada disk local privat dengan nama acak. Pengunduhan melalui API ber-token, memakai attachment, MIME terbatas, nosniff, no-store, dan CSP sandbox. Tidak mengekspos path atau memakai public storage link.
- Kegagalan insert membatalkan transaksi dan menghapus file yang sudah diunggah. Respons kesalahan penyimpanan tidak membeberkan SQL/stack trace.

## File dibuat pada Tahap 3

- `backend/app/Http/Controllers/Member4/FinanceReportController.php`
- `backend/app/Policies/InvoicePolicy.php`
- `backend/app/Policies/PaymentPolicy.php`
- `backend/app/Services/Member4/FinanceService.php`
- `backend/app/Services/Member4/Money.php`
- `backend/config/member4_finance.php`
- `backend/tests/Feature/Member4FinanceTest.php`
- `frontend/src/finance/FinancePages.jsx`
- `frontend/src/finance/InvoicePages.jsx`
- `frontend/src/finance/PaymentPages.jsx`
- `frontend/src/finance/finance.js`
- `frontend/src/finance/shared.jsx`
- `docs/member4/STAGE-3.md`

## File diubah dari hasil Tahap 2

- `backend/app/Http/Controllers/Member4/InvoiceController.php`: policy, total, pencarian, filter tunggakan.
- `backend/app/Http/Controllers/Member4/PaymentController.php`: pengajuan, file privat, verifikasi, relasi riwayat, penanganan kegagalan aman.
- `backend/app/Models/Invoice.php`: agregat verified, sisa, status tampilan/tunggakan.
- `backend/routes/member4.php`: lima endpoint keuangan tambahan.
- `frontend/src/App.jsx`: rute finance dan pembatasan halaman master admin.
- `frontend/src/api.js`: meneruskan konteks login existing, tanpa sistem auth baru.
- `frontend/src/pages/Login.jsx`: pilihan layanan akademik/keuangan.
- `frontend/src/layouts/Layout.jsx`: menu finance sesuai peran, judul panel dan label peran.
- `docs/member4/API.md`, `docs/member4/INTEGRATION.md`, `README.md`: kontrak dan penggunaan terbaru.

File Tahap 2 yang belum di-commit tetap dipertahankan. Daftar di atas membedakan pekerjaan Tahap 3 dari fondasi sebelumnya.

## Database

Tidak ada migrasi, tabel, kolom, atau perubahan schema baru pada Tahap 3. Menggunakan `invoices`/`payments` Tahap 2 dan relasi pengguna/siswa/wali existing. Foreign key RESTRICT existing tetap berlaku; catatan keuangan tidak boleh dihapus lewat penghapusan akun/siswa.

Status migrasi database sekolah diperiksa: seluruh migrasi termasuk empat migrasi Tahap 2 sudah Ran. Setelah pengujian, database sekolah tetap 0 siswa, 0 wali, 0 invoice, 0 payment; data sintetis hanya di database uji terpisah.

## Endpoint

Awalan `/api/member4`, token Sanctum dan akun aktif wajib.

| Metode | URI | Akses |
| --- | --- | --- |
| GET | `/invoices`, `/invoices/{id}` | Admin semua, siswa sendiri, wali anak tertaut |
| POST | `/invoices` | Admin |
| PUT/PATCH | `/invoices/{id}` | Admin, sebelum ada pembayaran |
| POST | `/invoices/{id}/payments` | Siswa/wali berhak; multipart bukti |
| GET | `/payments`, `/payments/{id}` | Scope keuangan yang sama |
| GET | `/payments/{id}/proof` | Scope keuangan yang sama |
| PATCH | `/payments/{id}/verification` | Admin, body decision verified/rejected |
| GET | `/finance/summary` | Ringkasan sesuai scope |
| GET | `/finance/reports` | Admin |

Lima endpoint baru: pengajuan, bukti, verifikasi, summary, reports. Kontrak field/filter lengkap: [API.md](API.md).

Frontend: `/finance`, `/finance/invoices`, `/finance/invoices/:id`, `/finance/payments`, `/finance/payments/:id`, `/finance/verification`, `/finance/outstanding`, `/finance/reports`. Form pengajuan menyatu dengan detail tagihan; form buat/ubah menggunakan dialog sesuai pola existing.

## Verifikasi

Perintah yang dijalankan:

```powershell
# backend, SQLite in-memory default phpunit
php artisan test

# backend, database MySQL khusus pengujian (jangan gunakan database sekolah)
$env:DB_CONNECTION='mysql'
$env:DB_DATABASE='bhakti_member4_stage3_test'
php artisan test

# backend, pemeriksaan aplikasi existing
php artisan migrate:status
php artisan route:list --path=member4

# frontend
npm.cmd run lint
npm.cmd run build
```

Pengujian browser memakai Chrome headless/Playwright yang sudah tersedia di `.tools`, API Laravel nyata, Vite, dan fixture khusus `bhakti_member4_stage3_test`. Script/screenshot lokal tersimpan di `.tools/member4-stage3-browser.cjs`, `.tools/finance-mobile-check.cjs`, `.tools/finance-reports.png`, `.tools/finance-mobile.png`; direktori ini diabaikan Git. Tidak menambah dependency runtime/frontend.

Hasil final yang benar-benar dijalankan:

| Pemeriksaan | Hasil |
| --- | --- |
| Seluruh suite Laravel, SQLite in-memory | 56 tes lulus, 655 assertion |
| Seluruh suite Laravel, MySQL/MariaDB terisolasi | 56 tes lulus, 655 assertion |
| `migrate:status` pada database sekolah | Semua migrasi Ran; tidak ada migrasi baru Stage 3 |
| `route:list --path=member4` | 21 route terdaftar, termasuk lima tambahan Stage 3 |
| Frontend lint | Lulus, tanpa warning |
| Frontend build | Lulus, Vite 8.3.1 |
| Chrome: alur keuangan end-to-end | Lulus, tanpa error JavaScript |
| Chrome: halaman/dialog sudah dimuat pada 390px | Lulus, tanpa overflow halaman |

Command MySQL sempat dijalankan dari root sehingga PHPUnit tidak ditemukan; diulang dari `backend` dan seluruh suite lulus. Temuan label formulir pada pengujian browser telah diperbaiki dan diverifikasi ulang. Server API/Vite khusus pengujian sudah dihentikan; konfigurasi `.env` aplikasi tidak diganti.

Pemeriksaan browser yang sudah lulus:

- Admin membuat dan mengubah tagihan; akun siswa melihat satu tagihan sendiri.
- Siswa mengunggah PNG; bukti tetap pending dan dapat diunduh privat oleh admin.
- Admin menolak; wali tertaut mengajukan PDF baru; admin menerima dan tagihan menjadi lunas.
- Riwayat menampilkan penolakan/penerimaan; tunggakan lunas hilang dan laporan memakai nominal terverifikasi.
- Wali mendapat 404 untuk tagihan siswa lain dan tidak memiliki menu admin; rute laporan admin dialihkan.
- Akun tanpa anak mendapat data kosong; error pemuatan dapat dicoba kembali.
- Tampilan 390px: dashboard, tabel tagihan, detail, riwayat, bukti, laporan, dialog; tidak ada overflow halaman atau error JavaScript. Tabel lebar dapat digeser di dalam panel.

Tes backend mencakup kepemilikan/role, metadata palsu, ukuran/MIME/ekstensi file, bukti hilang, tanggal, pengajuan ganda, penolakan/pengajuan ulang, keputusan idempoten, status invoice, presisi nominal dan laporan, batas hari tenggat, serta rollback dengan pembersihan file.

## Isu dan dependensi

- Tidak ada penghambat teknis Stage 3 yang diketahui setelah pemeriksaan. Data operasional sekolah masih perlu dimasukkan dan relasi akun/profil/perwalian ditautkan oleh Member 1; akun tanpa relasi memang mendapat data kosong.
- Member 2/3 tidak dibutuhkan untuk transaksi keuangan. Integrasi akademik wali tetap pekerjaan tahap berikutnya.
- PDF belum menentukan cicilan/kelebihan bayar; implementasi saat ini menerima pembayaran penuh saja. Kebijakan lain memerlukan spesifikasi sebelum penambahan fitur.
- Email/push/pengingat dan pesan belum dikerjakan, sesuai batas Tahap 3.
- Deployment harus mempertahankan penyimpanan privat dan akses tulis Laravel, serta memakai HTTPS sesuai NFR PDF. Pengujian ini lokal; deployment produksi tidak dilakukan.

Tahap 3 berhenti di sini; tidak memulai Tahap 4.
