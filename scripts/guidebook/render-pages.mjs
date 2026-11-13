import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME } from './lib.mjs';

const b = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1200, height: 1697 },
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await b.newPage();
const htmlFile = path.resolve('Manual-Book-Bhakti-Praja-AIS.html');
await page.goto('file:///' + htmlFile.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

const pages = await page.$$('section.page');
for (let i = 0; i < pages.length; i++) {
  const outPath = path.resolve(`docs/guidebook-screens/final-page-${i + 1}.png`);
  await pages[i].screenshot({ path: outPath });
  console.log(`Rendered page ${i + 1}`);
}

await b.close();
console.log('All pages rendered successfully!');
