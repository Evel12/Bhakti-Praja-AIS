import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const OUT = path.resolve('docs/guidebook-screens');
fs.mkdirSync(OUT, { recursive: true });

export async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, args: ['--no-sandbox', '--lang=id-ID'] });
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function shot(page, name, opts = {}) {
  await sleep(opts.wait ?? 700);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.full, ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log('shot', name);
  return file;
}

export async function clickText(page, text, selector = 'button, a, [role=tab], [role=button], label') {
  const ok = await page.evaluate((text, selector) => {
    const els = [...document.querySelectorAll(selector)].filter((e) => e.offsetParent !== null);
    const el = els.find((e) => e.textContent.replace(/\s+/g, ' ').trim() === text) || els.find((e) => e.textContent.replace(/\s+/g, ' ').trim().includes(text));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, text, selector);
  if (!ok) throw new Error('clickText not found: ' + text);
  await sleep(500);
}

export async function aisLogin(page, email, password, portal = 'ais') {
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle0' });
  await page.select('#portal', portal);
  await page.type('#email', email);
  await page.type('#password', password);
  return page;
}
export async function aisSubmit(page) {
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}), page.click('button[type=submit]')]);
  await sleep(1200);
}
