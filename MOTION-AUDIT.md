# EXAMNIA — Audit motion akhir

Tanggal: 29 Oktober 2026. Lingkup: code review, guard sumber dan automated regression. Tidak ada browser trace atau pengujian perangkat fisik.

| Area | Temuan / bukti | Status |
| --- | --- | --- |
| Layout thrashing | RAF engine hanya mengevaluasi spring dan menulis transform/opacity/filter. Uji burst setelah prepare menghasilkan nol style/geometry reads. FLIP membaca snapshot sebelum writes; snapshot exit diukur/ditaruh sekali. | Lulus tes deterministik; bukan browser performance trace. |
| Budget | 8 desktop, 3 mobile/coarse, 2 lite; reserve native route berbagi budget. Burst 20 tidak melebihi dua pada fixture lite. | Lulus tes. |
| Idle/cleanup | Sesudah settle active=0, RAF=0 dan will-change kosong. Scope menghapus listener/observer; rapid routes/overlay/filter dan removed nodes dibatalkan. | Lulus suite lifecycle. |
| Perangkat terbatas | Hint positif <=4 core/GB atau Save-Data => fade-only, filter off, budget dua. Tidak tersedia => tidak mengasumsikan nol. | Lulus tes; bukan benchmark hardware. |
| Reduced/off | Engine opacity-only untuk reduced/lite, off melewati efek; transform statis dipertahankan. Perubahan policy membatalkan job aktif. | Lulus tes. |
| Fokus/semantik | Outline 3px + offset3px tetap pada kontrol. Native dialog dan fokus balik, sidebar trap/Escape/inert, tabel tbody native, tooltip Escape, toast polite/pause dan label status diuji suite. | Code review + unit/component; screen reader dan contrast sweep belum diuji. |
| Konsistensi | Tokens SSOT, empat preset, guard source, konfigurasi global DEV; hover tombol statis. | Lulus guard dan tes regresi. |
| Gooey | Dua halaman + demo Lab. Lapisan inert/aria-hidden tanpa teks; filter mobile/reduced/lite off; tanpa loop idle. | Code review + policy tests; tampilan visual belum diperiksa. |
| Produksi | Build berhasil; tidak ada examniaMotion/stiffnessFactor/dampingFactor pada aset JS dist. | Lulus inspeksi bundle. |
| 60 fps / pengalaman visual | Browser tool tidak tersedia. Tidak dilakukan pemuatan halaman, rekaman Performance, audit screen reader atau pengukuran perangkat low-end nyata. | Belum terverifikasi. |

Validasi: npm run check (guard + 106 tests + production build), git diff --check dan pemeriksaan bundle DEV API. Tidak ada dependency runtime baru.

Review lanjutan yang memerlukan browser/perangkat: navigasi cepat/input saat spring, keyboard-only dan screen reader, kontras teks/fokus di setiap surface, viewport 360–1440 px, trace halaman/FLIP/drawer/gooey pada perangkat terbatas. Jangan menafsirkan lulus fixture sebagai bukti 60 fps.
