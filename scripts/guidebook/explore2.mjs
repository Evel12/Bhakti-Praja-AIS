import { launch, shot, sleep } from './lib.mjs';
const b = await launch();
const base = 'http://127.0.0.1:4173/';
async function login(email) {
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(base + '#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '#/login', { waitUntil: 'networkidle0' });
  await sleep(800);
  if (email.startsWith('student')) { await page.evaluate(() => [...document.querySelectorAll('.auth-quick-pill')].find((e) => e.textContent.includes('Peserta')).click()); }
  return page;
}
let page = await login('teacher@example.test');
await shot(page, '_a-login');
await Promise.all([page.click('button[type=submit]'), sleep(2500)]);
await shot(page, '_a-t-dashboard');
for (const r of ['assessments', 'bank', 'results']) {
  await page.evaluate((r) => (location.hash = '#/' + r), r);
  await shot(page, '_a-t-' + r, { wait: 1500 });
}
page = await login('student1@example.test');
await Promise.all([page.click('button[type=submit]'), sleep(2500)]);
await shot(page, '_a-s-home');
await page.evaluate(() => (location.hash = '#/my-results'));
await shot(page, '_a-s-results', { wait: 1500 });
await b.close();

