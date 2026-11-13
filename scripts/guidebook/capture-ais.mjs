import { launch, shot, sleep, aisLogin, aisSubmit, clickText } from './lib.mjs';

const b = await launch();
const page = await b.newPage();

// 1. AIS Login Page
await aisLogin(page, 'admin@akademik.test', 'admin123', 'ais');
await shot(page, 'ais-01-login');

// 2. AIS Dashboard Admin
await aisSubmit(page);
await sleep(1500);
await shot(page, 'ais-02-dashboard');

// 3. Data Pengguna
await page.goto('http://127.0.0.1:5173/users', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-03-users');

// Modal Tambah Pengguna
await clickText(page, 'Tambah Pengguna');
await sleep(1000);
// fill modal inputs
await page.evaluate(() => {
  const inputs = document.querySelectorAll('div[role=dialog] input, div[role=dialog] select');
  if (inputs[0]) { inputs[0].value = 'Budi Santoso, S.Pd.'; inputs[0].dispatchEvent(new Event('input', { bubbles: true })); }
  if (inputs[1]) { inputs[1].value = 'budi.guru@smkbp.sch.id'; inputs[1].dispatchEvent(new Event('input', { bubbles: true })); }
  if (inputs[2]) { inputs[2].value = 'guru'; inputs[2].dispatchEvent(new Event('change', { bubbles: true })); }
  if (inputs[3]) { inputs[3].value = 'password123'; inputs[3].dispatchEvent(new Event('input', { bubbles: true })); }
});
await sleep(800);
await shot(page, 'ais-04-user-modal');
await clickText(page, 'Batal');
await sleep(500);

// 4. Program & Konsentrasi Keahlian
await page.goto('http://127.0.0.1:5173/study-programs', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-05-programs');

// 5. Jadwal Pembelajaran
await page.goto('http://127.0.0.1:5173/schedules', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-06-schedules');

// Modal Tambah Jadwal
await clickText(page, 'Tambah Jadwal');
await sleep(1000);
await shot(page, 'ais-07-schedule-modal');
await clickText(page, 'Batal');
await sleep(500);

// 6. Tagihan Pendidikan (Admin)
await page.goto('http://127.0.0.1:5173/finance/invoices', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-08-invoices');

// 7. Verifikasi Pembayaran (Admin)
await page.goto('http://127.0.0.1:5173/finance/verification', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-09-verification');

// 8. Komunikasi Sekolah - Pengumuman (Admin)
await page.goto('http://127.0.0.1:5173/communication/announcements', { waitUntil: 'networkidle0' });
await sleep(1200);
await shot(page, 'ais-10-announcements');

// Modal Buat Pengumuman
await clickText(page, 'Buat pengumuman');
await sleep(1000);
await page.evaluate(() => {
  const t = document.querySelector('input[type=text], input[name=title]');
  if (t) { t.value = 'Pelaksanaan Penilaian Akhir Semester (PAS) Ganjil 2026/2027'; t.dispatchEvent(new Event('input', { bubbles: true })); }
  const ta = document.querySelector('textarea');
  if (ta) { ta.value = 'Diberitahukan kepada seluruh guru, siswa, dan wali murid SMK Bhakti Praja Batang bahwa pelaksanaan PAS Ganjil akan dilaksanakan melalui ruang Assessment Pembelajaran mulai tanggal 23 November 2026.'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
});
await sleep(800);
await shot(page, 'ais-11-announcement-modal');
await clickText(page, 'Batal').catch(() => {});
await sleep(500);

// 9. Portal Wali Murid (Wali: agus@akademik.test / wali12345)
const waliContext = await b.createBrowserContext();
const waliPage = await waliContext.newPage();
await aisLogin(waliPage, 'agus@akademik.test', 'wali12345', 'member4');
await sleep(600);
await aisSubmit(waliPage);
await sleep(1500);
await shot(waliPage, 'ais-12-parent-dashboard');

// Portal Wali - Tagihan Pendidikan
await waliPage.goto('http://127.0.0.1:5173/parent/invoices', { waitUntil: 'networkidle0' });
await sleep(1500);
await shot(waliPage, 'ais-13-parent-invoices');

// Click Detail on invoice
await clickText(waliPage, 'Detail').catch(() => {});
await sleep(1000);
await shot(waliPage, 'ais-14-parent-invoice-detail');

await b.close();
console.log('AIS capture complete!');
