# Pengujian BrowserStack Local

Cakupan: aplikasi LMS dengan backend, storage, dan akun sintetis terpisah. Fitur assessment tidak diubah.

## BrowserStack

Build: LMS Local 2026-11-14T17:11:03.542Z. Koneksi: BrowserStack Local, pengujian berurutan.

| Browser | Hasil | Pemeriksaan selesai | Session |
| --- | --- | ---: | --- |
| Chrome / Windows 11 | failed | 13 | [buka session](https://automate.browserstack.com/builds/cbc2cf340ceface871ecc7d26f6ae5436e01e441/sessions/260234a64693a6a09806882e35ab2767d520aa4f) |
| Edge / Windows 11 | failed | 13 | [buka session](https://automate.browserstack.com/builds/cbc2cf340ceface871ecc7d26f6ae5436e01e441/sessions/a3ccd4d671acd3a0936f2315b332ffb5f09799c2) |
| Firefox / Windows 11 | failed | 13 | [buka session](https://automate.browserstack.com/builds/cbc2cf340ceface871ecc7d26f6ae5436e01e441/sessions/17320e53174134606e35f59fb908e1892607bb83) |
| WebKit / macOS Sonoma | failed | 13 | [buka session](https://automate.browserstack.com/builds/cbc2cf340ceface871ecc7d26f6ae5436e01e441/sessions/d487aac5749eed162b76a3d3799bd34248c4e94a) |

Status keseluruhan tetap **failed** jika ada temuan, meskipun alur lain berhasil diperiksa. Setelah kegagalan tanggal default dicatat, tes mengisi tanggal pertemuan yang valid agar pemeriksaan berikutnya dapat dilanjutkan. Ini bukan perbaikan aplikasi.

## Temuan absensi

- Tanggal lokal browser dapat sudah memasuki hari berikutnya, sedangkan backend masih memakai UTC. Tanggal default kemudian ditolak dengan HTTP 422.
- Frontend menginisialisasi tanggal melalui `toLocaleDateString('en-CA')`; format presentasi locale tidak boleh dianggap selalu sama dengan nilai ISO yang dibutuhkan input tanggal.
- Lokasi yang relevan: `frontend/src/lms/LmsPage.jsx:42`, `backend/app/Http/Controllers/Lms/LmsController.php:202`, dan timezone UTC di `backend/config/app.php`.
- Kode aplikasi tidak diubah. Hasil ini mencatat bug untuk ditindaklanjuti.

## Riwayat pengujian awal

Build awal: LMS Local 2026-11-14T17:04:10.342Z. Artefak dan hasil awal dipertahankan sebelum pemeriksaan lanjutan.

| Browser | Hasil awal | Penyebab berhenti | Session |
| --- | --- | --- | --- |
| Chrome / Windows 11 | failed | Simpan absensi: HTTP 422 | [buka session](https://automate.browserstack.com/builds/45b2fa6740ca4a33de96f0b37a1949c89fb29907/sessions/020456e10c471a436618afd2f55f502981fe760d) |
| Edge / Windows 11 | failed | Simpan absensi: HTTP 422 | [buka session](https://automate.browserstack.com/builds/45b2fa6740ca4a33de96f0b37a1949c89fb29907/sessions/9ae25ffbc28e54918c57eb74e2abbce5d8609406) |
| Firefox / Windows 11 | failed | Simpan absensi: HTTP 422 | [buka session](https://automate.browserstack.com/builds/45b2fa6740ca4a33de96f0b37a1949c89fb29907/sessions/36a66b4fb10b3e37f0fa1da77a6c498036408c6a) |
| WebKit / macOS Sonoma | failed | page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response" | [buka session](https://automate.browserstack.com/builds/45b2fa6740ca4a33de96f0b37a1949c89fb29907/sessions/11f4bfde095f172b2d8b90f7c558ecb286b73c22) |

## Validasi lokal skrip yang sama

| Browser lokal | Versi | Hasil | Pemeriksaan selesai |
| --- | --- | --- | ---: |
| Local Chrome | 157.0.8103.52 | passed | 13 |
| Local Edge | 157.0.4341.46 | passed | 13 |

## Rincian browserstack-local

### Chrome / Windows 11

Versi browser: 157.0.8103.39.

Status terverifikasi melalui API BrowserStack: **failed**.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance with a valid meeting date
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- **Temuan attendance-date-timezone:** Default local attendance date is rejected while the UTC backend is still on the previous day. Tanggal browser: 2026-11-15; tanggal UTC server: 2026-11-14; HTTP 422.
- [Screenshot browserstack-1-teacher-desktop.png](E:/final/.tools/browserstack/results/browserstack-1-teacher-desktop.png)
- [Screenshot browserstack-1-student-mobile.png](E:/final/.tools/browserstack/results/browserstack-1-student-mobile.png)
- [Screenshot browserstack-1-student-progress.png](E:/final/.tools/browserstack/results/browserstack-1-student-progress.png)
- [Screenshot browserstack-1-parent-mobile.png](E:/final/.tools/browserstack/results/browserstack-1-parent-mobile.png)

### Edge / Windows 11

Versi browser: 157.0.4341.42.

Status terverifikasi melalui API BrowserStack: **failed**.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance with a valid meeting date
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- **Temuan attendance-date-timezone:** Default local attendance date is rejected while the UTC backend is still on the previous day. Tanggal browser: 2026-11-15; tanggal UTC server: 2026-11-14; HTTP 422.
- [Screenshot browserstack-2-teacher-desktop.png](E:/final/.tools/browserstack/results/browserstack-2-teacher-desktop.png)
- [Screenshot browserstack-2-student-mobile.png](E:/final/.tools/browserstack/results/browserstack-2-student-mobile.png)
- [Screenshot browserstack-2-student-progress.png](E:/final/.tools/browserstack/results/browserstack-2-student-progress.png)
- [Screenshot browserstack-2-parent-mobile.png](E:/final/.tools/browserstack/results/browserstack-2-parent-mobile.png)

### Firefox / Windows 11

Versi browser: 157.0.

Status terverifikasi melalui API BrowserStack: **failed**.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance with a valid meeting date
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- **Temuan attendance-date-timezone:** Default local attendance date is rejected while the UTC backend is still on the previous day. Tanggal browser: 2026-11-15; tanggal UTC server: 2026-11-14; HTTP 422.
- [Screenshot browserstack-3-teacher-desktop.png](E:/final/.tools/browserstack/results/browserstack-3-teacher-desktop.png)
- [Screenshot browserstack-3-student-mobile.png](E:/final/.tools/browserstack/results/browserstack-3-student-mobile.png)
- [Screenshot browserstack-3-student-progress.png](E:/final/.tools/browserstack/results/browserstack-3-student-progress.png)
- [Screenshot browserstack-3-parent-mobile.png](E:/final/.tools/browserstack/results/browserstack-3-parent-mobile.png)

### WebKit / macOS Sonoma

Versi browser: 18.2.

Status terverifikasi melalui API BrowserStack: **failed**.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance with a valid meeting date
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- **Temuan attendance-date-input:** The default attendance date is empty or invalid; native form validation blocks submission. Tanggal browser: (empty); tanggal UTC server: 2026-11-14; HTTP client-validation.
- [Screenshot browserstack-4-teacher-desktop.png](E:/final/.tools/browserstack/results/browserstack-4-teacher-desktop.png)
- [Screenshot browserstack-4-student-mobile.png](E:/final/.tools/browserstack/results/browserstack-4-student-mobile.png)
- [Screenshot browserstack-4-student-progress.png](E:/final/.tools/browserstack/results/browserstack-4-student-progress.png)
- [Screenshot browserstack-4-parent-mobile.png](E:/final/.tools/browserstack/results/browserstack-4-parent-mobile.png)


## Rincian local-validation

### Local Chrome

Versi browser: 157.0.8103.52.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- [Screenshot local-1-teacher-desktop.png](E:/final/.tools/browserstack/results/local-1-teacher-desktop.png)
- [Screenshot local-1-student-mobile.png](E:/final/.tools/browserstack/results/local-1-student-mobile.png)
- [Screenshot local-1-student-progress.png](E:/final/.tools/browserstack/results/local-1-student-progress.png)
- [Screenshot local-1-parent-mobile.png](E:/final/.tools/browserstack/results/local-1-parent-mobile.png)

### Local Edge

Versi browser: 157.0.4341.46.

- Invalid login is rejected
- Teacher login and course creation
- Public and private PDF uploads
- Qwen default and model selection
- Assignment creation and publication
- Teacher announcement
- Student joins course; private PDF is blocked
- Student PDF download
- Student file submission and mobile layout
- Teacher grading and attendance
- Student progress and grade display
- Linked parent sees grades with read-only UI
- No browser exceptions or HTTP 5xx
- [Screenshot local-2-teacher-desktop.png](E:/final/.tools/browserstack/results/local-2-teacher-desktop.png)
- [Screenshot local-2-student-mobile.png](E:/final/.tools/browserstack/results/local-2-student-mobile.png)
- [Screenshot local-2-student-progress.png](E:/final/.tools/browserstack/results/local-2-student-progress.png)
- [Screenshot local-2-parent-mobile.png](E:/final/.tools/browserstack/results/local-2-parent-mobile.png)

## Batas pengujian

- Validasi Chrome/Edge lokal tidak membuktikan koneksi atau keberhasilan BrowserStack.
- Tampilan mobile memakai viewport 390 × 844 pada browser desktop; bukan perangkat fisik Android/iOS.
- WebKit adalah engine Playwright, bukan klaim pengujian Safari bermerek atau iPhone.
- Pilihan model Qwen diperiksa, tetapi inferensi/generasi AI tidak dijalankan.
- Data dan file yang dikirim ke sesi browser adalah fixture sintetis. Access Key tidak dimasukkan ke repository atau laporan.
- Teks password diketik dengan masking command dan network logging BrowserStack dinonaktifkan.

Setup: [tests/browserstack/README.md](../../tests/browserstack/README.md).
