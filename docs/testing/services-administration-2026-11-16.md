# Login bersama dan alur administrasi

## Perubahan

- Login tidak lagi meminta pilihan layanan. Setelah autentikasi, `/` menampilkan Administrasi, Keuangan, LMS, dan Assessment. Kartu yang tidak sesuai peran akun tidak membuka layanan; pembatasan API tetap berlaku.
- Setiap layanan memiliki navigasi sendiri dan tautan kembali ke **Pilih layanan**. Dashboard administrasi berada di `/administration`. Komunikasi sekolah tetap berada bersama layanan wali/keuangan; guru tetap dapat mengakses komunikasinya.
- Tab dan rute antarmuka **Hak Akses & Peran** dihapus. Data peran internal tetap dipakai untuk pengelolaan akun dan otorisasi.
- Pembuatan akun guru/murid melalui Data Pengguna juga membuat atau menghubungkan profil akademik dalam transaksi database. Perubahan nama/status tersinkron; profil guru juga menyinkronkan email. NIS/NIP yang sudah ada dipertahankan. Profil baru memakai nomor sementara `AKUN-ID` sampai dilengkapi administrator.
- Perubahan peran menonaktifkan profil lama dan mempertahankan riwayatnya. Profil yang terhubung akun tidak bisa dihapus langsung; nonaktifkan profil/akun. Penghapusan akun mempertahankan profil sebagai arsip nonaktif.
- Kalender akademik memakai tampilan bulanan, pembuatan lewat klik tanggal, kegiatan beberapa hari, pengubahan, dan penghapusan. Tahun ajaran dan semester tetap memakai relasi API existing.
- Kelas memakai kartu dengan pemilihan wali kelas langsung. Wali kelas adalah penugasan seorang guru pada kelas, bukan peran login tambahan.
- Pembagian kelas memakai pemilihan beberapa siswa. Registrasi memakai daftar siswa dan tombol persetujuan. Beban mengajar dikelompokkan per guru. Jadwal ditampilkan sebagai agenda mingguan dengan pembuatan pelajaran dari kolom hari.
- Operasi beberapa siswa menggunakan permintaan API existing per siswa. Jika sebagian gagal, jumlah keberhasilan serta alasan kegagalan ditampilkan; bukan transaksi batch atomik.

## Akun lama

Pada database lokal yang dikonfigurasi di `backend/.env`, dua akun guru/murid diperiksa dan dihubungkan dengan:

```powershell
cd E:\final\backend
php artisan academic:sync-users --apply
```

Perintah dapat dijalankan ulang. Tanpa `--apply`, perintah hanya menghitung akun. Guru lama hanya dicocokkan melalui relasi `user_id` atau email unik. Siswa lama tidak digabung hanya berdasarkan nama, karena nama yang sama tidak membuktikan identitas yang sama.

## Penggunaan

1. Buat akun guru/murid dari **Data Pengguna**. Lengkapi NIP/NIS pada tab Guru/Siswa.
2. Siapkan tahun ajaran, semester, dan konsentrasi keahlian bila belum ada.
3. Buka **Kelas**, buat kelas, lalu pilih guru pada **Wali kelas**.
4. Klik **Atur siswa**, pilih semester, dan centang siswa yang akan ditempatkan.
5. Atur beban mengajar serta agenda mingguan dengan konteks kelas/semester yang sama.
6. Buka **Kalender Akademik** dan klik tanggal untuk menambah kegiatan.

## Verifikasi

- Laravel: **99 tes lulus, 1.080 assertions**, termasuk delapan tes baru login bersama, pembatasan API, sinkronisasi dua arah, idempotensi, pelestarian nomor/riwayat, dan rollback konflik email.
- Build Vite frontend utama berhasil; pemeriksaan oxlint pada berkas frontend yang berubah tidak menemukan masalah.
- Pengujian fungsional Chrome lokal: **14 pemeriksaan lulus**, memakai aplikasi terisolasi pada port 4178/8086 dengan SQLite sintetis. Mencakup login, isolasi menu, akun/profil, wali kelas, penempatan siswa, persetujuan registrasi, beban mengajar, agenda mingguan, kalender, akses siswa, dan tampilan beranda ukuran 390px.
- Hasil dan sepuluh screenshot: `.tools/browserstack/results/navigation-update/`.
- Skrip reproduksi: `node tests/browserstack/navigation-update.cjs` setelah aplikasi test lokal disiapkan. Skrip ini membuat data sintetis tambahan di database test; tidak memakai database MySQL aplikasi.
- Helper login pada skrip browser lama disesuaikan untuk login bersama. Matriks BrowserStack Cloud dan k6/Grafana tidak dijalankan ulang untuk perubahan ini; hasil historis bukan bukti pengujian ulang versi baru.
- Implementasi dan aset assessment tidak diubah. Pengujian hanya memeriksa isolasi navigasi pada pembungkus assessment, bukan menguji ulang isi assessment.
- UptimeRobot tidak diaktifkan.
