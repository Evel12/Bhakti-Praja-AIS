# BrowserStack Local LMS checks

The tests connect the isolated application on this computer to BrowserStack Automate
using a uniquely named BrowserStack Local tunnel. They do not change application
features, `.env`, or existing assessment code/assets.

## Authentication

Use the **Automate Username** and **Access Key** from your
[BrowserStack account settings](https://www.browserstack.com/accounts/settings).
An account with BrowserStack Automate access is needed; a Live-only account might
not allow automated Playwright sessions.

From PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File E:/final/tests/browserstack/connect.ps1
```

The helper asks for the username and a hidden access key, validates the Automate
plan endpoint, then saves the access key with Windows user encryption (DPAPI).
The credentials are readable only by the same Windows user. The `.tools/browserstack/`
runtime directory is excluded from source control.

## Prepare and run

```powershell
npm ci --prefix tests/browserstack --ignore-scripts
powershell -ExecutionPolicy Bypass -File tests/browserstack/start-local.ps1
powershell -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1
powershell -ExecutionPolicy Bypass -File tests/browserstack/verify-sessions.ps1
node tests/browserstack/report.cjs
```

The preparation reuses the disposable `.tools/k6/k6-lms.sqlite` database and Apache
on port 8086 from the performance test harness. It adds fresh synthetic teacher,
student and linked-parent accounts and serves the main React build at loopback
port 4178 with a same-origin API proxy. It builds only the main frontend; the
assessment prebuild hook is not executed.

The remote browser opens `http://bs-local.com:4178` through the named tunnel.
The runner starts its own tunnel, runs sequential sessions, and stops that tunnel
afterward. It does not stop or replace other BrowserStack Local connections.

Matrix:

- Chrome latest, Windows 11
- Edge latest, Windows 11
- Playwright Firefox, Windows 11
- Playwright WebKit, macOS Sonoma

WebKit is not branded Safari. Mobile checks resize desktop browser viewports to
390 × 844; these are not real-device tests. Availability depends on the BrowserStack
account and the provider's supported browser/Playwright versions.

## Checks

- Invalid login rejection and successful LMS role logins
- Teacher course creation and student joining by code
- Public/private PDF uploads, private-material authorization, and PDF downloading
- Default `qwen3.8:27b` model and selectable Llama/Qwen options (no AI inference)
- Assignment publication, student text/file submission, teacher grades and attendance
- Student progress and grade display
- Linked-parent read-only grade access
- Desktop/mobile layout and unexpected browser exceptions or HTTP 5xx

No production data is used. BrowserStack sessions/screenshots contain synthetic test
content. Network payload logging is disabled and supported sensitive typing commands
are masked. Error messages redact the service key and synthetic account passwords.

## Local validation without BrowserStack

```powershell
powershell -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -Local
```

This runs the same workflow using installed Chrome and Edge. It validates the script
and application but is not evidence that BrowserStack Local is connected.

Results and screenshots are in `.tools/browserstack/results/`. Remote results include
the real BrowserStack session ID and dashboard link when a session is established.
The date-stamped report under `docs/testing/` distinguishes remote
results from local validation.

If the browser's default attendance date is rejected at a local/UTC day boundary,
the test records a finding and keeps the BrowserStack session **failed**. It then
uses an explicitly valid server date to finish the remaining student/parent checks.
An empty or invalid native date input is recorded separately. This continuation
does not fix the application or turn a failing scenario into a passing session.

## OS, phone, tablet and resource profiles

With the isolated app running, execute `run-tests.ps1 -Variants` for the expanded
BrowserStack matrix, then `verify-sessions.ps1 -Variants` for provider metadata.
The matrix covers Windows 10/11, macOS Sequoia, Galaxy S22, Pixel 7, Galaxy Tab S9,
iPhone 15 and iPad 10th. Availability and account limitations are recorded as
blocked results, never treated as successful device coverage.
Windows/macOS and Android use Playwright; iOS uses real Safari through W3C
WebDriver. The iOS checks do not include JavaScript exception or HTTP 5xx monitoring.
Use `-Variants -Only 'Pixel 7'` to rerun one profile; retained profiles keep their
earlier session evidence. Comma-separated profile substrings are accepted.

After cloud sessions finish, run `python tests/browserstack/resources.py` from the
repository root. It starts only disposable Chrome trees on Windows with verified
1/2/4 logical-CPU affinity and 512/1024/2048 MiB aggregate committed-memory caps.
These are process limits, not physical RAM specifications or CPU-model emulation.
The backend and AI server are not constrained. `node tests/browserstack/variants-report.cjs`
generates the combined evidence report. AI model selection is tested; inference
speed is not. Run sequentially because shared fixture-account login revokes old tokens.

## Core AIS and finance workflows

After `tests/performance/seed-core-finance.ps1`, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -CoreFinance -Parallel 3
python tests/browserstack/resources.py --module core-finance
```

The W3C WebDriver suite covers nine profiles on Windows 10/11, macOS Sequoia,
Galaxy S22, Pixel 7, Galaxy Tab S9, iPhone 15 and iPad 10th. Each has separate
synthetic admin/student/parent accounts. Run it after k6 measurements finish.
Core checks populated academic pages and a department create/edit/delete cycle,
duplicate-code validation and referenced-record deletion protection. Finance
checks invoice creation/editing, role and student boundaries, proof submission,
pending and paid balances, admin verification and aggregate reporting.

The PNG is supplied to the real file input with File/DataTransfer; the OS file
picker is not tested. Default payment-date validity is checked before a valid
ISO date is used to continue. A date finding keeps the finance result failed.
Repeated acceptance is expected to be idempotent (200), while a conflicting
verification decision is expected to return 409. Expected 403/404/409/422
responses are assertions, not unexpected errors. No reminder is sent and no
bank/payment-gateway transaction is performed. Application features and
assessment are unchanged.

Results, source session links, screenshots and independently queried provider
metadata are under `.tools/browserstack/results/core-finance/`. Resource tests
use a shorter read-only UI/API journey on locally constrained Chrome trees;
their results are separate from the complete cloud workflow.
The WebDriver adapter waits for asynchronously rendered controls, centers native
click targets around fixed headers, and serializes returned JavaScript objects
as JSON strings to avoid a real-iOS transport serialization failure. These are
test-driver adaptations; application code is unchanged.

## Cleanup

```powershell
powershell -ExecutionPolicy Bypass -File tests/browserstack/stop-local.ps1
```

This stops only the isolated Node frontend and the isolated Apache instance.

References: [Local Testing](https://www.browserstack.com/docs/automate/playwright/local-testing/introduction),
[capabilities](https://www.browserstack.com/docs/automate/playwright/playwright-capabilities),
[session details](https://www.browserstack.com/docs/automate/playwright/get-session-details),
[command masking](https://www.browserstack.com/docs/automate/playwright/hide-sensitive-data).
