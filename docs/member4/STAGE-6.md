# Anggota 4 — Tahap 6: Integrasi Dashboard dan UI

## Cakupan dan audit awal

Sumber PDF gabungan: halaman 28 (Parent Portal, finance, komunikasi dan dashboard sesuai peran), 39 (ELIW-34–39 untuk pemantauan anak), 40 (progres akademik, administrasi dan pembayaran). Stage 6 hanya mengintegrasikan fungsi existing. Tidak ada LMS/penilaian/absensi/jadwal/auth baru, kanal notifikasi baru, payment gateway, AI atau metrik baru.

Struktur frontend/backend, routes, controller, layanan, model, client Axios, login/sesi, layout/sidebar serta komponen Member 4 diperiksa sebelum perubahan. Inventaris:

- Finance: `FinancePages` (ringkasan/laporan/routing), `InvoicePages` (daftar/form/detail/unggah), `PaymentPages` (riwayat/verifikasi/detail/bukti), helper `finance.js`, komponen feedback/form/table `shared.jsx`.
- Portal: `ParentPortal` (anak/routing/dashboard), `AcademicPages` (profil/kelas/jadwal/keadaan akademik), `parent.js` (pemilihan anak dan pagination).
- Komunikasi: `CommunicationPages` (pengumuman/detail/pusat notifikasi) dan `PaymentReminder` (reminder admin di detail tagihan).
- Bersama: `App`/React Router, `Layout`, `Login`, `api.js`/Sanctum; tetap satu frontend dan satu client autentikasi.
- Backend: routes `member4.php`, scope `StudentAccess`/`NotificationAccess`, `FinanceSummary`, controller portal/finance/komunikasi serta middleware role existing. Tidak ditemukan source akademik Anggota 2/3 baru atau infrastruktur push.

| Temuan integrasi | Perbaikan |
| --- | --- |
| Kartu ringkasan finance belum menuju daftar yang sesuai | Kartu menjadi tautan ke tagihan, riwayat verified/pending atau tunggakan sesuai peran |
| Filter riwayat tidak membaca query status dari URL | Status/page memakai search params, tetap konsisten saat reload/navigasi |
| Detail keuangan dari portal kehilangan anak terpilih | Tautan konteks dan tautan kembali memakai ID anak; kecocokan diperiksa terhadap respons API |
| Dialog/success state bisa terbawa saat ID transaksi berubah dalam SPA | Detail invoice/payment dipisah menjadi konten dengan key ID; state sumber lama dilepas |
| Ringkasan terbuka bisa tertinggal setelah operasi di tab lain | Dashboard/report dan pusat notifikasi revalidate saat window kembali fokus |
| Pembacaan identik dapat berulang pada StrictMode/subscriber bersamaan | Helper existing membagi GET yang belum selesai berdasarkan token/path, tanpa cache hasil permanen |
| Error backend 5xx/blob dapat menampilkan detail teknis | Pesan aman Indonesia untuk error server, hak akses, record hilang, validasi dan berkas |
| 401 terlambat dari token lama dapat menghapus token baru | Interceptor membandingkan Authorization request dengan token aktif sebelum menghapus sesi |
| Bahasa sidebar/header tidak konsisten | Keluar/Sistem Informasi Akademik konsisten; desain sidebar dan navigasi lama dipertahankan |

## Integrasi yang diselesaikan

### Dashboard wali

Anak, jadwal, tagihan/status dan ringkasan pembayaran tetap dari endpoint terotorisasi existing. Pilihan anak dipertahankan antar-menu dan saat kembali dari detail finance/riwayat. Tidak menghitung nilai atau saldo di frontend. Grade/absensi/tugas/progres tetap menampilkan unavailable secara eksplisit karena source tidak tersedia.

Dashboard mengambil ringkasan baru saat fokus kembali setelah admin melakukan verifikasi di sesi lain. Form unggah tidak memakai refresh-on-focus sehingga pilihan file dan metode pembayaran tidak hilang ketika pemilih berkas ditutup.

### Dashboard finance

