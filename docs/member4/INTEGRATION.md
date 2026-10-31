# Dependensi integrasi Anggota 4

Status akhir Tahap 7 dan bukti pengujian tersedia pada [STAGE-7.md](STAGE-7.md). Kelulusan tes lokal tidak menghilangkan dependensi sumber akademik, ketentuan pesan/pengingat, konfigurasi email eksternal dan infrastruktur push yang dijelaskan di bawah.

## Member 1 — dipakai sekarang

- `User`, `Role`, Sanctum; kode peran `admin`, `guru`, `murid`, `wali_murid`.
- `Student.user_id`, `Guardian` pada tabel `parents`, `parents.user_id`, `parent_student`.
- `ClassStudent` pada tabel `class_student`: `student_id`, `classroom_id`, `academic_year_id`, `semester_id`, `status`.
- `Schedule`: `subject_id`, `teacher_id`, `room_id`, `classroom_id`, `academic_year_id`, `semester_id`, `day`, `start_time`, `end_time`, `status`.

Member 1 tetap pemilik pengaitan akun/profil/perwalian. Endpoint master existing menerima `user_id`, tetapi formulir admin belum menampilkannya. Tahap 2 tidak mengubah formulir tersebut atau membuat profil berdasarkan email secara otomatis. Akun tanpa kaitan profil mendapat hasil kosong dan tidak mendapat akses ke murid lain.

## Member 2/3 — kontrak yang perlu disepakati

Tabel dan API berikut belum ditemukan pada checkout saat implementasi. Kontrak di bawah adalah kebutuhan data, bukan klaim endpoint sudah ada. Integrasikan melalui layanan/query milik anggota terkait; jangan membuat tabel pengganti.

| Sumber | Identitas dan data minimum | Aturan |
| --- | --- | --- |
| Member 2: course/keanggotaan | ID course, kelas, periode, judul, murid yang berhak | Mengikuti mapping kelas existing; jangan menebak dari kode jurusan |
| Member 2: tugas | ID tugas/course, judul, tenggat, status publikasi | Hanya tugas yang sudah boleh dilihat murid |
| Member 3: pengumpulan tugas | ID murid, tugas, waktu pengumpulan, status yang tersedia | Wali baca-saja; tidak ada endpoint submit atas nama anak |
| Member 3: nilai | ID murid/course/mapel, periode, nilai yang sudah dirilis | Wali tidak menghitung/mengubah nilai; draf guru tidak dipublikasikan |
| Member 3: absensi | ID murid/jadwal, tanggal, status kehadiran | Wali hanya membaca; tidak membuat catatan kehadiran |
| Member 2/3: progres | ID murid/course dan ringkasan progres yang telah disediakan | Tidak menambah algoritma skor atau prediksi |
| Member 3: ujian | Identitas ujian/kuis, publikasi, tanggal/tenggat, murid penerima | Konfirmasi apakah ujian memakai `quizzes` atau entitas lain |

Event untuk reminder harus menyediakan identitas sumber stabil, penerima berhak, tenggat dengan zona waktu jelas, serta perubahan pembatalan/publikasi. Mekanisme deduplikasi pengiriman ditentukan pada Tahap 5. Tidak membuat tugas/ujian di Member 4.

Tidak ada route nilai/absensi/tugas/progres yang mengembalikan array palsu pada tahap ini. Setelah kontrak tersedia, endpoint akademik portal ditambahkan dengan pemeriksaan perwalian yang sama.

## Keputusan yang masih diperlukan

1. Tahap 3 memakai pembayaran penuh per tagihan sebagai implementasi paling sederhana karena PDF tidak mendefinisikan cicilan/kelebihan bayar. Satu pending per tagihan; penolakan memungkinkan pengajuan baru. Keputusan final tidak diganti. Kebijakan cicilan/kelebihan bayar memerlukan spesifikasi lanjutan sebelum dikembangkan.
2. Peran penerima pesan dan hubungan yang wajib: tidak ada tabel/endpoint pesan sebelum disepakati.
3. Reminder tugas/ujian/pembayaran: jadwal, penerima, frekuensi, zona waktu dan pengiriman ulang.
4. Email: konfigurasi SMTP lingkungan dan worker; `MAIL_MAILER=log` bukan pengiriman email terverifikasi.
5. Push: platform browser/PWA, service worker, subscription dan delivery; belum ada implementasi atau klaim push bekerja.
6. Pengumuman course tetap milik Member 2. Tabel baru ini untuk pengumuman sistem berbasis peran menurut tabel PDF halaman 89.

Tahap 3 sudah mengunci invoice yang sama untuk perubahan tagihan, pengajuan, dan verifikasi; menggunakan integer sen/DECIMAL; serta melindungi bukti melalui endpoint terautentikasi. UI `/finance` dan pilihan layanan login memakai autentikasi existing. Tidak menambah field pada schema milik Member 1. Modul keuangan tidak bergantung pada nilai, tugas, atau absensi Member 2/3.

