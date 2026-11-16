# Pengujian BrowserStack Local

Cakupan: aplikasi LMS dengan backend, storage, dan akun sintetis terpisah. Fitur assessment tidak diubah.

## BrowserStack

Belum dijalankan di BrowserStack: autentikasi Automate Username dan Access Key belum tersedia.

| Browser | Hasil | Pemeriksaan selesai | Session |
| --- | --- | ---: | --- |
| Chrome, Edge, Firefox, WebKit (direncanakan) | Belum diuji di BrowserStack | — | Menunggu autentikasi |

## Validasi lokal skrip yang sama

| Browser lokal | Versi | Hasil | Pemeriksaan selesai |
| --- | --- | --- | ---: |
| Local Chrome | 157.0.8103.52 | passed | 13 |
| Local Edge | 157.0.4341.46 | passed | 13 |

## Rincian local-validation

### Local Chrome

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
