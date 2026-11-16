# Core AIS and Finance Grafana k6 results

Read-only populated API journeys. Each VU uses a distinct synthetic account. No login storm, payment mutation, bank connection or assessment workload. Ramp 10s, hold 30s, ramp-down 5s; provisional p95 < 2000ms, p99 < 5000ms and failure rates < 1%.

| Module | VUs | Requests | Avg ms | p95 ms | p99 ms | HTTP failures | Cloud |
|---|---:|---:|---:|---:|---:|---:|---|
| core | 10 | 386 | 331.70 | 360.07 | 457.96 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021859) |
| core | 25 | 974 | 356.06 | 386.75 | 489.06 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021863) |
| core | 50 | 1863 | 384.34 | 418.47 | 533.98 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021865) |
| finance | 10 | 352 | 336.62 | 370.32 | 405.64 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021871) |
| finance | 25 | 892 | 365.38 | 410.16 | 493.01 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021877) |
| finance | 50 | 1660 | 419.17 | 542.59 | 891.68 | 0.00% | [completed/passed](https://tancoconut1625.grafana.net/a/k6-app/runs/9021880) |

Core AIS users are admins. Finance mixes admin, student and parent; per-run role counts are in JSON. Results measure local baseline capacity, not production capacity. The backend, database and load generator share this host. Cloud completion/result independently verified with the Grafana API.
