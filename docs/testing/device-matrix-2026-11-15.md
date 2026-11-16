# LMS OS, device and resource tests — 2026-11-15

Only test harnesses and disposable test data were changed. Assessment and application features were not changed. These are sequential compatibility checks, not concurrent-load measurements. The earlier k6 report covers concurrent users.

## BrowserStack Local device matrix

Latest runner build: LMS device matrix 2026-11-15T05:44:41.870Z. The table retains completed profiles from earlier builds when a subset was rerun; each session link identifies its own build.

Checks: real UI teacher login; LMS rendering; Qwen default; switch to Llama and back; course/material navigation; horizontal overflow; small-screen drawer when visible; uncaught browser exceptions and HTTP 5xx. No AI inference or attendance is exercised. Existing attendance findings in the earlier full-workflow report remain unresolved.

Windows/macOS and Android use Playwright. iOS uses W3C WebDriver with native Safari after the Playwright iOS transport did not complete connection. iOS does not collect uncaught JavaScript exceptions or HTTP 5xx events. Drawer checks apply only where listed in the individual raw result; a passing result covers only that session’s recorded checks.

Desktop/laptop labels describe viewport sizes on cloud OS/browser machines. They do not establish physical laptop/PC hardware specifications. Mobile requests use BrowserStack real-device capabilities. Provider metadata below confirms what actually ran.

| Requested profile | Result | Provider platform | Login → LMS (ms) | Evidence |
|---|---|---|---:|---|
| Laptop screen / Windows 10 Chrome | passed / provider passed | Windows / 10 / chrome / 157.0 | 13073 | [Session](https://automate.browserstack.com/builds/2f47817bb6a500e199b3fda35bc5e2d221492b22/sessions/8c65f179a7f131fea66ba3cac49c3630542268d4) |
| PC screen / Windows 11 Edge | passed / provider passed | Windows / 11 / edge / 157.0 | 7761 | [Session](https://automate.browserstack.com/builds/2f47817bb6a500e199b3fda35bc5e2d221492b22/sessions/71a6d20d6e5f23bca8d92d7311ca98f2c221f44b) |
| Laptop screen / Windows 11 Firefox | passed / provider passed | Windows / 11 / playwright-firefox / 157.0 | 11529 | [Session](https://automate.browserstack.com/builds/2f47817bb6a500e199b3fda35bc5e2d221492b22/sessions/7f929802206b4881ed9263f0f344dc51d3efc89d) |
| Laptop screen / macOS Sequoia WebKit | passed / provider passed | OS X / Sequoia / playwright-webkit / 27.2 | 6362 | [Session](https://automate.browserstack.com/builds/2f47817bb6a500e199b3fda35bc5e2d221492b22/sessions/b25ad074d03b598a0b1d00c99fc03fe182389080) |
| Phone / Galaxy S22 Android 12 | passed / provider passed | android / 12.0 / Samsung Galaxy S22 / chrome_android | 8587 | [Session](https://automate.browserstack.com/builds/2fb09f5aeadc5f545eae226af4cb9dee23899674/sessions/96d106df556fbd3147b0fd6006d043366c7493f6) |
| Phone / Pixel 7 Android 13 | passed / provider passed | android / 13.0 / Google Pixel 7 / chrome_android | 9375 | [Session](https://automate.browserstack.com/builds/e5865a39e7ebb9cf2b6fb6753b83f6d6831a696f/sessions/c1266f481ced846a6f338abd46d1baa9e385877c) |
| Tablet / Galaxy Tab S9 Android 13 | passed / provider passed | android / 13.0 / Samsung Galaxy Tab S9 / chrome_android | 8497 | [Session](https://automate.browserstack.com/builds/e3236e435839ce6d14476144db6ab40d3dc0d505/sessions/1a5521a0f26d11df566d64b97494c1ff6d6919ef) |
| Phone / iPhone 15 iOS 17 | passed / provider passed | ios / 17.3 / iPhone 15 / iphone | 9710 | [Session](https://automate.browserstack.com/dashboard/v2/sessions/fff08b603db7a938014660c9ee7fe72073c1d194) |
| Tablet / iPad 10th iOS 16 | passed / provider passed | ios / 16.0 / iPad 10th / ipad | 9351 | [Session](https://automate.browserstack.com/dashboard/v2/sessions/405bf7f6ffede85635e329b5d6be3fefe7755c9b) |

Login timings include tunnel latency and UI automation overhead. They are single observations, not benchmark percentiles or service-level guarantees. Browser-reported logical CPU and memory values are retained in the raw result where available; they are not measured physical specifications.


## Controlled local CPU / memory profiles

Each profile launches a fresh Chrome process suspended, assigns its entire child-process tree to a Windows Job Object, verifies the configured limits through the Windows API, then resumes it. CPU affinity limits logical processor availability. The RAM-related limit is aggregate committed browser-process memory, not physical RAM capacity. The Node test driver, backend and AI server are outside the limit. This does not emulate CPU brands, clock speeds, mobile chips, GPU performance, or Qwen server hardware.

| Logical CPUs | Browser commit cap (MiB) | Result | Peak browser commit (MiB) | Login → LMS (ms) |
|---:|---:|---|---:|---:|
| 1 | 512 | passed | 372.91 | 3256 |
| 2 | 1024 | passed | 432.77 | 3030 |
| 4 | 2048 | passed | 429.76 | 2716 |

Host CPU: AMD Ryzen 9 8940HX with Radeon Graphics        ; 32 logical processors; physical RAM 31.21 GiB. The caps above apply only to the new browser tree.

## Reproduce

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/start-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/run-tests.ps1 -Variants
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/verify-sessions.ps1 -Variants
# Run after cloud sessions finish: shared synthetic account logins invalidate older tokens.
python tests/browserstack/resources.py
node tests/browserstack/variants-report.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File tests/browserstack/stop-local.ps1
```

Private raw results and screenshots: `.tools/browserstack/results/device-matrix.json`, `resources.json`, `variant-*.png`. Credentials remain outside version control.

References: [BrowserStack Android](https://www.browserstack.com/docs/automate/playwright/playwright-android/nodejs), [BrowserStack iOS](https://www.browserstack.com/docs/automate/playwright/playwright-ios/nodejs), [Windows Job Object limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information).
