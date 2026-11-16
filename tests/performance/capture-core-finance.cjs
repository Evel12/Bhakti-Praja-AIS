const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {chromium}=require('../browserstack/node_modules/playwright');
const root=path.resolve(__dirname,'../..');const out=path.join(root,'.tools/k6/results/core-finance-screenshots');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  for(const module of ['core','finance'])for(const vus of [10,25,50]){
   await page.goto(pathToFileURL(path.join(root,`.tools/k6/results/cloud-${module}-${vus}.html`)).href,{waitUntil:'networkidle'});
   await page.screenshot({path:path.join(out,`${module}-${vus}-full.png`),fullPage:true});
   const sections=await page.locator('h2').evaluateAll(h=>h.map(e=>({name:e.textContent.trim().toLowerCase(),top:e.getBoundingClientRect().top+scrollY})));
   const bottom=await page.evaluate(()=>document.documentElement.scrollHeight);
   for(const [i,s]of sections.entries()){
    const y=Math.max(0,s.top-15),next=Math.min(bottom,sections[i+1]?.top-15||bottom);
    if(next-y<80)continue;
    await page.screenshot({path:path.join(out,`${module}-${vus}-${s.name}.png`),fullPage:true,clip:{x:0,y,width:1440,height:next-y}});
   }
   console.log(`Captured ${module} ${vus} VUs report.`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
