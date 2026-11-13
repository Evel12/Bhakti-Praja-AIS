import { launch, shot, sleep, clickText } from './lib.mjs';

const b = await launch();
const base = 'http://127.0.0.1:4173/';

async function openStudent() {
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(base + '#/login', { waitUntil: 'networkidle0' });
  await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll('.auth-quick-pill')].find((e) => e.textContent.includes('Peserta')).click());
  await sleep(500);
  await Promise.all([page.click('button[type=submit]'), sleep(2800)]);
  return page;
}

const page = await openStudent();
// 1. Student Home
await shot(page, 'as-14-siswa-home');

// 2. Instructions for Quiz
await clickText(page, 'Lihat petunjuk');
await sleep(1500);
await shot(page, 'as-15-siswa-petunjuk');

// Check the agreement checkbox
await page.evaluate(() => {
  const cb = document.querySelector('input[type=checkbox]');
  if (cb) cb.click();
});
await sleep(600);
await shot(page, 'as-15b-siswa-petunjuk-siap');

// 3. Quiz Attempt
await clickText(page, 'Mulai assessment');
await sleep(1500);
await shot(page, 'as-16-siswa-attempt-soal');

// Choose option A
await page.evaluate(() => {
  const radios = document.querySelectorAll('input[type=radio]');
  if (radios.length > 0) radios[0].click();
});
await sleep(600);
// Click "Tandai ragu"
await clickText(page, 'Tandai ragu');
await sleep(600);
await shot(page, 'as-17-siswa-attempt-ragu');

// Navigate to next or check & submit
await clickText(page, 'Berikutnya').catch(() => {});
await sleep(600);
// Answer question 2
await page.evaluate(() => {
  const radios = document.querySelectorAll('input[type=radio]');
  if (radios.length > 1) radios[1].click();
});
await sleep(600);
// Click "Cek & kirim" in sidebar
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Cek & kirim'));
  if (btns.length > 0) btns[btns.length - 1].click();
});
await sleep(1000);
await shot(page, 'as-18-siswa-attempt-confirm');

// Confirm submit dialog
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('dialog button, .dialog button, [role=dialog] button, button')].filter(b => b.textContent.includes('Kirim sekarang') || b.textContent.includes('Kirim'));
  const submitBtn = btns.find(b => b.classList.contains('primary'));
  if (submitBtn) submitBtn.click();
});
await sleep(2500);
await shot(page, 'as-19-siswa-attempt-selesai');

// 4. Student Task (Perancangan Basis Data)
await page.evaluate(() => (location.hash = '#/student'));
await sleep(1500);
await page.evaluate(() => {
  // Find card with "Perancangan Basis Data"
  const cards = [...document.querySelectorAll('.card, div')].filter(el => el.textContent.includes('Perancangan Basis Data') && el.textContent.includes('Lihat petunjuk'));
  const btn = [...document.querySelectorAll('a, button')].find(b => b.textContent.includes('Lihat petunjuk') && b.closest('div')?.textContent.includes('Perancangan Basis Data'));
  if (btn) btn.click();
});
await sleep(1500);
await page.evaluate(() => {
  const cb = document.querySelector('input[type=checkbox]');
  if (cb) cb.click();
});
await sleep(500);
await clickText(page, 'Mulai assessment').catch(() => {});
await sleep(1500);
await shot(page, 'as-20-siswa-tugas-upload');

// 5. My Results
await page.evaluate(() => (location.hash = '#/my-results'));
await sleep(1500);
await shot(page, 'as-21-siswa-hasil-saya');

await b.close();
console.log('Student capture complete!');
