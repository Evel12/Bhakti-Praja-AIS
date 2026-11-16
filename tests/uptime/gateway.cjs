// On-demand readiness checks only. There is no sampling timer or uptime run.
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const runtime=path.resolve(__dirname,'../../.tools/uptime');
const c=JSON.parse(fs.readFileSync(path.join(runtime,'probe-credentials.json'),'utf8'));
const base='http://127.0.0.1:4178';let cached=null,inflight=null;
const probes=[
 {name:'frontend',group:'shared',route:'/login',type:'html'},
 {name:'backend',group:'shared',route:'/up',type:'up'},
 {name:'core_data',group:'core',route:'/api/students',actor:'admin',type:'list'},
 {name:'core_schedules',group:'core',route:'/api/schedules',actor:'admin',type:'list'},
 {name:'lms_data',group:'lms',route:`/api/lms/courses/${c.course_id}`,actor:'student',type:'json'},
 {name:'lms_storage',group:'lms',route:`/api/lms/materials/${c.material_id}/download`,actor:'student',type:'pdf'},
 {name:'finance_data',group:'finance',route:`/api/member4/invoices/${c.invoice_id}`,actor:'admin',type:'json'},
 {name:'finance_summary',group:'finance',route:'/api/member4/finance/summary',actor:'admin',type:'json'},
 {name:'finance_storage',group:'finance',route:`/api/member4/payments/${c.payment_id}/proof`,actor:'admin',type:'png'},
];
async function check(p){let ok=false;try{const r=await fetch(base+p.route,{headers:{Accept:'application/json',...(p.actor?{Authorization:'Bearer '+c[p.actor].token}:{})},signal:AbortSignal.timeout(12000),redirect:'error'});const b=Buffer.from(await r.arrayBuffer());ok=r.status===200;
 if(['json','list'].includes(p.type)){const d=JSON.parse(b);ok=ok&&d.success===true&&d.data!==null;if(p.type==='list')ok=ok&&Array.isArray(d.data)&&d.data.length>0;}
 if(p.type==='html')ok=ok&&b.toString().includes('<div id="root">');
 if(p.type==='pdf')ok=ok&&b.subarray(0,5).toString()==='%PDF-';
 if(p.type==='png')ok=ok&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 }catch{}return{name:p.name,group:p.group,ok};}
async function ready(){if(cached&&Date.now()-cached.time<10000)return cached;if(inflight)return inflight;inflight=(async()=>{const checks=await Promise.all(probes.map(check));cached={time:Date.now(),at:new Date().toISOString(),checks};return cached;})().finally(()=>{inflight=null;});return inflight;}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/health/')){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const scope=url.pathname.slice(8);if(!['ready','core','lms','finance'].includes(scope)){res.writeHead(404);res.end();return;}
  const result=await ready();const selected=result.checks.filter(c=>scope==='ready'||c.group==='shared'||c.group===scope);const healthy=selected.every(c=>c.ok);
  res.writeHead(healthy?200:503,{'Content-Type':'application/json','Cache-Control':'no-store, max-age=0','X-Robots-Tag':'noindex'});
  res.end(req.method==='HEAD'?'':JSON.stringify({status:healthy?'healthy':'unhealthy',scope,checked_at:result.at,checks:Object.fromEntries(selected.map(c=>[c.name,c.ok])),monitoring_started:false}));return;
 }
 const upstream=http.request({host:'127.0.0.1',port:4178,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:4178'}},r=>{res.writeHead(r.statusCode,{...r.headers,'Cache-Control':'no-store','X-Robots-Tag':'noindex'});r.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end('Test application unavailable.');});req.pipe(upstream);
}).listen(4180,'127.0.0.1',()=>console.log('Uptime connection gateway ready; no monitoring run started.'));
