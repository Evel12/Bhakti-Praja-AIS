# Kontrak API Anggota 4 — Tahap 6

Semua URI berikut diawali `/api`. Selain login, endpoint memerlukan token Sanctum `Authorization: Bearer ...` dan akun aktif. Respons mengikuti konvensi existing: `success`, `data`, `message` untuk hasil mutasi, `errors` untuk validasi, dan `meta` untuk pagination.

Verifikasi Tahap 7 tidak menambah endpoint atau schema. Konten pengumuman juga dibatasi 65.535 byte UTF-8 selain batas karakter existing. Exception internal pada prefix Member 4 menghasilkan pesan aman tanpa trace/SQL meskipun debug aktif; status HTTP, header metode, dan validasi tetap dipertahankan. Lihat [laporan final](STAGE-7.md).

Tahap 6 tidak menambah endpoint atau mengubah kontrak backend. Integrasi frontend kini mempertahankan filter riwayat `status`/`page` pada URL, memakai metadata navigasi `from=parent&student_id=...` untuk kembali ke anak yang dipilih, serta mengambil ulang ringkasan ketika dashboard kembali mendapat fokus. Metadata navigasi bukan izin akses; seluruh otorisasi tetap ditentukan backend. Detail audit: [STAGE-6.md](STAGE-6.md).

## Sesi existing

`POST /auth/login`:

```json
{"email":"akun-yang-sudah-terdaftar@example.test","password":"kata-sandi-akun","portal":"member4"}
```

`portal` menerima `ais`, `member4`, atau `communication`. Default `ais` tetap admin-only; `member4` tetap admin/murid/wali. Konteks `communication` menerima keempat peran aktif, termasuk guru, dengan password/token dan endpoint existing. Tidak ada autentikasi, registrasi, akun atau role baru. `GET /auth/me` dan `POST /auth/logout` memakai sesi yang sama.

## Route yang tersedia

| Metode | URI | Akses dan fungsi |
| --- | --- | --- |
| GET | `/member4/invoices` | Admin semua; murid sendiri; wali anak tertaut |
| GET | `/member4/invoices/{id}` | Detail dalam scope yang sama |
| POST | `/member4/invoices` | Admin membuat tagihan |
| PUT/PATCH | `/member4/invoices/{id}` | Admin memperbarui tagihan belum dibayar tanpa catatan pembayaran |
| GET | `/member4/payments` | Riwayat pembayaran dalam scope tagihan yang diizinkan |
| GET | `/member4/payments/{id}` | Detail pembayaran; lokasi file bukti tidak disertakan |
| POST | `/member4/invoices/{id}/payments` | Murid/wali berhak mengajukan pembayaran dengan bukti |
| GET | `/member4/payments/{id}/proof` | Unduh bukti privat; scope sama dengan pembayaran |
| PATCH | `/member4/payments/{id}/verification` | Admin menerima/menolak pembayaran |
| GET | `/member4/finance/summary` | Ringkasan keuangan sesuai scope pengguna |
| GET | `/member4/finance/reports` | Admin membaca laporan posisi keuangan dan rincian jenis tagihan |
| POST | `/member4/invoices/{id}/reminders` | Admin membuat pengingat tagihan secara manual untuk akun siswa/wali berhak |
| GET | `/member4/parent/children` | Wali melihat daftar anak tertaut |
| GET | `/member4/parent/children/{student}` | Wali melihat identitas minimum anak tertaut |
| GET | `/member4/parent/children/{student}/schedules` | Wali membaca jadwal aktif anak tertaut |
| GET | `/member4/parent/children/{student}/dashboard` | Wali membaca ringkasan anak, jadwal, keuangan, dan ketersediaan integrasi akademik |
| GET | `/member4/parent/children/{student}/grades` | Status integrasi nilai; belum ada sumber Member 3 |
| GET | `/member4/parent/children/{student}/attendance` | Status integrasi absensi; belum ada sumber Member 3 |
| GET | `/member4/parent/children/{student}/assignments` | Status integrasi tugas/pengumpulan; belum ada sumber Member 2/3 |
| GET | `/member4/parent/children/{student}/progress` | Status integrasi progres; belum ada sumber Member 2/3 |
| GET | `/member4/announcements` | Admin semua; peran lain target `all` atau perannya |
| GET | `/member4/announcements/{id}` | Detail pengumuman dalam scope target |
| POST | `/member4/announcements` | Admin membuat pengumuman sistem |
| PUT/PATCH | `/member4/announcements/{id}` | Admin memperbarui pengumuman sistem |
| DELETE | `/member4/announcements/{id}` | Admin menghapus pengumuman sistem |
| GET | `/member4/notifications` | Pengguna membaca notifikasinya sendiri |
| PATCH | `/member4/notifications/{id}/read` | Menandai notifikasi sendiri sudah dibaca; aman dipanggil ulang |

Guru dapat login dengan `portal=communication` dan membaca pengumuman/notifikasi. Guru tetap tidak memiliki akses finance, master AIS atau portal wali.

