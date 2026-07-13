# JWIS Pilot Plan (8 weeks)

> Goal: validate JWIS on a small, real slice of DLH operations with measurable
> acceptance criteria before any wider rollout. Scope kept deliberately small.

## Scope

- **~30 trucks**, **3 kecamatan**, **1 facility (Bantargebang weighbridge) interface**.
- Read-only integration first (observe), then advisory dispatch, then approved dispatch.

## Owner & agreements

- **Product owner:** _[assign]_
- **DLH sponsor:** _[assign]_
- **Data-sharing agreement:** required before any GPS/weighbridge data is stored.
  Data anonymized; retention and deletion terms written down.

## Phased timeline

| Week | Phase | Activity |
|---|---|---|
| 1-2 | Setup | Data agreement, anonymized sample ingest, baseline measurement |
| 3-4 | Observe | Run route-deviation + queue sim in shadow mode; compare with reality |
| 5-6 | Advise | Dispatcher uses JWIS recommendations; log accept/override |
| 7-8 | Measure | Compare pre/post KPIs; write validated impact |

## Acceptance criteria (must be measured on real ops)

- **Route-alert precision/recall** vs supervisor judgement (target precision ≥ 0.8).
- **Dispatch response time** (instruction → field confirm) improved vs baseline.
- **Queue P95 wait** at weighbridge reduced or explained.
- **Collection SLA** maintained or improved.
- **Operator task success** on Field App (acknowledge/confirm/incident) ≥ 90%.

## Risks

- Data access delays → start with shadow mode on samples.
- False alerts eroding trust → tune sustained-breach threshold in Week 3-4.
- Connectivity gaps in field → offline outbox already implemented.

## Exit

- Go/no-go for wider rollout based on measured acceptance criteria and DLH sign-off.
