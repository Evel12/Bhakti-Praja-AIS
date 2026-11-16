const fs=require('node:fs');const path=require('node:path');const {chromium}=require('playwright');const Driver=require('./webdriver.cjs');const flow=require('./core-finance-flow.cjs');
const root=path.resolve(__dirname,'../..');const out=path.join(root,'.tools/browserstack/results/core-finance-local');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('dialog',d=>d.accept());
  const d=new Driver('','');d.goto=url=>page.goto(url,{waitUntil:'domcontentloaded'});
  d.js=(script,args=[])=>page.evaluate(({script,args})=>new Function(script).apply(null,args),{script,args});
  d.asyncJs=(script,args=[])=>page.evaluate(({script,args})=>new Promise(done=>new Function(script).apply(null,[...args,done])),{script,args});
  d.click=(using,value)=>page.locator(using==='xpath'?'xpath='+value:value).click();
  d.fill=(selector,value)=>page.locator(selector).fill(String(value));
  d.cmd=async()=>{};d.screenshot=async file=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:file});};
  const accounts=JSON.parse(fs.readFileSync(path.join(root,'.tools/browserstack/core-finance-profiles.json')))[0];
  const record={profile:'Local Chrome harness validation',module_status:{core:'not-run',finance:'not-run'},checks:[],findings:[],screenshots:[]};
  await flow(d,'http://127.0.0.1:4178',accounts,record,async label=>{await d.screenshot(path.join(out,label+'.png'));record.screenshots.push(label+'.png');});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record.module_status),record.findings);if(Object.values(record.module_status).some(v=>v!=='passed'))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
