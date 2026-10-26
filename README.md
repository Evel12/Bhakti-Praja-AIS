# EXAMNIA — Assessment UI

Frontend assessment berbahasa Indonesia menggunakan **Vue 3, Vite, Tailwind CSS 4, Vue Router, dan Pinia**. Desain Star White `#EFEFE8`, panel membulat, dan logo Tut Wuri Handayani.

## Menjalankan

Gunakan Node.js **24.15 atau lebih baru** (diuji pada 24.22.1) dan npm. Versi dependensi terkunci di `package-lock.json`.

```powershell
cd "D:\Downloads\Project Capstone Ending\assessment-web"
npm ci
npm run dev
```

Buka **http://127.0.0.1:4173/#/dashboard**. Port dikunci agar preview tidak diam-diam berpindah. Gunakan alamat 127.0.0.1 yang sama agar data browser tetap tersedia.

```powershell
npm test          # 11 tes domain/persistensi + 6 tes komponen/lifecycle
npm run build    # produksi di dist/
npm run preview  # sajikan hasil build di port 4173; hentikan dev dahulu
npm run check    # tes dan build
```

## Navigasi dan fitur

- Sidebar desktop 248 px / rail 80 px, tooltip keyboard, submenu Assessment, serta preferensi tersimpan.
- Drawer pada lebar di bawah 1024 px: overlay, fokus keyboard terjaga, Escape dan penutupan setelah pindah halaman.
- Dashboard, pencarian/filter assessment, duplikasi draft, dan bank soal.
- Editor empat langkah: identitas, konten, jadwal, pratinjau. Soal manual/bank, kunci, poin, pembahasan, dan pemeriksaan soal AI.
- Publikasi memvalidasi konten dan tanggal; konten terbit dikunci dan revisi dibuat melalui duplikasi.
- Petunjuk peserta, timer berdasarkan expiresAt, jawaban tersimpan, tanda ragu, resume, pengiriman idempotent, dan review.
- Unggah tugas PDF/DOCX/JPG/PNG maksimum 2 MB, penilaian manual, umpan balik, rilis hasil, dan CSV.
- Jika data browser rusak, layar pemulihan menyediakan unduhan data asli dan impor JSON cadangan. Data rusak tidak ditimpa dengan seed.

## Struktur

```text
src/
  components/    Brand, navigasi, dialog, editor dan preview soal
  layouts/       AppShell dan ExamLayout
  views/         Halaman pengajar dan peserta berupa Vue SFC
  router/        Vue Router dengan hash URL lama
  stores/        State UI, assessment, attempt (Pinia)
  domain/        Validasi, waktu, penilaian, dan CSV
  repositories/  Batas penyimpanan lokal dan integrasi API mendatang
  composables/   Lifecycle timer
  fixtures/      Seed contoh, hanya untuk penggunaan pertama
  styles/        Token, Tailwind, dan aturan komponen/responsif
public/brand/    Logo lokal
index.html       Entry Vite dan metadata EXAMNIA
vite.config.js   Vue, Tailwind, dan Vitest
 tests/          Tes domain/persistensi dan komponen
 docs/           Sumber logo dan catatan implementasi
 dist/           Hasil build (diabaikan Git)
```

## Data dan batas backend

Key legacy **`kulon-assessment-v1`** dan schema v1 sengaja dipertahankan agar assessment, jawaban, deadline, nilai, umpan balik, serta attachment dari versi lama dapat dibaca. Preferensi sidebar memakai key terpisah `examnia.ui.sidebarCollapsed`. Commit baseline: `62da71cca58fee69554fbdc78f50eddd7a8d44fc`.

Repository lokal mengakui keberhasilan tulis sebelum state dan toast sukses diperbarui. Kegagalan localStorage tidak mengubah state tersimpan. Saat API Laravel ditambahkan, mutasi wajib menunggu acknowledgement server; fungsi penyimpanan lokal sinkron saat ini perlu diganti dengan adapter API asinkron.

Aplikasi saat ini adalah **UI dengan data lokal browser**. Pengajar/Peserta adalah pilihan untuk mencoba antarmuka. Backend Laravel, autentikasi/otorisasi, MySQL, penyimpanan berkas server, sinkronisasi lintas perangkat, dan AI PDF belum dihubungkan. Menu AI menggunakan soal contoh yang wajib ditinjau; PDF tidak dianalisis atau dikirim ke layanan eksternal. Pengumpulan seed hanya berisi metadata berkas; unggahan peserta menyimpan isi berkas di browser.

Pada backend mendatang, server harus memvalidasi hak akses, jadwal, kunci, penilaian, dan pengiriman. Jangan gunakan UI lokal ini sebagai sistem ujian resmi sebelum integrasi tersebut selesai.

## Hosting dan pemulihan rilis

`.openai/hosting.json` mempertahankan Site yang sama dan `static.directory=dist`. Judul tampilan menjadi EXAMNIA; origin/slug tetap agar data browser lama tetap terbaca.

Untuk rollback, gunakan versi Site sebelumnya dan schema v1 yang kompatibel. Jangan menghapus localStorage sebagai langkah rollback. Sumber logo dan cara pengambilannya tersedia di [docs/branding.md](docs/branding.md).