### Tagihan

Body POST: `student_id`, `invoice_type`, `amount`, `due_date` (YYYY-MM-DD). Contoh:

```json
{"student_id":123,"invoice_type":"spp","amount":"250000.00","due_date":"2026-11-10"}
```

ID contoh harus diganti dengan murid existing. Tidak ada bulk bill, tagihan berulang otomatis, atau kalkulasi cicilan.

PUT/PATCH menerima sebagian field yang sama. `status` dan `created_by` dilarang. Semua perubahan tagihan ditolak dengan 409 setelah ada catatan pembayaran atau status bukan `unpaid`.

Filter daftar: `student_id`, `invoice_type`, `status` (`unpaid`, `paid`), `search` (nama/NIS), `outstanding=1`, `overdue=1`, `page`, `per_page`. `overdue=1` menyertakan hanya tagihan bersisa dengan tenggat sebelum hari ini di Asia/Jakarta; tenggat hari ini belum terlambat.

Objek tagihan menyertakan `verified_amount`, `outstanding_amount` (string dua desimal), `is_overdue`, `display_status` (`unpaid`, `overdue`, `paid`). Pembacaan daftar/detail juga menyertakan `payments_count` dan `pending_payments_count`. Nilai `overdue` hanya hasil perhitungan; enum database tetap `unpaid`/`paid`.

### Pembayaran

Filter daftar: `invoice_id`, `student_id`, `status` (`pending`, `verified`, `rejected`), `page`, `per_page`. Filter `student_id` ditambahkan pada Tahap 4 untuk riwayat per anak dan tetap berada di dalam scope keuangan existing. Filter anak yang tidak berhak menghasilkan daftar kosong, bukan akses ke record lain. Pembacaan menyertakan tagihan, identitas minimum siswa, nama pengaju dan pemeriksa; tidak mengekspos email maupun `proof_path`.

Pengajuan memakai **multipart/form-data** ke `/member4/invoices/{id}/payments`:

| Field | Ketentuan |
| --- | --- |
| `amount` | Positif, maksimal sepuluh digit dan dua desimal; harus sama persis dengan nominal tagihan |
| `payment_date` | YYYY-MM-DD, tidak melewati hari ini di Asia/Jakarta |
| `payment_method` | Teks wajib, maksimal 50 karakter; catatan metode yang digunakan, bukan integrasi transfer |
| `transaction_number` | Opsional, maksimal 100 karakter |
| `proof` | File JPG/JPEG/PNG/PDF, maksimal 2 MB; ekstensi, MIME dan isi dasar diperiksa |

ID tagihan berasal dari URL; pengaju berasal dari token. `status`, `submitted_by`, `verified_by`, `verified_at`, `invoice_id`, `proof_path` tidak boleh dikirim. Respons 201 selalu `pending`. Admin tidak mengajukan atas nama siswa. Satu pengajuan pending per tagihan; setelah ditolak, siswa/wali dapat membuat pengajuan baru. Tidak menerima cicilan atau kelebihan bayar karena PDF tidak menentukan kebijakannya.

Verifikasi memakai JSON `{"decision":"verified"}` atau `{"decision":"rejected"}`. Nominal, identitas pemeriksa, waktu dan status invoice ditetapkan backend. Keputusan final yang sama aman diulang; mengganti keputusan final menghasilkan 409. Pembayaran dengan bukti hilang tidak dapat diterima. Pengajuan dan verifikasi memakai transaksi serta kunci invoice yang sama dengan perubahan tagihan.

Endpoint `proof` mengirim lampiran privat dengan MIME tersimpan, `nosniff`, `no-store`, dan CSP sandbox. Token tetap diperlukan; tidak ada URL publik atau kebutuhan `storage:link` untuk bukti pembayaran.

### Ringkasan dan laporan

`finance/summary` mengembalikan `invoice_count`, `paid_count`, `unpaid_count`, `overdue_count`, `billed_amount`, `verified_amount`, `outstanding_amount`, `overdue_amount`, `pending_payment_count`, `verified_payment_count`, `rejected_payment_count`, dan `as_of`. Semua nominal berupa string dua desimal. Pembayaran pending/ditolak tidak mengurangi tagihan.

`finance/reports` mengembalikan `summary` dengan kolom ringkasan, `by_type` dengan kolom yang sama per jenis tagihan PDF, serta `as_of`. Laporan adalah posisi seluruh data saat ini, tanpa asumsi periode akuntansi, laba/rugi, atau ekspor tambahan.

### Jadwal anak

Filter: `academic_year_id`, `semester_id`, `page`, `per_page`. Objek jadwal memakai kolom existing dan relasi `subject`, `teacher`, `room`, `classroom`, `academic_year`, `semester`. Relasi guru hanya mengekspos ID/nama, bukan email/telepon.

