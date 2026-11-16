// Safari on real iOS devices through BrowserStack's W3C WebDriver endpoint.
const fs=require('node:fs');
const assert=require('node:assert/strict');
module.exports=async function ios(config,identifier,build,accounts,record,screenshot){
  const authorization='Basic '+Buffer.from(`${process.env.BROWSERSTACK_USERNAME}:${process.env.BROWSERSTACK_ACCESS_KEY}`).toString('base64');
  let session;
  async function request(method,route,body){
    const r=await fetch(`https://hub-cloud.browserstack.com/wd/hub${route}`,{method,headers:{Authorization:authorization,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
    const data=await r.json();
    if(!r.ok||data.value?.error)throw Error(`${data.value?.error||r.status}: ${data.value?.message||'WebDriver request failed'}`);
    return data.value;
  }
  const command=(method,route,body)=>request(method,`/session/${session}${route}`,body);
  const js=(script,args=[])=>command('POST','/execute/sync',{script,args});
  const element=async(using,value)=>(await command('POST','/element',{using,value}))['element-6066-11e4-a52e-4f735466cecf'];
  const click=async(using,value)=>command('POST',`/element/${await element(using,value)}/click`,{});
  async function wait(script){
    const deadline=Date.now()+45000;
    do{if(await js(script))return;await new Promise(r=>setTimeout(r,500));}while(Date.now()<deadline);
    throw Error('Timed out waiting for Safari UI: '+script.slice(0,160));
  }
  try{
    const value=await request('POST','/session',{capabilities:{alwaysMatch:{browserName:'Safari','bstack:options':{
      deviceName:config.deviceName,osVersion:config.osVersion,realMobile:'true',
      projectName:'Bhakti Praja LMS',buildName:build,sessionName:config.name,
      local:true,localIdentifier:identifier,networkLogs:false,consoleLogs:'disable',
      maskCommands:'setValues,sendKeys'}}}});
    session=value.sessionId;record.session_id=session;record.transport='W3C WebDriver / real iOS Safari';
    record.browser_version=value.capabilities?.browserVersion;
    record.dashboard_url=`https://automate.browserstack.com/dashboard/v2/sessions/${session}`;
    const start=Date.now();
    await command('POST','/url',{url:'http://bs-local.com:4178/login'});
    await wait("return !!document.querySelector('#email')");
    for(const [selector,text] of [['#email',accounts.teacher.email],['#password',accounts.teacher.password]]){
      const id=await element('css selector',selector);
      await command('POST',`/element/${id}/value`,{text,value:[...text]});
    }
    await click('css selector','h1');
    await click('css selector','button[type="submit"]');
    await wait("return !!localStorage.getItem('ais_token') && !document.querySelector('#password')");
    await command('POST','/url',{url:'http://bs-local.com:4178/lms'});
    await wait("return [...document.querySelectorAll('h1,h2')].some(e=>e.textContent.trim()==='Pembelajaran LMS')");
    record.login_to_lms_ms=Date.now()-start;record.checks.push('Teacher login and LMS rendering');
    await wait("return [...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Kuis AI')");
    await click('xpath',"//button[normalize-space(.)='Kuis AI']");
    const modelScript="[...document.querySelectorAll('label')].find(e=>e.textContent.includes('Model AI')).querySelector('select')";
    await wait(`return !!(${modelScript})`);
    assert.equal(await js(`return (${modelScript}).value`),'qwen3.8:27b');
    for(const model of ['llama3.1:8b','qwen3.8:27b']){
      await js(`const s=${modelScript};s.value=arguments[0];s.dispatchEvent(new Event('change',{bubbles:true}));return true;`,[model]);
      assert.equal(await js(`return (${modelScript}).value`),model);
    }
    record.checks.push('Qwen default and alternate model selection (no inference)');
    await click('xpath',"//button[normalize-space(.)='Materi']");
    record.checks.push('Course and material tab navigation');
    record.client=await js('return {userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrencyReported:navigator.hardwareConcurrency||null,deviceMemoryReportedGiB:navigator.deviceMemory||null,viewport:{width:innerWidth,height:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2}');
    assert.equal(record.client.horizontalOverflow,false);
    record.checks.push('No horizontal page overflow');
    const drawerVisible=await js("const e=document.querySelector('button[aria-label=\"Buka navigasi\"]');return !!e&&e.getBoundingClientRect().width>0");
    if(drawerVisible){
      await click('css selector','button[aria-label="Buka navigasi"]');
      await click('css selector','button[aria-label="Tutup navigasi"]');
      record.checks.push('Small-screen navigation drawer');
    }
    await js('window.scrollTo(0,0);return true;');
    fs.writeFileSync(screenshot,Buffer.from(await command('GET','/screenshot'),'base64'));
    record.status='passed';
  }catch(e){record.status=session?'failed':'blocked';throw e;}
  finally{
    if(session){
      try{await js('browserstack_executor: '+JSON.stringify({action:'setSessionStatus',arguments:{status:record.status==='passed'?'passed':'failed',reason:record.status==='passed'?'iOS LMS checks passed':'iOS LMS checks did not complete'}}));}catch{}
      try{await command('DELETE','');}catch{}
    }
  }
};
