import { launch, shot, sleep, aisLogin, aisSubmit } from './lib.mjs';
const b = await launch();
const page = await b.newPage();
await aisLogin(page, 'admin@akademik.test', 'admin123');
await shot(page, '_x-login');
await aisSubmit(page);
await shot(page, '_x-dash');
for (const p of ['users', 'finance/invoices', 'communication/announcements', 'assessment', 'schedules']) {
  await page.goto('http://127.0.0.1:5173/' + p, { waitUntil: 'networkidle0' });
  await shot(page, '_x-' + p.replace(/\//g, '-'), { wait: 1500 });
}
await b.close();
