const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const BrowserStackLocal = require('browserstack-local');

const root = path.resolve(__dirname, '../..');
const runtime = path.join(root, '.tools/browserstack');
const local = process.argv.includes('--local');
const base = process.env.BS_BASE_URL || (local ? 'http://127.0.0.1:4178' : 'http://bs-local.com:4178');
const accounts = JSON.parse(fs.readFileSync(path.join(runtime, 'app-users.json'), 'utf8').replace(/^\uFEFF/, ''));
const build = `LMS Local ${new Date().toISOString()}`;
const identifier = `lms-local-${Date.now()}`;
const matrix = local ? [
  { name: 'Local Chrome', executable: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  { name: 'Local Edge', executable: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
] : [
  { name: 'Chrome / Windows 11', os: 'Windows', os_version: '11', browser: 'chrome', browser_version: 'latest' },
  { name: 'Edge / Windows 11', os: 'Windows', os_version: '11', browser: 'edge', browser_version: 'latest' },
  { name: 'Firefox / Windows 11', os: 'Windows', os_version: '11', browser: 'playwright-firefox' },
  { name: 'WebKit / macOS Sonoma', os: 'osx', os_version: 'Sonoma', browser: 'playwright-webkit' },
];
const results = [];
let tunnel;
let connectionError = null;
let tunnelConnected = false;

function safe(error) {
  let message = String(error?.message || error);
  for (const value of [process.env.BROWSERSTACK_ACCESS_KEY, ...Object.values(accounts).map(a => a.password)]) {
    if (value) message = message.split(value).join('[REDACTED]').split(encodeURIComponent(value)).join('[REDACTED]');
  }
  return message.replace(/wss:\/\/cdp\.browserstack\.com\/playwright\?caps=\S+/g, '[BrowserStack connection]').slice(0, 2500);
}

function writeResults() {
  const document = { build, mode: local ? 'local-validation' : 'browserstack-local', base,
    tunnel_connected: tunnelConnected, connection_error: connectionError,
    real_mobile_devices: false, tests_ai_generation: false, assessment_modified: false, results };
  fs.writeFileSync(path.join(runtime, 'results', `${local ? 'local' : 'browserstack'}-results.json`), JSON.stringify(document, null, 2));
}

async function executor(page, action, args) {
  return page.evaluate(() => {}, `browserstack_executor: ${JSON.stringify({ action, ...(args ? { arguments: args } : {}) })}`);
}

function pdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const text = 'BT /F1 12 Tf 40 730 Td (Materi BrowserStack: primary key mengidentifikasi baris secara unik.) Tj ET';
  objects.push(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
  let file = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(file)); file += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(file);
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(file);
}

async function run(config, index) {
  const record = { browser: config.name, status: 'running', checks: [], findings: [], screenshots: [], started_at: new Date().toISOString() };
  results.push(record);
  let browser; let page;
  const pageErrors = []; const serverErrors = [];
  const check = name => { record.checks.push(name); console.log(`${config.name}: ${name}`); };
  try {
    if (local) browser = await playwright.chromium.launch({ executablePath: config.executable, headless: true });
    else {
      const { name, ...platform } = config;
      const caps = { ...platform, project: 'Bhakti Praja LMS', build, name: `LMS workflow - ${name}`,
        'browserstack.username': process.env.BROWSERSTACK_USERNAME,
        'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
        'browserstack.local': 'true', 'browserstack.localIdentifier': identifier,
        'browserstack.playwrightVersion': '1.latest', 'client.playwrightVersion': require('playwright/package.json').version,
        'browserstack.debug': 'true', 'browserstack.video': 'true', 'browserstack.console': 'disable',
        'browserstack.networkLogs': 'false', 'browserstack.maskCommands': 'sendType,sendPress,setHTTPCredentials,setStorageState' };
      browser = await playwright.chromium.connect({ wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`, timeout: 90000 });
    }
    record.browser_version = browser.version();
    page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => pageErrors.push(safe(error)));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) serverErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    if (!local) {
      const raw = await executor(page, 'getSessionDetails');
      const details = typeof raw === 'string' ? JSON.parse(raw) : raw;
      record.session_id = details.hashed_id;
      record.dashboard_url = details.browser_url || details.public_url || (details.hashed_id ? `https://automate.browserstack.com/dashboard/v2/sessions/${details.hashed_id}` : null);
    }
    async function post(label, route) {
      const pending = page.waitForResponse(response => response.url().includes(route) && response.request().method() === 'POST');
      await page.getByRole('button', { name: label, exact: true }).click();
      const response = await pending;
      assert(response.ok(), `${label}: HTTP ${response.status()}`);
      return response.json();
    }
    async function login(role) {
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Email', { exact: true }).fill(accounts[role].email);
      await page.getByLabel('Kata Sandi', { exact: true }).type(accounts[role].password);
      await post('Masuk', '/api/auth/login');
      await page.getByRole('heading', { name: /Selamat datang,/ }).waitFor();
      await page.goto(`${base}/lms`);
      await page.getByRole('heading', { name: 'Pembelajaran LMS', exact: true }).waitFor();
    }
    async function logout() {
      await page.setViewportSize({ width: 1365, height: 1000 });
      await post('Keluar', '/api/auth/logout');
      await page.getByLabel('Email', { exact: true }).waitFor();
    }
    async function screenshot(label) {
      const filename = `${local ? 'local' : 'browserstack'}-${index}-${label}.png`;
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(runtime, 'results', filename), fullPage: true, animations: 'disabled' });
      record.screenshots.push(filename);
    }
    async function responsive(label) {
      await page.setViewportSize({ width: 390, height: 844 });
      const close = page.getByRole('button', { name: 'Tutup navigasi', exact: true });
      await page.getByRole('button', { name: 'Buka navigasi', exact: true }).click();
      await close.click();
      await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at 390px.');
      await screenshot(label);
      await page.setViewportSize({ width: 1365, height: 1000 });
    }

    await page.goto(`${base}/login`);
    await page.getByLabel('Email', { exact: true }).fill(accounts.teacher.email);
    await page.getByLabel('Kata Sandi', { exact: true }).type('invalid-password-for-test');
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    assert.equal((await rejected).status(), 401);
    await page.getByRole('alert').waitFor(); check('Invalid login is rejected');

    await login('teacher');
    const courseName = `BrowserStack ${index} ${Date.now()}`;
    await page.getByLabel('Nama course', { exact: true }).first().fill(courseName);
    await page.getByLabel('Deskripsi', { exact: true }).first().fill('Materi dan tugas pengujian lintas browser.');
    await post('Buat course', '/api/lms/courses');
    await page.getByRole('heading', { name: courseName, exact: true }).waitFor();
    const code = await page.locator('strong.font-mono').innerText(); check('Teacher login and course creation');
    await page.getByLabel('Dokumen PDF (maksimal 10 MB)').setInputFiles({ name: 'materi-browserstack.pdf', mimeType: 'application/pdf', buffer: pdf() });
    await post('Unggah materi', '/materials');
    await page.getByText('materi-browserstack.pdf', { exact: true }).waitFor();
    await page.getByLabel('Dokumen PDF (maksimal 10 MB)').setInputFiles({ name: 'privat-browserstack.pdf', mimeType: 'application/pdf', buffer: pdf() });
    await page.locator('select[name="visibility"]').selectOption('private');
    const privateMaterial = await post('Unggah materi', '/materials');
    await page.getByText('privat-browserstack.pdf', { exact: true }).waitFor(); check('Public and private PDF uploads');
    await page.getByRole('button', { name: 'Kuis AI', exact: true }).click();
    assert.equal(await page.getByLabel('Model AI').inputValue(), 'qwen3.8:27b');
    await page.getByLabel('Model AI').selectOption('llama3.1:8b');
    assert.equal(await page.getByLabel('Model AI').inputValue(), 'llama3.1:8b');
    await page.getByLabel('Model AI').selectOption('qwen3.8:27b'); check('Qwen default and model selection');
    await page.getByRole('button', { name: 'Tugas', exact: true }).click();
    await page.locator('summary').filter({ hasText: 'Buat tugas' }).click();
    await page.getByLabel('Judul tugas').fill('Tugas lintas browser');
    await page.getByLabel('Petunjuk').fill('Jelaskan fungsi primary key.');
    await page.getByLabel('Batas pengumpulan (waktu lokal)').fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
    await post('Buat tugas', '/assignments');
    await post('Terbitkan tugas', '/status'); check('Assignment creation and publication');
    await page.getByRole('button', { name: 'Pengumuman', exact: true }).click();
    await page.getByLabel('Judul', { exact: true }).fill('Pengumuman BrowserStack');
    await page.getByLabel('Isi pengumuman').fill('Materi siap dibaca.');
    await post('Kirim pengumuman', '/announcements'); check('Teacher announcement');
    await screenshot('teacher-desktop'); await logout();

    await login('student');
    await page.getByLabel('Kode dari guru').fill(code);
    await post('Gabung', '/api/lms/join');
    await page.getByRole('heading', { name: courseName, exact: true }).waitFor();
    await page.getByText('materi-browserstack.pdf', { exact: true }).waitFor();
    assert.equal(await page.getByText('privat-browserstack.pdf', { exact: true }).count(), 0);
    const privateStatus = await page.evaluate(async id => {
      const response = await fetch(`/api/lms/materials/${id}/download`, { headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('ais_token')}` } });
      return response.status;
    }, privateMaterial.data.id);
    assert.equal(privateStatus, 404); check('Student joins course; private PDF is blocked');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh PDF', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'materi-browserstack.pdf'); check('Student PDF download');
    await post('Tandai dibaca', '/read');
    await page.getByRole('button', { name: 'Sudah dibaca', exact: true }).waitFor();
    await responsive('student-mobile');
    await page.getByRole('button', { name: 'Tugas', exact: true }).click();
    await page.getByLabel('Jawaban tugas').fill('Primary key mengidentifikasi baris secara unik.');
    await page.getByLabel('Berkas jawaban (PDF, Word, TXT, ZIP; maksimal 10 MB)').setInputFiles({ name: 'jawaban-browserstack.txt', mimeType: 'text/plain', buffer: Buffer.from('Jawaban pengujian LMS.') });
    await post('Kumpulkan jawaban', '/submit');
    await page.getByRole('button', { name: 'Unduh jawaban-browserstack.txt', exact: true }).waitFor(); check('Student file submission and mobile layout');
    await logout();

    await login('teacher');
    await page.getByRole('heading', { name: courseName, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tugas', exact: true }).click();
    await page.getByLabel(/Nilai \(/).fill('95');
    await page.getByLabel('Umpan balik').fill('Jawaban sesuai materi.');
    const grade = page.waitForResponse(response => response.url().includes('/grade') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Simpan nilai', exact: true }).click();
    const gradeResponse = await grade;
    assert(gradeResponse.ok());
    await page.getByRole('button', { name: 'Absensi', exact: true }).click();
    const meetingField = page.getByLabel('Tanggal pertemuan');
    const defaultMeetingDate = await meetingField.inputValue();
    const validDateInput = await meetingField.evaluate(field => field.validity.valid);
    const knownServerDate = new Date(gradeResponse.headers()['date']).toISOString().slice(0, 10);
    record.default_meeting_date = { value: defaultMeetingDate, valid: validDateInput };
    if (!defaultMeetingDate || !validDateInput) {
      record.findings.push({ code: 'attendance-date-input', browser_date: defaultMeetingDate || '(empty)', server_date_utc: knownServerDate,
        status: 'client-validation', description: 'The default attendance date is empty or invalid; native form validation blocks submission.' });
      console.log(`${config.name}: FINDING default attendance input is invalid; continuing with an explicitly valid date.`);
      await meetingField.fill(knownServerDate);
      await post('Simpan absensi', '/attendance');
    } else {
      const attendancePending = page.waitForResponse(response => response.url().includes('/attendance') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Simpan absensi', exact: true }).click();
      const attendanceResponse = await attendancePending;
      if (attendanceResponse.status() === 422) {
      const validation = await attendanceResponse.json();
      const serverDate = new Date(attendanceResponse.headers()['date']).toISOString().slice(0, 10);
      if (defaultMeetingDate > serverDate && validation.errors?.meeting_date) {
        record.findings.push({ code: 'attendance-date-timezone', browser_date: defaultMeetingDate, server_date_utc: serverDate,
          status: 422, description: 'Default local attendance date is rejected while the UTC backend is still on the previous day.' });
        console.log(`${config.name}: FINDING attendance date differs from UTC backend; continuing with an explicitly valid meeting date.`);
        await page.getByLabel('Tanggal pertemuan').fill(serverDate);
        await post('Simpan absensi', '/attendance');
      } else throw new Error('Attendance validation failed for a reason other than the known date boundary.');
      } else assert(attendanceResponse.ok(), `Attendance: HTTP ${attendanceResponse.status()}`);
    }
    check('Teacher grading and attendance with a valid meeting date');
    await logout();

    await login('student');
    await page.getByRole('button', { name: 'Progres & Nilai', exact: true }).click();
    await page.getByRole('cell', { name: '100%', exact: true }).waitFor();
    await page.getByRole('cell', { name: '95', exact: true }).waitFor(); check('Student progress and grade display');
    await screenshot('student-progress'); await logout();

    await login('parent');
    await page.getByRole('heading', { name: courseName, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Buat course', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Progres & Nilai', exact: true }).click();
    await page.getByRole('cell', { name: '95', exact: true }).waitFor();
    await responsive('parent-mobile'); check('Linked parent sees grades with read-only UI');
    assert.deepEqual(pageErrors, [], 'Unexpected browser JavaScript errors');
    assert.deepEqual(serverErrors, [], 'Unexpected HTTP 5xx responses'); check('No browser exceptions or HTTP 5xx');
    record.status = record.findings.length ? 'failed' : 'passed';
    if (!local) await executor(page, 'setSessionStatus', { status: record.status, reason: record.findings.length ? 'Default attendance date validation failed; remaining workflow checks completed using an explicit valid meeting date.' : 'LMS workflow, permissions and responsive checks passed.' });
  } catch (error) {
    record.status = 'failed'; record.error = safe(error);
    if (page) {
      try { const filename = `${local ? 'local' : 'browserstack'}-${index}-failure.png`; await page.screenshot({ path: path.join(runtime, 'results', filename), fullPage: true }); record.screenshots.push(filename); } catch (_) {}
      if (!local) try { await executor(page, 'setSessionStatus', { status: 'failed', reason: safe(error).slice(0, 250) }); } catch (_) {}
    }
    console.error(`${config.name}: ${record.error}`);
  } finally {
    record.page_errors = pageErrors; record.server_errors = serverErrors; record.finished_at = new Date().toISOString();
    if (browser) try { await browser.close(); } catch (_) {}
    writeResults();
  }
}

async function main() {
  fs.mkdirSync(path.join(runtime, 'results'), { recursive: true });
  if (!local && (!process.env.BROWSERSTACK_USERNAME || !process.env.BROWSERSTACK_ACCESS_KEY)) throw new Error('Use tests/browserstack/connect.ps1 and run-tests.ps1 to supply BrowserStack credentials.');
  if (!local) {
    tunnel = new BrowserStackLocal.Local();
    await new Promise((resolve, reject) => tunnel.start({ key: process.env.BROWSERSTACK_ACCESS_KEY, localIdentifier: identifier, onlyAutomate: true,
      logFile: path.join(runtime, 'tunnel.log'), verbose: false }, error => error ? reject(error) : resolve()));
    if (!tunnel.isRunning()) throw new Error('BrowserStack Local did not become ready.');
    tunnelConnected = true;
    console.log('BrowserStack Local tunnel connected.');
  }
  try { for (let i = 0; i < matrix.length; i++) await run(matrix[i], i + 1); }
  finally { if (tunnel?.isRunning()) await new Promise(resolve => tunnel.stop(() => resolve())); }
  if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
}

main().catch(async error => {
  connectionError = safe(error);
  console.error(connectionError);
  if (tunnel?.isRunning()) await new Promise(resolve => tunnel.stop(() => resolve()));
  writeResults();
  process.exitCode = 1;
});