Urutan hari Senin–Minggu, lalu jam dan ID. Sumber hanya jadwal aktif dengan penempatan kelas aktif anak, kelas dan tahun sama, semester sesuai; penempatan tanpa semester mencakup semester dalam tahun tersebut. Tidak menebak periode dari tahun kalender atau mengembalikan jadwal siswa lain.

### Informasi anak dan dashboard wali

Semua endpoint `/parent/*` hanya untuk `wali_murid` aktif. Admin/guru/murid tetap 403; sumber ID wali selalu token. Pemeriksaan `parents.status=active` dan `parent_student` dijalankan pada setiap request. Tidak ada pencocokan nama/email atau pengaitan profil otomatis.

Daftar/detail anak menyertakan `id`, `name`, `student_number`, `gender`, `birth_date`, `status`. Detail juga menyertakan `placements`: penempatan kelas aktif dengan identitas kelas, konsentrasi keahlian, tahun ajaran dan semester. Tidak mengekspos akun, alamat, atau data siswa lain.

Dashboard per anak mengembalikan `student`, `placements`, `schedule_count`, `finance` (hasil layanan ringkasan Stage 3 untuk anak tersebut), `academic` (empat status integrasi), `as_of`. Semua hitungan jadwal/keuangan berasal dari record nyata. Dashboard tidak menghasilkan nilai rata-rata, persentase kehadiran, atau skor perkembangan baru.

### Integrasi akademik yang belum tersedia

Checkout ini belum memiliki model/migrasi/API nilai, absensi, tugas, pengumpulan atau progres. Empat endpoint akademik memeriksa perwalian dahulu, lalu mengembalikan status eksplisit:

```json
{"success":true,"available":false,"status":"unavailable","message":"Informasi nilai akademik belum tersedia. Silakan periksa kembali nanti.","data":null}
```

Respons ini membedakan belum terintegrasi dari record kosong pada modul yang tersedia. ID anak di luar scope tetap 404; status integrasi tidak membypass otorisasi. Tidak ada endpoint penulisan akademik. Kontrak sumber yang dibutuhkan dan batas verifikasi dijelaskan di [STAGE-4.md](STAGE-4.md).

### Pengumuman

Body POST: `title` (maksimal 255 karakter), `content` (teks biasa, maksimal 20.000 karakter), `target_role` (`all`, `admin`, `guru`, `murid`, `wali_murid`). PUT/PATCH menerima sebagian field tersebut. `created_by` dan `course_id` dilarang.

Pembuatan/perubahan menyinkronkan notifikasi untuk akun aktif pada peran penerima. Perubahan identik tidak menggandakan notifikasi; perubahan isi mengembalikan status belum dibaca. Perubahan audience menarik notifikasi dari penerima lama, dan penghapusan pengumuman menghapus notifikasi sumber tersebut. Notifikasi dan source disimpan dalam transaksi yang sama. Email hanya diantrekan setelah commit jika kanal dikonfigurasi; tidak ada pengiriman push.

### Notifikasi

Filter: `is_read=0`/`1`, `category=announcement`/`payment_reminder`, `page`, `per_page`. Endpoint `read` tidak menggunakan target pengguna dari body; selalu pengguna login. Tidak ada endpoint publik untuk mengirim notifikasi arbitrer.

Record dapat menyertakan `category`, `source_id`, `email_status` (pending/sent/failed/skipped), `email_sent_at`. Field nullable mempertahankan notifikasi lama. Pembacaan/mark-read memeriksa pemilik dan akses sumber saat ini: peran audience pengumuman, atau perwalian/kepemilikan tagihan yang masih belum lunas. Notifikasi lama tanpa kategori tetap hanya milik pengguna tersebut.

### Reminder pembayaran

POST `/member4/invoices/{id}/reminders` tidak menerima daftar penerima arbitrer. Admin memicu pengingat per tagihan; server mengunci invoice yang sama dengan Stage 3, memeriksa sisa pembayaran terverifikasi dan akun siswa/wali aktif yang tertaut. Respons `data` berisi `eligible` dan `created` (jumlah notifikasi baru/diperbarui). Tagihan lunas menghasilkan 409; pengulangan identik menghasilkan 200 dengan created=0. Akun tanpa profil tertaut tidak mendapat reminder. Verifikasi/status pembayaran tidak diubah.

Tidak ada scheduler atau pengiriman berulang. Email mengikuti konfigurasi Laravel dan worker, bukan janji penerimaan mailbox. Kontrak tugas/ujian, aturan pesan, dan dependensi push dijelaskan di [STAGE-5.md](STAGE-5.md).

### Kode respons

- 200: pembacaan/perubahan berhasil; 201: pembuatan berhasil.
- 401: belum terautentikasi.
- 403: peran atau akun tidak diizinkan.
- 404: objek tidak ditemukan atau berada di luar scope pengguna.
- 409: perubahan bertentangan dengan catatan keuangan yang sudah ada.
- 422: validasi gagal.

Route akademik Member 1 tetap admin-only; wali/murid tidak boleh menggunakan `/students`, `/parents`, `/schedules`, atau `/dashboard` untuk menghindari scope portal.
