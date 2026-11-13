import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const htmlPath = path.join(rootDir, 'Manual-Book-Bhakti-Praja-AIS.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

// Extract all pages
const pageRegex = /<section class="page">([\s\S]*?)<\/section>/g;
const allPages = [];
let match;
while ((match = pageRegex.exec(rawHtml)) !== null) {
  allPages.push(match[1]);
}

console.log(`Extracted ${allPages.length} pages.`);

// Find each page by marker
const findPage = (predicate) => {
  const idx = allPages.findIndex(predicate);
  if (idx === -1) throw new Error('Could not find page with predicate');
  return allPages[idx];
};

const pageCover = findPage(p => p.includes('cover-page'));
const page1 = findPage(p => p.includes('1.1.') && p.includes('Gambaran Umum Sistem'));
const page2 = findPage(p => p.includes('1.3.') && p.includes('Proteksi Peran (RBAC)'));
const page3 = findPage(p => p.includes('1.4.') && p.includes('Frontend React 19'));
const page4 = findPage(p => p.includes('1.6.') && p.includes('Implementasi Kode Domain'));
const page5 = findPage(p => p.includes('2.1.') && p.includes('Login Website Sistem Informasi'));
const page6 = findPage(p => p.includes('2.2.') && p.includes('Ringkasan Akademik'));
const page7 = findPage(p => p.includes('2.4.') && p.includes('Data Master Akademik'));
const page8 = findPage(p => p.includes('2.5.') && p.includes('Administrasi Akademik'));
const page9 = findPage(p => p.includes('2.6.') && p.includes('Keuangan Pendidikan'));
const page10 = findPage(p => p.includes('2.7.') && p.includes('Komunikasi Sekolah'));
let pageWali = findPage(p => p.includes('Anak yang dipantau') && p.includes('Ajukan Pembayaran'));
let pageGuru1 = findPage(p => p.includes('Mengakses Ringkasan Assessment') || (p.includes('Nilai per kelas') && p.includes('Assessment aktif')));
let pageGuru2 = findPage(p => p.includes('Editor Builder 4 Langkah') || p.includes('Bank Soal · Rekayasa'));
let pageGuru3 = findPage(p => p.includes('AssignmentGradeView') || p.includes('Penilaian Pengumpulan Tugas'));
let pageSiswa1 = findPage(p => p.includes('Mengerjakan Ujian Berwaktu') && p.includes('Tandai ragu'));
let pageSiswa2 = findPage(p => p.includes('Pengumpulan Berkas Tugas oleh Siswa') && p.includes('AttemptReviewView'));

console.log('All 17 pages successfully identified!');

// Helper function to remove the white mask covering "ASSESSMENT SPACE"
function revealAssessmentSpace(html) {
  return html.replace(/<rect\s+x=["']70["']\s+y=["']38["']\s+width=["']234["']\s+height=["']36["']\s+fill=["']#ffffff["']\s*\/>/g, '');
}

// ===================== UPDATE COVER =====================
let updatedCover = pageCover.replace(
  'TERINTEGRASI DENGAN WEB ASSESSMENT PEMBELAJARAN (EXAMNIA)',
  'TERINTEGRASI DENGAN WEB ASSESSMENT PEMBELAJARAN (ASSESSMENT SPACE)'
);

// ===================== UPDATE PAGE 1 =====================
let updatedPage1 = page1.replace(
  /(Modul Assessment[\s\S]*?<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>)/,
  'Modul Assessment Space</td><td class="tbl-td">Vue 3 SFC, Pinia 3, Tailwind 4 &amp; Laravel 13 API</td><td class="tbl-td">assessment-frontend/ &amp; assessment-backend/</td>'
);
updatedPage1 = updatedPage1.replace(
  /\(EXAMNIA\) berbasis Vue 3 \+ Pinia/g,
  '(ASSESSMENT SPACE) berbasis Vue 3 + Pinia &amp; Laravel 13 API'
);
updatedPage1 = updatedPage1.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">1</div>');

// ===================== UPDATE PAGE 2 =====================
let updatedPage2 = page2.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">2</div>');

// ===================== UPDATE PAGE 3 =====================
let updatedPage3 = page3.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">3</div>');

// ===================== UPDATE PAGE 4 =====================
let updatedPage4 = page4.replace(
  /1\.6\.<\/span><span>[\s\S]*?<\/span>/,
  '1.6.</span><span>Implementasi Kode Domain &amp; Pinia Store Modul Assessment (Assessment Space Vue 3 &amp; Laravel 13)</span>'
);
updatedPage4 = updatedPage4.replace(
  /<code>src\/domain\/assessment\.js<\/code>[\s\S]*?<code>src\/stores\/assessmentStore\.js<\/code>/,
  '<code>assessment-frontend/src/domain/assessment.js</code>, store <code>assessment-frontend/src/stores/assessmentStore.js</code>, serta API Laravel 13 <code>assessment-backend/</code>'
);
updatedPage4 = updatedPage4.replace(
  '<span class="code-path">src/domain/assessment.js</span>',
  '<span class="code-path">assessment-frontend/src/domain/assessment.js</span>'
);

const new17Code = `<div class="code-line"><span class="ln">1</span><span class="lc"><span class="cm"># 1. Menjalankan Sistem Utama Core AIS (Laravel Backend Port 8000 &amp; React Frontend Port 5173)</span></span></div><div class="code-line"><span class="ln">2</span><span class="lc">cd backend; composer install; php artisan migrate --seed; php artisan serve --port=8000</span></div><div class="code-line"><span class="ln">3</span><span class="lc">cd frontend; npm ci; npm run dev  <span class="cm"># Buka: http://localhost:5173</span></span></div><div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;</span></div><div class="code-line"><span class="ln">5</span><span class="lc"><span class="cm"># 2. Menjalankan Assessment Space (assessment-frontend Port 4173 &amp; assessment-backend)</span></span></div><div class="code-line"><span class="ln">6</span><span class="lc">cd assessment-frontend; npm run dev  <span class="cm"># Mode Mandiri (Local Fallback): http://127.0.0.1:4173</span></span></div><div class="code-line"><span class="ln">7</span><span class="lc"><span class="cm"># Opsi Full-Stack: cd assessment-backend; composer install; php artisan serve --port=8000</span></span></div>`;

updatedPage4 = updatedPage4.replace(
  /(<div class="code-body">)[\s\S]*?(<\/div>\s*<div class="code-caption">Kode 1\.7)/,
  `$1${new17Code}$2`
);
updatedPage4 = updatedPage4.replace(
  /Kode 1\.7:[\s\S]*?<\/div>/,
  'Kode 1.7: Panduan eksekusi server Sistem Utama AIS (Port 5173/8000) dan Assessment Space (Port 4173/8000).</div>'
);
updatedPage4 = updatedPage4.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">4</div>');

// ===================== UPDATE PAGES 5 - 10 (ADMIN AIS) =====================
let updatedPage5 = page5.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">5</div>');
let updatedPage6 = page6.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">6</div>');
let updatedPage7 = page7.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">7</div>');
let updatedPage8 = page8.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">8</div>');
let updatedPage9 = page9.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">9</div>');
let updatedPage10 = page10.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">10</div>');

// ===================== UPDATE PAGE 11: WALI MURID (Bab 3) =====================
let updatedPage11 = pageWali.replace(
  /<h1 class="sec-h1"><span>\d+\.<\/span><span>Manual Penggunaan Program — Wali Murid \(Portal Wali &amp; Keuangan\)<\/span><\/h1>/,
  '<h1 class="sec-h1"><span>3.</span><span>Manual Penggunaan Program — Wali Murid (Portal Wali &amp; Keuangan)</span></h1>'
);
updatedPage11 = updatedPage11.replace(
  /<h2 class="sec-h2"><span>\d+\.1\.<\/span><span>Memantau Informasi Akademik &amp; Jadwal Pelajaran Anak<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>3.1.</span><span>Memantau Informasi Akademik &amp; Jadwal Pelajaran Anak</span></h2>'
);
updatedPage11 = updatedPage11.replace(
  /<h2 class="sec-h2"><span>\d+\.2\.<\/span><span>Mengajukan Bukti Pembayaran Tagihan Pendidikan<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>3.2.</span><span>Mengajukan Bukti Pembayaran Tagihan Pendidikan</span></h2>'
);
updatedPage11 = updatedPage11.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">11</div>');

// ===================== UPDATE PAGE 12: GURU ASSESSMENT (Bab 4, 4.1 & 4.2) =====================
let updatedPage12 = revealAssessmentSpace(pageGuru1);
updatedPage12 = updatedPage12.replace(
  /<h1 class="sec-h1"><span>\d+\.<\/span><span>[\s\S]*?<\/span><\/h1>/,
  '<h1 class="sec-h1"><span>4.</span><span>Manual Penggunaan Program — Guru (Web Assessment Space)</span></h1>'
);
updatedPage12 = updatedPage12.replace(
  /<h2 class="sec-h2"><span>\d+\.1\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>4.1.</span><span>Mengakses Ringkasan Assessment &amp; Statistik Nilai Kelas</span></h2>'
);
updatedPage12 = updatedPage12.replace(
  /<h2 class="sec-h2"><span>\d+\.2\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>4.2.</span><span>Melihat Daftar Assessment &amp; Filter Status (Aktif, Terjadwal, Draft, Ditutup)</span></h2>'
);
updatedPage12 = updatedPage12.replace(
  /Guru masuk melalui portal Login[\s\S]*?antarmuka utama\./,
  'Guru membuka web assessment di <span class="url-link">http://127.0.0.1:4173/#/login</span> (atau menu <em>Assessment</em> AIS). Masuk dengan email <code>teacher@example.test</code> (kata sandi <code>DemoPassword123!</code>) atau klik pill <strong>Pengajar</strong>.'
);
updatedPage12 = updatedPage12.replace(/Budi Santoso, S\.Pd\./g, 'Demo Teacher (teacher@example.test)');
updatedPage12 = updatedPage12.replace(/>BU</g, '>DT<');
updatedPage12 = updatedPage12.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">12</div>');

// ===================== UPDATE PAGE 13: GURU ASSESSMENT (Bab 4, 4.3 & 4.4) =====================
let updatedPage13 = revealAssessmentSpace(pageGuru2);
updatedPage13 = updatedPage13.replace(
  /<h2 class="sec-h2"><span>\d+\.3\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>4.3.</span><span>Menyusun Kuis/Ujian dengan Editor Builder 4 Langkah</span></h2>'
);
updatedPage13 = updatedPage13.replace(
  /<h2 class="sec-h2"><span>\d+\.4\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>4.4.</span><span>Mengelola Bank Soal &amp; Penggunaan Kembali Soal Ujian</span></h2>'
);
updatedPage13 = updatedPage13.replace(
  /Guru juga dapat menekan[\s\S]*?\(<em>draft autosave<\/em>\)\./,
  'Guru juga dapat menekan <strong>”📚 Dari bank soal”</strong> atau <strong>”✨ Bantu dengan AI”</strong> (unggah PDF materi). Soal berlabel AI wajib ditinjau dengan mencentang kotak verifikasi keselamatan sebelum assessment dapat diterbitkan.'
);
updatedPage13 = updatedPage13.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">13</div>');

// ===================== UPDATE PAGE 14: GURU ASSESSMENT (Bab 4, 4.5) =====================
let updatedPage14 = revealAssessmentSpace(pageGuru3);
updatedPage14 = updatedPage14.replace(
  /<h2 class="sec-h2"><span>\d+\.5\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>4.5.</span><span>Memeriksa Hasil Pengumpulan, Menilai Tugas Siswa, &amp; Merilis Nilai</span></h2>'
);
updatedPage14 = updatedPage14.replace(/Budi Santoso, S\.Pd\./g, 'Demo Teacher (teacher@example.test)');
updatedPage14 = updatedPage14.replace(/>BU</g, '>DT<');
updatedPage14 = updatedPage14.replace(
  /lalu mengeklik <strong>”Simpan nilai”<\/strong> dan <strong>”Rilis hasil”<\/strong> agar nilai dapat langsung dilihat oleh siswa\./,
  'lalu mengeklik <strong>”Simpan nilai”</strong> dan <strong>”Rilis hasil”</strong> agar nilai dapat langsung dilihat oleh siswa, serta menekan <strong>”Download CSV”</strong> untuk mengekspor rekapitulasi nilai kelas.'
);
updatedPage14 = updatedPage14.replace(
  /Kode \d+\.\d+: Logika penyimpanan nilai tugas dan umpan balik guru[\s\S]*?<\/div>/,
  'Kode 4.1: Logika penyimpanan nilai tugas dan umpan balik guru pada assessment-frontend (src/views/teacher/AssignmentGradeView.vue).</div>'
);
updatedPage14 = updatedPage14.replace(
  '<span class="code-path">src/views/teacher/AssignmentGradeView.vue</span>',
  '<span class="code-path">assessment-frontend/src/views/teacher/AssignmentGradeView.vue</span>'
);
updatedPage14 = updatedPage14.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">14</div>');

// ===================== UPDATE PAGE 15: SISWA ASSESSMENT (Bab 5, 5.1 & 5.2) =====================
let updatedPage15 = revealAssessmentSpace(pageSiswa1);
updatedPage15 = updatedPage15.replace(
  /<h1 class="sec-h1"><span>\d+\.<\/span><span>[\s\S]*?<\/span><\/h1>/,
  '<h1 class="sec-h1"><span>5.</span><span>Manual Penggunaan Program — Peserta Didik / Siswa (Assessment Space)</span></h1>'
);
updatedPage15 = updatedPage15.replace(
  /<h2 class="sec-h2"><span>\d+\.1\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>5.1.</span><span>Melihat Daftar Assessment Saya &amp; Memulai Pengerjaan</span></h2>'
);
updatedPage15 = updatedPage15.replace(
  /<h2 class="sec-h2"><span>\d+\.2\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>5.2.</span><span>Mengerjakan Ujian Berwaktu (Timer, Tandai Ragu, &amp; Navigasi Nomor Soal)</span></h2>'
);
updatedPage15 = updatedPage15.replace(
  /Siswa masuk melalui portal Login[\s\S]*?siswa tersebut\./,
  'Siswa masuk melalui halaman <span class="url-link">http://127.0.0.1:4173/#/login</span> dengan memilih akun <strong>Peserta (student1@example.test)</strong> dan kata sandi <code>DemoPassword123!</code>.'
);
updatedPage15 = updatedPage15.replace(/Rizky Pratama/g, 'Demo Student One (student1@example.test)');
updatedPage15 = updatedPage15.replace(/>RI</g, '>S1<');
updatedPage15 = updatedPage15.replace(
  /Setelah semua terjawab, tekan tombol <strong>”Periksa &amp; kirim”<\/strong>\./,
  'Uji ketahanan: jika halaman direfresh (F5), jawaban tetap tersimpan dan timer tidak ter-reset. Setelah selesai, tekan <strong>”Periksa &amp; kirim”</strong>.'
);
updatedPage15 = updatedPage15.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">15</div>');

// ===================== UPDATE PAGE 16: SISWA ASSESSMENT (Bab 5, 5.3 & 5.4) =====================
let updatedPage16 = revealAssessmentSpace(pageSiswa2);
updatedPage16 = updatedPage16.replace(
  /<h2 class="sec-h2"><span>\d+\.3\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>5.3.</span><span>Pengumpulan Berkas Tugas oleh Siswa</span></h2>'
);
updatedPage16 = updatedPage16.replace(
  /<h2 class="sec-h2"><span>\d+\.4\.<\/span><span>[\s\S]*?<\/span><\/h2>/,
  '<h2 class="sec-h2"><span>5.4.</span><span>Melihat Hasil Penilaian &amp; Pembahasan Ujian</span></h2>'
);
updatedPage16 = updatedPage16.replace(/Rizky Pratama/g, 'Demo Student One (student1@example.test)');
updatedPage16 = updatedPage16.replace(
  /Kode \d+\.\d+: Logika timer otomatis pengiriman ujian saat waktu habis[\s\S]*?<\/div>/,
  'Kode 5.1: Logika timer otomatis countdown ujian dan idempotensi submit pada assessment-frontend (src/views/student/AttemptView.vue).</div>'
);
updatedPage16 = updatedPage16.replace(
  '<span class="code-path">src/views/student/AttemptView.vue</span>',
  '<span class="code-path">assessment-frontend/src/views/student/AttemptView.vue</span>'
);
updatedPage16 = updatedPage16.replace(/<div class="page-number">\d+<\/div>/, '<div class="page-number">16</div>');

// Final Ordered Array: exactly 17 pages (Cover + 16 numbered pages)
const finalPages = [
  updatedCover,   // Cover
  updatedPage1,   // Page 1: 1.1 & 1.2
  updatedPage2,   // Page 2: 1.3
  updatedPage3,   // Page 3: 1.4 & 1.5
  updatedPage4,   // Page 4: 1.6 & 1.7
  updatedPage5,   // Page 5: 2.1 (Admin AIS)
  updatedPage6,   // Page 6: 2.2 & 2.3
  updatedPage7,   // Page 7: 2.4
  updatedPage8,   // Page 8: 2.5
  updatedPage9,   // Page 9: 2.6
  updatedPage10,  // Page 10: 2.7
  updatedPage11,  // Page 11: 3. Wali Murid AIS (Completed before Assessment!)
  updatedPage12,  // Page 12: 4. Guru Assessment (Dashboard & Daftar)
  updatedPage13,  // Page 13: 4. Guru Assessment (Builder & Bank Soal)
  updatedPage14,  // Page 14: 4. Guru Assessment (Penilaian & Rilis Nilai)
  updatedPage15,  // Page 15: 5. Siswa Assessment (Assessment Saya & Ujian)
  updatedPage16   // Page 16: 5. Siswa Assessment (Tugas & Pembahasan)
];

const firstPagePos = rawHtml.indexOf('<section class="page">');
const htmlHead = rawHtml.substring(0, firstPagePos);

let outputHtml = htmlHead;
for (let p = 0; p < finalPages.length; p++) {
  outputHtml += `  <section class="page">\n${finalPages[p]}\n  </section>\n\n`;
}
outputHtml += '</body>\n</html>\n';

fs.writeFileSync(htmlPath, outputHtml, 'utf8');
console.log('Successfully wrote perfected Manual-Book-Bhakti-Praja-AIS.html!');

// Verification
const verifyHtml = fs.readFileSync(htmlPath, 'utf8');
let vm;
let vIdx = 0;
const vRegex = /<section class="page">([\s\S]*?)<\/section>/g;
while ((vm = vRegex.exec(verifyHtml)) !== null) {
  const pg = vm[1].match(/<div class="page-number">(\d+)<\/div>/);
  const h1 = vm[1].match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h2 = vm[1].match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  console.log(`Page [${pg ? pg[1] : 'Cover'}]: H1: ${h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : '-'} | H2: ${h2 ? h2[1].replace(/<[^>]+>/g, '').trim() : '-'}`);
  vIdx++;
}
