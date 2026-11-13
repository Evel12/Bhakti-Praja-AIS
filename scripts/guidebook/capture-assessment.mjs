import fs from 'node:fs';
import path from 'node:path';
import { launch, shot, sleep, clickText } from './lib.mjs';

const only = process.argv[2] || 'all';
const b = await launch();
const base = 'http://127.0.0.1:4173/';

async function open(student = false) {
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(base + '#/login', { waitUntil: 'networkidle0' });
  await sleep(900);
  if (student) await page.evaluate(() => [...document.querySelectorAll('.auth-quick-pill')].find((e) => e.textContent.includes('Peserta')).click());
  return page;
}
const submitLogin = async (page) => { await Promise.all([page.click('button[type=submit]'), sleep(2800)]); };
const go = async (page, hash) => { await page.evaluate((h) => (location.hash = h), hash); await sleep(1200); };
const dump = async (page, label) => console.log(label, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main button, main a, main input, main textarea, main select')].filter((e) => e.offsetParent).map((e) => (e.tagName + ':' + (e.innerText || e.placeholder || e.name || e.type || '')).replace(/\s+/g, ' ').slice(0, 40)))), page.url());

if (only === 'all' || only === 'teacher') {
  const page = await open(false);
  await shot(page, 'as-01-login');
  await submitLogin(page);
  await shot(page, 'as-02-guru-home');
  await go(page, '#/assessments/all');
  await shot(page, 'as-03-guru-daftar', { wait: 1200 });
  await clickText(page, 'Aktif', 'button, a, [role=tab]');
  await shot(page, 'as-04-guru-filter-aktif', { wait: 1200 });

  // Builder
  await clickText(page, 'Buat assessment');
  await sleep(1200);
  await page.type('input[placeholder^="Contoh"]', 'Evaluasi Basis Data & SQL Dasar');
  await page.type('textarea', 'Kuis pemahaman dasar perintah SQL (SELECT, INSERT, UPDATE, DELETE).');
  await shot(page, 'as-05-builder-identitas');
  await clickText(page, 'Lanjutkan');
  await sleep(1200);
  const qs = await page.$$('textarea');
  await qs[1].type('Perintah SQL yang digunakan untuk mengambil kolom tertentu dari tabel adalah...');
  const opts = await page.$$('main input:not([type=radio]):not([type=number]):not([type=file]):not([type=checkbox]):not([type=hidden])');
  const vals = ['SELECT', 'INSERT INTO', 'UPDATE SET', 'DELETE FROM'];
  for (const [i, v] of vals.entries()) await opts[i].type(v);
  await shot(page, 'as-06-builder-konten');
  await page.evaluate(() => window.scrollTo(0, 600));
  await clickText(page, 'Dari bank soal');
  await sleep(1000);
  await shot(page, 'as-07-builder-bank');
  await dump(page, 'bankdialog');
  await page.keyboard.press('Escape');
  await clickText(page, 'Batal').catch(() => {});
  await sleep(500);
  await clickText(page, 'Lanjutkan');
  await sleep(1200);
  await shot(page, 'as-08-builder-pengaturan');
  await dump(page, 'step3');
  await clickText(page, 'Lanjutkan').catch(() => {});
  await sleep(1200);
  await shot(page, 'as-09-builder-preview', { full: true });
  await dump(page, 'step4');

  // Bank soal
  await go(page, '#/bank');
  await shot(page, 'as-10-bank-soal', { wait: 1200 });
  await clickText(page, 'Lihat soal');
  await sleep(900);
  await shot(page, 'as-11-bank-lihat');
  await page.keyboard.press('Escape');

  // Hasil & penilaian
  await go(page, '#/results');
  await shot(page, 'as-12-guru-hasil', { wait: 1200 });
  await clickText(page, 'Nilai tugas');
  await sleep(1500);
  await shot(page, 'as-13-guru-pengumpulan', { wait: 1000 });
  await dump(page, 'results-detail');
}
await b.close();

