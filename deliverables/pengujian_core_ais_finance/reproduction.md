# Reproduksi dari repository proyek

Jalankan dari E:/final dengan koneksi BrowserStack dan Grafana yang sudah disimpan lokal. Jangan membagikan file kredensial.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/start-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/performance/seed-core-finance.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/performance/run-core-finance.ps1
python tests/performance/report-core-finance.py
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -CoreFinance -Parallel 3
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/verify-core-finance.ps1
python tests/browserstack/resources.py --module core-finance
node tests/performance/capture-core-finance.cjs
python tests/performance/package-core-finance.py
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/stop-local.ps1
```
