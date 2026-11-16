const fs=require('node:fs');
const assert=require('node:assert/strict');
// Small W3C client; no credentials are placed in URLs or returned test records.
module.exports=class Driver{
 constructor(user,key){this.authorization='Basic '+Buffer.from(user+':'+key).toString('base64');}
 async request(method,route,body){
  const r=await fetch('https://hub-cloud.browserstack.com/wd/hub'+route,{method,headers:{Authorization:this.authorization,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  const data=await r.json();if(!r.ok||data.value?.error)throw Error(`${method} ${route}: ${data.value?.error||r.status}: ${data.value?.message||'WebDriver failed'}`);return data.value;
 }
 async start(capabilities){const v=await this.request('POST','/session',{capabilities:{alwaysMatch:capabilities}});this.id=v.sessionId;this.capabilities=v.capabilities;await this.cmd('POST','/timeouts',{implicit:15000,pageLoad:45000,script:45000});}
 cmd(method,route,body){return this.request(method,`/session/${this.id}${route}`,body);}
 async js(script,args=[]){try{
  if(script.startsWith('browserstack_executor:'))return await this.cmd('POST','/execute/sync',{script,args});
  // Safari's remote transport can fail serializing nested JSON objects. Return
  // a JSON string through WebDriver and deserialize on the test-runner side.
  const raw=await this.cmd('POST','/execute/sync',{script:`return JSON.stringify((function(){${script}\n}).apply(null,arguments));`,args});
  return typeof raw==='string'?JSON.parse(raw):raw;
 }catch(e){throw Error(`Script ${script.slice(0,110)}: ${e.message}`);}}
 asyncJs(script,args=[]){return this.cmd('POST','/execute/async',{script,args});}
 async goto(url){await this.cmd('POST','/url',{url});}
 async find(using,value){return(await this.cmd('POST','/element',{using,value}))['element-6066-11e4-a52e-4f735466cecf'];}
 async click(using,value){
  const end=Date.now()+30000;
  while(true){try{
   const id=await this.find(using,value);
   await this.js("arguments[0].scrollIntoView({block:'center',inline:'nearest'});return true;",[{'element-6066-11e4-a52e-4f735466cecf':id}]);
   await this.cmd('POST',`/element/${id}/click`,{});return;
  }catch(e){if(Date.now()>end||!/click intercepted|not interactable|stale element/.test(e.message))throw e;await new Promise(r=>setTimeout(r,400));}}
 }
 button(name){return this.click('xpath',`//button[normalize-space(.)=${JSON.stringify(name)}]`);}
 async fill(selector,value){
  const id=await this.find('css selector',selector);
  // WebDriver clear alone can leave React's controlled value unchanged until
  // blur, causing the next keystrokes to append to the previous numeric value.
  await this.js("const e=document.querySelector(arguments[0]);const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;",[selector]);
  await this.cmd('POST',`/element/${id}/value`,{text:String(value),value:[...String(value)]});
  if(selector==='#password'){
   const length=await this.js('return document.querySelector(arguments[0]).value.length',[selector]);assert.equal(length,String(value).length,'Password replacement length mismatch');
  }else{
   const actual=await this.js('return document.querySelector(arguments[0]).value',[selector]);assert.equal(actual,String(value),'Input replacement did not produce the requested value');
  }
 }
 async field(label,value){
  await this.wait("return [...document.querySelectorAll('label')].some(e=>e.textContent.trim()===arguments[0])",[label]);
  const id=await this.js("const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===arguments[0]);if(!l)throw Error('Missing label '+arguments[0]);return l.htmlFor;",[label]);
  await this.fill(`[id=${JSON.stringify(id)}]`,value);
 }
 async select(selector,value){return this.js("const e=document.querySelector(arguments[0]);if(!e)throw Error('Select missing');e.value=arguments[1];e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;",[selector,String(value)]);}
 async date(selector,value){return this.js("const e=document.querySelector(arguments[0]);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,arguments[1]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;",[selector,value]);}
 async wait(script,args=[]){const end=Date.now()+45000;let last;do{try{if(await this.js(script,args))return;}catch(e){last=e.message;}await new Promise(r=>setTimeout(r,350));}while(Date.now()<end);throw Error('UI wait timed out: '+script.slice(0,180)+(last?' ('+last.slice(0,160)+')':''));}
 heading(text){return this.wait("return [...document.querySelectorAll('h1,h2')].some(e=>e.textContent.trim()===arguments[0])",[text]);}
 async api(route,method='GET',body){
  // Poll a normal page fetch using execute/sync. Some real-iOS provider
  // transports fail execute/async even though the browser request succeeds.
  await this.js("window.__cfApiResult=null;fetch(arguments[0],{method:arguments[1],headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('ais_token')},...(arguments[2]===null?{}:{body:JSON.stringify(arguments[2])})}).then(async r=>{window.__cfApiResult={status:r.status,data:await r.json()}}).catch(e=>{window.__cfApiResult={error:e.message}});return true;",[route,method,body??null]);
  await this.wait('return window.__cfApiResult!==null');
  return this.js('return window.__cfApiResult');
 }
 async screenshot(file){await this.js('scrollTo(0,0);return true;');fs.writeFileSync(file,Buffer.from(await this.cmd('GET','/screenshot'),'base64'));}
 async status(status,reason){return this.js('browserstack_executor: '+JSON.stringify({action:'setSessionStatus',arguments:{status,reason}}));}
 async close(){if(this.id)await this.cmd('DELETE','');}
 async login(base,account,portal){
  await this.goto(base+'/login');await this.js('localStorage.clear();return true;');await this.goto(base+'/login');
  await this.wait("return !!document.querySelector('#email')");
  await this.js("window.__cfHttp=[];const p=XMLHttpRequest.prototype;const open=p.open,send=p.send;p.open=function(m,u){this.__cfRequest={method:m,path:new URL(u,location.href).pathname};return open.apply(this,arguments)};p.send=function(){this.addEventListener('loadend',()=>{if(this.__cfRequest?.path.startsWith('/api/'))window.__cfHttp.push({...this.__cfRequest,status:this.status})});return send.apply(this,arguments)};return true;");
  await this.fill('#email',account.email);await this.fill('#password',account.password);
  await this.click('css selector','h1');await this.button('Masuk');
  try{await this.wait("return !!localStorage.getItem('ais_token') && !document.querySelector('#password')");}
  catch(e){const diagnostics=await this.js("return {network:window.__cfHttp,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),inputValid:document.querySelector('form')?.checkValidity(),service:document.querySelector('#portal')?.value}");throw Error('Login did not complete: '+JSON.stringify(diagnostics));}
  await this.goto(base+(portal==='ais'?'/administration':'/finance'));
  await this.heading(portal==='ais'?'Ringkasan Akademik':'Ringkasan Keuangan');
 }
 async assertApi(route,status=200,method='GET',body){const response=await this.api(route,method,body);assert.equal(response.status,status,`${method} ${route}: ${JSON.stringify(response.data?.message)}`);return response.data;}
};