Kartu jumlah tagihan, pembayaran diterima, sisa dan pending membuka halaman existing yang sesuai. Verified/pending diteruskan sebagai filter URL ke riwayat, bukan filter tampilan palsu. Nominal dan jumlah seluruhnya dari `FinanceSummary` backend. Pembuatan tagihan, pengajuan bukti dan verifikasi mengandalkan hasil API dan reload existing; pembacaan yang dimulai sebelum write tidak dipakai ulang untuk reload tersebut.

### Komunikasi dan peran

CRUD pengumuman, audience, notifikasi pribadi, mark-read dan reminder manual existing tetap terhubung. Pusat notifikasi refresh saat kembali fokus. Tidak menampilkan status email/push seolah telah terkirim; penjelasan notifikasi dalam aplikasi tetap dipakai. Empat peran mempertahankan sidebar dan akses langsung sesuai pembatasan existing. Admin AIS dan route anggota lain tidak diganti.

## File

File produksi baru: **tidak ada**. Dokumen baru: `docs/member4/STAGE-6.md`.

File dimodifikasi dari hasil Tahap 5:

- `frontend/src/finance/finance.js`: error aman, pooling GET token/path, invalidasi setelah write, pilihan refresh-on-focus dan helper konteks tautan.
- `frontend/src/finance/FinancePages.jsx`: tautan kartu dan refresh dashboard/laporan.
- `frontend/src/finance/InvoicePages.jsx`: detail yang di-key per ID, tautan konteks dan empty state tagihan.
- `frontend/src/finance/PaymentPages.jsx`: filter URL, konteks anak, reset detail per ID dan error bukti privat yang aman.
- `frontend/src/parent/parent.js`: pemuatan seluruh anak menggunakan pembacaan bersama dengan perlindungan hasil request yang sudah tidak aktif.
- `frontend/src/parent/ParentPortal.jsx`: dashboard wali refresh-on-focus.
- `frontend/src/communication/CommunicationPages.jsx`: notifikasi refresh-on-focus.
- `frontend/src/api.js`: perlindungan 401 dari token lama; client/token dan pola auth existing dipertahankan.
- `frontend/src/pages/Login.jsx`: penanganan error server/validasi memakai helper existing; pesan kredensial salah tetap jelas.
- `frontend/src/layouts/Layout.jsx`: konteks anak pada tautan portal dari detail finance, bahasa header/logout konsisten.
- `README.md`, `docs/member4/API.md`, `docs/member4/INTEGRATION.md`: status integrasi dan batas terbaru.

Script/screenshot pengujian lokal di `.tools/member4-stage6-*` dan `.tools/communication-stage6-*` diabaikan Git, seperti infrastruktur browser tahap sebelumnya. Tidak menambah dependency, UI library, state library, client API, atau berkas aplikasi lain. Perubahan tahap terdahulu di workspace dipertahankan.

## Routes, API dan database

Tidak ada route/backend endpoint atau schema baru pada Tahap 6. Seluruh 24 route Laravel Member 4 tetap terdaftar. API yang diintegrasikan:

- Ringkasan/laporan: `/api/member4/finance/summary`, `/finance/reports`.
- Portal: `/parent/children`, detail/kelas, `/schedules`, `/dashboard`, dan empat pembacaan status akademik existing.
- Tagihan/pembayaran: daftar/detail, POST bukti dan PATCH verification existing.
- Komunikasi: announcement CRUD, daftar notifikasi, PATCH read dan reminder invoice existing.
- Auth: login/me/logout dan header Bearer existing.

Rute UI existing `/finance/*`, `/parent/*`, `/communication/*` tetap digunakan. Perbaikan query: `status`/`page` pada riwayat dan `from=parent&student_id=...` pada detail. Metadata konteks hanya navigasi; tidak menjadi izin backend. Parameter anak untuk tautan kembali harus cocok dengan anak pada respons invoice/payment. Tidak ada redirect ke alamat bebas dari client.

Tidak ada perubahan database aplikasi. Fixture hanya di database `bhakti_member4_stage6_test`. Pemeriksaan read-only pada `sistem_akademik` tetap menunjukkan 0 siswa, wali, invoice, payment, announcement dan notification; tidak memasukkan data palsu ke sekolah.

## Verifikasi

Perintah yang benar-benar dijalankan:

