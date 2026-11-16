const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const smoke=require('./smoke.cjs');
const runtime=path.resolve(__dirname,'../../.tools/browserstack');
const record={checks:[],status:'running'};
(async()=>{
  let browser;
  try{
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${Number(process.argv[3])}`,{timeout:20000});
    const context=browser.contexts()[0];
    const page=await context.newPage();
    await page.setViewportSize({width:1366,height:768});
    const accounts=JSON.parse(fs.readFileSync(path.join(runtime,'resource-users.json'),'utf8').replace(/^\uFEFF/,''));
    await smoke(page,'http://127.0.0.1:4178',accounts,record);
    record.status='passed';
  }catch(e){record.status='failed';record.error=String(e.message).slice(0,1200);}
  finally{
    fs.writeFileSync(process.argv[2],JSON.stringify(record,null,2));
    if(browser)await browser.close().catch(()=>{});
    if(record.status!=='passed')process.exitCode=1;
  }
})();
