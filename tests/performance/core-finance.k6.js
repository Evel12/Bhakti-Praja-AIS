import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { Rate, Counter } from 'k6/metrics';
const moduleName=__ENV.TEST_MODULE||'core';
const users=new SharedArray('isolated '+moduleName,()=>JSON.parse(open(__ENV.K6_USERS_FILE)));
const base=__ENV.BASE_URL||'http://127.0.0.1:8086';
const vus=Number(__ENV.TEST_VUS||10);
const failed=new Rate('application_failure_rate');
const limited=new Rate('rate_limited_rate');
const serverErrors=new Counter('server_errors');
const journeys=new Counter('completed_journeys');
export const options={
 scenarios:{users:{executor:'ramping-vus',startVUs:0,stages:[{duration:__ENV.RAMP_UP||'10s',target:vus},{duration:__ENV.HOLD||'30s',target:vus},{duration:__ENV.RAMP_DOWN||'5s',target:0}],gracefulRampDown:'10s',gracefulStop:'10s'}},
 thresholds:{http_req_failed:['rate<0.01'],application_failure_rate:['rate<0.01'],rate_limited_rate:['rate<0.01'],http_req_duration:['p(95)<2000','p(99)<5000'],checks:['rate>0.99']},
 summaryTrendStats:['avg','min','med','max','p(90)','p(95)','p(99)'],
 tags:{component:moduleName,concurrency:String(vus),environment:'isolated-local-apache'},
 cloud:{name:`${moduleName==='core'?'Core AIS':'Finance'} concurrent users - ${vus} VUs`},
};
function get(route,user,binary=false){
 const r=http.get(base+route,{headers:{Accept:'application/json',Authorization:`Bearer ${user.token}`},tags:{name:'GET '+route.replace(/\/\d+/g,'/:id'),role:user.role},timeout:'20s',...(binary?{responseType:'binary'}:{})});
 let ok=r.status===200;
 try{if(ok&&!binary)ok=r.json('success')===true;}catch{ok=false;}
 if(binary&&ok)ok=String(r.headers['Content-Type']).includes('image/png');
 failed.add(!ok);limited.add(r.status===429);if(r.status>=500)serverErrors.add(1);
 check(r,{'HTTP 200 and valid response':()=>ok});return ok;
}
export function setup(){
 if(vus>users.length)fail('Each VU needs a separate synthetic account.');
 if(!get(moduleName==='core'?'/api/dashboard':'/api/member4/finance/summary',users[0]))fail('Fixture or authentication preflight failed.');
}
export default function(){
 const u=users[exec.vu.idInTest-1];let ok=true;
 const routes=moduleName==='core'?['/api/auth/me','/api/dashboard','/api/students','/api/classrooms','/api/schedules','/api/academic-registrations','/api/departments']:
 ['/api/auth/me','/api/member4/finance/summary','/api/member4/invoices',`/api/member4/invoices/${u.invoice_id}`,'/api/member4/payments',...(u.role==='admin'?['/api/member4/finance/reports']:[`/api/member4/payments/${u.payment_id}`])];
 for(const route of routes)ok=get(route,u)&&ok;
 if(moduleName==='finance'&&exec.vu.iterationInScenario%5===0)ok=get(`/api/member4/payments/${u.payment_id}/proof`,u,true)&&ok;
 if(ok)journeys.add(1);
 sleep(4+Math.random()*2);
}
export function handleSummary(data){return {[`${__ENV.RESULT_PREFIX}.summary.json`]:JSON.stringify(data,null,2),stdout:JSON.stringify({module:moduleName,vus,requests:data.metrics.http_reqs?.values.count,failed:data.metrics.http_req_failed?.values.rate,duration:data.metrics.http_req_duration?.values})+'\n'};}
