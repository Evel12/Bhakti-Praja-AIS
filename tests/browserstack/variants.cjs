const fs = require('node:fs');
const path = require('node:path');
const pw = require('playwright');
const Local = require('browserstack-local').Local;
const smoke = require('./smoke.cjs');
const runtime = path.resolve(__dirname, '../../.tools/browserstack');
const accounts = JSON.parse(fs.readFileSync(path.join(runtime, 'app-users.json'), 'utf8').replace(/^\uFEFF/, ''));
const matrix = [
  { name: 'Laptop screen / Windows 10 Chrome', os: 'Windows', os_version: '10', browser: 'chrome', browser_version: 'latest', viewport: {width:1366,height:768} },
  { name: 'PC screen / Windows 11 Edge', os: 'Windows', os_version: '11', browser: 'edge', browser_version: 'latest', viewport: {width:1920,height:1080} },
  { name: 'Laptop screen / Windows 11 Firefox', os: 'Windows', os_version: '11', browser: 'playwright-firefox', viewport: {width:1440,height:900} },
  { name: 'Laptop screen / macOS Sequoia WebKit', os: 'osx', os_version: 'Sequoia', browser: 'playwright-webkit', viewport: {width:1440,height:900} },
  { name: 'Phone / Galaxy S22 Android 12', kind: 'android', browser: 'chrome', deviceName: 'Samsung Galaxy S22', osVersion: '12.0', realMobile: 'true' },
  { name: 'Phone / Pixel 7 Android 13', kind: 'android', browser: 'chrome', deviceName: 'Google Pixel 7', osVersion: '13.0', realMobile: 'true' },
  { name: 'Tablet / Galaxy Tab S9 Android 13', kind: 'android', browser: 'chrome', deviceName: 'Samsung Galaxy Tab S9', osVersion: '13.0', realMobile: 'true' },
  { name: 'Phone / iPhone 15 iOS 17', kind: 'ios', browser: 'safari', deviceName: 'iPhone 15', osVersion: '17', realMobile: 'true' },
  { name: 'Tablet / iPad 10th iOS 16', kind: 'ios', browser: 'safari', deviceName: 'iPad 10th', osVersion: '16', realMobile: 'true' },
];
const resultFile = path.join(runtime,'results/device-matrix.json');
const only = process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const selected = name => !only || only.split(',').some(part=>name.includes(part));
const results = (process.argv.includes('--mobile-only') || only) && fs.existsSync(resultFile)
  ? JSON.parse(fs.readFileSync(resultFile,'utf8').replace(/^\uFEFF/,'')).results.filter(r=>only ? !selected(r.name) : !r.requested.kind)
  : [];