```powershell
# frontend
npm.cmd run lint
npm.cmd run build

# backend, default SQLite in-memory
php artisan test --compact
php artisan route:list --path=member4

# backend, MySQL khusus uji (bukan sistem_akademik)
$env:DB_CONNECTION='mysql'
$env:DB_DATABASE='bhakti_member4_stage6_test'
php artisan test --compact
```

| Pemeriksaan final | Hasil yang benar-benar dijalankan |
| --- | --- |
| Seluruh suite Laravel pada SQLite in-memory | 79 tes lulus, 902 assertion |
| Seluruh suite Laravel pada MySQL uji terisolasi | 79 tes lulus, 902 assertion |
| Frontend lint | Bersih tanpa warning |
| Frontend build | Berhasil, Vite 8.3.1 |
| Routes Laravel Member 4 | 24 route existing tetap terdaftar |
| Chrome integrasi dashboard/finance/portal/sesi | Lulus, termasuk 320px dan fault handling |
| Chrome regresi komunikasi/notifikasi/reminder | Lulus, termasuk 390px |
| Error JavaScript pada kedua alur browser | Tidak ditemukan |
| Diff check | Tidak ada whitespace error; hanya pemberitahuan konversi line ending Git |

Browser menggunakan Chrome/Playwright existing, Vite dan API Laravel/MySQL nyata; tidak menggunakan mock produksi. Respons error/401 sengaja diinjeksi hanya untuk menguji keadaan gagal. Server API/Vite uji telah dihentikan. Bukti/transaksi fixture dibersihkan sebelum tes MySQL final; `.env` aplikasi dan data sekolah tidak diganti.

Pemeriksaan browser yang lulus:

- Perpindahan anak B -> tagihan/detail -> kembali, serta riwayat/detail -> kembali tetap anak B.
- Kartu verified membuka riwayat dengan filter verified; pilihan pending bertahan setelah reload URL.
- Admin membuat invoice baru, siswa mengunggah PDF, admin memverifikasi; tampilan total cocok dengan backend dan laporan.
- Dashboard wali yang sudah terbuka menampilkan saldo terbaru setelah fokus kembali; data keuangan anak lain tidak tercampur.
- Fokus kembali ke form upload mempertahankan metode dan file; dialog verifikasi lama tidak terbawa saat pindah ID pembayaran dalam SPA.
- Dua GET bersamaan yang identik melalui helper menghasilkan satu request backend.
- Fault server berisi contoh SQL/path tidak ditampilkan; retry memuat data nyata kembali.
- Guru tidak mendapat menu/admin finance, URL finance guru diarahkan ke komunikasi, URL report siswa diarahkan ke finance miliknya.
- Layout data selesai dimuat pada 320px: dashboard wali, laporan, detail invoice, detail/verifikasi/bukti pembayaran; tidak ada overflow halaman.
- Respons 401 token lama tidak menghapus token pengganti; 401 dari token aktif tetap membersihkan sesi dan kembali ke login.
- Regresi komunikasi: CRUD pengumuman, audience berubah/dihapus, notifikasi pribadi/read/filter, reminder invoice manual/dedup, role siswa/wali/guru, empty/error/retry dan layout 390px.
- Tidak ada error JavaScript pada kedua alur browser.

## Dependensi dan isu yang masih tersedia

1. Nilai, absensi, tugas/pengumpulan dan progres Anggota 2/3 belum memiliki source di checkout; keadaan unavailable dipertahankan. Retrieval record akademik nyata tidak dapat dinyatakan lulus.
2. Messaging memerlukan aturan pengirim/penerima/aksi; reminder tugas/ujian memerlukan source dan kebijakan waktu. Tidak dibuat fitur pengganti pada tahap integrasi ini.
3. Email produksi memerlukan konfigurasi SMTP/sendmail, flag email dan worker. Transport SMTP lokal diuji pada Tahap 5; mailbox produksi belum diverifikasi kembali atau diklaim terkirim.
4. Push belum memiliki infrastruktur approved; notifikasi dalam aplikasi tidak disebut push.
5. Sekolah masih perlu melengkapi data asli dan relasi akun/perwalian melalui Anggota 1.

Tidak ada penghambat teknis baru yang diketahui pada integrasi yang tersedia setelah pemeriksaan. Tidak memulai Tahap 7.
