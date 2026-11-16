# Hasil uji pengguna bersamaan LMS

Lingkungan: Apache 2.4 / PHP 8.2.12, 64 thread, database SQLite WAL terpisah.
Beban: sekitar 10% guru dan 90% murid, masing-masing menggunakan akun/token berbeda.
Setiap tingkat beban naik selama 10 detik, bertahan 30 detik, lalu turun 5 detik.

| Pengguna bersamaan | Request | Rata-rata (ms) | p95 (ms) | p99 (ms) | Gagal HTTP | HTTP 429 | Hasil |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 10 | 370 | 194.72 | 230.66 | 269.40 | 0.00% | 0.00% | Lulus |
| 25 | 921 | 209.74 | 263.58 | 307.32 | 0.00% | 0.00% | Lulus |
| 50 | 1811 | 247.63 | 331.41 | 429.68 | 0.00% | 0.00% | Lulus |

p95 berarti 95% request selesai dalam waktu tersebut atau lebih cepat.
Kriteria sementara: kegagalan HTTP/aplikasi <1%, HTTP 429 <1%, p95 <2 detik dan p99 <5 detik.

## Rincian dan dashboard

### 10 pengguna

- Konkurensi maksimum teramati: 10 VU.
- Laju request rata-rata: 7.51/detik.
- Status HTTP: rincian tersedia di Grafana Cloud; tidak diekspor sebagai raw JSON lokal.
- Dashboard HTML: [buka laporan](E:/final/.tools/k6/results/cloud-lms-10.html).


Grafana Cloud: [buka run 9016374](https://tancoconut1625.grafana.net/a/k6-app/runs/9016374); status: **completed**, hasil: **passed**.

### 25 pengguna

- Konkurensi maksimum teramati: 25 VU.
- Laju request rata-rata: 17.82/detik.
- Status HTTP: rincian tersedia di Grafana Cloud; tidak diekspor sebagai raw JSON lokal.
- Dashboard HTML: [buka laporan](E:/final/.tools/k6/results/cloud-lms-25.html).


Grafana Cloud: [buka run 9016376](https://tancoconut1625.grafana.net/a/k6-app/runs/9016376); status: **completed**, hasil: **passed**.

### 50 pengguna

- Konkurensi maksimum teramati: 50 VU.
- Laju request rata-rata: 34.79/detik.
- Status HTTP: rincian tersedia di Grafana Cloud; tidak diekspor sebagai raw JSON lokal.
- Dashboard HTML: [buka laporan](E:/final/.tools/k6/results/cloud-lms-50.html).


Grafana Cloud: [buka run 9016383](https://tancoconut1625.grafana.net/a/k6-app/runs/9016383); status: **completed**, hasil: **passed**.

## Batas interpretasi

- Ini baseline lokal berdurasi singkat pada mesin yang juga menjalankan k6; bukan jaminan kapasitas produksi atau uji ketahanan jangka panjang.
- Jadwal akademik kosong dan PDF sintetis kecil; hasil tidak mengukur bandwidth dokumen besar.
- Login massal, render browser, generasi AI dan fitur assessment tidak termasuk beban ini.
- Hasil awal dengan storage Apache salah dikonfigurasi disimpan di `.tools/k6/results/storage-misconfigured/` dan tidak digunakan dalam tabel ini. Jalur storage pada server uji diperbaiki sebelum pengukuran ulang; kode aplikasi tidak diubah.
- Database, akun, token dan file fixture terpisah dari data aplikasi.

## Grafana Cloud

Hasil ini berasal dari eksekusi lokal dengan pengiriman ke Grafana Cloud; lihat URL run yang dicetak k6.

Panduan menjalankan ulang dan autentikasi: [tests/performance/README.md](../../tests/performance/README.md).
