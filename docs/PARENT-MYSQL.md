# Portal Wali dan MySQL

Portal Wali menggunakan backend Laravel dan koneksi database yang sama dengan AIS. Tidak ada database wali terpisah atau tabel anak duplikat.

## Konfigurasi

Pada `backend/.env`, setel `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD` sesuai server lokal. Template `.env.example` menggunakan database `sistem_akademik`. Kredensial sebenarnya hanya disimpan di `.env` yang diabaikan Git. Pastikan MySQL berjalan melalui XAMPP/layanan lokal; bila konfigurasi diubah setelah dicache, jalankan `php artisan config:clear` dari folder backend.

Untuk instalasi baru, buat database kosong yang sesuai, lalu jalankan `php artisan migrate`. Jangan menggunakan `migrate:fresh`, `db:wipe` atau mengimpor database lain di atas data sekolah. Pemeriksaan koneksi pada pekerjaan ini tidak menjalankan migrasi atau mengubah data sekolah.

## Relasi yang digunakan

- `users` dengan role `wali_murid` → `parents.user_id`, status parent harus `active`.
- `parent_student.parent_id` dan `.student_id` → daftar anak yang berhak dilihat. Wali tanpa relasi mendapat daftar kosong; tidak ada pencocokan otomatis berdasarkan nama/email.
- `class_student` → penempatan siswa pada kelas/tahun/semester yang sesuai.
- `schedules` → jadwal dari kelas dan periode penempatan tersebut.
- `invoices.student_id` → tagihan anak; `payments.invoice_id` → riwayat pembayaran. Jumlah terverifikasi dihitung backend.

Data tersebut dikelola melalui modul Member 1 dan Finance existing. Isi data siswa/wali asli, tautkan akun dan hubungan perwalian, lalu buat penempatan/jadwal/tagihan sesuai kebutuhan sekolah. Jangan membuat data contoh untuk menutupi ketiadaan data produksi.

API `/api/member4/parent/children`, detail/dashboard/jadwal anak, serta API invoice/payment membaca relasi MySQL tersebut dengan pemeriksaan kepemilikan pada setiap permintaan. Frontend `frontend/src/parent/` memanggil API existing; tidak menggunakan local storage sebagai sumber data portal.

## Hasil pemeriksaan lokal 2026-11-01

Koneksi efektif: driver **mysql**, database **sistem_akademik**. Server awalnya berhenti dan koneksi ditolak; MySQL XAMPP kemudian dijalankan dan koneksi berhasil. Query read-only menunjukkan 4 user, tetapi `parents`, `students`, `parent_student`, `class_student`, `schedules`, `invoices` dan `payments` masih kosong. Karena itu, portal belum menampilkan anak atau transaksi pada database sekolah ini.

`grades`, `attendances`, `assignments` dan `assignment_submissions` belum ada. Halaman akademik portal tetap menampilkan status belum tersedia. Assessment Vue saat ini adalah workspace lokal browser, bukan sumber MySQL. Menyimpan dan membagikan assessment melalui MySQL memerlukan backend assessment beserta otorisasi, publikasi hasil dan kontrak pembacaan portal; hal tersebut tidak terjadi hanya dengan mengganti konfigurasi koneksi.

Verifikasi: suite Laravel pada `bhakti_member4_stage7_test` menggunakan MySQL lulus **83 tes, 942 assertions**. Cakupannya termasuk daftar anak, ringkasan, jadwal, tagihan/riwayat, pencabutan relasi dan penolakan akses anak lain. Database sekolah tidak dipakai sebagai database tes. Pemeriksaan Git sebelum commit memastikan `origin/assesment` tetap leluhur HEAD dan 16 commit Blackumis tetap ada.

## Riwayat Git

Commit baru tidak menghapus commit dan penulis sebelumnya. Merge assessment sebelumnya mempertahankan 16 commit Blackumis. Push biasa mempertahankan leluhur tersebut. GitHub dapat menampilkan pesan commit/penulis terbaru pada file yang berubah; itu berbeda dari menghapus atribusi historis. Jangan squash/rebase riwayat contributor atau force-push main untuk pembaruan ini. Kontribusi baru sebaiknya menjadi commit baru dengan penulis sebenarnya.
