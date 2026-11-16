const assert = require('node:assert/strict');
// Shared read-only checks. Login revokes previous tokens, so profiles run sequentially.
module.exports = async function smoke(page, base, accounts, record) {
  const errors = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 500) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  const started = Date.now();
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(accounts.teacher.email);
  await page.getByLabel('Kata Sandi', { exact: true }).fill(accounts.teacher.password);
  // Blur the field before tapping: real mobile keyboards otherwise move the
  // submit button while the remote touch coordinates are being calculated.
  await page.getByRole('heading', { name: 'Selamat datang kembali', exact: true }).click();
  const [login] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Masuk', exact: true }).click(),
  ]);
  assert.equal(login.status(), 200);
  await page.getByRole('heading', { name: /Selamat datang,/ }).waitFor();
  await page.goto(`${base}/lms`);
  await page.getByRole('heading', { name: 'Pembelajaran LMS', exact: true }).waitFor();
  record.login_to_lms_ms = Date.now() - started;
  record.checks.push('Teacher login and LMS rendering');
  await page.getByRole('button', { name: 'Kuis AI', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kuis AI', exact: true }).click();
  const model = page.getByLabel('Model AI');
  assert.equal(await model.inputValue(), 'qwen3.8:27b');
  await model.selectOption('llama3.1:8b');
  assert.equal(await model.inputValue(), 'llama3.1:8b');
  await model.selectOption('qwen3.8:27b');
  record.checks.push('Qwen default and alternate model selection (no inference)');
  await page.getByRole('button', { name: 'Materi', exact: true }).click();
  record.checks.push('Course and material tab navigation');
  record.client = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform,
    hardwareConcurrencyReported: navigator.hardwareConcurrency, deviceMemoryReportedGiB: navigator.deviceMemory ?? null,
    viewport: { width: innerWidth, height: innerHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2 }));
  assert.equal(record.client.horizontalOverflow, false, 'Page overflows horizontally');
  const open = page.getByRole('button', { name: 'Buka navigasi', exact: true });
  if (await open.isVisible()) {
    await open.click();
    await page.getByRole('button', { name: 'Tutup navigasi', exact: true }).click();
    record.checks.push('Small-screen navigation drawer');
  }
  assert.deepEqual(errors, [], 'Browser exceptions or server errors');
  record.checks.push('No uncaught browser errors or HTTP 5xx');
};
