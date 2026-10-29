# Redesign dropdown peran

Diimplementasikan melalui komponen `RoleSwitcher.vue` pada topbar EXAMNIA.
Custom dropdown mengikuti gaya panel aplikasi dan menggantikan select HTML bawaan.

## Tampilan

- Tombol tertutup: ikon pengguna, label **Pengajar** atau **Peserta**, lalu chevron bawah.
- Tinggi tombol 44 px, radius 12 px, border sage tipis, latar putih hangat.
- Menu terbuka rata kanan di bawah tombol, lebar 224 px, jarak 8 px, radius 16 px, bayangan lembut.
- Judul kecil **Tampilan peran**, kemudian dua pilihan setinggi minimal 44 px.
- **Pengajar** dengan keterangan “Kelola assessment dan penilaian”.
- **Peserta** dengan keterangan “Kerjakan assessment dan lihat hasil”.
- Pilihan aktif memakai latar sage muda dan ikon centang di kanan.
- Hover menggunakan latar netral lembut; teks tetap berkontras jelas.
- Menu pada layar kecil dibatasi oleh lebar viewport agar tidak terpotong.

## Interaksi

- Klik, Enter, atau Space membuka menu; panah atas/bawah berpindah pilihan.
- Enter memilih peran; Escape menutup dan mengembalikan fokus ke tombol.
- Klik di luar atau Tab menutup menu tanpa mengubah peran.
- Animasi fade ringan hanya pada menu, mengikuti pengaturan reduced motion.
- Pertahankan label aksesibel “Tampilan peran”, status pilihan aktif, dan indikator fokus keyboard.

Perubahan ini mempertahankan dua tujuan navigasi peran yang sudah ada.