Pada pemeriksaan database sekolah setelah Tahap 3, `students` dan `parents` masih kosong. Admin perlu memasukkan data asli serta menautkan `students.user_id`, `parents.user_id`, dan `parent_student` melalui modul/API Member 1. UI keuangan tidak membuat profil otomatis dan tidak mengubah formulir pengelolaan pengguna anggota lain.

## Tahap 4 — portal wali

Portal `/parent` sudah membaca anak, penempatan kelas dan jadwal dari Member 1, serta tagihan/riwayat dari Stage 3. Pemilihan anak disimpan pada URL `student_id` dan dipertahankan saat berpindah menu portal. Login tetap `/auth/login` dengan konteks `member4`; tidak ada akun, role, atau relasi baru.

Ringkasan finance dipisahkan ke `FinanceSummary` agar dashboard wali dan laporan Stage 3 memakai perhitungan identik. `ParentScheduleReader` memakai query penempatan yang sama untuk jumlah dan daftar jadwal. Tidak mengubah model/schema milik anggota lain.

`ParentAcademicData` secara eksplisit melaporkan empat sumber akademik belum tersedia pada checkout ini. Setelah Anggota 2/3 menyediakan reader/API yang memeriksa publikasi dan keanggotaan siswa, integrasikan pembacaan di layanan ini dengan ID anak yang telah diotorisasi. Jangan menyimpulkan source siap hanya dari keberadaan tabel; kontrak publikasi dan periode harus dikonfirmasi. Detail kontrak dan tes yang tertunda: [STAGE-4.md](STAGE-4.md).

## Tahap 5 — komunikasi dan notifikasi

Pengumuman sistem menyinkronkan notifikasi dalam aplikasi. Reminder tagihan dipicu admin pada detail tagihan; sumber/penerima selalu ditentukan dari invoice dan relasi Member 1. Login komunikasi menerima guru melalui konteks opsional pada endpoint existing; tidak membuka ACL finance/AIS untuk guru.

`NotificationAccess` memeriksa kepemilikan dan akses sumber saat membaca/mark-read maupun sebelum pengiriman email. Tidak memakai relasi polymorphic `$user->notifications()` pada schema PDF. `PortalNotification` tetap satu-satunya tabel notifikasi aplikasi; Laravel Mail/Mailable/queue dipakai untuk email.

Email perlu `MEMBER4_EMAIL_ENABLED=true`, transport SMTP/sendmail yang benar, `MAIL_*` dan worker. Log/array tidak dianggap terkirim. Alur worker ke SMTP lokal sudah diuji; mailbox produksi belum diverifikasi. Push belum memiliki service worker, subscription/device, VAPID/kanal mobile atau layanan pengiriman.

Kontrak reminder Anggota 2/3 minimal: ID sumber stabil, jenis tugas/ujian, judul, status publikasi/pembatalan, tenggat/waktu dan zona waktu, relasi penerima siswa yang sah, status pengumpulan bila kebijakan sekolah mengecualikan yang selesai. Jadwal dan frekuensi pengingat harus disepakati terlebih dahulu. Belum ada adapter/generator yang membuat sumber akademik atau menebak tabel pengganti.

Pesan masih menunggu aturan pengirim/penerima, hubungan yang diizinkan, serta aksi percakapan. Tidak dibuat tabel atau endpoint pesan sebelum aturan tersebut disepakati. Detail hasil, file, pengujian, dan batas: [STAGE-5.md](STAGE-5.md).

## Tahap 6 — integrasi dashboard dan UI

Dashboard, laporan, daftar dan detail tetap memakai API existing. Kartu finance kini menuju tagihan/riwayat terverifikasi/pending/tunggakan sesuai peran. Filter riwayat dibaca dari URL. Tautan detail dari portal menyertakan konteks anak dan memeriksa kecocokannya dengan record yang dikembalikan API sebelum menawarkan tautan kembali.

GET yang masih berjalan untuk path dan token sama dibagi melalui helper existing; hasil selesai tidak disimpan sebagai cache lintas halaman atau lintas akun. Sukses mutasi membatalkan reuse pembacaan yang dimulai sebelumnya. Dashboard dan notifikasi mengambil data ulang saat kembali mendapat fokus; form unggah tidak di-reset karena fokus pemilih berkas. Respons 401 dari token lama tidak menghapus token pengganti, sementara 401 sesi aktif tetap mengeluarkan pengguna.

Backend, perhitungan finance, schema dan aturan email/push tidak diubah. Dependensi akademik, aturan pesan/timing reminder dan infrastruktur push tetap seperti Tahap 4/5. Hasil audit dan verifikasi: [STAGE-6.md](STAGE-6.md).
