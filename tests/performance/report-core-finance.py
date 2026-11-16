"""Summarize local measurements and verify their actual Grafana Cloud runs."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
RESULTS=ROOT/'.tools/k6/results'


def read_log(path):
    data=path.read_bytes()
    return data.decode('utf-16' if data.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig',errors='replace')


def main():
    config=json.loads((Path(os.environ['APPDATA'])/'k6/config.json').read_text())['collectors']['cloud']
    rows=[]
    for module in ['core','finance']:
        actors=json.loads((ROOT/f'.tools/k6/{module}-credentials.json').read_text())
        for vus in [10,25,50]:
            prefix=RESULTS/f'cloud-{module}-{vus}'
            data=json.loads(prefix.with_suffix('.summary.json').read_text())
            metrics=data['metrics']
            url=re.search(r'https://tancoconut1625\.grafana\.net/a/k6-app/runs/(\d+)',read_log(prefix.with_suffix('.log')))
            if not url:
                raise RuntimeError(f'No real Grafana run URL for {module}/{vus}')
            run_id=int(url.group(1))
            request=urllib.request.Request(f'https://api.k6.io/cloud/v6/test_runs/{run_id}',headers={'Authorization':'Bearer '+config['token'],'X-Stack-Id':str(config['stackID'])})
            with urllib.request.urlopen(request,timeout=30) as response:
                cloud=json.load(response)
            assert cloud['id']==run_id
            thresholds={f'{name}: {condition}':value['ok'] for name,metric in metrics.items() for condition,value in metric.get('thresholds',{}).items()}
            role_counts={role:sum(a['role']==role for a in actors[:vus]) for role in set(a['role'] for a in actors[:vus])}
            row={'module':module,'users':vus,'role_counts':role_counts,'max_observed_vus':metrics['vus']['values']['max'],
                 'requests':metrics['http_reqs']['values']['count'],'response_ms':metrics['http_req_duration']['values'],
                 'http_failure_rate':metrics['http_req_failed']['values']['rate'],
                 'application_failure_rate':metrics['application_failure_rate']['values']['rate'],
                 'rate_limited_rate':metrics['rate_limited_rate']['values']['rate'],
                 'thresholds':thresholds,'local_passed':all(thresholds.values()),
                 'cloud':{'id':run_id,'url':url.group(0),'status':cloud['status'],'result':cloud['result'],'created':cloud['created'],'ended':cloud['ended']}}
            rows.append(row)
            print(f"{module} {vus} VUs: p95={row['response_ms']['p(95)']:.2f}ms, HTTP failure={row['http_failure_rate']:.2%}, cloud={cloud['status']}/{cloud['result']}")
    date=dt.datetime.now().strftime('%Y-%m-%d')
    output=ROOT/f'docs/performance/core-finance-k6-{date}.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'tested_at':dt.datetime.now(dt.timezone.utc).isoformat(),'environment':'Local isolated Apache/PHP SQLite WAL, 64 threads; execution local with cloud streaming','runs':rows},indent=2))
    text=['# Core AIS and Finance Grafana k6 results','',
          'Read-only populated API journeys. Each VU uses a distinct synthetic account. No login storm, payment mutation, bank connection or assessment workload. Ramp 10s, hold 30s, ramp-down 5s; provisional p95 < 2000ms, p99 < 5000ms and failure rates < 1%.','',
          '| Module | VUs | Requests | Avg ms | p95 ms | p99 ms | HTTP failures | Cloud |','|---|---:|---:|---:|---:|---:|---:|---|']
    for r in rows:
        m=r['response_ms'];text.append(f"| {r['module']} | {r['users']} | {r['requests']} | {m['avg']:.2f} | {m['p(95)']:.2f} | {m['p(99)']:.2f} | {r['http_failure_rate']:.2%} | [{r['cloud']['status']}/{r['cloud']['result']}]({r['cloud']['url']}) |")
    text+=['','Core AIS users are admins. Finance mixes admin, student and parent; per-run role counts are in JSON. Results measure local baseline capacity, not production capacity. The backend, database and load generator share this host. Cloud completion/result independently verified with the Grafana API.']
    output.with_suffix('.md').write_text('\n'.join(text)+'\n',encoding='utf-8')


if __name__=='__main__':main()
