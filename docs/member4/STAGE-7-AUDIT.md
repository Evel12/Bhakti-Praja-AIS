# Tahap 7 — snapshot audit sebelum perbaikan

Repo/PDF diperiksa pada awal Tahap 7. Sumber: PDF gabungan 28, 39–40, 51–53, 59–61, 88–89, 104 dan 109. Snapshot ini tidak menggantikan hasil final di `STAGE-7.md`.

Baseline yang benar-benar dijalankan: `php artisan test --compact`, 79 tes existing lulus dan satu tes regresi baru gagal (903 assertion). Pengujian browser dari tahap sebelumnya belum dihitung sebagai pengujian ulang Tahap 7.

| Kebutuhan PDF | Implementasi/lokasi | Metode verifikasi awal | Status awal | Isu |
| --- | --- | --- | --- | --- |
| Kelola tagihan | InvoiceController, InvoicePolicy, invoices | Member4FoundationTest/FinanceTest existing | PASS | Tidak ditemukan kegagalan pada baseline |
| Upload bukti/pending | PaymentController, FinanceService, payments | FinanceTest existing | PASS | MIME/ekstensi/ukuran/ownership dan rollback tercakup |
| Verifikasi/riwayat/saldo/laporan | FinanceService, FinanceSummary | FinanceTest existing | PASS | Pengulangan serial tercakup |
| Operasi pembayaran benar-benar bersamaan | Kunci invoice/payment dalam FinanceService | Belum menjalankan proses MySQL paralel | NOT TESTED | Perlu bukti runtime tambahan |
| Perwalian, data anak, jadwal baca-saja | ParentPortalController, StudentAccess, ParentScheduleReader | ParentPortalTest existing | PASS | Tidak membuka mutasi akademik |
| Nilai, absensi, tugas, progres nyata | ParentAcademicData; tidak ada source Member 2/3 | Inventaris model/migrasi/API | BLOCKED | Kontrak/source anggota lain belum tersedia |
| Pengumuman audience dan notifikasi | AnnouncementController, CommunicationService, NotificationAccess | CommunicationTest existing | PASS | Role dan akses sumber tercakup |
| Validasi isi pengumuman | AnnouncementController; content TEXT | Tes baru 17.000 emoji: API menerima 201 | FAIL | Validasi karakter belum membatasi kapasitas byte MySQL |
| Pesan | Tidak ada implementasi/kontrak percakapan approved | PDF hanya ruang lingkup umum, inventaris repository | BLOCKED | Penerima/aksi belum ditentukan |
| Reminder tugas/ujian | Tidak ada source assignments/examinations | Inventaris model/migrasi/API | BLOCKED | Source serta timing belum tersedia |
| Reminder pembayaran manual | PaymentReminderController, CommunicationService | CommunicationTest existing | PASS | Tidak ada jadwal periodik yang diasumsikan |
| Mail job/error/retry | DeliverNotificationEmail, PortalNotificationMail | CommunicationTest fake transport | PASS | Ini bukan bukti mailbox produksi |
| SMTP lokal saat Tahap 7 | Laravel mail/queue | Belum diulang pada tahap ini | NOT TESTED | Bukti Tahap 5 tersedia tetapi tidak dihitung ulang |
| Email mailbox produksi | MAIL_MAILER=log; flag default false | Konfigurasi/source existing | BLOCKED | SMTP produksi/worker dan receipt eksternal belum tersedia |
| Push | Tidak ada service worker/subscription/device delivery | Inventaris repository | BLOCKED | Infrastruktur belum tersedia |
| FK/unique dan migrasi MySQL | Migrasi Member 4 dan relasi shared | Inspeksi migration/model; runtime final belum dijalankan | NOT TESTED | Jangan menulis atau reset DB sekolah |
| UI finance/portal/komunikasi | frontend/src/{finance,parent,communication} | Inspeksi, belum menjalankan browser Tahap 7 | NOT TESTED | Perlu jalankan alur A–D yang sumbernya tersedia |
| Logout saat server gagal | Layout.handleLogout, api.logout | Inspeksi async try/finally tanpa penanganan error | NOT TESTED | Dugaan unhandled rejection, harus direproduksi |
| Error API internal dengan debug aktif | Renderer Laravel default untuk Member 4 | Tes regresi menyuntikkan exception internal; pesan SQL/path muncul di respons | FAIL | Frontend masking tidak melindungi pemanggil API langsung; perlu renderer yang dibatasi pada prefix Member 4 |
| RBAC API empat peran | Sanctum, AdminOnly, Member4Role, policies/scopes | Seluruh baseline tes existing | PASS | Tidak memakai frontend sebagai sumber izin |
| Lintas-browser dan NFR operasional | Deployment/lingkungan browser | Belum diuji di lingkungan target | NOT TESTED | HTTPS, uptime, beban 50 user, Safari/Firefox tidak boleh diklaim PASS |

Tidak ada schema akademik yang diubah. Perubahan workspace tahap sebelumnya dipertahankan. Laporan final harus mencatat bukti yang baru dijalankan, cacat/perbaikan, serta status dependensi terpisah dari PASS fungsi lokal.
