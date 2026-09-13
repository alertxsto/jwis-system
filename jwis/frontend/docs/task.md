# JWIS Frontend — Task Tracker

> **Catatan status:** ini pelacak fase pertama (ekstraksi komponen dan pemecahan
> CSS). Seluruh itemnya selesai. Fase berikutnya — penggantian sistem visual,
> redesign layout, dan penghapusan fallback yang mengarang angka — dicatat di
> [walkthrough.md](./walkthrough.md).

## Phase 1 — Quick Wins
- [x] tokens.css — ganti accent color ke teal
- [x] base.css — hapus outline:none global, fix font family
- [x] shell.css — ganti hardcoded hex ke CSS vars, fix magic number
- [x] components.css — fix .icon-button background
- [x] AppShell.jsx — fix typo "weighbridge", fix profile role, hapus duplikasi StatusBadge

## Phase 2 — Functional Fixes
- [x] main.jsx LoginPage — tambah isSubmitting state
- [x] Topbar search — implementasi Ctrl+K focus handler

## Phase 3 — Component Extraction
- [x] ui/StatusPill.jsx
- [x] ui/KpiCard.jsx
- [x] components/AlertQueue.jsx
- [x] components/RouteEvidencePanel.jsx
- [x] components/WeatherPanel.jsx
- [x] components/TpaQueuePanel.jsx
- [x] components/FleetTable.jsx
- [x] components/FleetHistoryPanel.jsx
- [x] components/AssistantPanel.jsx
- [x] components/CarbonPanel.jsx
- [x] components/UnlicensedCollectorAlerts.jsx
- [x] components/AStarReroutingPanel.jsx
- [x] components/StaggerSimulatorPanel.jsx
- [x] components/DataAuditWorkspace.jsx
- [x] main.jsx cleanup: 2583 → 1709 baris

## Phase 4 — CSS Restructuring
- [x] map.css (extract dari legacy.css)
- [x] forecast.css (extract dari legacy.css)
- [x] planning.css (extract dari legacy.css)
- [x] legacy.css cleanup
- [x] styles.css update imports
