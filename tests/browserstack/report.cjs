const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const runtime = path.join(root, '.tools/browserstack/results');
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
const date = `${parts.year}-${parts.month}-${parts.day}`;
const output = path.join(root, `docs/testing/browserstack-local-${date}.md`);
const read = name => fs.existsSync(path.join(runtime, name)) ? JSON.parse(fs.readFileSync(path.join(runtime, name), 'utf8').replace(/^\uFEFF/, '')) : null;
const remote = read('browserstack-results.json');
const local = read('local-results.json');
const initial = read(`initial-${date}/browserstack-results.json`);
const rows = ['# Pengujian BrowserStack Local', '',
  'Cakupan: aplikasi LMS dengan backend, storage, dan akun sintetis terpisah. Fitur assessment tidak diubah.', '',
  '## BrowserStack', '',
  remote ? `Build: ${remote.build}. Koneksi: BrowserStack Local, pengujian berurutan.` : 'Belum dijalankan di BrowserStack: autentikasi Automate Username dan Access Key belum tersedia.', '',
  '| Browser | Hasil | Pemeriksaan selesai | Session |', '| --- | --- | ---: | --- |'];
for (const result of remote?.results || []) {
  rows.push(`| ${result.browser} | ${result.status} | ${result.checks.length} | ${result.dashboard_url ? `[buka session](${result.dashboard_url})` : 'Tidak ada session terverifikasi'} |`);
}
if (!remote) rows.push('| Chrome, Edge, Firefox, WebKit (direncanakan) | Belum diuji di BrowserStack | — | Menunggu autentikasi |');
if (remote?.connection_error) rows.push('', `Koneksi belum berhasil: ${remote.connection_error.replace(/\n/g, ' ')}`);
if (remote?.results.some(result => result.findings?.length)) {
  rows.push('', 'Status keseluruhan tetap **failed** jika ada temuan, meskipun alur lain berhasil diperiksa. Setelah kegagalan tanggal default dicatat, tes mengisi tanggal pertemuan yang valid agar pemeriksaan berikutnya dapat dilanjutkan. Ini bukan perbaikan aplikasi.', '',
    '## Temuan absensi', '',
    '- Tanggal lokal browser dapat sudah memasuki hari berikutnya, sedangkan backend masih memakai UTC. Tanggal default kemudian ditolak dengan HTTP 422.',
    '- Frontend menginisialisasi tanggal melalui `toLocaleDateString(\'en-CA\')`; format presentasi locale tidak boleh dianggap selalu sama dengan nilai ISO yang dibutuhkan input tanggal.',
    '- Lokasi yang relevan: `frontend/src/lms/LmsPage.jsx:42`, `backend/app/Http/Controllers/Lms/LmsController.php:202`, dan timezone UTC di `backend/config/app.php`.',
    '- Kode aplikasi tidak diubah. Hasil ini mencatat bug untuk ditindaklanjuti.');
}
if (initial) {
  rows.push('', '## Riwayat pengujian awal', '', `Build awal: ${initial.build}. Artefak dan hasil awal dipertahankan sebelum pemeriksaan lanjutan.`, '', '| Browser | Hasil awal | Penyebab berhenti | Session |', '| --- | --- | --- | --- |');
  for (const result of initial.results) rows.push(`| ${result.browser} | ${result.status} | ${(result.error || '').replace(/\n/g, ' ')} | ${result.dashboard_url ? `[buka session](${result.dashboard_url})` : '—'} |`);
}
rows.push('', '## Validasi lokal skrip yang sama', '', '| Browser lokal | Versi | Hasil | Pemeriksaan selesai |', '| --- | --- | --- | ---: |');
for (const result of local?.results || []) rows.push(`| ${result.browser} | ${result.browser_version || '—'} | ${result.status} | ${result.checks.length} |`);
for (const document of [remote, local].filter(Boolean)) {
  rows.push('', `## Rincian ${document.mode}`, '');
  for (const result of document.results) {
    rows.push(`### ${result.browser}`, '');
    if (result.browser_version) rows.push(`Versi browser: ${result.browser_version}.`, '');
    if (result.browserstack_status) rows.push(`Status terverifikasi melalui API BrowserStack: **${result.browserstack_status}**.`, '');
    for (const check of result.checks) rows.push(`- ${check}`);
    for (const finding of result.findings || []) rows.push(`- **Temuan ${finding.code}:** ${finding.description} Tanggal browser: ${finding.browser_date}; tanggal UTC server: ${finding.server_date_utc}; HTTP ${finding.status}.`);
    if (result.error) rows.push(`- Error: ${result.error.replace(/\n/g, ' ')}`);
    for (const filename of result.screenshots) rows.push(`- [Screenshot ${filename}](${path.join(runtime, filename).replace(/\\/g, '/')})`);
    rows.push('');
  }
}
rows.push('## Batas pengujian', '',
  '- Validasi Chrome/Edge lokal tidak membuktikan koneksi atau keberhasilan BrowserStack.',
  '- Tampilan mobile memakai viewport 390 × 844 pada browser desktop; bukan perangkat fisik Android/iOS.',
  '- WebKit adalah engine Playwright, bukan klaim pengujian Safari bermerek atau iPhone.',
  '- Pilihan model Qwen diperiksa, tetapi inferensi/generasi AI tidak dijalankan.',
  '- Data dan file yang dikirim ke sesi browser adalah fixture sintetis. Access Key tidak dimasukkan ke repository atau laporan.',
  '- Teks password diketik dengan masking command dan network logging BrowserStack dinonaktifkan.', '',
  'Setup: [tests/browserstack/README.md](../../tests/browserstack/README.md).');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, rows.join('\n') + '\n');
console.log(output);
