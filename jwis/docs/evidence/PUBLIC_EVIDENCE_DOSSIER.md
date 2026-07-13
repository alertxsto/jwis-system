# JWIS Public Evidence Dossier

Updated: 2026-07-13

## Evidence standard

This dossier is desk research based on public government material. It
corroborates the problem, operational workflow, data contract, and need for
JWIS. It is not stakeholder approval, a DLH pilot, or observed JWIS impact.

Use these labels consistently:

- `official-public`: official government publication or regulation.
- `public-corroboration`: a JWIS assumption supported by public evidence.
- `replay-ready`: enough published inputs exist for a reproducible scenario.
- `unvalidated`: requires internal data or an authorized field pilot.

## Evidence matrix

| ID | Official public evidence | JWIS implication | Safe use | Limitation |
|---|---|---|---|---|
| E01 | Pemprov DKI press release, 2 Apr 2026: DLH split waste transport into three daily shifts to reduce truck queues; reported dwelling time was kept within three hours. [Source](https://www.jakarta.go.id/siaran-pers/6588-SP-HMS-04-2026) | Staggered dispatch is an observed DLH operating practice, not an invented workflow. | Use three shifts and 180 minutes as a public scenario/SLA reference. | Does not prove the JWIS optimizer reduces waiting time. |
| E02 | UPST DLH article, 20 Mar 2017: DLH integrated truck GPS with weighbridges for traffic management and queue anticipation around TPST Bantargebang. [Source](https://upst.dlh.jakarta.go.id/article/post-6) | GPS, weighbridge, geofence, command-center, and dwelling-time concepts match the operating environment. | Position JWIS as a decision-intelligence layer over established telemetry. | Historical article; current implementation details may differ. |
| E03 | Jakarta Barat official report, 31 Mar 2026: disruption reduced the Jakarta Barat allocation from 308 to 190 trucks/day, leaving a stated gap of 118 trucks/day. [Source](https://barat.jakarta.go.id/index.php/berita/penjelasan-sudis-lh-jakbar-terkait-tumpukan-sampah-tps-pinggir-jalan-kali-kbb) | Facility disruption can propagate into city TPS accumulation and requires dynamic capacity planning. | Build a reproducible `308 -> 190 trucks/day` disruption replay. | A temporary incident, not a normal operating baseline. |
| E04 | DLH report on New Year 2025: it forecast 150 tons using crowd-point growth and predicted rain; observed collection was 132 tons after rain did not occur. [Source](https://lingkunganhidup.jakarta.go.id/detail-artikel/perayaan-malam-tahun-baru-di-jakarta-hasilkan-132-ton-sampah) | Event location and weather are publicly documented forecast drivers. | Use as an external event forecast case: absolute error 18 tons; APE 13.6% against observed volume. | One event is not enough to establish general model accuracy. |
| E05 | DLH report for Independence Day 2025: 1,800 workers operated in two shifts, supported by 14 road sweepers, 12 compactors, 12 inorganic trucks, and 65 bins across event locations. [Source](https://lingkunganhidup.jakarta.go.id/detail-artikel/dlh-pastikan-jakarta-bersih-pada-peringatan-kemerdekaan-ke-80-tahun) | Readiness decisions are spatial and require coordinated crews, vehicles, bins, and shifts. | Use published allocation as a resource-planning reference scenario. | It does not publish waste tonnage by location or allocation cost. |
| E06 | Pergub DKI No. 215/2012 identifies floods and temporary crowds as causes of major waste-volume increases and allows mobilization of people and infrastructure. [Source](https://jdih.jakarta.go.id/dokumenPeraturanDirectory/0031/2012PERGUB0031215.pdf) | Case 2 drivers and resource recommendations are aligned with a documented government response mechanism. | Cite as policy grounding for event/weather scenarios. | The regulation does not prescribe a forecasting algorithm. |
| E07 | DLH 2026 environmental status summary reports 2025 DKI waste generation of 9,187.24 tons/day and Bantargebang intake around 6,500-7,000 tons/day. [Source](https://lingkunganhidup.jakarta.go.id/uploads/images/galery/buku%20i%20ringkasan%20eksekutif%20slhd%20dki%20jakarta%202026_final%2031.05.2026_20260604071914.pdf) | The scale and constrained downstream capacity justify city-level forecasting and dispatch coordination. | Use as the current official scale baseline, with document year and page noted. | City totals do not provide daily district-level ground truth. |
| E08 | UPST DLH public FAQ states that disposal records include entry/exit time, plate, vehicle identifier/type, work location, gross weight, tare, and net weight. [Source](https://upst.dlh.jakarta.go.id/wastemanagement/faq) | A realistic future integration contract can be specified without claiming data access. | Map these fields to a proposed JWIS weighbridge adapter schema. | Public field descriptions are not API access or permission to process records. |

## Reproducible validation without internal access

### Replay A: Bantargebang disruption

- Published normal allocation: 308 Jakarta Barat trucks/day.
- Published disrupted allocation: 190 trucks/day.
- Published shortfall: 118 trucks/day, or 38.3% of the normal allocation.
- Compare a fixed schedule against JWIS reassignment and three-shift planning.
- Report unmet demand, truck utilization, queue estimate, and every assumption.

### Replay B: New Year event forecast

- Published forecast: 150 tons.
- Published observed collection: 132 tons.
- Published explanation: expected rain did not occur.
- Run JWIS once with forecast rain and once with observed no-rain conditions.
- Compare absolute error and show whether weather updating moves the prediction
  toward the observed value. Do not train on this event before evaluation.

### Replay C: Independence Day resource readiness

- Use the published event locations, two shifts, 1,800 workers, and vehicle/bin
  counts as a reference plan.
- Ask JWIS to produce a resource plan from the same public inputs.
- Compare coverage, explain differences, and mark missing capacities as unknown.

## Claims that are safe

- Public DLH material confirms that GPS, weighbridges, shifting, event planning,
  and weather-sensitive waste operations are real parts of the problem.
- JWIS combines public baselines and external signals into auditable forecasts,
  route alerts, queue simulations, and proposed dispatch plans.
- Demonstrated percentages are simulated or replay results unless explicitly
  identified as published government figures.

## Claims that must not be used

- "Validated", "approved", "adopted", or "endorsed" by DLH.
- "Live DLH data" unless an endpoint is actually authorized and connected.
- Real-world waiting-time, fuel, carbon, accuracy, or cost improvements based
  only on a simulation.
- District-day forecast accuracy as observed performance; current suitability
  documentation correctly labels that resolution calibrated-synthetic.

## Remaining unvalidated questions

- Current route-permit corridor definitions and deviation tolerance.
- Current weighbridge service-time distribution and queue SLA by condition.
- Dispatch approval authority and override workflow.
- Official TPS operational capacities and daily district-level ground truth.

