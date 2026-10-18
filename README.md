# Kulon Assessment — Web UI

Implementasi frontend assessment dengan sidebar, panel membulat, dan palet Star White. Dibuat untuk kebutuhan tugas, kuis, ujian pilihan ganda, bank soal, pengerjaan, serta hasil penilaian dari project capstone.

## Menjalankan

Memerlukan Node.js 18 atau lebih baru. Tidak memerlukan instalasi paket.

```powershell
cd "D:\Downloads\Project Capstone Ending\assessment-web"
node server.mjs
```

Buka `http://127.0.0.1:4173`. Situs juga dapat disajikan oleh server statis mana pun dari folder `dist/`.

```powershell
node --test tests/model.test.mjs
node --check dist/app.js
node --check dist/ui.js
```

## Alur yang sudah tersedia

- Dashboard dengan ringkasan yang dihitung dari data assessment, aktivitas, dan agenda.
- Daftar assessment, filter status, pencarian, serta duplikasi ke draft.
- Builder empat langkah: identitas, konten, pengaturan, dan pratinjau/publikasi.
- Soal pilihan ganda manual, kunci, poin, pembahasan, dan penggunaan ulang bank soal.
- Validasi sebelum terbit; konten terbit dikunci dan revisi dibuat melalui duplikasi.
- Tampilan peserta, petunjuk, timer, simpan jawaban, navigasi soal, tanda ragu, review, dan pengiriman.
- Pengumpulan tugas berupa PDF/DOCX/JPG/PNG maksimal 2 MB, penilaian manual, serta umpan balik.
- Perhitungan nilai pilihan ganda, review jawaban, rilis hasil, dan ekspor CSV.
- Tampilan responsif dan navigasi keyboard, label input, dialog native, serta pesan gagal penyimpanan.

## Batas implementasi

Ini **UI frontend dengan penyimpanan lokal browser**, bukan sistem ujian produksi. Data contoh dibuat saat pemakaian pertama. Semua perubahan dan unggahan disimpan pada perangkat/browser yang sama; tidak ada sinkronisasi antar perangkat. Penggantian tampilan Pengajar/Peserta adalah alat mencoba UI dan bukan autentikasi atau kontrol akses.

Endpoint Laravel, akun/kelas dari sistem utama, MySQL, storage berkas server, validasi waktu dan nilai di server, dan layanan AI belum dihubungkan. Kunci jawaban tersedia dalam state frontend untuk simulasi UI; produksi wajib menyimpannya di server dan membatasi data endpoint peserta. Timer/simpan/publikasi/grading saat ini berjalan di browser. Tidak digunakan untuk menyelenggarakan ujian nyata sebelum backend dan pengamanannya tersedia.

Menu AI menjelaskan bahwa ia merupakan pratinjau alur. Tombol contoh menggunakan soal bank Jaringan Komputer dan tidak mengklaim menghasilkan soal dari PDF. Berkas PDF tidak dikirim ke layanan eksternal. Berkas pada pengumpulan contoh hanya metadata; pengumpulan sendiri melalui tampilan peserta menyimpan isi berkas lokal agar alur unduh dapat dicoba.

## Struktur

```
dist/
  index.html       Shell dan metadata
  styles.css       Token Star White dan layout responsif
  model.js         Aturan assessment, attempt, scoring, dan CSV
  seed.js          Data contoh
  ui.js            View dan komponen UI
  app.js           Navigasi, interaksi, penyimpanan lokal
server.mjs         Server statis pengembangan
tests/             Uji aturan utama
```

Frontend menggunakan HTML/CSS dan JavaScript modules tanpa dependensi untuk memudahkan peninjauan serta menjalankan UI langsung. Ini adalah perubahan dari usulan Vue pada rencana awal; aturan data dipisahkan di `model.js`, sehingga dapat diadaptasi menjadi komponen Vue atau dihubungkan ke API Laravel pada fase integrasi.

## Token desain

- Star White: `#EFEFE8` (pendekatan sRGB untuk Pantone 11-4202 TCX).
- Canvas: `#F4F4EF`; panel: `#FCFCFA`.
- Teks arang: `#262923`; teks sekunder: `#71766B`.
- Aksen mint: `#BDE1CD`; teks status hijau: `#2D7053`.
- Aksen peach: `#FFDBC2` untuk status draft/perlu tindakan.

Nama warna diverifikasi melalui [Pantone](https://www.pantone.com/na/en-us/color-finder/11-4202-tcx); pendekatan layar `#EFEFE8` dirujuk dari [Swatches](https://swatches.page/pantone-colors/11-4202-tcx).
