# Anggota 4 — Tahap 4: Parent Portal

## Cakupan dan sumber

Fondasi Stage 3 diperiksa dari controller, layanan pembayaran, routes, tes dan laporan sebelumnya. PDF gabungan `capsnew_Merged.pdf` menjadi sumber: halaman 28 (Parent Portal/dashboard), 39 (ELIW-34 sampai ELIW-39), 40 (progres akademik, absensi, nilai dan administrasi), serta 109 (SRS-49/50). Stack dan desain existing dipertahankan.

| Kebutuhan | Implementasi dan batas |
| --- | --- |
| Autentikasi/perwalian | Sanctum dan role wali existing; cek profil wali aktif dan pivot pada setiap request |
| Dashboard wali | Ringkasan anak terpilih, jumlah jadwal aktif, tagihan/sisa, status pembayaran, status ketersediaan sumber akademik |
| Informasi anak | Daftar anak tertaut, pemilihan anak, identitas minimum, kelas/konsentrasi/periode aktif |
| Jadwal | Mata pelajaran, guru, kelas, ruang, hari/jam, tahun/semester; hanya kelas/periode anak |
| Nilai | Halaman baca-saja dan respons sumber belum tersedia; integrasi nyata Anggota 3 tertunda |
| Absensi | Halaman baca-saja dan respons sumber belum tersedia; integrasi nyata Anggota 3 tertunda |
| Tugas/pengumpulan | Halaman pemantauan dan respons sumber belum tersedia; Anggota 2/3 belum tersedia |
| Perkembangan akademik | Status belum tersedia dan navigasi ke informasi pendukung; tanpa skor/prediksi/algoritma baru |
| Tagihan/riwayat | Komponen dan API Stage 3 dengan filter anak; rincian/pengajuan tetap di modul finance |

Halaman nilai, absensi, tugas dan progres menangani dependensi yang tidak ada secara eksplisit. Ini bukan klaim bahwa pengambilan record akademik nyata dari Anggota 2/3 telah diimplementasikan atau diuji. Tidak ada tabel/record/score pengganti.

## File dibuat

- `backend/app/Services/Member4/ParentAcademicData.php`: status integrasi akademik yang belum tersedia.
- `backend/app/Services/Member4/ParentScheduleReader.php`: query jadwal berdasarkan penempatan anak.
- `backend/app/Services/Member4/FinanceSummary.php`: layanan ringkasan finance yang diekstrak dari Stage 3 agar tidak diduplikasi.
- `backend/tests/Feature/Member4ParentPortalTest.php`: sembilan tes portal/perwalian/integrasi yang tersedia.
- `frontend/src/parent/ParentPortal.jsx`: pemilihan anak, daftar anak, dashboard, routing portal.
- `frontend/src/parent/AcademicPages.jsx`: profil, kelas, jadwal/filter dan keadaan akademik belum tersedia.
- `frontend/src/parent/parent.js`: pemuatan anak dengan seluruh halaman pagination, label dan tautan portal.
- `docs/member4/STAGE-4.md`: laporan ini.

## File dimodifikasi

- `backend/app/Http/Controllers/Member4/ParentPortalController.php`: identitas minimum/kelas, dashboard dan pembacaan status akademik yang sudah diotorisasi.
- `backend/app/Http/Controllers/Member4/FinanceReportController.php`: mendelegasikan agregat existing ke `FinanceSummary`; kontrak dan hasil Stage 3 dipertahankan.
- `backend/app/Http/Controllers/Member4/PaymentController.php`: filter `student_id` pada daftar pembayaran, tetap di dalam scope yang sama.
- `backend/routes/member4.php`: dashboard per anak dan empat pembacaan akademik hanya untuk wali.
- `frontend/src/App.jsx`: rute `/parent/*`, landing wali ke portal; landing admin/siswa tetap sesuai modulnya.
- `frontend/src/layouts/Layout.jsx`: menu wali, identitas panel, mempertahankan anak saat berpindah menu.
- `frontend/src/pages/Login.jsx`: memperjelas label layanan Member 4; backend auth existing tidak diubah.
- `frontend/src/finance/InvoicePages.jsx`, `PaymentPages.jsx`: parameter anak opsional agar komponen Stage 3 dapat dipakai portal.
- `frontend/src/finance/shared.jsx`: label konteks dan loading opsional; default finance dipertahankan.
- `docs/member4/API.md`, `docs/member4/INTEGRATION.md`, `README.md`: penggunaan dan batas integrasi terbaru.

