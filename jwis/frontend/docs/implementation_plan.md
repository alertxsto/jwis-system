# JWIS Frontend — Rencana Implementasi

> **Design Read:** Command center B2B untuk operator internal DLH. Pengguna: dispatcher, supervisor, auditor, driver. Bukan marketing page — ini operational tool. Prioritas: keterbacaan data cepat, keandalan, dan kejujuran informasi.
>
> **Dials:** `DESIGN_VARIANCE: 5 / MOTION_INTENSITY: 3 / VISUAL_DENSITY: 7`
> Tidak ada scroll-hijack, kinetic typography, atau glassmorphism. Animasi hanya untuk state feedback.

---

## Konteks & Tujuan

Frontend JWIS saat ini adalah sebuah God File (`main.jsx` 2.557 baris / 95KB) yang memuat semua komponen, data mock, dan logic dalam satu file. Selain itu terdapat beberapa pelanggaran desain yang diidentifikasi dari audit (lihat [frontend_audit.md](./frontend_audit.md)).

Plan ini mencakup:
1. **Perbaikan desain & token** (accent color, font, CSS variables)
2. **Perbaikan fungsional** (profile role, loading state, label typo)
3. **Pemecahan `main.jsx`** ke komponen terpisah
4. **Peningkatan CSS** (legacy.css cleanup, magic number, hardcoded hex)
5. **A11y fixes** (outline, focus)

---

## Proposed Changes

### Phase 1 — Quick Wins (non-breaking)

#### [MODIFY] [tokens.css](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/styles/tokens.css)
- Ganti `--ui-primary` dan `--ui-accent` dari `#6366e8` (AI purple) ke `#0F766E` (teal).
- Derive semua shade dari hue yang sama: `--ui-accent-soft`, `--ui-accent-foreground`, focus ring.

#### [MODIFY] [base.css](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/styles/base.css)
- Hapus `outline: none` global (L36-41) — ini A11y fix WCAG 2.4.7.
- Fix font family: tetapkan `"Geist Sans"` sebagai primary.

#### [MODIFY] [shell.css](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/styles/shell.css)
- Ganti hardcoded `#e5e6ff` dan `#f4f4ff` di `.nav-tab-btn` ke CSS variables yang derived dari accent baru.
- Ganti magic number `gap: 14px` → `gap: 12px`.

#### [MODIFY] [components.css](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/styles/components.css)
- Fix `.icon-button` background dari `var(--ui-ink)` ke subtle variant yang lebih wajar.

#### [MODIFY] [AppShell.jsx](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/layout/AppShell.jsx)
- Fix `"weighbridge Logs"` → `"Weighbridge Logs"`.
- Hapus duplikasi StatusBadge di sidebar.
- Baca `localStorage.getItem("jwis_role")` untuk menampilkan role yang benar.

---

### Phase 2 — Functional Fixes

#### [MODIFY] [main.jsx](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/main.jsx) — `LoginPage` component
- Tambah `isSubmitting` state di `LoginPage`.
- Disable tombol + tampilkan loading spinner saat submit.
- Cegah double-submit.

#### [MODIFY] [shell.css](file:///home/alertxist/Projects/jwis-system/jwis/frontend/src/styles/shell.css)
- Tambahkan keyboard shortcut handler `Ctrl+K` untuk memfokuskan search input.

---

### Phase 3 — Komponen Extraction dari `main.jsx`

Memecah `main.jsx` menjadi komponen-komponen mandiri:
- `src/components/KpiCard.jsx`
- `src/components/StatusPill.jsx`
- `src/components/AlertQueue.jsx`
- `src/components/RouteEvidencePanel.jsx`
- `src/components/WeatherPanel.jsx`
- `src/components/TpaQueuePanel.jsx`
- `src/components/FleetTable.jsx`
- `src/components/FleetHistoryPanel.jsx`
- `src/components/AssistantPanel.jsx`
- `src/components/CarbonPanel.jsx`
- `src/components/UnlicensedCollectorAlerts.jsx`
- `src/components/AStarReroutingPanel.jsx`
- `src/components/StaggerSimulatorPanel.jsx`
- `src/components/DataAuditWorkspace.jsx`

---

### Phase 4 — CSS Restructuring

Memecah `legacy.css` menjadi stylesheet modular:
- `src/styles/map.css` (MapLibre rules, markers, popup, legends)
- `src/styles/forecast.css` (Weather, prediction, kecamatan map)
- `src/styles/planning.css` (Stagger, A* reroute, TPA queues)
- `src/styles/panels.css` (Alert, panels, carbon, history tables)

---

## Verification Plan

### Automated Tests
- Menjalankan `npm run build` untuk memverifikasi kompilasi bundler.
