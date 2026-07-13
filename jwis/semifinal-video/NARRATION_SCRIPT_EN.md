# JWIS Semifinal Prototype Video — English Narration

Target runtime: 8 minutes 30 seconds. Speak naturally at approximately 125-135 words per minute. Do not use AI-generated voice dubbing.

## 00:00-00:25 — Opening Identity

Screen: `cards.html`, opening card, full screen.

> Hello judges. We are **[TEAM NAME]**, represented by **[MEMBER NAMES]**. Our selected case provider is Dinas Lingkungan Hidup DKI Jakarta. We present JWIS, the Jakarta Waste Intelligence System: an AI-powered command center that turns waste operations from reactive monitoring into predictive field action.

## 00:25-01:20 — Problem

Screen: show one clean problem slide or keep the command center blurred behind three short problem statements.

> Jakarta's waste transportation process faces three connected operational gaps. First, managers do not always have one actionable view of fleet position, route compliance, vehicle condition, and landfill queues. Second, waste surges caused by heavy rain, holidays, and major events are often handled after they happen. Third, even when a manager identifies a problem, the instruction and confirmation loop with field workers is fragmented.
>
> The result is avoidable travel time, delayed collection, longer queues at Bantargebang, and decisions that depend heavily on manual reports. The challenge is therefore not only to monitor data. The challenge is to convert data into a timely, auditable action.

## 01:20-02:00 — Solution Overview

Screen: command center top section; slowly move the cursor across KPIs, map, alerts, and forecast.

> JWIS integrates Case One and Case Two in a single closed-loop platform. It detects route deviations, evaluates fleet and landfill conditions, calculates alternative routes using OSRM, forecasts spatial waste risk using historical, weather, holiday, and event data, and sends the approved instruction directly to the field worker application.
>
> The operational loop is simple: detect, predict, recommend, dispatch, confirm, and record.

## 02:00-02:45 — Data and AI Evidence

Screen: weather risk, heatmap, OSRM evidence panels.

> JWIS combines multiple evidence layers. We prepared two years of Jakarta historical weather from Open-Meteo, the 2026 Indonesian holiday calendar, Jakarta administrative boundaries, event scenarios, and waste-volume seed data with explicit source labels. Open-Meteo provides the live seven-day rainfall forecast. OSRM provides route geometry, distance, and estimated travel time.
>
> The prediction engine converts rainfall, event attendance, weekend effects, and historical baseline volume into an explainable risk score. Every recommendation shows its operational reason instead of presenting a black-box number.

## 02:45-03:35 — Live Fleet Monitoring

Screen: MapLibre map. Hover or click normal truck, damaged truck, and T-047.

> This is the live fleet supervision map. Green markers represent trucks operating inside their assigned corridor. Amber represents a vehicle condition issue. Red represents a critical route violation.
>
> Truck T-047 is currently outside its assigned corridor. JWIS calculates the distance from the approved route and classifies the severity. The map overlays the assigned corridor, the actual movement, and the spatial waste-risk layer, giving the manager one operational picture instead of separate reports.

## 03:35-04:25 — OSRM Recommendation and TPA Queue

Screen: action queue and OSRM route evidence.

> For T-047, JWIS requests a route from the OSRM routing engine. The system returns full route geometry, distance, and estimated travel time. The recommendation also considers permit compliance, traffic risk, flood risk, and the current Bantargebang queue.
>
> Today, the queue is estimated at forty-seven trucks and one hundred sixteen minutes. Therefore, JWIS recommends Route B and staggered departure timing instead of simply sending every truck toward the landfill at once.

## 04:25-05:20 — Manager Dispatch to Field App

Screen: click `Approve & Dispatch`; then open `http://localhost:5173/field`.

> The manager approves Route B and dispatches the instruction. The decision is stored in the audit history. Now we move to the field-worker interface.
>
> The driver of T-047 receives a clear instruction without needing to understand the analytics behind it. The worker can confirm “Siap,” meaning ready, or report a problem. This closes the communication loop. The manager no longer has to assume that a message was received and understood.

Action: click **Siap**.

> The confirmation is immediately recorded and the pending instruction disappears.

## 05:20-06:15 — Predictive Waste Readiness

Screen: return to command center; show Predictive Readiness, Open-Meteo, and heatmap.

> JWIS also changes waste management from reactive to predictive. The current scenario forecasts the largest increase in West Jakarta. The system explains the drivers: heavy rainfall, a permitted event with high attendance, and weekend activity.
>
> Instead of only predicting tonnes, JWIS translates the forecast into operational requirements: additional trucks, additional crews, and priority districts. The kelurahan risk layer makes the prediction spatial, while the seven-day weather panel provides the temporal view.

## 06:15-06:55 — Scenario Simulator

Screen: Event Scenario Simulator. Change attendance and rainfall values.

> Managers can also test a future scenario. For example, we increase expected attendance and rainfall. JWIS immediately updates the estimated waste spike, additional fleet requirement, and crew requirement. This supports planning before a concert, public holiday, flood risk, or major city event.

## 06:55-07:30 — AI Assistant, Alerts, and Reporting

Screen: AI assistant, WhatsApp alert button, PDF export.

> The operational assistant answers natural-language questions using the current command-center snapshot. It can use an OpenAI endpoint when configured, with a local deterministic fallback for demo resilience. Critical alerts can also be forwarded through the optional OpenWA WhatsApp adapter. Finally, JWIS generates an executive summary and exports it as a PDF for leadership reporting.

## 07:30-08:05 — Feasibility and Safety

Screen: API docs or architecture image; then briefly show PWA/offline indicator.

> The prototype uses React, MapLibre, FastAPI, SQLite, Open-Meteo, and OSRM. It includes automated backend tests, explicit fallback data, and service-worker caching so the demonstration remains functional when an external service is temporarily unavailable. In production, synthetic fleet and event inputs can be replaced by internal DLH GPS, permit, and operational APIs without changing the user workflow.

## 08:05-08:30 — Impact and Closing

Screen: `cards.html`, press 2 for closing card.

> JWIS is not only a dashboard. It is an operational decision loop connecting prediction, route supervision, management approval, and field confirmation. Our goal is to reduce response time, prevent avoidable route and queue delays, and help DLH allocate fleet and manpower before waste surges occur.
>
> JWIS: detect, predict, dispatch, and confirm. Thank you.

## Claims That Must Stay Honest

- Say “prototype,” not “deployed system.”
- Say “estimated” for queue time, fleet savings, and manpower impact.
- State that fleet GPS and some event/waste data are simulated or fallback data.
- Do not claim a trained Prophet/XGBoost model unless it is implemented and validated before recording.
- Do not claim WhatsApp was sent unless OpenWA is configured and the message is visibly delivered.
