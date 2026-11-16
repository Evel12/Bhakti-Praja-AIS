# Uptime connection preparation

This setup exposes the isolated test application and synthetic data using a free
Cloudflare Quick Tunnel. It does not deploy the backend to Cloudflare, and the
PC must remain powered on while the tunnel is needed.

No monitoring campaign is started by the connection scripts. The earlier
`monitor.cjs` is a separate local sampler and is not invoked here.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/connect-cloudflare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/connect-uptimerobot.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/prepare-uptimerobot.ps1
```

The first script reuses only project-owned connection processes, seeds dedicated
read-only probe accounts into the disposable database, and starts a gateway plus
the official SHA-256-verified `cloudflared` binary. Data persists in the existing
`.tools/k6/k6-lms.sqlite` and private test storage. It does not alter application
features or assessment.

The second script asks for an UptimeRobot API key in a hidden terminal prompt,
verifies a read-only API call and stores it with Windows DPAPI. It deliberately
does not create an active monitor. Never paste the key into chat or commit it.
The preparation script independently verifies API access and saves four valid
create-request drafts plus the intended PAUSED state locally. It does not send
create/start requests. Connection verification is recorded in
`.tools/uptime/uptimerobot-connection.json`; request drafts are in
`uptimerobot-drafts.json`. An authenticated account connection is distinct from
an actually provisioned monitor; do not describe drafts as paused remote monitors.

Current URL and monitor drafts are in `.tools/uptime/connection.json` and
`monitor-drafts.json`. Login credentials for synthetic demo users are in
`.tools/uptime/demo-accounts.json`; these are not served by the public gateway.

Readiness endpoints:

- `/health/ready`: frontend, backend, Core AIS data, LMS data/PDF, finance data/proof.
- `/health/core`: frontend/backend and populated academic data.
- `/health/lms`: frontend/backend and an enrolled course/PDF.
- `/health/finance`: frontend/backend and invoice, summary, payment proof.

These endpoints run read-only checks on demand, cache checks for 10 seconds to
avoid probe bursts, and return 200 only when their checks pass (503 otherwise).
They do not return tokens or data rows. They do not check AI inference or
assessment. No uptime samples, duration or availability percentage are produced
by the gateway. `monitoring_started:false` describes this setup, not an external
provider's status.

Prepare UptimeRobot with GET, a 300-second interval and no alert contacts. Keep
monitors PAUSED. The documented create-monitor API does not expose an atomic
create-paused option; creating active then pausing could run a check and therefore
is not done automatically. Existing paused project monitors can be linked later;
otherwise drafts remain local until creation is explicitly authorized.

When ready, explicitly start the real provider monitors:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/start-uptimerobot.ps1
```

This creates/starts the four monitors on first invocation, or resumes existing
project monitors. It verifies public data readiness first, uses GET every 300
seconds and attaches no alert contacts. API requests are paced for the free
account limit. It preserves IDs and updates a changed Quick Tunnel URL on
subsequent starts. Creation is intentionally deferred until this command runs.
It does not automatically stop after 24 hours.

Pause before shutting down the laptop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/pause-uptimerobot.ps1
```

The command verifies PAUSED statuses. Run the start command again to resume.
Connection/gateway/backend must be running first; recreate the tunnel with
`connect-cloudflare.ps1` if needed. State and action timestamps are saved in
`.tools/uptime/provider-status.json` and `session-events.jsonl`; these record
control operations, not continuous measured uptime. Use provider check/incident
history for final measurements. Paused sessions do not constitute 24 continuous
hours of observation. Add `-WhatIf` for a no-API dry run.

Quick Tunnel hostnames change on recreation. Update paused monitor URLs before
resuming them. URL validity is not a guarantee of uptime; laptop sleep or closing
the tunnel ends public access.

Disconnect without stopping unrelated services:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/uptime/disconnect-cloudflare.ps1
```

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[UptimeRobot API](https://uptimerobot.com/api/),
[UptimeRobot OpenAPI](https://cdn.uptimerobot.com/api/openapi.yaml).
