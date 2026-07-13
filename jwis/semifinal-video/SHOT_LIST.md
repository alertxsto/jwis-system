# JWIS Semifinal Video Shot List

Target final runtime: 08:30. Hard limit: 10:00.

| Time | Visual | Required Action | Editing Note |
|---|---|---|---|
| 00:00-00:25 | Opening card | Show team name, members, case provider, required partner logos | Hold at least 5 seconds before narration starts |
| 00:25-01:20 | Problem framing | Three short problem statements | Use human voice; no AI voice dubbing |
| 01:20-02:00 | Dashboard overview | Slow cursor movement across KPI, map, alert, forecast | Avoid random scrolling |
| 02:00-02:45 | Data evidence | Weather, heatmap, OSRM panels | Zoom browser to keep text readable |
| 02:45-03:35 | Fleet map | Open T-001, T-112, then T-047 marker | T-047 must be visibly red |
| 03:35-04:25 | OSRM + queue | Show ETA, distance, route source, TPA delay | Pause on evidence values |
| 04:25-05:20 | Dispatch loop | Approve route, open Field App, click Siap | This is the strongest demo moment |
| 05:20-06:15 | Prediction | Show West Jakarta spike, weather, heatmap | Explain factors, not only percentage |
| 06:15-06:55 | Simulator | Change attendance and rainfall | Use values rehearsed beforehand |
| 06:55-07:30 | Assistant/reporting | Ask one question; show PDF export; mention WA adapter | Do not wait on unconfigured external services |
| 07:30-08:05 | Architecture/safety | Show API docs or architecture, mention fallbacks/tests | Keep technical detail concise |
| 08:05-08:30 | Closing card | Summary and thank you | Required logos remain visible |

## Recording URLs

- Opening/closing cards: open `cards.html` in a browser, press `1` or `2`.
- Command center: `http://localhost:5173/`
- Field application: `http://localhost:5173/field`
- API documentation: `http://localhost:8000/docs`

## Cursor Rehearsal

1. Refresh command center and wait for MapLibre markers to load.
2. Keep T-047 alert visible before recording.
3. Dispatch T-047 once only.
4. Switch to `/field`, verify T-047 is selected, then click `Siap`.
5. Return to command center using a prepared browser tab.
6. Ask the assistant: “What is the biggest operational risk today?”
7. Export PDF only if the browser download prompt has been tested.
