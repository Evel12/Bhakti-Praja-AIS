"""Build the reviewable HTML, original screenshots and JSON evidence ZIP."""
from pathlib import Path
import datetime as dt
import hashlib
import html
import json
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'deliverables/pengujian_core_ais_finance'
SOURCE=ROOT/'.tools/browserstack/results/core-finance'
DATE=dt.datetime.now().strftime('%Y-%m-%d')


def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def esc(value):return html.escape(str(value))
def table(headers,rows):
    return '<div class="table"><table><thead><tr>'+''.join('<th>'+esc(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(x)+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>'


CAPTIONS={
 'core-dashboard':('Dashboard Akademik','Ringkasan data akademik berhasil dibuka setelah login admin.'),
 'core-students':('Data Siswa','Daftar siswa terisi data sintetis. Endpoint daftar diverifikasi mengembalikan HTTP 200.'),
 'core-classrooms':('Data Kelas','Daftar kelas terisi dan relasi data akademik dapat dibaca.'),
 'core-schedules':('Jadwal Pembelajaran','Jadwal akademik terisi, sehingga pemeriksaan tidak hanya mengukur daftar kosong.'),
 'core-academic-registrations':('Registrasi Akademik','Data registrasi sintetis berhasil dimuat pada UI dan API.'),
 'core-created':('Pembuatan Program Keahlian','Program keahlian sintetis dibuat melalui UI dan keberadaannya diperiksa melalui API. Alur berikutnya menguji perubahan, validasi kode duplikat dan penghapusan data uji tersebut.'),
 'finance-dashboard':('Ringkasan Keuangan','Dashboard finance memuat jumlah tagihan, pembayaran terverifikasi, sisa tagihan dan pengajuan pending.'),
 'finance-invoice-created':('Pembuatan Tagihan','Admin membuat tagihan sintetis sebesar Rp150.000 melalui UI. Alur berikutnya memeriksa perubahan menjadi Rp151.000 sebelum ada pembayaran.'),
 'finance-parent-invoice':('Tagihan Milik Anak','Wali yang terhubung dapat melihat tagihan anak sintetis. Permintaan ke tagihan siswa lain diperiksa terpisah dan harus ditolak dengan HTTP 404.'),
 'finance-payment-pending':('Pembayaran Menunggu Verifikasi','PNG sintetis dipasok ke input file menggunakan File dan DataTransfer, lalu dikirim melalui form multipart aplikasi. Ini tidak menguji dialog pemilih file OS. Tagihan harus tetap memiliki sisa Rp151.000 selama status pembayaran pending.'),
 'finance-payment-verified':('Pembayaran Diterima','Admin menerima pengajuan melalui UI. API memverifikasi tagihan lunas dengan sisa nol. Penerimaan ulang yang sama harus idempotent, sedangkan perubahan keputusan yang bertentangan ditolak.'),
 'finance-report':('Laporan Keuangan','Laporan memuat pembayaran terverifikasi. Jumlah terverifikasi pada tagihan yang diuji diperiksa tepat Rp151.000 satu kali; agregat sekolah dapat meningkat lebih banyak karena profil lain juga memakai data sintetis terpisah.'),
 'finance-student-paid':('Tagihan Lunas pada Akun Siswa','Siswa yang berhak melihat status lunas. Akses ke tagihan siswa lain tetap diperiksa dan ditolak.'),
 'core-failure':('Bukti Kegagalan Core AIS','Screenshot asli diambil ketika alur Core AIS berhenti atau menemukan kegagalan. Lihat rincian temuan dan daftar pemeriksaan yang berhasil diselesaikan.'),
 'finance-failure':('Bukti Kegagalan Finance','Screenshot asli diambil ketika alur finance berhenti atau menemukan kegagalan. Hasil ini tidak diperlakukan sebagai lulus walaupun langkah sebelumnya berhasil.')}
CSS='body{font:16px/1.6 Georgia,serif;max-width:1100px;margin:36px auto;padding:0 24px;color:#19242d}h1,h2,h3,figcaption{font-family:Arial,sans-serif;line-height:1.4}h2{margin-top:38px}h3{margin-top:28px}table{border-collapse:collapse;width:100%;font:14px/1.5 Arial,sans-serif}th,td{border:1px solid #ccc;padding:9px;text-align:left}th{background:#eef1f3}.table{overflow:auto}figure{margin:26px 0}img{display:block;max-width:100%;height:auto;border:1px solid #ddd;margin-top:12px}a{color:#12548a}li{margin:6px 0}code{overflow-wrap:anywhere}@media print{figure{break-inside:avoid}img{max-height:240mm;object-fit:contain}h2,h3,figcaption{break-after:avoid}}'


def main():
    browser=read(SOURCE/'results.json')
    cloud=read(ROOT/f'docs/performance/core-finance-k6-{DATE}.json')
    resource=read(ROOT/'.tools/browserstack/results/resources-core-finance.json')
    assert len(browser['results'])==9,'All nine requested browser profiles must be attempted before packaging.'
    assert all(r['status']!='running' for r in browser['results']),'Wait for active browser sessions before packaging.'
    assert len(cloud['runs'])==6,'All six load runs must be present.'
    assert all(r['cloud']['status'] in ['completed','aborted'] for r in cloud['runs']),'Wait for final cloud processing.'
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'data').mkdir(exist_ok=True)
    manifest=[]
    for module,title in [('core','Core AIS'),('finance','Finance')]:
        shots=OUT/'screenshots'/module;shots.mkdir(parents=True,exist_ok=True)
        content=[f'<h1>Hasil Pengujian {title}</h1>',f'<p>Tanggal pengujian {DATE}. Data, akun dan penyimpanan sintetis terpisah dari aplikasi utama. Kode fitur aplikasi dan assessment tidak diubah.</p>']
        module_rows=[r for r in cloud['runs'] if r['module']==module]
        content+=['<h2>Pengujian Beban Grafana k6</h2>',
          '<p>Eksekusi k6 berlangsung lokal dan metrik dikirim ke Grafana Cloud. Beban dinaikkan selama 10 detik, dipertahankan 30 detik, lalu diturunkan 5 detik. Akun dan token berbeda digunakan per pengguna virtual. Run k6 selesai sebelum pengujian browser dimulai. Ambang sementara adalah p95 kurang dari 2.000 ms, p99 kurang dari 5.000 ms, dan tingkat kegagalan HTTP/aplikasi serta HTTP 429 kurang dari 1 persen.</p>',
          '<p>Core AIS menguji perjalanan baca admin pada dashboard, siswa, kelas, jadwal, registrasi dan program keahlian. Finance menguji ringkasan, daftar/detail tagihan, daftar/detail pembayaran atau laporan admin serta unduhan bukti PNG kecil. Finance memakai kombinasi admin, siswa dan wali; jumlah tiap peran dicatat di JSON.</p>',
          table(['VU','Request','Rata-rata ms','p95 ms','p99 ms','Gagal HTTP','Grafana Cloud'],[[r['users'],r['requests'],f"{r['response_ms']['avg']:.2f}",f"{r['response_ms']['p(95)']:.2f}",f"{r['response_ms']['p(99)']:.2f}",f"{r['http_failure_rate']:.2%}",r['cloud']['status']+'/'+str(r['cloud']['result'])] for r in module_rows])]
        count=0

        def image(source,label,description,url=None,provenance='BrowserStack W3C screenshot'):
            nonlocal count
            count+=1;target=shots/source.name
            shutil.copyfile(source,target)
            relative=target.relative_to(OUT).as_posix()
            manifest.append({'module':module,'figure':count,'file':relative,'caption':label,'description':description,'source_url':url,'provenance':provenance,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
            block=f'<figure><figcaption><strong>Gambar {count}. {esc(label)}</strong></figcaption><p>{esc(description)}</p><a href="{relative}"><img loading="lazy" src="{relative}" alt="{esc(label)}"></a></figure>'
            if url:block+=f'<p><a href="{esc(url)}">Buka sesi atau run sumber</a></p>'
            content.append(block)

        for r in module_rows:
            roles=', '.join(f"{count} {dict(admin='admin',murid='siswa',wali_murid='wali').get(role,role)}" for role,count in r['role_counts'].items())
            content.append(f"<h3>{r['users']} Pengguna Bersamaan</h3><p>VU maksimum teramati {r['max_observed_vus']}. Komposisi peran: {esc(roles)}. Tingkat kegagalan aplikasi {r['application_failure_rate']:.2%}; HTTP 429 {r['rate_limited_rate']:.2%}. p95 berarti 95 persen request selesai pada nilai tersebut atau lebih cepat. Status dan hasil cloud diverifikasi melalui API Grafana, bukan sekadar akses halaman dashboard.</p>")
            for suffix,label,explain in [('overview','Overview','Grafik memperlihatkan perubahan VU, laju request dan durasi sepanjang run.'),('timings','Rincian Waktu HTTP','Bagian ini memperlihatkan durasi HTTP, kegagalan request, waktu tunggu, pengiriman, penerimaan dan koneksi.'),('summary','Ringkasan Metrik','Tabel menunjukkan agregat metrik dan pemeriksaan. Angka presisi pada laporan diambil dari JSON summary; angka screenshot dapat dibulatkan.'),('full','Laporan Utuh','Screenshot utuh dari Overview sampai Summary. Versi per bagian disertakan agar angka tetap terbaca.')]:
                image(ROOT/f'.tools/k6/results/core-finance-screenshots/{module}-{r["users"]}-{suffix}.png',f'{title} {r["users"]} VU {label}',explain+' Gambar berasal dari laporan HTML hasil run yang dikirim ke Grafana Cloud, bukan screenshot antarmuka web Grafana Cloud.',r['cloud']['url'],'k6 exported HTML report capture')
        content+=['<h2>Pengujian Fungsi dan Kompatibilitas BrowserStack</h2>',
          '<p>Sembilan profil memakai browser cloud Windows/macOS serta perangkat Android dan iOS nyata. Ukuran layar PC/laptop adalah profil jendela browser cloud, bukan verifikasi merek atau spesifikasi laptop fisik. Tiap profil memakai akun sendiri agar token tidak saling membatalkan. Status modul dibedakan dari status sesi provider karena satu sesi menguji dua modul.</p>',
          table(['Profil','Hasil modul','Pemeriksaan selesai','Status sesi provider'],[[r['profile'],r['module_status'][module],sum(x['module']==module for x in r['checks']),r.get('provider',{}).get('status','Belum terverifikasi')] for r in browser['results']])]
        for r in browser['results']:
            provider=r.get('provider',{})
            platform=' / '.join(str(provider[k]) for k in ['os','os_version','device','browser','browser_version'] if provider.get(k))
            content.append(f'<h3>{esc(r["profile"])}</h3><p>Hasil modul: <strong>{esc(r["module_status"][module])}</strong>. Platform terverifikasi: {esc(platform or "Tidak tersedia")}. Status provider: {esc(provider.get("status","Belum terverifikasi"))}. Sesi: {esc(r.get("session_id","Tidak terbentuk"))}.</p>')
            checks=[x['name'] for x in r['checks'] if x['module']==module]
            content.append('<p>Pemeriksaan yang selesai:</p><ul>'+''.join('<li>'+esc(c)+'</li>' for c in checks)+'</ul>')
            findings=[f for f in r['findings'] if f['module']==module]
            for finding in findings:content.append('<p><strong>Temuan:</strong> '+esc(finding['description'])+'</p>')
            if r.get('error'):content.append('<p><strong>Kesalahan sesi:</strong> '+esc(r['error'])+'</p>')
            if module=='finance' and r.get('default_payment_date'):
                date=r['default_payment_date']
                content.append('<p>Tanggal pembayaran awal: '+esc(date['value'] or 'Kosong')+'. Validasi input: '+('valid' if date['valid'] else 'tidak valid')+'. Batas maksimum: '+esc(date['max'])+'. Jika tidak valid, temuan tetap membuat hasil modul gagal; tanggal ISO eksplisit hanya dipakai untuk meneruskan pemeriksaan alur berikutnya.</p>')
            for s in r['screenshots']:
                if s['module']!=module:continue
                label,description=CAPTIONS.get(s['label'],(s['label'],'Screenshot asli dari tahap yang disebutkan.'))
                image(SOURCE/s['file'],label+' pada '+r['profile'],description,r.get('dashboard_url'))
        content+=['<h2>Batas CPU dan Memori Browser Lokal</h2>',
          '<p>Chrome dijalankan pada Windows Job Object dengan affinity 1/2/4 CPU logis dan batas committed memory agregat 512/1024/2048 MiB pada pohon proses browser. Batas diverifikasi melalui API Windows. Ini bukan emulasi merek CPU atau kapasitas RAM fisik; backend dan server lain tidak dibatasi. Profil sumber daya memakai pemeriksaan baca UI/API yang lebih singkat, bukan seluruh alur CRUD dan pembayaran cloud.</p>',
          table(['CPU logis','Batas commit MiB','Puncak commit MiB','Hasil keseluruhan','Hasil modul'],[[r['logical_cpu_limit'],r['committed_memory_limit_mib'],r.get('peak_job_committed_memory_mib','Tidak tersedia'),r['status'],r.get('module_status',{}).get(module,'Tidak selesai')] for r in resource['results']])]
        host=resource.get('host',{})
        if host.get('cpu_model'):
            content.append(f"<p>Host pengujian: {esc(host['cpu_model'].strip())}, {host['logical_processors']} CPU logis, RAM fisik terdeteksi {host['physical_ram_bytes']/1024**3:.2f} GiB. Batas pada tabel hanya diterapkan pada proses browser baru dan turunannya.</p>")
        for r in resource['results']:
            if r.get('error'):content.append('<p>Temuan profil sumber daya: '+esc(r['error'])+'</p>')
            for s in r.get('screenshots',[]):
                if s['module']==module:image(ROOT/'.tools/browserstack/results'/s['file'],f'{title} pada {r["logical_cpu_limit"]} CPU dan {r["committed_memory_limit_mib"]} MiB','Screenshot dari browser lokal dengan batas proses yang diverifikasi, bukan perangkat cloud.',provenance='Local constrained Chrome screenshot')
        content+=['<h2>Batas Interpretasi</h2>',
          '<p>Hasil berlaku untuk skenario dan lingkungan yang dicatat. Pengujian beban merupakan baseline lokal berdurasi singkat, bukan kapasitas produksi atau uji ketahanan jangka panjang. Tidak ada login massal, transaksi bank nyata, payment gateway, pengiriman pengingat, inferensi AI atau perubahan assessment. Alur browser memakai UI dan pemeriksaan API secara gabungan; pemeriksaan negatif 403/404/409/422 yang diharapkan tidak termasuk kegagalan pada beban k6 baca normal. WebDriver tidak mengumpulkan seluruh exception JavaScript dan event HTTP 5xx; hanya respons API dan keadaan UI yang tercantum yang diperiksa. Lihat JSON untuk pemeriksaan individual dan temuan lengkap.</p>',
          '<p>Jika satu tahap gagal, tahap sesudahnya pada modul tersebut tidak dianggap teruji. Hasil lulus pada perangkat lain tidak membatalkan temuan. Setiap PNG disimpan dalam resolusi aslinya dan memiliki SHA-256 pada evidence-manifest.json.</p>']
        (OUT/('core_ais.html' if module=='core' else 'finance.html')).write_text('<!doctype html><html lang="id"><meta charset="utf-8"><title>'+title+'</title><style>'+CSS+'</style><body>'+''.join(content)+'</body></html>',encoding='utf-8')
    for name,data in [('grafana-k6.json',cloud),('browserstack.json',browser),('resources.json',resource)]:
        (OUT/'data'/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    overview=table(['Modul','Run k6 lulus','Profil BrowserStack lulus'],[[name,str(sum(r['local_passed'] and r['cloud']['result']=='passed' for r in cloud['runs'] if r['module']==key))+'/3',str(sum(r['module_status'][key]=='passed' for r in browser['results']))+'/9'] for key,name in [('core','Core AIS'),('finance','Finance')]])
    (OUT/'index.html').write_text('<!doctype html><html lang="id"><meta charset="utf-8"><title>Hasil Pengujian Core AIS dan Finance</title><style>'+CSS+'</style><body><h1>Hasil Pengujian Core AIS dan Finance</h1><p>Tanggal '+DATE+'. Paket berisi laporan, screenshot asli dengan penjelasan, tautan sesi/run dan data JSON. Ekstrak ZIP sebelum membuka laporan agar gambar relatif dapat dimuat.</p>'+overview+'<p><a href="core_ais.html">Buka laporan Core AIS</a></p><p><a href="finance.html">Buka laporan Finance</a></p><p>Nomor hasil di atas hanya mencakup skenario yang dijalankan; bukan klaim seluruh fitur aplikasi telah lulus. Kode fitur dan assessment tidak diubah.</p></body></html>',encoding='utf-8')
    (OUT/'README.txt').write_text('Ekstrak ZIP, lalu buka index.html. Laporan terpisah ada pada core_ais.html dan finance.html. Semua gambar PNG asli ada di screenshots. Data hasil dan status provider ada di data. Gambar k6 berasal dari ekspor HTML hasil run yang dikirim ke Grafana Cloud; tautan run aslinya tersedia. Tidak ada kredensial, password atau token dalam paket.\n',encoding='utf-8')
    (OUT/'reproduction.md').write_text('# Reproduksi dari repository proyek\n\nJalankan dari E:/final dengan koneksi BrowserStack dan Grafana yang sudah disimpan lokal. Jangan membagikan file kredensial.\n\n```powershell\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/start-local.ps1\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/performance/seed-core-finance.ps1\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/performance/run-core-finance.ps1\npython tests/performance/report-core-finance.py\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -CoreFinance -Parallel 3\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/verify-core-finance.ps1\npython tests/browserstack/resources.py --module core-finance\nnode tests/performance/capture-core-finance.cjs\npython tests/performance/package-core-finance.py\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/stop-local.ps1\n```\n',encoding='utf-8')
    summary=['# Core AIS and Finance browser/device results','',
             'Nine requested W3C BrowserStack profiles; separate accounts; synthetic database/storage. Representative Core CRUD and finance payment workflows, not exhaustive coverage of all features. Assessment and application source unchanged.','',
             '| Profile | Core AIS | Finance | Provider session |','|---|---|---|---|']
    for r in browser['results']:
        summary.append(f"| {r['profile']} | {r['module_status']['core']} | {r['module_status']['finance']} | [{r.get('provider',{}).get('status','unverified')}]({r.get('dashboard_url','')}) |")
    for r in browser['results']:
        for f in r['findings']:summary+=['',f"- {r['profile']} / {f['module']}: {f['description']}"]
    summary+=['',f'Packaged {len(manifest)} original screenshot figures with captions, source links and SHA-256 provenance. Resource tests use verified process CPU affinity and committed-memory caps; they do not emulate physical hardware.']
    (ROOT/f'docs/testing/core-finance-{DATE}.md').write_text('\n'.join(summary)+'\n',encoding='utf-8')
    target=OUT.parent/'hasil_pengujian_core_ais_finance.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(OUT.rglob('*')):
            if file.is_file():z.write(file,file.relative_to(OUT))
    print(f'Packaged {len(manifest)} screenshots: {target}')


if __name__=='__main__':main()
