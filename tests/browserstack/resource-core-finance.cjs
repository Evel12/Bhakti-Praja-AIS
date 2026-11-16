const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'../..');
const record={status:'running',checks:[],module_status:{core:'not-run',finance:'not-run'},screenshots:[]};
(async()=>{let browser;
 try{
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${Number(process.argv[3])}`,{timeout:20000});
  const page=await browser.contexts()[0].newPage();await page.setViewportSize({width:1366,height:768});page.setDefaultTimeout(30000);
  const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
  const base='http://127.0.0.1:4178';
  async function login(account,portal,heading){await page.goto(base+'/login');await page.evaluate(()=>localStorage.clear());await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Kata Sandi',{exact:true}).fill(account.password);await page.getByRole('heading',{name:'Selamat datang kembali',exact:true}).click();await page.getByRole('button',{name:'Masuk',exact:true}).click();await page.waitForFunction(()=>!!localStorage.getItem('ais_token')&&!document.querySelector('#password'));await page.goto(base+(portal==='ais'?'/administration':'/finance'));await page.getByRole('heading',{name:heading,exact:true}).waitFor();}
  async function api(route){return page.evaluate(async route=>{const r=await fetch(route,{headers:{Accept:'application/json',Authorization:'Bearer '+localStorage.getItem('ais_token')}});return{status:r.status,data:await r.json()};},route);}
  async function shot(label){const file=process.argv[2].replace(/\.json$/,`-${label}.png`);await page.screenshot({path:file});record.screenshots.push({module:label,file:path.basename(file)});}
  const core=JSON.parse(fs.readFileSync(path.join(root,'.tools/k6/core-credentials.json')))[49];
  const finance=JSON.parse(fs.readFileSync(path.join(root,'.tools/k6/finance-credentials.json')))[49];
  const start=Date.now();await login(core,'ais','Ringkasan Akademik');record.core_login_ms=Date.now()-start;
  for(const [route,title] of [['/students','Siswa'],['/schedules','Jadwal Pembelajaran'],['/academic-registrations','Registrasi Akademik']]){await page.goto(base+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();const response=await api('/api'+route);assert.equal(response.status,200);assert(response.data.data.length>0);if(route==='/students')await page.locator('tbody tr').first().waitFor();else{const first=response.data.data[0];await page.getByLabel('1. Tahun ajaran',{exact:true}).selectOption(String(first.academic_year_id));await page.getByLabel('2. Semester',{exact:true}).selectOption(String(first.semester_id));if(route==='/schedules')await page.getByLabel('3. Kelas',{exact:true}).selectOption(String(first.classroom_id));await page.getByRole('article').first().waitFor();}record.checks.push('Core: '+title+' renders populated academic data and API returns 200');}
  await shot('core');record.module_status.core='passed';
  const next=Date.now();await login(finance,'member4','Ringkasan Keuangan');record.finance_login_ms=Date.now()-next;
  await page.goto(base+'/finance/invoices/'+finance.invoice_id);await page.getByRole('heading',{name:'Detail Tagihan #'+finance.invoice_id,exact:true}).waitFor();
  const invoice=await api('/api/member4/invoices/'+finance.invoice_id);assert.equal(invoice.status,200);assert.equal(invoice.data.data.student_id,finance.student_id);
  await page.locator('h2').filter({hasText:invoice.data.data.student.name}).first().waitFor();
  assert.equal((await api('/api/member4/finance/reports')).status,403);record.checks.push('Finance: own invoice renders; admin-only report denied');
  await shot('finance');record.module_status.finance='passed';assert.deepEqual(exceptions,[]);record.checks.push('No uncaught JavaScript exceptions');record.status='passed';
 }catch(e){record.status='failed';record.error=String(e.message).slice(0,1500);}
 finally{fs.writeFileSync(process.argv[2],JSON.stringify(record,null,2));if(browser)await browser.close().catch(()=>{});if(record.status!=='passed')process.exitCode=1;}
})();