Perubahan Stage 2/3 yang belum di-commit tetap dipertahankan. Tidak ada perubahan schema atau implementasi modul Member 1/2/3.

## API dan integritas akses

Awalan `/api/member4`. Seluruh `/parent/*` memerlukan akun aktif `wali_murid`. ID wali selalu dari token. Akun admin tidak dapat menggunakan endpoint portal untuk menyamar sebagai wali.

| Metode | URI | Status |
| --- | --- | --- |
| GET | `/parent/children` | Digunakan kembali, memperkaya identitas minimum |
| GET | `/parent/children/{student}` | Digunakan kembali, menambah penempatan kelas aktif |
| GET | `/parent/children/{student}/schedules` | Digunakan kembali, urutan Senin–Minggu dan filter periode |
| GET | `/parent/children/{student}/dashboard` | Baru; agregat anak yang berhak |
| GET | `/parent/children/{student}/grades` | Baru; batas integrasi nilai belum tersedia |
| GET | `/parent/children/{student}/attendance` | Baru; batas integrasi absensi belum tersedia |
| GET | `/parent/children/{student}/assignments` | Baru; batas integrasi tugas belum tersedia |
| GET | `/parent/children/{student}/progress` | Baru; batas integrasi progres belum tersedia |
| GET | `/invoices?student_id={student}` | Menggunakan scope dan filter Stage 3 |
| GET | `/payments?student_id={student}` | Menggunakan riwayat Stage 3, filter anak ditambahkan |
| GET | `/invoices/{id}`, `/payments/{id}`, `/payments/{id}/proof` | Rincian/proof Stage 3; scope tetap berlaku |

Empat endpoint akademik menggunakan satu route Laravel dengan regex section terbatas. Status unavailable diperiksa setelah otorisasi anak dan memakai `available=false`, `status=unavailable`, `data=null`, pesan Indonesia. Tidak menyamakan tidak terintegrasi dengan nilai nol atau absensi kosong.

Wali yang tidak memiliki hubungan mendapat 404 untuk detail. Daftar finance yang difilter ke anak tidak berhak tetap kosong sesuai konvensi Stage 3. Pencabutan pivot/nonaktifnya profil wali langsung menutup akses data di request berikutnya. Tidak tersedia endpoint perubahan profil/nilai/absensi/tugas/jadwal di portal. Verifikasi pembayaran tetap admin-only.

Frontend: `/parent`, `/parent/children`, `/parent/information`, `/parent/grades`, `/parent/attendance`, `/parent/assignments`, `/parent/schedules`, `/parent/progress`, `/parent/invoices`, `/parent/payments`. Parameter URL `student_id` dipertahankan saat navigasi. ID tidak sah tidak dialihkan diam-diam ke anak lain.

## Database

Tidak ada migrasi, tabel atau kolom baru. Menggunakan `users`, `roles`, `students`, `parents`, `parent_student`, `class_student`, `classrooms`, `study_programs`, `schedules`, `subjects`, `teachers`, `rooms`, `academic_years`, `semesters`, `invoices`, `payments` existing. Tidak menambah relasi ke model akademik bersama.

Status migrasi aplikasi diperiksa: seluruh migrasi existing sudah Ran. Data sekolah tidak diisi fixture; pemeriksaan read-only menunjukkan 0 siswa/wali/tagihan/pembayaran pada `sistem_akademik`.

## Kontrak sumber akademik yang masih dibutuhkan

Berikut kebutuhan baca minimum untuk disepakati dengan pemilik modul, **bukan tabel/endpoint yang diasumsikan sudah ada**:

| Pemilik | Sumber | Kontrak baca minimum |
| --- | --- | --- |
| Anggota 3 | Nilai | ID siswa, identitas mapel/course, periode, nilai yang telah dirilis sesuai struktur penilaian milik modul; status publikasi wajib jelas |
| Anggota 3 | Absensi | ID siswa/jadwal, tanggal, status hadir/absen/sakit/izin sesuai enum sumber, ringkasan jika memang disediakan |
| Anggota 2 | Tugas/course | ID tugas/course, judul, tenggat dengan zona waktu, publikasi, daftar/relasi siswa penerima yang sah |
| Anggota 3 | Pengumpulan | ID siswa/tugas, status pengumpulan/penyelesaian yang memang disediakan, waktu pengumpulan; tanpa endpoint submit dari portal |
| Anggota 2/3 | Progres | ID siswa/course, periode dan catatan/ringkasan progres yang telah dihasilkan modul; tanpa algoritma baru di Member 4 |

