const fs=require('node:fs');const path=require('node:path');
const Local=require('browserstack-local').Local;
const Driver=require('./webdriver.cjs');const flow=require('./core-finance-flow.cjs');
const runtime=path.resolve(__dirname,'../../.tools/browserstack');
const accounts=JSON.parse(fs.readFileSync(path.join(runtime,'core-finance-users.json'),'utf8'));
const profileFile=path.join(runtime,'core-finance-profiles.json');
const profileAccounts=fs.existsSync(profileFile)?JSON.parse(fs.readFileSync(profileFile,'utf8')):null;
const out=path.join(runtime,'results/core-finance');fs.mkdirSync(out,{recursive:true});
const matrix=[
 {name:'Laptop Windows 10 Chrome',browserName:'Chrome',os:'Windows',osVersion:'10',width:1366,height:768},
 {name:'PC Windows 11 Edge',browserName:'MicrosoftEdge',os:'Windows',osVersion:'11',width:1920,height:1080},
 {name:'Laptop Windows 11 Firefox',browserName:'Firefox',os:'Windows',osVersion:'11',width:1440,height:900},
 {name:'Laptop macOS Sequoia Safari',browserName:'Safari',os:'OS X',osVersion:'Sequoia',width:1440,height:900},
 {name:'Galaxy S22 Android 12',browserName:'Chrome',deviceName:'Samsung Galaxy S22',osVersion:'12.0'},
 {name:'Pixel 7 Android 13',browserName:'Chrome',deviceName:'Google Pixel 7',osVersion:'13.0'},
 {name:'Galaxy Tab S9 Android 13',browserName:'Chrome',deviceName:'Samsung Galaxy Tab S9',osVersion:'13.0'},
 {name:'iPhone 15 iOS 17',browserName:'Safari',deviceName:'iPhone 15',osVersion:'17'},
 {name:'iPad 10th iOS 16',browserName:'Safari',deviceName:'iPad 10th',osVersion:'16'},
];
const file=path.join(out,'results.json');const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const selected=c=>!only||only.split(',').some(x=>c.name.includes(x));
const results=only&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).results.filter(r=>!selected({name:r.profile})):[];
const build='Core AIS and Finance '+new Date().toISOString();const identifier='core-finance-'+Date.now();let tunnel;
const secrets=[process.env.BROWSERSTACK_ACCESS_KEY,...[accounts,...(profileAccounts||[])].flatMap(a=>Object.values(a).filter(x=>x&&typeof x==='object').map(x=>x.password))];
function safe(e){let s=String(e.message||e);for(const secret of secrets)if(secret)s=s.split(secret).join('[REDACTED]').split(encodeURIComponent(secret)).join('[REDACTED]');return s.slice(0,2200);}
function save(){fs.writeFileSync(file,JSON.stringify({build,scope:'Core AIS administration and finance UI workflows, role boundaries and synthetic payment lifecycle. Assessment unchanged.',results},null,2));}
async function run(config,index){
 const d=new Driver(process.env.BROWSERSTACK_USERNAME,process.env.BROWSERSTACK_ACCESS_KEY);
 const r={profile:config.name,requested:config,build,status:'running',module_status:{core:'not-run',finance:'not-run'},checks:[],findings:[],screenshots:[],started_at:new Date().toISOString()};results.push(r);save();
 try{
  const {name,browserName,width,height,...platform}=config;
  await d.start({browserName,...(!platform.deviceName?{browserVersion:'latest'}:{}),unhandledPromptBehavior:'ignore','bstack:options':{...platform,...(platform.deviceName?{realMobile:'true'}:{}),projectName:'Bhakti Praja Core AIS Finance',buildName:build,sessionName:name,local:true,localIdentifier:identifier,networkLogs:false,consoleLogs:'disable',maskCommands:'setValues,sendKeys'}});
  r.session_id=d.id;r.dashboard_url='https://automate.browserstack.com/dashboard/v2/sessions/'+d.id;save();
  if(width)await d.cmd('POST','/window/rect',{width,height});
  async function shot(label){const name=`${index}-${label}.png`;await d.screenshot(path.join(out,name));r.screenshots.push({module:label.startsWith('core-')?'core':'finance',label,file:name});save();}
  await flow(d,'http://bs-local.com:4178',profileAccounts?.[index-1]||accounts,r,shot);
  r.findings=r.findings.map(f=>({...f,description:safe(f.description)}));
  r.status=Object.values(r.module_status).every(s=>s==='passed')?'passed':'failed';
 }catch(e){r.status=d.id?'failed':'blocked';r.error=safe(e);}
 finally{
  if(d.id){try{await d.status(r.status==='passed'?'passed':'failed',r.status==='passed'?'Core AIS and finance workflow checks passed':safe(r.findings[0]?.description||r.error||'Workflow incomplete').slice(0,250));}catch{}
   try{await d.close();}catch{}
   try{const response=await fetch(`https://api.browserstack.com/automate/sessions/${d.id}.json`,{headers:{Authorization:d.authorization},signal:AbortSignal.timeout(30000)});const {automation_session:s}=await response.json();if(!s||s.hashed_id!==d.id)throw Error('Session identity not verified');
    const expected=String(config.osVersion),actual=String(s.os_version);
    const versionMatches=/^\d+$/.test(expected)?actual.split('.')[0]===expected:actual.toLowerCase().replace(/\.0$/,'')===expected.toLowerCase().replace(/\.0$/,'');
    const platformMatches=versionMatches&&(!config.deviceName||s.device===config.deviceName);
    r.provider={status:s.status,os:s.os,os_version:s.os_version,device:s.device,browser:s.browser,browser_version:s.browser_version,platform_matches_request:platformMatches};r.verified_at=new Date().toISOString();
    if(!platformMatches){r.status='blocked';r.error='The provider OS/device differs from the requested profile.';}
   }catch(e){r.verification_error=safe(e);r.status='failed';}
  }
  r.finished_at=new Date().toISOString();save();console.log(`${config.name}: ${r.status} (${JSON.stringify(r.module_status)})`);
 }
}
async function main(){
 if(!process.env.BROWSERSTACK_ACCESS_KEY)throw Error('Run run-tests.ps1 -CoreFinance.');
 tunnel=new Local();await new Promise((resolve,reject)=>tunnel.start({key:process.env.BROWSERSTACK_ACCESS_KEY,localIdentifier:identifier,onlyAutomate:true},e=>e?reject(e):resolve()));
 const parallel=Number(process.argv.find(a=>a.startsWith('--parallel='))?.slice(11)||1);
 if(!Number.isInteger(parallel)||parallel<1||parallel>3)throw Error('Parallel sessions must be 1 through 3.');
 if(parallel>1&&!profileAccounts)throw Error('Seed independent profile accounts before parallel sessions.');
 const queue=matrix.map((config,index)=>({config,index})).filter(x=>selected(x.config));let cursor=0;
 try{await Promise.all(Array.from({length:parallel},async()=>{while(cursor<queue.length){const item=queue[cursor++];await run(item.config,item.index+1);}}));}
 finally{if(tunnel.isRunning())await new Promise(r=>tunnel.stop(r));}
 if(results.some(r=>r.status!=='passed'))process.exitCode=1;
}
const heartbeat=setInterval(()=>{},1000);
process.on('exit',()=>{for(const r of results)if(r.status==='running'){r.status='blocked';r.error='Runner exited before session completion';process.exitCode=1;}save();});
main().catch(async e=>{console.error(safe(e));if(tunnel?.isRunning())await new Promise(r=>tunnel.stop(r));process.exitCode=1;}).finally(()=>clearInterval(heartbeat));
