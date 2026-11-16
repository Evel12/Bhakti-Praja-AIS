const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const runtime=path.join(root,'.tools/uptime');
const hours=Number(process.argv.find(a=>a.startsWith('--hours='))?.slice(8)||24);
const interval=Number(process.argv.find(a=>a.startsWith('--interval='))?.slice(11)||60);
if(!Number.isFinite(hours)||hours<=0||!Number.isFinite(interval)||interval<15)throw Error('Invalid duration or interval.');
const credentials=JSON.parse(fs.readFileSync(path.join(runtime,'probe-credentials.json'),'utf8'));
const started=new Date();const end=started.getTime()+hours*3600000;
const runId=started.toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'deliverables/uptime',runId);fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4178';
const checks=[
 {name:'frontend',route:'/login',type:'html'},
 {name:'backend',route:'/up',type:'health'},
 {name:'core_dashboard',route:'/api/dashboard',actor:'admin',type:'json'},
 {name:'core_students_data',route:'/api/students',actor:'admin',type:'list'},
 {name:'core_schedules_data',route:'/api/schedules',actor:'admin',type:'list'},
 {name:'lms_course_data',route:`/api/lms/courses/${credentials.course_id}`,actor:'student',type:'json'},
 {name:'lms_pdf_storage',route:`/api/lms/materials/${credentials.material_id}/download`,actor:'student',type:'pdf'},
 {name:'finance_summary',route:'/api/member4/finance/summary',actor:'admin',type:'json'},
 {name:'finance_invoice_data',route:`/api/member4/invoices/${credentials.invoice_id}`,actor:'admin',type:'json'},
 {name:'finance_proof_storage',route:`/api/member4/payments/${credentials.payment_id}/proof`,actor:'admin',type:'png'},
];
const samples=[];let gaps=[];let stopped=false;let running=false;
function escape(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function percentile(values,p){const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.max(0,Math.ceil(p*a.length)-1)]:null;}
function save(state){
 const rows=checks.map(c=>{const values=samples.map(s=>s.checks.find(x=>x.name===c.name)).filter(Boolean);return{name:c.name,samples:values.length,passed:values.filter(v=>v.ok).length,failed:values.filter(v=>!v.ok).length,availability_percent:values.length?100*values.filter(v=>v.ok).length/values.length:null,p95_ms:percentile(values.map(v=>v.ms),.95)};});
 const document={run_id:runId,state,mode:'local-data-aware-monitoring',started_at:started.toISOString(),planned_end_at:new Date(end).toISOString(),last_updated_at:new Date().toISOString(),interval_seconds:interval,planned_hours:hours,completed_samples:samples.length,all_checks_passed_samples:samples.filter(s=>s.ok).length,sample_availability_percent:samples.length?100*samples.filter(s=>s.ok).length/samples.length:null,unobserved_gaps:gaps,fixture_counts:credentials.fixture_counts,checks:rows,limitations:['Local PC, application and data availability; not UptimeRobot or internet/public-hosting uptime.','AI inference and assessment are not checked.','Availability is based on samples, not continuous observation. Sleep/offline monitoring gaps are unobserved; no invented downtime or completed duration.']};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(document,null,2));
 fs.writeFileSync(path.join(out,'summary.csv'),'check,samples,passed,failed,availability_percent,p95_ms\n'+rows.map(r=>[r.name,r.samples,r.passed,r.failed,r.availability_percent?.toFixed(2),r.p95_ms?.toFixed(2)].join(',')).join('\n')+'\n');
 const table=rows.map(r=>`<tr><td>${r.name}</td><td>${r.samples}</td><td>${r.passed}</td><td>${r.failed}</td><td>${r.availability_percent?.toFixed(2)??'—'}%</td><td>${r.p95_ms?.toFixed(2)??'—'}</td></tr>`).join('');
 const failures=samples.filter(s=>!s.ok).slice(-30).map(s=>`<li>${s.at}: ${s.checks.filter(c=>!c.ok).map(c=>escape(c.name+' '+(c.error||'HTTP '+c.status))).join('; ')}</li>`).join('');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="id"><meta charset="utf-8"><meta http-equiv="refresh" content="60"><title>Pemantauan Uptime Lokal</title><style>body{max-width:1100px;margin:36px auto;padding:0 20px;font:16px/1.6 Arial;color:#17242e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:9px;text-align:left}th{background:#eef2f3}</style><h1>Pemantauan Uptime Lokal dengan Data Sintetis</h1><p>Status: <strong>${state}</strong>. Sampel selesai: ${samples.length}. Mulai: ${started.toISOString()}. Target selesai: ${new Date(end).toISOString()}. Interval: ${interval} detik.</p><p>Ketersediaan berdasarkan sampel: <strong>${document.sample_availability_percent?.toFixed(2)??'—'}%</strong>. Ini belum merupakan hasil ${hours} jam sampai status completed.</p><p>Data fixture: ${escape(JSON.stringify(credentials.fixture_counts))}. Probe membaca data akademik, course, tagihan, PDF dan bukti pembayaran menggunakan akun khusus.</p><table><tr><th>Komponen</th><th>Sampel</th><th>Lulus</th><th>Gagal</th><th>Ketersediaan</th><th>p95 ms</th></tr>${table}</table><h2>Kegagalan yang Teramati</h2><ul>${failures||'<li>Belum ada kegagalan tercatat.</li>'}</ul><h2>Batas Pengamatan</h2><p>Hasil mengukur aplikasi dan data di PC lokal, bukan layanan UptimeRobot atau uptime internet. Inferensi AI dan assessment tidak diperiksa. PC, server dan proses monitor harus tetap berjalan. Celah akibat sleep atau monitor terhenti tidak dianggap otomatis sebagai uptime maupun downtime.</p><p>Celah pengamatan terdeteksi: ${gaps.length}. Diperbarui: ${document.last_updated_at}.</p></html>`);
 fs.writeFileSync(path.join(runtime,'active-run.json'),JSON.stringify({pid:process.pid,script:__filename,output:out,run_id:runId,state,planned_end_at:new Date(end).toISOString()},null,2));
}
async function probe(c){const start=performance.now();let status=0;try{
 const headers={Accept:c.type==='json'||c.type==='list'?'application/json':'*/*'};if(c.actor)headers.Authorization='Bearer '+credentials[c.actor].token;
 const r=await fetch(base+c.route,{headers,signal:AbortSignal.timeout(10000),redirect:'error'});status=r.status;const bytes=Buffer.from(await r.arrayBuffer());let ok=status===200;
 if(c.type==='json'||c.type==='list'){const data=JSON.parse(bytes);ok=ok&&data.success===true&&data.data!==null;if(c.type==='list')ok=ok&&Array.isArray(data.data)&&data.data.length>0;}
 if(c.type==='html')ok=ok&&bytes.toString().includes('<div id="root">');
 if(c.type==='pdf')ok=ok&&bytes.subarray(0,5).toString()==='%PDF-';
 if(c.type==='png')ok=ok&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 return{name:c.name,ok,status,ms:Math.round((performance.now()-start)*100)/100};
 }catch(e){return{name:c.name,ok:false,status,ms:Math.round((performance.now()-start)*100)/100,error:e.name==='TimeoutError'?'timeout':(e instanceof SyntaxError?'invalid JSON':'request failed')};}}
async function sample(){running=true;const at=new Date().toISOString();const results=await Promise.all(checks.map(probe));const result={at,ok:results.every(r=>r.ok),checks:results};samples.push(result);fs.appendFileSync(path.join(out,'samples.jsonl'),JSON.stringify(result)+'\n');save('running');console.log(`${at} ${result.ok?'healthy':'degraded'} ${results.filter(r=>r.ok).length}/${checks.length}`);running=false;}
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
(async()=>{save('running');let due=Date.now();while(!stopped&&Date.now()<=end){const now=Date.now();if(now>due+interval*1500)gaps.push({from:new Date(due).toISOString(),to:new Date(now).toISOString(),reason:'sampling delayed or host suspended'});await sample();due=Math.max(due+interval*1000,Date.now());while(!stopped&&Date.now()<due&&Date.now()<end)await new Promise(r=>setTimeout(r,Math.min(1000,due-Date.now())));}
 save(stopped?'stopped':'completed');console.log('Uptime sampling '+(stopped?'stopped':'completed'));})().catch(()=>{save('monitor-error');process.exitCode=1;});
