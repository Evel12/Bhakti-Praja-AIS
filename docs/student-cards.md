# Card Assessment saya

27 Oktober 2026

## Rencana dan hasil

Card peserta pada `/student` menggunakan susunan referensi pertama dengan palet terang referensi kedua: header kelas dan mata pelajaran, baris jenis dan status, judul, deskripsi, metadata berikon, serta tombol selebar isi card.

Header memakai sage pucat `#ECEEE6`, permukaan memakai token `--surface`, dan teks memakai charcoal serta olive yang sudah digunakan EXAMNIA. Sudut 18 px dan border halus membentuk card yang lebih ringkas. Metadata membungkus secara alami pada layar kecil. Deskripsi kosong tidak menghasilkan ruang paragraf kosong.

Perubahan ada di `src/views/student/StudentAssessmentView.vue` dan aturan `.student-card*` dalam `src/styles/design-system.css`. Setiap card diberi nama aksesibel dari judulnya, waktu memakai elemen `time`, dan label Tenggat tetap tersedia bagi pembaca layar. Ikon memakai komponen Icon yang sudah ada.

Status, tautan, data lokal, serta animasi daftar mengikuti implementasi yang sudah ada. Tugas menampilkan informasi unggah dan maksimum 2 MB. Kuis/ujian menampilkan jumlah soal dan durasi. Card terkirim membuka review; card lain membuka petunjuk dengan label melanjutkan sesi bila ada attempt yang berjalan.

## Validasi

- `npm run check`: 11 tes domain/persistensi dan 57 tes komponen/animasi lulus; build produksi berhasil.
- Browser memeriksa data lokal yang sudah ada dan hasil build produksi pada origin preview terpisah.
- Breakpoint 360, 390, 768, 1024, dan 1440 px tidak overflow; lebar tombol sama dengan lebar isi card.
- Variasi kuis, tugas, aktif, ditutup, terkirim, deskripsi kosong, dan label lanjutkan sesi diperiksa.
- Klik Lihat petunjuk menuju petunjuk assessment yang sesuai. Klik Lihat pengumpulan menuju review yang sesuai.
- Tidak ada warning/error console pada pemeriksaan build produksi.
- Bukti visual berada di folder `outputs/` pada workspace induk: `student-cards-390.png`, `student-cards-1440.png`, dan `student-card-preview.png`.
