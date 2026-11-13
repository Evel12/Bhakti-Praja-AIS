import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME } from './guidebook/lib.mjs';

const screensDir = path.resolve('docs/guidebook-screens');

function img(name) {
  const file = path.join(screensDir, `${name}.png`);
  if (!fs.existsSync(file)) throw new Error(`Screenshot not found: ${file}`);
  const b64 = fs.readFileSync(file).toString('base64');
  return `data:image/png;base64,${b64}`;
}

const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Manual Book - Sistem Informasi Akademik SMK Bhakti Praja Batang (Bhakti Praja AIS)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 10pt;
      line-height: 1.34;
      color: #000000;
      background: #cbd5e1;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
    .page {
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      margin: 8mm auto;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .page-content {
      padding: 14mm 19mm 20mm 20mm;
      height: 100%;
      position: relative;
      z-index: 2;
    }

    /* COVER PAGE STYLING */
    .cover-page {
      padding: 24mm 24mm 24mm 25mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }
    .cover-top {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .cover-brand-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .cover-brand-badge {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: bold;
      font-size: 20pt;
      font-family: Arial, Helvetica, sans-serif;
      box-shadow: 0 4px 10px rgba(15,23,42,0.3);
    }
    .cover-brand-title {
      font-family: "Times New Roman", Times, serif;
      font-size: 24pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .cover-brand-sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      color: #475569;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .cover-middle {
      margin: 12mm 0 auto 0;
      padding-top: 24mm;
    }
    .cover-bar-wrap {
      border-left: 7px solid #000000;
      padding: 4px 0 4px 26px;
    }
    .cover-title-line {
      font-family: "Times New Roman", Times, serif;
      font-size: 32pt;
      font-weight: 400;
      letter-spacing: 0.8px;
      line-height: 1.22;
      color: #000000;
      margin-bottom: 14px;
      text-transform: uppercase;
    }
    .cover-title-line:last-child {
      margin-bottom: 0;
    }
    .cover-subtitle {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.8pt;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 18px;
    }
    .cover-bottom {
      margin-bottom: 12mm;
    }
    .cover-bottom p {
      font-family: "Times New Roman", Times, serif;
      font-size: 15pt;
      line-height: 1.5;
      color: #000000;
    }
    .cover-bottom .sub-address {
      font-size: 11.5pt;
      color: #334155;
      margin-top: 4px;
    }

    /* FOOTER & WAVE */
    .page-number {
      position: absolute;
      bottom: 18mm;
      right: 20mm;
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      color: #000000;
      z-index: 3;
    }
    .corner-wave {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 52mm;
      height: 35mm;
      z-index: 1;
      pointer-events: none;
    }

    /* HEADINGS & TEXT */
    h1.sec-h1 {
      font-size: 11.6pt;
      font-weight: bold;
      margin-bottom: 4px;
      display: flex;
      gap: 14px;
      color: #000000;
    }
    h2.sec-h2 {
      font-size: 10.8pt;
      font-weight: bold;
      margin-top: 6px;
      margin-bottom: 3px;
      display: flex;
      gap: 10px;
      color: #000000;
    }
    p.lead {
      margin-bottom: 4px;
      text-align: justify;
    }
    ol.steps {
      list-style: none;
      margin-left: 0;
      margin-bottom: 4px;
    }
    ol.steps > li {
      display: flex;
      align-items: flex-start;
      margin-bottom: 3px;
      text-align: justify;
    }
    ol.steps > li > .s-num {
      width: 24px;
      flex-shrink: 0;
      font-weight: 600;
    }
    ol.steps > li > .s-body {
      flex: 1;
    }
    ul.bullets {
      list-style: disc;
      margin-left: 30px;
      margin-bottom: 4px;
    }
    ul.bullets li {
      margin-bottom: 2px;
      text-align: justify;
    }
    .url-link {
      color: #0284c7;
      text-decoration: underline;
    }

    /* CODE CARDS */
    .code-card {
      font-family: Consolas, "Courier New", monospace;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin: 4px 0 6px 20px;
      background: #0f172a;
      color: #f8fafc;
    }
    .code-header {
      background: #1e293b;
      padding: 3.5px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #334155;
      font-size: 7.8pt;
    }
    .code-dots {
      display: flex;
      gap: 4px;
    }
    .code-dots i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .code-dots i:nth-child(1) { background: #ef4444; }
    .code-dots i:nth-child(2) { background: #f59e0b; }
    .code-dots i:nth-child(3) { background: #10b981; }
    .code-path {
      color: #e2e8f0;
      font-weight: 600;
    }
    .code-lang {
      color: #38bdf8;
      font-size: 7pt;
      text-transform: uppercase;
    }
    .code-body {
      padding: 4px 8px;
      font-size: 7.3pt;
      line-height: 1.28;
    }
    .code-line {
      display: flex;
      align-items: baseline;
    }
    .code-line .ln {
      width: 20px;
      color: #64748b;
      user-select: none;
      text-align: right;
      padding-right: 7px;
      flex-shrink: 0;
    }
    .code-line .lc {
      flex: 1;
      display: block;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .kw { color: #c084fc; font-weight: 600; }
    .st { color: #86efac; }
    .cm { color: #94a3b8; font-style: italic; }
    .code-caption {
      background: #f8fafc;
      color: #334155;
      font-family: "Times New Roman", Times, serif;
      font-size: 8.8pt;
      padding: 3px 10px;
      border-top: 1px solid #cbd5e1;
      font-style: italic;
    }

    /* ARCHITECTURE TABLE */
    table.arch-table {
      width: calc(100% - 20px);
      margin: 4px 0 6px 20px;
      border-collapse: collapse;
      font-size: 8.4pt;
      border: 1px solid #cbd5e1;
    }
    table.arch-table th, table.arch-table td {
      border: 1px solid #cbd5e1;
      padding: 4.5px 7px;
      vertical-align: top;
      text-align: left;
    }
    table.arch-table th {
      background: #f1f5f9;
      font-weight: bold;
    }

    /* REAL SCREENSHOT CONTAINERS */
    .ss-box {
      margin: 4px 0 6px 20px;
      border: 1.2px solid #cbd5e1;
      border-radius: 7px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 2px 7px rgba(0,0,0,0.06);
    }
    .ss-box img {
      display: block;
      width: 100%;
      height: auto;
    }
    .ss-box-dialog {
      margin: 4px auto 6px auto;
      max-width: 440px;
      border: 1.2px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    }
    .ss-box-dialog img {
      display: block;
      width: 100%;
      height: auto;
    }
    .ss-grid-2 {
      margin: 4px 0 6px 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .ss-grid-2 .ss-box {
      margin: 0;
    }
    .ss-caption {
      font-size: 8.2pt;
      font-style: italic;
      color: #475569;
      padding: 3px 8px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <section class="page">
    <div class="cover-page">
      <div class="cover-top">
        <div class="cover-brand-header">
          <div class="cover-brand-badge">BP</div>
          <div>
            <div class="cover-brand-title">SMK Bhakti Praja Batang</div>
            <div class="cover-brand-sub">NPSN 20322714 · Batang, Jawa Tengah</div>
          </div>
        </div>
      </div>

      <div class="cover-middle">
        <div class="cover-bar-wrap">
          <div class="cover-title-line">MANUAL BOOK</div>
          <div class="cover-title-line">SISTEM INFORMASI AKADEMIK</div>
          <div class="cover-title-line">BHAKTI PRAJA AIS</div>
          <div class="cover-subtitle">TERINTEGRASI DENGAN WEB ASSESSMENT PEMBELAJARAN (ASSESSMENT SPACE)</div>
        </div>
      </div>

      <div class="cover-bottom">
        <p><strong>SMK Bhakti Praja Batang</strong></p>
        <p>Jawa Tengah</p>
        <p class="sub-address">Jl. Ki Mangunsarkoro No. 45, Proyonanggan Selatan, Kabupaten Batang 51211</p>
      </div>
    </div>
  </section>

  <!-- ==================== PAGE 1: 1.1 & 1.2 ==================== -->
  <section class="page">
    <div class="page-content">
      <h1 class="sec-h1"><span>1.</span><span>Program &amp; Arsitektur Sistem Bhakti Praja AIS</span></h1>
      <h2 class="sec-h2"><span>1.1.</span><span>Gambaran Umum Sistem</span></h2>
      <p class="lead">Bhakti Praja AIS (Academic Information System) adalah sistem informasi administrasi akademik, penilaian pembelajaran (<em>assessment</em>), keuangan pendidikan, portal wali murid, dan komunikasi sekolah terintegrasi yang dirancang khusus untuk SMK Bhakti Praja Batang (NPSN 20322714) di bawah naungan Yayasan Bhakti Praja KORPRI Kabupaten Batang.</p>
      <p class="lead">Sistem ini mengintegrasikan Backend REST API berbasis Laravel 12 &amp; Laravel Sanctum dengan Frontend Utama berbasis React 19 + Vite + Tailwind CSS 4 serta Workspace Assessment Pembelajaran (ASSESSMENT SPACE) berbasis Vue 3 + Pinia &amp; Laravel 13 API dalam satu origin dan satu sesi autentikasi terpadu.</p>

      <table class="arch-table">
        <thead>
          <tr>
            <th style="width:23%;">Komponen / Modul</th>
            <th style="width:27%;">Teknologi Utama</th>
            <th style="width:24%;">Lokasi Direktori</th>
            <th style="width:26%;">Fungsi Utama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Backend API &amp; RBAC</strong></td>
            <td>PHP 8.2+, Laravel 12, Sanctum, SQLite/MySQL</td>
            <td><code>backend/</code></td>
            <td>Autentikasi multi-layanan, otorisasi peran (Admin, Guru, Siswa, Wali), CRUD akademik &amp; keuangan.</td>
          </tr>
          <tr>
            <td><strong>Frontend Utama AIS</strong></td>
            <td>React 19, React Router 7, Axios, Tailwind CSS 4</td>
            <td><code>frontend/src/</code></td>
            <td>Panel Admin Akademik, Portal Wali Murid, Keuangan Pendidikan, &amp; Komunikasi Sekolah.</td>
          </tr>
          <tr>
            <td><strong>Modul Assessment Space</strong></td>
            <td>Vue 3 SFC, Pinia 3, Tailwind 4 &amp; Laravel 13 API</td>
            <td><code>assessment-frontend/</code> &amp; <code>assessment-backend/</code></td>
            <td>Penyusunan kuis/ujian/tugas 4 langkah, bank soal, ruang ujian berwaktu (<em>timer</em>), &amp; penilaian.</td>
          </tr>
        </tbody>
      </table>

      <h2 class="sec-h2"><span>1.2.</span><span>Konfigurasi Identitas Sekolah &amp; Program Keahlian</span></h2>
      <p class="lead">Data identitas resmi sekolah, NPSN, serta pemetaan 3 Program Keahlian dan 4 Konsentrasi Keahlian SMK Bhakti Praja Batang disimpan secara terpusat pada berkas konfigurasi <code>backend/config/school.php</code> dan disajikan melalui endpoint publik <code>GET /api/school-profile</code>:</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">backend/config/school.php</span>
          <span class="code-lang">PHP 8 / Laravel Config</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc"><span class="kw">&lt;?php</span></span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc"><span class="kw">return</span> [</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">&nbsp;&nbsp;<span class="st">'name'</span> =&gt; <span class="st">'SMK Bhakti Praja Batang'</span>,</span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;&nbsp;<span class="st">'short_name'</span> =&gt; <span class="st">'SMK Bhakti Praja'</span>,</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc">&nbsp;&nbsp;<span class="st">'npsn'</span> =&gt; <span class="st">'20322714'</span>,</span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">&nbsp;&nbsp;<span class="st">'address'</span> =&gt; <span class="st">'Jl. Ki Mangunsarkoro No. 45, Proyonanggan Selatan, Batang, Jawa Tengah 51211'</span>,</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">&nbsp;&nbsp;<span class="st">'phone'</span> =&gt; <span class="st">'02854496582'</span>,</span></div>
          <div class="code-line"><span class="ln">8</span><span class="lc">&nbsp;&nbsp;<span class="st">'email'</span> =&gt; <span class="st">'smkbhaktiprajabatang@yahoo.co.id'</span>,</span></div>
          <div class="code-line"><span class="ln">9</span><span class="lc">&nbsp;&nbsp;<span class="st">'foundation'</span> =&gt; <span class="st">'Yayasan Bhakti Praja KORPRI Kabupaten Batang'</span>,</span></div>
          <div class="code-line"><span class="ln">10</span><span class="lc">&nbsp;&nbsp;<span class="st">'programs'</span> =&gt; [</span></div>
          <div class="code-line"><span class="ln">11</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-TM'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Teknik Mesin'</span>, <span class="st">'concentrations'</span> =&gt; [</span></div>
          <div class="code-line"><span class="ln">12</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-TMI'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Teknik Mekanik Industri'</span>],</span></div>
          <div class="code-line"><span class="ln">13</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;]],</span></div>
          <div class="code-line"><span class="ln">14</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-TO'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Teknik Otomotif'</span>, <span class="st">'concentrations'</span> =&gt; [</span></div>
          <div class="code-line"><span class="ln">15</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-TKR'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Teknik Kendaraan Ringan'</span>],</span></div>
          <div class="code-line"><span class="ln">16</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-TSM'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Teknik Sepeda Motor'</span>],</span></div>
          <div class="code-line"><span class="ln">17</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;]],</span></div>
          <div class="code-line"><span class="ln">18</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-PPLG'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Pengembangan Perangkat Lunak dan Gim'</span>, <span class="st">'concentrations'</span> =&gt; [</span></div>
          <div class="code-line"><span class="ln">19</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span class="st">'code'</span> =&gt; <span class="st">'BP-RPL'</span>, <span class="st">'name'</span> =&gt; <span class="st">'Rekayasa Perangkat Lunak'</span>],</span></div>
          <div class="code-line"><span class="ln">20</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;]],</span></div>
          <div class="code-line"><span class="ln">21</span><span class="lc">&nbsp;&nbsp;],</span></div>
          <div class="code-line"><span class="ln">22</span><span class="lc">];</span></div>
        </div>
        <div class="code-caption">Kode 1.1: Konfigurasi identitas resmi SMK Bhakti Praja Batang beserta 3 Program dan 4 Konsentrasi Keahlian.</div>
      </div>
    </div>
    <div class="page-number">1</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 2: 1.3 ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>1.3.</span><span>Implementasi Kode Autentikasi Multi-Layanan &amp; Proteksi Peran (RBAC)</span></h2>
      <p class="lead">Pada sisi server, <code>AuthController.php</code> memvalidasi kredensial pengguna, memeriksa status keaktifan akun, serta memverifikasi kecocokan peran (<em>admin</em>, <em>guru</em>, <em>murid</em>, <em>wali_murid</em>) terhadap konteks portal yang dipilih saat login sebelum menerbitkan token Laravel Sanctum:</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">backend/app/Http/Controllers/AuthController.php</span>
          <span class="code-lang">PHP / Laravel Controller</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc"><span class="kw">public function</span> login(Request $request) {</span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc">&nbsp;&nbsp;$validator = Validator::make($request-&gt;all(), [</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'email'</span> =&gt; [<span class="st">'required'</span>, <span class="st">'email'</span>, <span class="st">'max:150'</span>],</span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'password'</span> =&gt; [<span class="st">'required'</span>, <span class="st">'string'</span>, <span class="st">'min:6'</span>],</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'portal'</span> =&gt; [<span class="st">'nullable'</span>, Rule::in([<span class="st">'ais'</span>, <span class="st">'member4'</span>, <span class="st">'communication'</span>, <span class="st">'assessment'</span>])],</span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">&nbsp;&nbsp;]);</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">&nbsp;&nbsp;<span class="kw">if</span> ($validator-&gt;fails()) <span class="kw">return</span> response()-&gt;json([<span class="st">'success'</span> =&gt; <span class="kw">false</span>, <span class="st">'errors'</span> =&gt; $validator-&gt;errors()], 422);</span></div>
          <div class="code-line"><span class="ln">8</span><span class="lc">&nbsp;&nbsp;$user = User::with(<span class="st">'role'</span>)-&gt;where(<span class="st">'email'</span>, $request-&gt;email)-&gt;first();</span></div>
          <div class="code-line"><span class="ln">9</span><span class="lc">&nbsp;&nbsp;<span class="kw">if</span> (! $user || ! Hash::check($request-&gt;password, $user-&gt;password)) {</span></div>
          <div class="code-line"><span class="ln">10</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> response()-&gt;json([<span class="st">'success'</span> =&gt; <span class="kw">false</span>, <span class="st">'message'</span> =&gt; <span class="st">'Email atau kata sandi salah.'</span>], 401);</span></div>
          <div class="code-line"><span class="ln">11</span><span class="lc">&nbsp;&nbsp;}</span></div>
          <div class="code-line"><span class="ln">12</span><span class="lc">&nbsp;&nbsp;$portal = $request-&gt;input(<span class="st">'portal'</span>) ?? <span class="st">'ais'</span>;</span></div>
          <div class="code-line"><span class="ln">13</span><span class="lc">&nbsp;&nbsp;$allowedRoles = <span class="kw">match</span> ($portal) {</span></div>
          <div class="code-line"><span class="ln">14</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'assessment'</span> =&gt; [<span class="st">'admin'</span>, <span class="st">'guru'</span>, <span class="st">'murid'</span>],</span></div>
          <div class="code-line"><span class="ln">15</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'communication'</span> =&gt; [<span class="st">'admin'</span>, <span class="st">'guru'</span>, <span class="st">'murid'</span>, <span class="st">'wali_murid'</span>],</span></div>
          <div class="code-line"><span class="ln">16</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="st">'member4'</span> =&gt; [<span class="st">'admin'</span>, <span class="st">'murid'</span>, <span class="st">'wali_murid'</span>],</span></div>
          <div class="code-line"><span class="ln">17</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">default</span> =&gt; [<span class="st">'admin'</span>],</span></div>
          <div class="code-line"><span class="ln">18</span><span class="lc">&nbsp;&nbsp;};</span></div>
          <div class="code-line"><span class="ln">19</span><span class="lc">&nbsp;&nbsp;<span class="kw">if</span> (! in_array($user-&gt;role?-&gt;name, $allowedRoles, <span class="kw">true</span>)) {</span></div>
          <div class="code-line"><span class="ln">20</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> response()-&gt;json([<span class="st">'success'</span> =&gt; <span class="kw">false</span>, <span class="st">'message'</span> =&gt; <span class="st">'Akses ditolak untuk peran ini.'</span>], 403);</span></div>
          <div class="code-line"><span class="ln">21</span><span class="lc">&nbsp;&nbsp;}</span></div>
          <div class="code-line"><span class="ln">22</span><span class="lc">&nbsp;&nbsp;$user-&gt;tokens()-&gt;delete();</span></div>
          <div class="code-line"><span class="ln">23</span><span class="lc">&nbsp;&nbsp;$token = $user-&gt;createToken($portal === <span class="st">'ais'</span> ? <span class="st">'ais-admin'</span> : $portal)-&gt;plainTextToken;</span></div>
          <div class="code-line"><span class="ln">24</span><span class="lc">&nbsp;&nbsp;<span class="kw">return</span> response()-&gt;json([<span class="st">'success'</span> =&gt; <span class="kw">true</span>, <span class="st">'data'</span> =&gt; $user, <span class="st">'token'</span> =&gt; $token]);</span></div>
          <div class="code-line"><span class="ln">25</span><span class="lc">}</span></div>
        </div>
        <div class="code-caption">Kode 1.2: Validasi login multi-layanan dan penerbitan token Sanctum sesuai hak akses peran.</div>
      </div>

      <p class="lead">Seluruh endpoint REST API administrasi akademik diproteksi menggunakan middleware <code>auth:sanctum</code> dan <code>AdminOnly</code> pada <code>backend/routes/api.php</code>:</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">backend/routes/api.php</span>
          <span class="code-lang">PHP / Laravel Routes</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc">Route::post(<span class="st">'/auth/login'</span>, [AuthController::<span class="kw">class</span>, <span class="st">'login'</span>]);</span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc">Route::get(<span class="st">'/school-profile'</span>, SchoolProfileController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">&nbsp;</span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">Route::middleware([<span class="st">'auth:sanctum'</span>, Member4Role::<span class="kw">class</span>.<span class="st">':admin,guru,murid,wali_murid'</span>])-&gt;group(<span class="kw">function</span> () {</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc">&nbsp;&nbsp;Route::post(<span class="st">'/auth/logout'</span>, [AuthController::<span class="kw">class</span>, <span class="st">'logout'</span>]);</span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">&nbsp;&nbsp;Route::get(<span class="st">'/auth/me'</span>, [AuthController::<span class="kw">class</span>, <span class="st">'me'</span>]);</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">});</span></div>
          <div class="code-line"><span class="ln">8</span><span class="lc">&nbsp;</span></div>
          <div class="code-line"><span class="ln">9</span><span class="lc">Route::middleware([<span class="st">'auth:sanctum'</span>, AdminOnly::<span class="kw">class</span>])-&gt;group(<span class="kw">function</span> () {</span></div>
          <div class="code-line"><span class="ln">10</span><span class="lc">&nbsp;&nbsp;Route::get(<span class="st">'/dashboard'</span>, [DashboardController::<span class="kw">class</span>, <span class="st">'index'</span>]);</span></div>
          <div class="code-line"><span class="ln">11</span><span class="lc">&nbsp;&nbsp;Route::get(<span class="st">'/roles'</span>, [RoleController::<span class="kw">class</span>, <span class="st">'index'</span>]);</span></div>
          <div class="code-line"><span class="ln">12</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'users'</span>, UserController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">13</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'study-programs'</span>, StudyProgramController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">14</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'teachers'</span>, TeacherController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">15</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'students'</span>, StudentController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">16</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'classrooms'</span>, ClassroomController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">17</span><span class="lc">&nbsp;&nbsp;Route::apiResource(<span class="st">'schedules'</span>, ScheduleController::<span class="kw">class</span>);</span></div>
          <div class="code-line"><span class="ln">18</span><span class="lc">});</span></div>
        </div>
        <div class="code-caption">Kode 1.3: Definisi rute REST API untuk modul Data Master dan Administrasi Akademik.</div>
      </div>
    </div>
    <div class="page-number">2</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 3: 1.4 & 1.5 ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>1.4.</span><span>Implementasi Kode Frontend React 19 (Routing &amp; Modul CRUD Akademik)</span></h2>
      <p class="lead">Pada sisi klien, <code>frontend/src/App.jsx</code> memetakan 17 resource akademik secara deklaratif ke komponen <code>CrudPage</code> serta mengintegrasikan rute <code>/assessment</code>, <code>/finance</code>, <code>/parent</code>, dan <code>/communication</code> dalam satu kerangka tata letak (<code>Layout.jsx</code>):</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">frontend/src/App.jsx</span>
          <span class="code-lang">JSX / React 19 Router</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc"><span class="kw">const</span> resources = {</span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc">&nbsp;&nbsp;<span class="st">'teaching-loads'</span>: { title: <span class="st">'Beban Mengajar'</span>, singular: <span class="st">'Beban Mengajar'</span> },</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">&nbsp;&nbsp;users: { title: <span class="st">'Data Pengguna'</span>, singular: <span class="st">'Pengguna'</span> },</span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;&nbsp;students: { title: <span class="st">'Siswa'</span>, singular: <span class="st">'Siswa'</span> },</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc">&nbsp;&nbsp;teachers: { title: <span class="st">'Guru'</span>, singular: <span class="st">'Guru'</span> },</span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">&nbsp;&nbsp;parents: { title: <span class="st">'Wali Murid'</span>, singular: <span class="st">'Wali Murid'</span> },</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">&nbsp;&nbsp;<span class="st">'study-programs'</span>: { title: <span class="st">'Konsentrasi Keahlian'</span>, singular: <span class="st">'Konsentrasi Keahlian'</span> },</span></div>
          <div class="code-line"><span class="ln">8</span><span class="lc">&nbsp;&nbsp;subjects: { title: <span class="st">'Mata Pelajaran'</span>, singular: <span class="st">'Mata Pelajaran'</span> },</span></div>
          <div class="code-line"><span class="ln">9</span><span class="lc">&nbsp;&nbsp;classrooms: { title: <span class="st">'Kelas'</span>, singular: <span class="st">'Kelas'</span> },</span></div>
          <div class="code-line"><span class="ln">10</span><span class="lc">&nbsp;&nbsp;schedules: { title: <span class="st">'Jadwal Pembelajaran'</span>, singular: <span class="st">'Jadwal'</span> },</span></div>
          <div class="code-line"><span class="ln">11</span><span class="lc">};</span></div>
        </div>
        <div class="code-caption">Kode 1.4: Konfigurasi pemetaan modul CRUD Data Master dan Administrasi Akademik pada React.</div>
      </div>

      <h2 class="sec-h2"><span>1.5.</span><span>Implementasi Kode Keuangan Pendidikan, Portal Wali, &amp; Pengajuan Bukti Bayar</span></h2>
      <p class="lead">Modul keuangan dan portal wali murid diatur melalui <code>backend/routes/member4.php</code> dan komponen <code>InvoicePages.jsx</code>. Ketika siswa atau wali murid mengunggah bukti pembayaran, sistem memvalidasi format berkas (JPG, JPEG, PNG, atau PDF maksimal 2 MB) dan menyimpannya ke penyimpanan privat server:</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">frontend/src/finance/InvoicePages.jsx</span>
          <span class="code-lang">JSX / React Finance Module</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc"><span class="kw">function</span> PaymentSubmission({ invoice, onSaved }) {</span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc">&nbsp;&nbsp;<span class="kw">const</span> [form, setForm] = useState({ payment_date: today(), payment_method: <span class="st">''</span>, transaction_number: <span class="st">''</span> });</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">&nbsp;&nbsp;<span class="kw">const</span> [proof, setProof] = useState(<span class="kw">null</span>);</span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;&nbsp;<span class="kw">async function</span> submit(e) {</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;e.preventDefault();</span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> (!proof || proof.size &gt; 2 * 1024 * 1024 || !/\.(jpe?g|png|pdf)$/i.test(proof.name)) {</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;setError(<span class="st">'Pilih bukti JPG, JPEG, PNG, atau PDF dengan ukuran maksimal 2 MB.'</span>);</span></div>
          <div class="code-line"><span class="ln">8</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span>;</span></div>
          <div class="code-line"><span class="ln">9</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;}</span></div>
          <div class="code-line"><span class="ln">10</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">const</span> data = <span class="kw">new</span> FormData();</span></div>
          <div class="code-line"><span class="ln">11</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;Object.entries({ ...form, amount: invoice.amount }).forEach(([k, v]) =&gt; data.append(k, v));</span></div>
          <div class="code-line"><span class="ln">12</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;data.append(<span class="st">'proof'</span>, proof);</span></div>
          <div class="code-line"><span class="ln">13</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">const</span> response = <span class="kw">await</span> financeApi.post(<span class="st">\`invoices/\${invoice.id}/payments\`</span>, data);</span></div>
          <div class="code-line"><span class="ln">14</span><span class="lc">&nbsp;&nbsp;&nbsp;&nbsp;onSaved(response.message);</span></div>
          <div class="code-line"><span class="ln">15</span><span class="lc">&nbsp;&nbsp;}</span></div>
          <div class="code-line"><span class="ln">16</span><span class="lc">}</span></div>
        </div>
        <div class="code-caption">Kode 1.5: Komponen pengajuan bukti pembayaran tagihan pendidikan dengan validasi tipe dan ukuran berkas.</div>
      </div>
    </div>
    <div class="page-number">3</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 4: 1.6 & 1.7 ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>1.6.</span><span>Implementasi Kode Domain &amp; Pinia Store Modul Assessment (Assessment Space Vue 3 &amp; Laravel 13)</span></h2>
      <p class="lead">Modul Assessment Pembelajaran menggunakan aturan domain terpusat pada <code>assessment-frontend/src/domain/assessment.js</code>, store <code>assessment-frontend/src/stores/assessmentStore.js</code>, serta API Laravel 13 <code>assessment-backend/</code>. Validasi status (<em>Draft</em>, <em>Terjadwal</em>, <em>Aktif</em>, <em>Ditutup</em>), pencegahan pengumpulan dobel (<em>idempotent attempt</em>), dan batas tenggat ditangani secara ketat:</p>

      <div class="code-card">
        <div class="code-header">
          <div class="code-dots"><i></i><i></i><i></i></div>
          <span class="code-path">assessment-frontend/src/domain/assessment.js</span>
          <span class="code-lang">JavaScript / Domain Model</span>
        </div>
        <div class="code-body">
          <div class="code-line"><span class="ln">1</span><span class="lc"><span class="cm"># 1. Menjalankan Sistem Utama Core AIS (Laravel Backend Port 8000 &amp; React Frontend Port 5173)</span></span></div>
          <div class="code-line"><span class="ln">2</span><span class="lc">cd backend; composer install; php artisan migrate --seed; php artisan serve --port=8000</span></div>
          <div class="code-line"><span class="ln">3</span><span class="lc">cd frontend; npm ci; npm run dev  <span class="cm"># Buka: http://localhost:5173</span></span></div>
          <div class="code-line"><span class="ln">4</span><span class="lc">&nbsp;</span></div>
          <div class="code-line"><span class="ln">5</span><span class="lc"><span class="cm"># 2. Menjalankan Assessment Space (assessment-frontend Port 4173 &amp; assessment-backend Port 8001)</span></span></div>
          <div class="code-line"><span class="ln">6</span><span class="lc">cd assessment-backend; composer install; php artisan migrate --seed; php artisan serve --port=8001</span></div>
          <div class="code-line"><span class="ln">7</span><span class="lc">cd assessment-frontend; npm ci; npm run dev  <span class="cm"># Buka: http://127.0.0.1:4173</span></span></div>
        </div>
        <div class="code-caption">Kode 1.7: Panduan eksekusi server Sistem Utama AIS (Port 5173/8000) dan Assessment Space (Port 4173/8001).</div>
      </div>

      <p class="lead">Catatan: Saat proses <code>npm run dev</code> dijalankan pada direktori <code>frontend/</code>, skrip <code>predev</code> otomatis memanggil <code>scripts/build-assessment.mjs</code> untuk memaketkan aplikasi Vue Assessment ke dalam <code>/assessment-app/</code> sehingga seluruh modul dapat diakses terpadu melalui satu alamat URL: <span class="url-link">http://localhost:5173</span>.</p>
    </div>
    <div class="page-number">4</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 5: 2.1 LOGIN AIS ==================== -->
  <section class="page">
    <div class="page-content">
      <h1 class="sec-h1"><span>2.</span><span>Manual Penggunaan Program — Administrator AIS</span></h1>
      <h2 class="sec-h2"><span>2.1.</span><span>Login Website Sistem Informasi Akademik</span></h2>
      <p class="lead">Cara masuk ke dalam website Sistem Informasi Akademik SMK Bhakti Praja Batang:</p>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Membuka Browser (Google Chrome / Mozilla Firefox / Microsoft Edge).</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Ketik URL berikut pada bilah alamat browser:<br/><span class="url-link">http://localhost:5173/login</span></span></li>
        <li><span class="s-num">3.</span><span class="s-body">Setelah memasukkan URL tersebut akan muncul tampilan halaman Login seperti berikut:</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-01-login')}" alt="Halaman Login Utama AIS SMK Bhakti Praja Batang" />
        <div class="ss-caption">Gambar 2.1: Tampilan resmi antarmuka login terintegrasi Bhakti Praja AIS.</div>
      </div>

      <ol class="steps" start="4">
        <li><span class="s-num">4.</span><span class="s-body">Pilih jenis <strong>Layanan</strong> pada menu dropdown (<em>Administrasi akademik</em>, <em>Portal wali dan keuangan pendidikan</em>, <em>Komunikasi sekolah</em>, atau <em>Assessment pembelajaran</em>), lalu masukkan <strong>Email</strong> (<code>admin@akademik.test</code>) dan <strong>Kata Sandi</strong> (<code>admin123</code>). Kemudian tekan tombol <strong>Masuk</strong>.</span></li>
        <li><span class="s-num">5.</span><span class="s-body">Jika Email, Kata Sandi, dan hak akses peran sesuai, maka pengguna akan diarahkan masuk ke halaman utama layanan yang dipilih (untuk Administrator menuju halaman <strong>Dashboard Ringkasan Akademik</strong>).</span></li>
      </ol>
    </div>
    <div class="page-number">5</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 6: 2.2 & 2.3 DASHBOARD & USERS ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>2.2.</span><span>Mengakses Dashboard Admin &amp; Ringkasan Akademik</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Setelah berhasil login sebagai Administrator, sistem menampilkan halaman <strong>Ringkasan Akademik</strong> yang memuat kartu identitas resmi SMK Bhakti Praja Batang (NPSN 20322714), statistik jumlah Siswa, Guru, Wali Murid, Kelas, Mata Pelajaran, Tahun Ajaran Aktif, serta Semester Aktif.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Admin dapat menekan tombol <strong>”Muat Ulang”</strong> di pojok kanan atas untuk menyegarkan data statistik secara langsung dari database.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-02-dashboard')}" alt="Dashboard Admin Ringkasan Akademik" />
        <div class="ss-caption">Gambar 2.2: Halaman Ringkasan Akademik Dashboard Admin dengan identitas dan metrik sekolah.</div>
      </div>

      <h2 class="sec-h2"><span>2.3.</span><span>Mengelola Data Pengguna &amp; Hak Akses Peran</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Pada navigasi sidebar bagian Data Master, klik menu <strong>”Data Pengguna”</strong> untuk mengelola akun pengguna atau klik <strong>”Hak Akses &amp; Peran”</strong> untuk melihat matriks hak akses keempat peran (admin, guru, murid, wali_murid).</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Tabel pengguna menyajikan fitur pencarian nama/email, penyaringan status (Aktif/Nonaktif) dan peran, pagination, serta aksi ubah status, edit, dan hapus akun.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-03-users')}" alt="Manajemen Data Pengguna" />
        <div class="ss-caption">Gambar 2.3: Antarmuka pengelolaan akun pengguna dan hak akses peran pada sistem AIS.</div>
      </div>
    </div>
    <div class="page-number">6</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 7: 2.3 DIALOG & 2.4 DATA MASTER ==================== -->
  <section class="page">
    <div class="page-content">
      <ol class="steps" start="3">
        <li><span class="s-num">3.</span><span class="s-body">Untuk menambahkan akun baru, tekan tombol <strong>”Tambah Pengguna”</strong> di kanan atas. Pada jendela dialog, isi Nama Lengkap, Email, Peran (<em>admin / guru / murid / wali_murid</em>), Kata Sandi (minimal 8 karakter), dan Status. Lalu klik <strong>”Simpan”</strong>.</span></li>
      </ol>

      <div class="ss-box-dialog">
        <img src="${img('ais-04-user-modal')}" alt="Dialog Tambah Pengguna" />
        <div class="ss-caption">Gambar 2.4: Formulir dialog penambahan akun pengguna dengan penetapan peran RBAC.</div>
      </div>

      <h2 class="sec-h2"><span>2.4.</span><span>Mengelola Data Master Akademik (Program Keahlian, Kurikulum, Kelas, &amp; Siswa)</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Pada bagian Data Master di sidebar, admin dapat mengelola entitas referensi resmi sekolah yang meliputi:
          <ul class="bullets">
            <li><strong>Program &amp; Konsentrasi Keahlian:</strong> Teknik Mesin (BP-TMI), Teknik Otomotif (BP-TKR &amp; BP-TSM), serta Pengembangan Perangkat Lunak dan Gim (BP-RPL).</li>
            <li><strong>Tahun Ajaran, Semester, &amp; Kalender Akademik:</strong> Periode belajar aktif (2026/2027 Ganjil) serta jadwal agenda.</li>
            <li><strong>Mata Pelajaran &amp; Kurikulum:</strong> Katalog 17 mata pelajaran referensi SMK beserta dokumen kurikulum.</li>
            <li><strong>Siswa, Guru, Wali Murid, Kelas, &amp; Ruangan:</strong> Biodata induk NIS siswa, guru (NIP/NUPTK), rombel, dan ruangan.</li>
          </ul>
        </span></li>
        <li><span class="s-num">2.</span><span class="s-body">Setiap data master dilengkapi validasi keunikan kode/nomor induk serta proteksi integritas relasi foreign-key.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-05-programs')}" alt="Data Konsentrasi Keahlian" />
        <div class="ss-caption">Gambar 2.5: Daftar konsentrasi keahlian SMK Bhakti Praja Batang beserta pemetaan program induk.</div>
      </div>
    </div>
    <div class="page-number">7</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 8: 2.5 ADMINISTRASI AKADEMIK ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>2.5.</span><span>Mengelola Administrasi Akademik (Pembagian Kelas, Beban Mengajar, Registrasi, &amp; Jadwal)</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Pada grup menu <strong>Administrasi Akademik</strong> di sidebar kiri, terdapat empat modul operasional:
          <ul class="bullets">
            <li><strong>Pembagian Kelas (<code>/class-students</code>):</strong> Menempatkan siswa ke dalam kelas/rombongan belajar pada tahun ajaran dan semester aktif.</li>
            <li><strong>Beban Mengajar (<code>/teaching-loads</code>):</strong> Menetapkan penugasan guru pengampu mata pelajaran pada kelas beserta alokasi jam mengajar mingguan (JP).</li>
            <li><strong>Registrasi Akademik (<code>/academic-registrations</code>):</strong> Memverifikasi status daftar ulang siswa per semester (<em>Pending</em>, <em>Approved</em>, <em>Rejected</em>).</li>
            <li><strong>Jadwal Pembelajaran (<code>/schedules</code>):</strong> Menyusun jadwal pelajaran harian (Senin–Sabtu), jam mulai dan selesai, ruang kelas, guru pengampu, serta mata pelajaran.</li>
          </ul>
        </span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-06-schedules')}" alt="Jadwal Pembelajaran Akademik" />
        <div class="ss-caption">Gambar 2.6: Tabel daftar jadwal pembelajaran mingguan terstruktur per kelas dan guru pengampu.</div>
      </div>

      <ol class="steps" start="2">
        <li><span class="s-num">2.</span><span class="s-body">Ketika menekan tombol <strong>”Tambah Jadwal”</strong>, sistem memuat dropdown data terelasi (Mata Pelajaran, Kelas, Guru Pengampu, Ruang Kelas, Hari, Jam Mulai, Jam Selesai, dan Status). Klik <strong>”Simpan”</strong> untuk memvalidasi jadwal.</span></li>
      </ol>

      <div class="ss-box-dialog">
        <img src="${img('ais-07-schedule-modal')}" alt="Dialog Tambah Jadwal Pembelajaran" />
        <div class="ss-caption">Gambar 2.7: Formulir pembuatan jadwal pelajaran dengan dropdown relasi kelas, ruang, dan guru.</div>
      </div>
    </div>
    <div class="page-number">8</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 9: 2.6 KEUANGAN PENDIDIKAN ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>2.6.</span><span>Mengelola Keuangan Pendidikan (Buat Tagihan, Verifikasi Pembayaran, &amp; Laporan)</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Pada sidebar grup <strong>Keuangan Pendidikan</strong>, admin dapat mengakses menu <em>Ringkasan Keuangan</em>, <em>Tagihan Pendidikan</em>, <em>Riwayat Pembayaran</em>, <em>Tagihan Belum Lunas</em>, <em>Verifikasi Pembayaran</em>, dan <em>Laporan Keuangan</em>.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Untuk menerbitkan tagihan baru kepada siswa (SPP, Ujian, Kegiatan, Buku, Seragam), buka menu <strong>”Tagihan Pendidikan”</strong> lalu klik tombol <strong>”Buat tagihan”</strong> di pojok kanan atas.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-08-invoices')}" alt="Tagihan Pendidikan Admin" />
        <div class="ss-caption">Gambar 2.8: Manajemen tagihan pendidikan siswa dengan filter jenis pembayaran dan status lunas.</div>
      </div>

      <ol class="steps" start="3">
        <li><span class="s-num">3.</span><span class="s-body">Untuk memeriksa bukti transfer yang diajukan oleh siswa atau wali murid, buka menu <strong>”Verifikasi Pembayaran”</strong>. Klik <strong>”Periksa bukti”</strong>, tinjau berkas gambar/PDF transfer, lalu tentukan keputusan dengan menekan tombol <strong>”Terima pembayaran”</strong> atau <strong>”Tolak pembayaran”</strong>. Pembayaran yang diverifikasi otomatis melunasi tagihan terkait.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-09-verification')}" alt="Verifikasi Pembayaran Admin" />
        <div class="ss-caption">Gambar 2.9: Panel antrian verifikasi bukti pembayaran transfer yang diajukan oleh siswa/wali murid.</div>
      </div>
    </div>
    <div class="page-number">9</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 10: 2.7 KOMUNIKASI SEKOLAH ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>2.7.</span><span>Mengelola Pengumuman Sekolah &amp; Pusat Notifikasi</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Pada sidebar grup <strong>Komunikasi Sekolah</strong>, klik menu <strong>”Pengumuman”</strong> (<code>/communication/announcements</code>). Halaman ini menampilkan seluruh pengumuman aktif dengan label target audiens yang dituju.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Admin dapat menerbitkan surat edaran atau pengumuman resmi baru dengan mengeklik tombol <strong>”Buat pengumuman”</strong> pada pojok kanan atas halaman.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('ais-10-announcements')}" alt="Pengumuman Komunikasi Sekolah" />
        <div class="ss-caption">Gambar 2.10: Daftar pengumuman resmi sekolah dengan target peran dan kontrol pengeditan.</div>
      </div>

      <ol class="steps" start="3">
        <li><span class="s-num">3.</span><span class="s-body">Pada jendela dialog <strong>”Buat Pengumuman”</strong>, masukkan Judul pengumuman, pilih Penerima (<em>Semua peran, Administrator, Guru, Siswa,</em> atau <em>Wali murid</em>), dan tulis Isi pengumuman. Klik <strong>”Simpan pengumuman”</strong>.</span></li>
        <li><span class="s-num">4.</span><span class="s-body">Pengumuman otomatis memicu notifikasi <em>in-app</em> pada portal setiap akun penerima di menu <strong>”Pusat Notifikasi”</strong>.</span></li>
      </ol>

      <div class="ss-box-dialog">
        <img src="${img('ais-11-announcement-modal')}" alt="Formulir Buat Pengumuman" />
        <div class="ss-caption">Gambar 2.11: Dialog pembuatan pengumuman baru dengan pemilihan segmentasi peran penerima.</div>
      </div>
    </div>
    <div class="page-number">10</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 11: 3.1 & 3.2 WALI MURID ==================== -->
  <section class="page">
    <div class="page-content">
      <h1 class="sec-h1"><span>3.</span><span>Manual Penggunaan Program — Wali Murid (Portal Wali &amp; Keuangan)</span></h1>
      <h2 class="sec-h2"><span>3.1.</span><span>Memantau Informasi Akademik &amp; Jadwal Pelajaran Anak</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Wali murid login pada alamat <span class="url-link">http://localhost:5173/login</span> dengan memilih layanan <strong>”Portal wali dan keuangan pendidikan”</strong> menggunakan email wali yang terdaftar (misal: <code>agus@akademik.test</code>).</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Pada bagian atas halaman <strong>Dashboard Wali</strong> (<code>/parent</code>), pilih nama siswa pada dropdown <strong>”Anak yang dipantau”</strong> apabila memiliki lebih dari satu anak bersekolah di SMK Bhakti Praja Batang.</span></li>
        <li><span class="s-num">3.</span><span class="s-body">Wali dapat memantau ringkasan Jadwal Pelajaran, Tagihan Pendidikan, Sisa Tagihan, serta modul informasi akademik anak secara <em>real-time</em>.</span></li>
      </ol>

      <h2 class="sec-h2"><span>3.2.</span><span>Mengajukan Bukti Pembayaran Tagihan Pendidikan</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Buka menu <strong>”Tagihan Pendidikan”</strong> pada sidebar Portal Wali, lalu klik tombol <strong>”Detail”</strong> pada tagihan yang berstatus <em>Belum lunas</em>.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Pada formulir <strong>”Ajukan Pembayaran”</strong>, isi Tanggal pembayaran, Metode pembayaran (contoh: <em>Transfer Bank BPD Jateng / BRI</em>), Nomor transaksi referensi, dan unggah foto/PDF bukti bayar (maks. 2 MB). Klik tombol <strong>”Kirim bukti pembayaran”</strong> untuk mengirim pengajuan ke tim keuangan sekolah.</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('ais-12-parent-dashboard')}" alt="Dashboard Portal Wali Murid" />
          <div class="ss-caption">Gambar 3.1: Dashboard Portal Wali Murid.</div>
        </div>
        <div class="ss-box">
          <img src="${img('ais-14-parent-invoice-detail')}" alt="Detail Tagihan & Pembayaran Wali" />
          <div class="ss-caption">Gambar 3.2: Formulir pengajuan bukti bayar wali.</div>
        </div>
      </div>
    </div>
    <div class="page-number">11</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 12: 4.1 & 4.2 GURU ASSESSMENT ==================== -->
  <section class="page">
    <div class="page-content">
      <h1 class="sec-h1"><span>4.</span><span>Manual Penggunaan Program — Guru (Web Assessment Space)</span></h1>
      <h2 class="sec-h2"><span>4.1.</span><span>Mengakses Ringkasan Assessment &amp; Statistik Nilai Kelas</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Guru membuka web assessment di <span class="url-link">http://127.0.0.1:4173/#/login</span> (atau melalui menu <em>Assessment</em> pada AIS Utama). Masuk dengan email <code>teacher@example.test</code> (kata sandi <code>DemoPassword123!</code>) atau klik pill <strong>Pengajar</strong>.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Sistem menampilkan antarmuka terdedikasi <strong>Assessment Space SMK Bhakti Praja Batang</strong> dengan sidebar navigasi (<em>Home, Assessment, Bank soal, Hasil &amp; penilaian</em>), kartu ringkasan <strong>Assessment aktif</strong>, <strong>Perlu dinilai</strong>, daftar <strong>Perlu dicek</strong>, serta panel <strong>Tenggat terdekat</strong>.</span></li>
      </ol>

      <h2 class="sec-h2"><span>4.2.</span><span>Melihat Daftar Assessment &amp; Filter Status (Aktif, Terjadwal, Draft, Ditutup)</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Buka menu <strong>”Assessment”</strong> pada sidebar. Halaman ini memuat seluruh instrumen kuis, tugas, dan ujian yang telah dibuat oleh guru pengampu.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Gunakan tab filter status (<strong>Semua, Draft, Aktif, Terjadwal, Ditutup</strong>) dan bilah pencarian untuk menyaring instrumen evaluasi.</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('as-02-guru-home')}" alt="Dashboard Home Pengajar Assessment Space" />
          <div class="ss-caption">Gambar 4.1: Tampilan Home Pengajar Assessment Space.</div>
        </div>
        <div class="ss-box">
          <img src="${img('as-03-guru-daftar')}" alt="Daftar Assessment Pengajar" />
          <div class="ss-caption">Gambar 4.2: Daftar instrumen assessment & filter status.</div>
        </div>
      </div>
    </div>
    <div class="page-number">12</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 13: 4.3 BUILDER ASSESSMENT ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>4.3.</span><span>Menyusun Kuis/Ujian dengan Editor Builder 4 Langkah</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Tekan tombol <strong>”+ Buat assessment”</strong> di kanan atas. Sistem membuka editor <strong>Assessment Builder</strong> dengan 4 tahap terstruktur (<strong>1. Identitas, 2. Konten, 3. Pengaturan, 4. Preview</strong>).</span></li>
        <li><span class="s-num">2.</span><span class="s-body"><strong>Tahap 1 (Identitas):</strong> Masukkan Judul assessment, Jenis assessment (<em>Kuis, Tugas, Ujian</em>), Mata pelajaran, Kelas sasaran, dan Deskripsi instruksional, lalu klik <strong>”Lanjutkan →”</strong>.</span></li>
        <li><span class="s-num">3.</span><span class="s-body"><strong>Tahap 2 (Konten):</strong> Masukkan instruksi pengerjaan, pertanyaan butir soal, opsi jawaban (A, B, C, D), tandai radio pilihan kunci jawaban yang benar, serta bobot poin. Guru dapat menekan <strong>”+ Soal manual”</strong>, <strong>”📖 Dari bank soal”</strong>, atau <strong>”✨ Bantu dengan AI”</strong>.</span></li>
        <li><span class="s-num">4.</span><span class="s-body"><strong>Tahap 3 &amp; 4 (Pengaturan &amp; Preview):</strong> Tentukan jadwal waktu buka, batas tenggat waktu tutup, durasi pengerjaan, kebijakan rilis nilai, lalu tinjau pratinjau sebelum menekan tombol <strong>”Terbitkan assessment”</strong>.</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('as-05-builder-identitas')}" alt="Tahap 1 Identitas Assessment Builder" />
          <div class="ss-caption">Gambar 4.3: Tahap 1 Identitas Assessment Builder.</div>
        </div>
        <div class="ss-box">
          <img src="${img('as-06-builder-konten')}" alt="Tahap 2 Susun Konten Soal Builder" />
          <div class="ss-caption">Gambar 4.4: Tahap 2 Penyusunan butir soal & opsi.</div>
        </div>
      </div>
    </div>
    <div class="page-number">13</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 14: 4.4 BANK SOAL & 4.5 PENILAIAN ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>4.4.</span><span>Mengelola Bank Soal &amp; Penggunaan Kembali Soal Ujian</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Buka menu <strong>”Bank soal”</strong> (<code>#/bank</code>) pada sidebar. Guru dapat melihat repositori butir soal yang terorganisir rapi per mata pelajaran (Jaringan Komputer, Basis Data, Sistem Operasi).</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Guru dapat menekan tombol <strong>”Lihat soal”</strong> untuk memeriksa detail kunci pembahasan atau mengeklik <strong>”Gunakan soal”</strong> untuk langsung menyematkan soal tersebut ke kuis baru tanpa mengetik ulang.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('as-10-bank-soal')}" alt="Koleksi Bank Soal Pengajar" />
        <div class="ss-caption">Gambar 4.5: Repositori bank soal terstandar SMK Bhakti Praja Batang dengan opsi pemanfaatan instan.</div>
      </div>

      <h2 class="sec-h2"><span>4.5.</span><span>Memeriksa Hasil Pengumpulan, Menilai Tugas Siswa, &amp; Merilis Nilai</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Buka menu <strong>”Hasil &amp; penilaian”</strong> (<code>#/results</code>). Sistem menampilkan daftar evaluasi, progres penilaian, dan tombol aksi <strong>”Nilai tugas”</strong> bagi pengumpulan yang menunggu koreksi.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Pada antarmuka <code>AssignmentGradeView</code>, guru dapat mengunduh berkas laporan tugas siswa, membaca instruksi, memberikan <strong>Nilai (0–100)</strong>, serta menuliskan <strong>Feedback</strong> pembimbingan sebelum menekan <strong>”Simpan penilaian”</strong> atau <strong>”Simpan &amp; nilai berikutnya”</strong>.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('as-13-guru-pengumpulan')}" alt="Halaman Penilaian Pengumpulan Tugas Siswa" />
        <div class="ss-caption">Gambar 4.6: Antarmuka evaluasi tugas siswa, pengunduhan berkas, penilaian angka, dan feedback tertulis.</div>
      </div>
    </div>
    <div class="page-number">14</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 15: 5.1, 5.2, 5.3 SISWA ==================== -->
  <section class="page">
    <div class="page-content">
      <h1 class="sec-h1"><span>5.</span><span>Manual Penggunaan Program — Peserta Didik / Siswa (Assessment Space)</span></h1>
      <h2 class="sec-h2"><span>5.1.</span><span>Melihat Daftar Assessment Saya &amp; Membaca Petunjuk</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Siswa masuk melalui halaman <span class="url-link">http://127.0.0.1:4173/#/login</span> dengan memilih pill <strong>Peserta (student1@example.test)</strong> dan kata sandi <code>DemoPassword123!</code>.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Halaman <strong>”Assessment saya”</strong> (<code>#/student</code>) menampilkan kartu evaluasi yang sedang aktif dengan rincian kelas, mata pelajaran, tenggat waktu, jumlah soal, dan durasi pengerjaan.</span></li>
        <li><span class="s-num">3.</span><span class="s-body">Klik tombol <strong>”Lihat petunjuk →”</strong> pada kartu assessment yang akan dikerjakan untuk membuka lembar informasi aturan ujian.</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('as-14-siswa-home')}" alt="Halaman Assessment Saya Ruang Siswa" />
          <div class="ss-caption">Gambar 5.1: Daftar kartu assessment aktif siswa.</div>
        </div>
        <div class="ss-box">
          <img src="${img('as-15b-siswa-petunjuk-siap')}" alt="Petunjuk Pengerjaan & Persetujuan Mandiri" />
          <div class="ss-caption">Gambar 5.2: Verifikasi persetujuan pengerjaan mandiri.</div>
        </div>
      </div>

      <h2 class="sec-h2"><span>5.2.</span><span>Mengerjakan Ujian Berwaktu (Timer, Tandai Ragu, &amp; Navigasi Nomor Soal)</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Centang kotak <em>”Saya sudah baca petunjuk dan siap mengerjakan secara mandiri”</em>, kemudian tekan tombol <strong>”Mulai assessment”</strong> untuk memasuki ruang ujian (<code>#/attempt/:id</code>).</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Pilih opsi jawaban yang benar (A, B, C, D). Jawaban disimpan otomatis secara persisten ke browser per detik. Tombol <strong>”Tandai ragu”</strong> menyematkan tanda titik kuning pada kisi nomor soal. Panel samping menampilkan penghitung waktu mundur <strong>Sisa waktu</strong> dan navigasi nomor soal.</span></li>
      </ol>

      <div class="ss-box">
        <img src="${img('as-16-siswa-attempt-soal')}" alt="Ruang Ujian Berwaktu Siswa" />
        <div class="ss-caption">Gambar 5.3: Antarmuka ruang ujian berwaktu dengan timer mundur, opsi jawaban, dan kisi navigasi soal.</div>
      </div>
    </div>
    <div class="page-number">15</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

  <!-- ==================== PAGE 16: 5.4, 5.5, 5.6 REVIEW & TUGAS ==================== -->
  <section class="page">
    <div class="page-content">
      <h2 class="sec-h2"><span>5.3.</span><span>Konfirmasi Pengiriman &amp; Penerimaan Hasil Ujian</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Setelah seluruh soal selesai dijawab, tekan tombol <strong>”Cek &amp; kirim”</strong>. Sistem menampilkan dialog rekapitulasi status pengerjaan sebelum jawaban dikirimkan secara final ke server.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Setelah menekan tombol <strong>”Kirim sekarang”</strong>, sistem menampilkan halaman tanda terima (<code>AttemptReviewView</code>) yang menyajikan total skor (misal: <strong>90/100</strong>), umpan balik guru, serta pembahasan rincian soal.</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('as-18-siswa-attempt-confirm')}" alt="Dialog Konfirmasi Pengiriman Ujian" />
          <div class="ss-caption">Gambar 5.4: Dialog konfirmasi final pengiriman ujian.</div>
        </div>
        <div class="ss-box">
          <img src="${img('as-19-siswa-attempt-selesai')}" alt="Halaman Bukti Tanda Terima & Skor Ujian" />
          <div class="ss-caption">Gambar 5.5: Lembar tanda terima pengiriman dan skor.</div>
        </div>
      </div>

      <h2 class="sec-h2"><span>5.4.</span><span>Pengumpulan Berkas Tugas Praktikum &amp; Riwayat Hasil Saya</span></h2>
      <ol class="steps">
        <li><span class="s-num">1.</span><span class="s-body">Untuk assessment bertipe <strong>Tugas</strong>, ruang pengerjaan menyediakan form unggah berkas laporan (PDF, DOCX, JPG, PNG maksimal 2 MB). Setelah berkas terpilih, klik tombol <strong>”Kirim tugas”</strong>.</span></li>
        <li><span class="s-num">2.</span><span class="s-body">Siswa dapat memantau seluruh riwayat pengerjaan, tanggal submit, status kelulusan, dan skor yang telah dirilis oleh guru melalui menu <strong>”Hasil saya”</strong> (<code>#/my-results</code>).</span></li>
      </ol>

      <div class="ss-grid-2">
        <div class="ss-box">
          <img src="${img('as-20-siswa-tugas-upload')}" alt="Form Pengumpulan File Tugas Siswa" />
          <div class="ss-caption">Gambar 5.6: Pengunggahan berkas tugas praktikum.</div>
        </div>
        <div class="ss-box">
          <img src="${img('as-21-siswa-hasil-saya')}" alt="Menu Riwayat Hasil Saya Siswa" />
          <div class="ss-caption">Gambar 5.7: Tabel riwayat nilai pada menu Hasil saya.</div>
        </div>
      </div>
    </div>
    <div class="page-number">16</div>
    <svg class="corner-wave" viewBox="0 0 200 140"><path d="M0,140 C80,135 120,80 200,30 L200,140 Z" fill="#f59e0b"/><path d="M40,140 C110,130 150,70 200,10 L200,140 Z" fill="#1e3a8a"/></svg>
  </section>

</body>
</html>
`;

const htmlOut = path.resolve('Manual-Book-Bhakti-Praja-AIS.html');
fs.writeFileSync(htmlOut, html, 'utf8');
console.log('Saved HTML to', htmlOut);

// Render PDF with Puppeteer
console.log('Rendering PDF via Puppeteer...');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
});
const page = await browser.newPage();
await page.goto('file:///' + htmlOut.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
const pdfOut = path.resolve('Manual-Book-Bhakti-Praja-AIS.pdf');
await page.pdf({
  path: pdfOut,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('Saved PDF to', pdfOut);