Kontrak harus membedakan record kosong, sumber belum tersedia, dan kegagalan sumber. Semua reader harus menerima identitas siswa yang sudah diotorisasi, memfilter periode/publikasi/keanggotaan menurut sumber, tidak membuka draf atau data teman sekelas, dan mendukung pagination bila perlu. Nilai asli ditampilkan tanpa menghitung ulang bobot/nilai akhir. Setelah kontrak nyata tersedia, integrasikan pada `ParentAcademicData` dan lengkapi penyajian kolom sesuai respons sumber; jangan menebak schema hanya dari nama tabel.

## Verifikasi

Perintah yang dijalankan dari direktori sesuai proyek:

```powershell
# backend, pengujian default SQLite in-memory
php artisan test

# backend, database MySQL khusus uji (bukan sistem_akademik)
$env:DB_CONNECTION='mysql'
$env:DB_DATABASE='bhakti_member4_stage4_test'
php artisan test

# backend, inspeksi aplikasi
php artisan migrate:status
php artisan route:list --path=member4/parent

# frontend
npm.cmd run lint
npm.cmd run build
```

Hasil tes Laravel: **65 lulus, 804 assertion pada SQLite dan MySQL**. Sembilan tes portal mencakup dua anak, profil/kelas, agregat finance per anak, filter riwayat untuk wali maupun siswa, jadwal/periode/hari, sumber akademik belum tersedia, role, login wajib, profil wali nonaktif, akun tanpa anak, pencabutan perwalian, dan larangan penulisan/verifikasi oleh wali. Seluruh tes Stage 2/3 dan AIS juga lulus.

Frontend lint bersih dan build Vite berhasil. Pemeriksaan browser menggunakan Chrome/Playwright existing, Vite, API Laravel nyata dan fixture khusus `bhakti_member4_stage4_test`; tidak memakai mock data produksi. Script/screenshot lokal di `.tools/member4-stage4-browser.cjs` dan `.tools/parent-*.png` diabaikan Git.

| Pemeriksaan browser yang benar-benar dijalankan | Hasil |
| --- | --- |
| Login existing, landing wali/admin/siswa | Lulus; admin/siswa tetap masuk modul existing |
| Dua anak, profil dan kelas, pilihan anak antar-menu | Lulus; anak terpilih dipertahankan di URL |
| Daftar anak dengan respons API per_page=1 | Lulus; seluruh halaman dibaca dan kedua anak tersedia |
| Jadwal anak, pergantian anak dan filter tahun | Lulus; tidak tercampur jadwal saudara/anak lain |
| Tagihan, riwayat per anak dan tautan bukti Stage 3 | Lulus; hanya record anak terpilih |
| Nilai/absensi/tugas/progres belum tersedia | Lulus sebagai keadaan unavailable, bukan retrieval akademik nyata |
| URL anak tidak berhak, API lintas anak dan verifikasi oleh wali | Ditolak sesuai aturan |
| Akun tanpa anak, gagal memuat dan coba kembali | Lulus; tidak menampilkan statistik palsu |
| Tampilan data selesai dimuat pada 390px | Lulus: dashboard, jadwal, profil, tagihan, riwayat, keadaan akademik; tidak ada overflow halaman |
| Error JavaScript | Tidak ditemukan |

Server API/Vite khusus pengujian sudah dihentikan. Bukti/transaksi fixture dibersihkan dari database uji sebelum regresi MySQL final; `.env` dan data sekolah tidak diganti. Kesalahan fixture awal yang belum mengisi field wajib kelas/ruang diperbaiki dengan mengikuti schema existing, lalu seluruh tes lulus.

**Tidak dapat diuji sebagai integrasi nyata:** retrieval nilai, riwayat absensi, tugas/status pengumpulan, dan record progres Anggota 2/3. Tidak ada model, migrasi maupun API sumber di checkout ini. Tes yang lulus pada area ini hanya otorisasi dan respons/keadaan belum tersedia.

## Sisa dan batas tahap

- Anggota 1 perlu menyediakan data siswa/wali asli dan pengaitan akun/perwalian; tidak ditangani oleh portal.
- Anggota 2/3 perlu menyediakan kontrak dan reader sumber akademik di atas sebelum informasi tersebut dapat ditampilkan sebagai record nyata.
- Tidak ada pengelolaan akun, pengeditan hubungan perwalian, penilaian, pencatatan absensi, pembuatan/pengumpulan tugas, atau pembuatan jadwal baru.
- Pengajuan/verifikasi pembayaran tetap Stage 3; komunikasi/notifikasi/reminder belum dimulai.
- Tahap 5 menunggu instruksi berikutnya.
