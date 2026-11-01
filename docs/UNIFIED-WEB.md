# Integrasi assessment pada web utama

## Hasil dan batas

React AIS dan Vue assessment tersedia pada satu origin, satu login existing, dan navigasi utama yang sama. `/assessment` memuat build assessment pada `/assessment-app/`; iframe mengisolasi stylesheet, motion globals, dan routing hash milik assessment. Tidak mengganti framework atau menulis ulang kontribusi Blackumis. Build frontend utama memaketkan kedua aplikasi sehingga tidak memerlukan server assessment kedua.

Ini penyatuan web, sesi dan navigasi, **belum integrasi database assessment**. Assessment masih menggunakan contoh/local storage, yang ditandai jelas pada antarmuka. Data lokal akun yang satu tidak dibaca workspace akun lain. Data standalone lama tidak dihapus atau dimigrasikan diam-diam. Nilai ini tidak boleh dipakai sebagai nilai sekolah, data bersama antar guru/siswa, atau sumber portal wali. Pengguna telah dimintai klarifikasi mengenai cakupan integrasi backend berikutnya; implementasi ini tidak mengklaim sinkronisasi MySQL.

## Perubahan

- Existing auth menerima konteks `assessment` untuk admin/guru/murid, memakai akun dan token Sanctum yang sama. Wali ditolak. Hak admin AIS tidak diperluas untuk guru/murid.
- Route React dan menu Assessment untuk peran yang sesuai; akses route wali menampilkan penolakan.
- Build assessment terpaket selalu memvalidasi `/api/auth/me`, bahkan jika parameter `embedded` dihapus. Token tidak dikirim melalui URL atau postMessage.
- Mode tertanam meniadakan sidebar dan role switcher simulasi; navigasi assessment internal mengikuti peran terverifikasi.
- Local storage workspace memakai namespace ID akun. Data simulator standalone tetap berada pada key lama.
- `scripts/build-assessment.mjs` dipanggil `predev`/`prebuild` frontend; output terbangun diabaikan Git. Root dependencies perlu dipasang sebelum menjalankan frontend.
- Logo mengikuti base path, route halaman utama diberi judul assessment, CSS tidak disuntikkan ke dokumen React.

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Laravel SQLite suite | 83 tes, 942 assertions lulus, termasuk konteks assessment dan RBAC |
| Node domain assessment | 18 tes lulus |
| Vitest assessment | 181 tes pada 20 file lulus, termasuk 6 tes integrasi sesi dan storage |
| Motion guard | Lulus |
| React lint | Lulus |
| Standalone assessment build | Lulus |
| Combined frontend build | Lulus; kedua aplikasi ada pada frontend/dist |
| Chrome build gabungan desktop/390px | Lulus: satu origin, tab guru/siswa, route guard, tidak ada sidebar/role switcher ganda, host mobile tidak overflow, reload, wali ditolak, entry langsung tanpa sesi ditolak, tanpa error JavaScript |

Tes browser menggunakan API mock untuk mengisolasi perilaku UI; autentikasi asli dan peran diuji terpisah lewat Laravel. Ini tidak membuktikan alur assessment MySQL end-to-end. Tidak menjalankan migrasi baru atau menulis data sekolah. Kontributor dan commit asal assessment tetap terjaga; perubahan integrasi merupakan perubahan terpisah.

Deploy seluruh `frontend/dist`, bukan root dist. `/api` harus diteruskan ke Laravel, file `/assessment-app/*` harus disajikan sebagai file statis, dan route React seperti `/assessment` harus mendapat SPA fallback. Gunakan HTTPS untuk lingkungan produksi. Backend assessment, sumber nilai/absensi, publikasi hasil, pengingat dan sinkronisasi portal wali tetap memerlukan implementasi/kontrak tersendiri.
