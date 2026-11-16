# LMS concurrency test with Grafana k6

Tests authenticated LMS API use at 10, 25 and 50 concurrent virtual users.
The existing assessment implementation is not exercised or modified.

## Isolation and workload

`start-local.ps1` starts a separate XAMPP Apache instance on loopback port 8086,
with 64 worker threads. It uses `.tools/k6/k6-lms.sqlite` and a separate Laravel
storage directory. It does not alter the application's `.env`, Apache installation
configuration, production database, or application behavior.

The fixture has 50 distinct users (10% teachers, 90% students), 5 courses,
45 students per course, private/public materials, attendance, announcements,
published synthetic quizzes, and 1,125 graded submissions. Student profiles and
academic schedules are not populated, so schedule requests test an empty lookup.
PDF downloads use a small synthetic fixture, not a large-file bandwidth test.

Each user has a separate Sanctum token. A journey reads session information, the
course list, course detail/progress, schedules, and either models (teacher) or a
published quiz (student). Students periodically mark a material as read and download
a PDF. Four to six seconds of think time preserves the existing rate limit.

The test does not call AI generation, change grades, or submit assessment answers.
It measures API latency and concurrency, not browser rendering or LLM throughput.
The prior Ollama 27B memory failure must be resolved before separately benchmarking AI.

## Start the local test server

From the repository root (PHP/XAMPP must already be installed):

```powershell
powershell -ExecutionPolicy Bypass -File tests/performance/start-local.ps1
```

Install the official Grafana k6 CLI, or use the verified portable binary under
`.tools/k6/bin/k6-v2.4.0-windows-amd64/k6.exe` if prepared in this workspace.

```powershell
$k6 = 'E:/final/.tools/k6/bin/k6-v2.4.0-windows-amd64/k6.exe'
$env:K6_USERS_FILE = 'E:/final/.tools/k6/credentials.json'
$env:BASE_URL = 'http://127.0.0.1:8086'
$env:K6_WEB_DASHBOARD = 'true'
$env:K6_WEB_DASHBOARD_PORT = '-1'
$env:K6_WEB_DASHBOARD_PERIOD = '5s'
foreach ($count in @(10, 25, 50)) {
    $env:TEST_VUS = "$count"
    $env:RESULT_PREFIX = "E:/final/.tools/k6/results/lms-$count"
    $env:K6_WEB_DASHBOARD_EXPORT = "$env:RESULT_PREFIX.html"
    & $k6 run --out "json=$env:RESULT_PREFIX.metrics.json.gz" tests/performance/lms.k6.js
    # Exit code 99 means a performance threshold failed; preserve/report the result.
}
```

Each run ramps up for 10 seconds, holds peak load for 30 seconds, and ramps down for
5 seconds, with up to 10 seconds allowed for active journeys to finish. Override
`RAMP_UP`, `HOLD` and `RAMP_DOWN` for longer validation runs. These short runs are
baseline checks, not a claim about long-term or production capacity.

The PowerShell runner performs the same matrix and preserves threshold-failure
exit codes in `.tools/k6/results/run-outcomes.json`:

```powershell
powershell -ExecutionPolicy Bypass -File tests/performance/run-tests.ps1
python tests/performance/report.py
```

Provisional acceptance criteria: HTTP and application failure rates below 1%,
rate-limit rejection rate below 1%, p95 response time below 2 seconds and p99 below
5 seconds. These are test assumptions, not an agreed service-level commitment.

## Send results to the user's Grafana Cloud stack

Target stack: `https://tancoconut1625.grafana.net/`.
The URL is reachable, but metric writes require a valid k6 Cloud authentication.
Authenticate locally; never commit or paste the token into test source:

In Grafana, open **Testing & synthetics > Performance > Settings > Access >
Personal token**, or use the [direct token page](https://tancoconut1625.grafana.net/a/k6-app/settings/api-token).
The login helper prompts securely for a token and supplies it explicitly to k6.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/performance/connect-cloud.ps1
```

With the same workload environment variables above, stream a local execution:

```powershell
& $k6 cloud run --local-execution --no-archive-upload --no-cloud-logs --no-cloud-secrets --include-system-env-vars tests/performance/lms.k6.js
```

To stream all three load levels using the supplied runner:

```powershell
powershell -ExecutionPolicy Bypass -File tests/performance/run-tests.ps1 -Cloud
python tests/performance/report.py --mode cloud --output docs/performance/k6-cloud-results-2026-11-14
```

`--no-archive-upload` keeps the private account/token fixture on the local machine.
`--no-cloud-logs` prevents test logs from being uploaded. The k6 process still runs
locally because Grafana-hosted runners cannot reach `127.0.0.1` on this computer.
The CLI prints the real Grafana run URL when authentication and streaming succeed.
Cloud result ingestion uses the stack's k6 quota.

The cloud CLI in k6 2.4.0 does not accept `--out`. Cloud-mode reports therefore use
the local end-of-run JSON summary and HTML export, while detailed tagged metrics
are streamed to Grafana. Local-only runs additionally save raw metric JSON.

Only a completed authenticated cloud run proves results were received by Grafana.
An HTTP 200 from `/api/health` alone does not prove write access or metric delivery.

## Results and cleanup

Detailed HTML dashboards and JSON summaries are under `.tools/k6/results/`.
Private tokens and runtime files stay under `.tools/k6/`; do not publish this directory.
Stop only the Apache instance started with `.tools/k6/httpd.conf` after testing.

```powershell
powershell -ExecutionPolicy Bypass -File tests/performance/stop-local.ps1
```

References: [cloud streaming](https://grafana.com/docs/k6/latest/results-output/real-time/cloud/),
[web dashboard exports](https://grafana.com/docs/k6/latest/results-output/web-dashboard/).

## Core AIS and finance

With the isolated app running, use `seed-core-finance.ps1` to add synthetic
academic records, 150 invoices, separate browser accounts and distinct load-test
actors. `run-core-finance.ps1` streams separate Core AIS and finance workloads at
10/25/50 VUs to Grafana Cloud. It preserves exit code 99 as a failed threshold.
Core uses admin accounts; finance interleaves admin, student and parent accounts.
Exact per-run role counts are recorded in the generated report.

`python tests/performance/report-core-finance.py` summarizes results and verifies
run completion through the Grafana REST API using the existing local CLI login.
It never exports the token. The workloads read populated API resources and small
synthetic payment proofs; they do not perform bank payments, send reminders,
stress login, mutate finance records, or exercise assessment.

After the browser/device and resource suites finish, run
`node tests/performance/capture-core-finance.cjs` and
`python tests/performance/package-core-finance.py` for the evidence ZIP.
Screenshot captures come from the HTML export of each authenticated cloud run;
they are not presented as screenshots of the Grafana Cloud website.
