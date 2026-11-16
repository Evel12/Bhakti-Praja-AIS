const assert=require('node:assert/strict');
const proof='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4Z8AAAAASUVORK5CYII=';
module.exports=async function flow(d,base,accounts,record,shot){
 const check=(module,name)=>{record.checks.push({module,name});console.log(`${record.profile} / ${module}: ${name}`);};
 const url=(route)=>base+route;
 const ui=async(route,heading)=>{await d.goto(url(route));await d.heading(heading);};
 const noOverflow=async()=>{const client=await d.js('return {userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2}');record.client=client;assert.equal(client.horizontalOverflow,false,'Page overflows horizontally');};
 record.module_status.core='running';
 try {
 await d.login(base,accounts.ais,'ais');
 await d.assertApi('/api/dashboard');await shot('core-dashboard');check('core','Admin login and academic dashboard');
 for(const [route,title,api] of [['/students','Siswa','students'],['/classrooms','Kelas & Wali Kelas','classrooms'],['/schedules','Jadwal Pembelajaran','schedules'],['/academic-registrations','Registrasi Akademik','academic-registrations']]){
  await ui(route,title);const res=await d.assertApi('/api/'+api);assert(res.data.length>0,api+' fixture must be populated');if(['schedules','academic-registrations'].includes(api)){const item=res.data[0];await d.select('select',item.academic_year_id);const contextSelect=await d.js("const selects=[...document.querySelectorAll('main select')];return selects.map(s=>s.id);");await d.select('[id="'+contextSelect[1]+'"]',item.semester_id);if(api==='schedules')await d.select('[id="'+contextSelect[2]+'"]',item.classroom_id);}await noOverflow();await shot('core-'+api);check('core','Populated '+title+' list and responsive layout');
 }
 await ui('/departments','Program Keahlian');
 const code='BT'+Date.now().toString(36).toUpperCase()+require('node:crypto').randomBytes(2).toString('hex');const name='Browser Core '+code;
 await d.button('Tambah Program Keahlian');await d.fill('#code',code);await d.fill('#name',name);await d.click('css selector','[role=dialog] h2');await d.button('Simpan');
 await d.wait("return !document.querySelector('[role=dialog]')");
 let created=(await d.assertApi('/api/departments?search='+encodeURIComponent(code))).data.find(x=>x.code===code);assert(created,'Created department is missing');
 await shot('core-created');check('core','Create department through the UI and verify persisted data');
 await d.click('xpath',`//tr[td[contains(.,'${name}')]]//button[@title='Ubah']`);await d.fill('#name',name+' Updated');await d.click('css selector','[role=dialog] h2');await d.button('Simpan');await d.wait("return !document.querySelector('[role=dialog]')");
 assert.equal((await d.assertApi('/api/departments/'+created.id)).data.name,name+' Updated');check('core','Edit department through UI');
 await d.assertApi('/api/departments',422,'POST',{code,name:'Duplicate synthetic name'});check('core','Duplicate department code rejected (422)');
 await d.assertApi('/api/departments/'+accounts.department_id,422,'DELETE');check('core','Referenced department cannot be deleted (422)');
 await d.click('xpath',`//tr[td[contains(.,'${name} Updated')]]//button[@title='Hapus']`);await d.cmd('POST','/alert/accept',{});
 await d.wait("return ![...document.querySelectorAll('td')].some(e=>e.textContent.includes(arguments[0]))",[name+' Updated']);
 await d.assertApi('/api/departments/'+created.id,404);check('core','Delete only newly created synthetic department');
 record.module_status.core='passed';
 } catch(error) {record.module_status.core='failed';record.findings.push({module:'core',description:error.message});await shot('core-failure').catch(()=>{});}
 record.module_status.finance='running';
 try {
 await d.login(base,accounts.admin,'member4');const baseline=(await d.assertApi('/api/member4/finance/summary')).data;await shot('finance-dashboard');check('finance','Finance admin login and summary');
 await ui('/finance/invoices','Tagihan Pendidikan');await d.button('Buat tagihan');
 await d.wait("return !!document.querySelector('select[name=student_id] option[value=\"'+arguments[0]+'\"]')",[String(accounts.student_id)]);
 await d.select('select[name=student_id]',accounts.student_id);await d.field('Nominal (Rp)','150000');await d.date('input[name=due_date]','2026-12-31');await d.click('css selector','dialog[open] h2');await d.button('Simpan tagihan');await d.wait("return !document.querySelector('dialog[open]')");
 const invoice=(await d.assertApi('/api/member4/invoices?student_id='+accounts.student_id)).data[0];assert.equal(invoice.amount,'150000.00');record.synthetic_invoice_id=invoice.id;
 await shot('finance-invoice-created');check('finance','Create real synthetic invoice through UI');
 await ui('/finance/invoices/'+invoice.id,'Detail Tagihan #'+invoice.id);await d.button('Ubah tagihan');await d.field('Nominal (Rp)','151000');await d.click('css selector','dialog[open] h2');await d.button('Simpan tagihan');await d.wait("return !document.querySelector('dialog[open]')");
 assert.equal((await d.assertApi('/api/member4/invoices/'+invoice.id)).data.amount,'151000.00');check('finance','Edit unpaid invoice before payments');
 await d.login(base,accounts.parent,'member4');
 await d.assertApi('/api/dashboard',403);await d.assertApi('/api/member4/finance/reports',403);await d.assertApi('/api/member4/invoices/'+accounts.other_invoice_id,404);check('finance','Parent cannot access Core AIS, admin report or unrelated invoice');
 await ui('/finance/invoices/'+invoice.id,'Detail Tagihan #'+invoice.id);await d.heading('Ajukan Pembayaran');await shot('finance-parent-invoice');
 record.default_payment_date=await d.js("const e=document.querySelector('input[name=payment_date]');return {value:e.value,max:e.max,valid:e.checkValidity()};");
 if(!record.default_payment_date.value||!record.default_payment_date.valid)record.findings.push({module:'finance',code:'default-payment-date-invalid',description:'Default payment date is empty or invalid. The test records the finding before supplying an explicit ISO date to continue the payment workflow.'});
 await d.field('Metode pembayaran','Synthetic bank transfer');await d.field('Nomor transaksi (opsional)','BS-'+invoice.id);
 const validDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await d.date('input[name=payment_date]',validDate);
 // The synthetic PNG is supplied to the actual file input; the application
 // submits its normal multipart form. This does not test the OS file picker.
 await d.js("const bytes=Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],'synthetic-proof.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return input.files.length;",[proof]);
 await d.click('css selector','h1');
 await d.button('Kirim bukti pembayaran');
 await d.wait("return document.body.textContent.includes('Bukti sudah diajukan dan menunggu verifikasi admin.')");
 const payments=(await d.assertApi('/api/member4/payments?invoice_id='+invoice.id)).data;const payment=payments[0];assert.equal(payment.status,'pending');
 assert.equal((await d.assertApi('/api/member4/invoices/'+invoice.id)).data.outstanding_amount,'151000.00');await shot('finance-payment-pending');check('finance','Parent submits proof through UI; pending payment does not reduce outstanding');
 await d.login(base,accounts.admin,'member4');await ui('/finance/payments/'+payment.id,'Detail Pembayaran #'+payment.id);await d.button('Terima pembayaran');await d.button('Simpan keputusan');
 await d.wait("return !document.querySelector('dialog[open]')");
 const paid=(await d.assertApi('/api/member4/invoices/'+invoice.id)).data;assert.equal(paid.status,'paid');assert.equal(paid.outstanding_amount,'0.00');await shot('finance-payment-verified');check('finance','Admin accepts payment through UI; invoice becomes paid with zero outstanding');
 await d.assertApi('/api/member4/payments/'+payment.id+'/verification',200,'PATCH',{decision:'verified'});
 await d.assertApi('/api/member4/payments/'+payment.id+'/verification',409,'PATCH',{decision:'rejected'});check('finance','Repeated acceptance is idempotent; conflicting decision rejected (409)');
 assert.equal(paid.verified_amount,'151000.00');
 await ui('/finance/reports','Laporan Keuangan');const report=await d.assertApi('/api/member4/finance/reports');assert(Number(report.data.summary.verified_amount)>=Number(baseline.verified_amount)+151000);await shot('finance-report');check('finance','Verified invoice counts payment once; aggregate finance report includes payment');
 await d.login(base,accounts.student,'member4');await ui('/finance/invoices/'+invoice.id,'Detail Tagihan #'+invoice.id);
 assert.equal((await d.assertApi('/api/member4/invoices/'+invoice.id)).data.display_status,'paid');await d.assertApi('/api/member4/invoices/'+accounts.other_invoice_id,404);await noOverflow();await shot('finance-student-paid');check('finance','Linked student sees paid invoice; unrelated invoice remains hidden');
 record.module_status.finance=record.findings.some(f=>f.module==='finance')?'failed':'passed';
 } catch(error) {record.module_status.finance='failed';record.findings.push({module:'finance',description:error.message});await shot('finance-failure').catch(()=>{});}
};