const build = `LMS device matrix ${new Date().toISOString()}`;
const identifier = `lms-variants-${Date.now()}`;
let tunnel;
function safe(e) {
  let s = String(e.message || e);
  for (const secret of [process.env.BROWSERSTACK_ACCESS_KEY, ...Object.values(accounts).map(a=>a.password)])
    if (secret) s = s.split(secret).join('[REDACTED]').split(encodeURIComponent(secret)).join('[REDACTED]');
  return s.replace(/wss:\/\/\S+/g, '[remote connection]').slice(0,1800);
}
function save() { fs.writeFileSync(path.join(runtime,'results/device-matrix.json'),JSON.stringify({build, scope:'Read-only LMS compatibility; no AI inference, attendance or assessment tests', results},null,2)); }
async function executor(page,action,args) { return page.evaluate(()=>{},`browserstack_executor: ${JSON.stringify({action,arguments:args})}`); }
async function run(config,index) {
  const record={name:config.name, build, requested:config,status:'running',checks:[],started_at:new Date().toISOString()}; results.push(record);save();
  let browser,device,context,page;
  try {
    if(config.kind==='ios'){
      await require('./ios-webdriver.cjs')(config,identifier,build,accounts,record,path.join(runtime,`results/variant-${index}.png`));
      record.screenshot=`variant-${index}.png`;
      return;
    }
    const {name,kind,viewport,...platform}=config;
    const caps={...platform,project:'Bhakti Praja LMS',build,name,
      'browserstack.username':process.env.BROWSERSTACK_USERNAME,'browserstack.accessKey':process.env.BROWSERSTACK_ACCESS_KEY,
      'browserstack.local':'true','browserstack.localIdentifier':identifier,
      'browserstack.playwrightVersion':'1.latest','client.playwrightVersion':require('playwright/package.json').version,
      'browserstack.video':'true','browserstack.networkLogs':'false','browserstack.console':'disable',
      'browserstack.maskCommands':'sendType,sendPress,setHTTPCredentials,setStorageState'};
    const endpoint=`wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
    if(kind==='android') {
      record.transport='Playwright / real Android Chrome';
      device=await pw._android.connect(endpoint,{timeout:90000});
      await device.shell('am force-stop com.android.chrome');
      context=await device.launchBrowser({viewport:null});
    } else {
      record.transport='Playwright / desktop cloud browser';
      browser=await pw.chromium.connect({wsEndpoint:endpoint,timeout:90000});
      record.browser_version=browser.version();
      context=await browser.newContext(viewport?{viewport}:{viewport:null});
    }
    page=await context.newPage();
    const raw=await executor(page,'getSessionDetails');
    const detail=typeof raw==='string'?JSON.parse(raw):raw;
    record.session_id=detail.hashed_id; record.dashboard_url=detail.browser_url;
    save();
    await smoke(page,'http://bs-local.com:4178',accounts,record);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(runtime,`results/variant-${index}.png`),fullPage:false});
    record.screenshot=`variant-${index}.png`; record.status='passed';
  } catch(e) {record.status=record.session_id?'failed':'blocked'; record.error=safe(e);
    if(page)try{await page.screenshot({path:path.join(runtime,`results/variant-${index}-failure.png`),fullPage:true});}catch{}
  }
  finally {
    if(page) try {await executor(page,'setSessionStatus',{status:record.status==='passed'?'passed':'failed',reason:record.error?.slice(0,250)||'LMS compatibility checks passed'});}catch{}
    if(context) try{await context.close();}catch{}
    if(browser) try{await browser.close();}catch{}
    if(device) try{await device.close();}catch{}
    record.finished_at=new Date().toISOString();save();console.log(`${record.name}: ${record.status}${record.error?' - '+record.error:''}`);
  }
}
async function main(){
  if(!process.env.BROWSERSTACK_ACCESS_KEY) throw Error('Run run-tests.ps1 -Variants to load credentials.');
  fs.mkdirSync(path.join(runtime,'results'),{recursive:true});
  tunnel=new Local();
  await new Promise((resolve,reject)=>tunnel.start({key:process.env.BROWSERSTACK_ACCESS_KEY,localIdentifier:identifier,onlyAutomate:true,logFile:path.join(runtime,'variants-tunnel.log')},e=>e?reject(e):resolve()));
  try{for(let i=0;i<matrix.length;i++) {if(!selected(matrix[i].name))continue;if(process.argv.includes('--mobile-only')&&!matrix[i].kind)continue;await run(matrix[i],i+1);}}
  finally{if(tunnel.isRunning())await new Promise(r=>tunnel.stop(r));}
  if(results.some(r=>r.status!=='passed'))process.exitCode=1;
}
// Mobile transports can close their last socket while a command is pending.
// Keep command timeout timers alive so an unfinished run cannot look successful.
const heartbeat=setInterval(()=>{},1000);
process.on('exit',()=>{
  for(const r of results)if(r.status==='running'){r.status='blocked';r.error='Runner exited before this session completed';process.exitCode=1;}
  save();
});
main().catch(async e=>{console.error(safe(e));save();if(tunnel?.isRunning())await new Promise(r=>tunnel.stop(r));process.exitCode=1;}).finally(()=>clearInterval(heartbeat));
