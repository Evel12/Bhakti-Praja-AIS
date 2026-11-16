const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const runtime=path.join(root,'.tools/browserstack/results');
function read(name){const p=path.join(runtime,name);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')):null;}
const devices=read('device-matrix.json');
const resources=read('resources.json');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clean=s=>String(s??'—').replace(/\|/g,'/').replace(/[\r\n]+/g,' ');
let report=`# LMS OS, device and resource tests — ${date}\n\n`;
report+='Only test harnesses and disposable test data were changed. Assessment and application features were not changed. These are sequential compatibility checks, not concurrent-load measurements. The earlier k6 report covers concurrent users.\n\n';
report+='## BrowserStack Local device matrix\n\n';
report+=`Latest runner build: ${devices?.build||'Not run'}. The table retains completed profiles from earlier builds when a subset was rerun; each session link identifies its own build.\n\n`;
report+='Checks: real UI teacher login; LMS rendering; Qwen default; switch to Llama and back; course/material navigation; horizontal overflow; small-screen drawer when visible; uncaught browser exceptions and HTTP 5xx. No AI inference or attendance is exercised. Existing attendance findings in the earlier full-workflow report remain unresolved.\n\n';
report+='Windows/macOS and Android use Playwright. iOS uses W3C WebDriver with native Safari after the Playwright iOS transport did not complete connection. iOS does not collect uncaught JavaScript exceptions or HTTP 5xx events. Drawer checks apply only where listed in the individual raw result; a passing result covers only that session’s recorded checks.\n\n';
report+='Desktop/laptop labels describe viewport sizes on cloud OS/browser machines. They do not establish physical laptop/PC hardware specifications. Mobile requests use BrowserStack real-device capabilities. Provider metadata below confirms what actually ran.\n\n';
report+='| Requested profile | Result | Provider platform | Login → LMS (ms) | Evidence |\n|---|---|---|---:|---|\n';
for(const r of devices?.results||[]){
 const p=r.provider_platform;
 const platform=p?[p.os,p.os_version,p.device,p.browser,p.browser_version].filter(Boolean).join(' / '):'Not independently verified';
 report+=`| ${clean(r.name)} | ${r.status}${r.browserstack_status?' / provider '+r.browserstack_status:''} | ${clean(platform)} | ${r.login_to_lms_ms??'—'} | ${r.dashboard_url?'[Session]('+r.dashboard_url+')':'No session'} |\n`;
}
report+='\nLogin timings include tunnel latency and UI automation overhead. They are single observations, not benchmark percentiles or service-level guarantees. Browser-reported logical CPU and memory values are retained in the raw result where available; they are not measured physical specifications.\n\n';
for(const r of devices?.results||[])if(r.error)report+=`- **${clean(r.name)}:** ${clean(r.error)}\n`;
report+='\n## Controlled local CPU / memory profiles\n\n';
report+='Each profile launches a fresh Chrome process suspended, assigns its entire child-process tree to a Windows Job Object, verifies the configured limits through the Windows API, then resumes it. CPU affinity limits logical processor availability. The RAM-related limit is aggregate committed browser-process memory, not physical RAM capacity. The Node test driver, backend and AI server are outside the limit. This does not emulate CPU brands, clock speeds, mobile chips, GPU performance, or Qwen server hardware.\n\n';
report+='| Logical CPUs | Browser commit cap (MiB) | Result | Peak browser commit (MiB) | Login → LMS (ms) |\n|---:|---:|---|---:|---:|\n';
for(const r of resources?.results||[])report+=`| ${r.logical_cpu_limit} | ${r.committed_memory_limit_mib} | ${r.status} | ${r.peak_job_committed_memory_mib??'—'} | ${r.login_to_lms_ms??'—'} |\n`;
for(const r of resources?.results||[])if(r.error)report+=`\n- **${r.logical_cpu_limit} CPU / ${r.committed_memory_limit_mib} MiB:** ${clean(r.error)}\n`;
if(resources?.host)report+=`\nHost CPU: ${clean(resources.host.cpu_model)}; ${resources.host.logical_processors??'unknown'} logical processors; physical RAM ${resources.host.physical_ram_bytes?(resources.host.physical_ram_bytes/1024**3).toFixed(2)+' GiB':'unknown'}. The caps above apply only to the new browser tree.\n`;
report+='\n## Reproduce\n\n```powershell\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/start-local.ps1\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -Variants\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/verify-sessions.ps1 -Variants\n# Run after cloud sessions finish: shared synthetic account logins invalidate older tokens.\npython tests/browserstack/resources.py\nnode tests/browserstack/variants-report.cjs\npowershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/stop-local.ps1\n```\n\n';
report+='Private raw results and screenshots: `.tools/browserstack/results/device-matrix.json`, `resources.json`, `variant-*.png`. Credentials remain outside version control.\n\n';
report+='References: [BrowserStack Android](https://www.browserstack.com/docs/automate/playwright/playwright-android/nodejs), [BrowserStack iOS](https://www.browserstack.com/docs/automate/playwright/playwright-ios/nodejs), [Windows Job Object limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information).\n';
const target=path.join(root,`docs/testing/device-matrix-${date}.md`);
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,report);console.log(target);
