# JWIS Frontend — Audit Mendalam

> **Design Read:** Command center dashboard untuk operator DLH, pengguna internal teknis. Bukan landing page publik. Prioritas: keandalan data, keterbacaan cepat, dan akurasi informasi. Tidak perlu scroll-hijack atau kinetic typography — ini tools, bukan marketing.
>
> **Dial yang sesuai:** `DESIGN_VARIANCE: 5 / MOTION_INTENSITY: 3 / VISUAL_DENSITY: 7`

---

## 🏗️ Struktur Proyek

| Path | Deskripsi | Ukuran |
|---|---|---|
| `src/main.jsx` | **God file** — semua komponen, logic, data mock, App root | 2.557 baris / 95KB |
| `src/layout/AppShell.jsx` | Sidebar + topbar shell | 211 baris |
| `src/LiveFleetMap.jsx` | Peta MapLibre GL | 36KB |
| `src/workspaces/FleetOperations.jsx` | Layout wrapper fleet (tipis) | 97 baris |
| `src/workspaces/WasteForecast.jsx` | Layout wrapper forecast (tipis) | ~50 baris |
| `src/workspaces/IntegratedPlanning.jsx` | Layout wrapper planning (tipis) | ~40 baris |
| `src/field/FieldApp.jsx` | App mobile untuk driver | 8KB |
| `src/ui/` | 3 atom components (MetricStrip, SegmentedControl, StatusBadge) | kecil |
| `src/styles/` | 7 file CSS terpisah (tokens, base, shell, components, legacy, workspaces, responsive) | ~72KB total |

---

## 🔴 Temuan CRITICAL (usability / kebenaran fungsional)

### C1 — God File `main.jsx` (2557 baris)
- **Masalah:** Semua komponen (LoginPage, KpiCard, AlertQueue, FleetTable, WeatherPanel, KecamatanMapPanel, AssistantPanel, DataAuditWorkspace, dll) hidup di satu file 95KB.
- **Dampak:** Tidak ada code splitting → semua kode dimuat sekaligus di browser meskipun user hanya butuh 1 workspace. Build time lambat, kolaborasi tidak mungkin, test sulit.
- **Fix:** Pecah ke file terpisah per komponen/workspace.

### C2 — `lucide-react` digunakan, bukan `@phosphor-icons/react`
- **Masalah:** Skill `design-taste-frontend` melarang lucide-react sebagai default; namun seluruh codebase (AppShell + main.jsx) mengimpor dari `lucide-react`.
- **Status saat ini:** Lucide memang sudah ada di `package.json` sebagai dependency — bukan instalasi ilegal, tapi melanggar skill preference.
- **Fix effort:** Medium — perlu search-replace import secara sistematis setelah phosphor diinstal.

### C3 — Halaman Login: tidak ada indikator loading saat submit
- **Masalah:** Tombol "Sign in" tidak ada loading state — user bisa klik berkali-kali, atau mengira tidak ada respons saat API lambat.
- **Fix:** Tambah `isSubmitting` state → disable button + spinner.

### C4 — `outline: none` global di `base.css` (L36-41)
- **Masalah:** `button, a, input, select, textarea { outline: none; }` menghapus focus indicator untuk semua elemen. Hanya diganti dengan `box-shadow` di `:focus-visible`, namun reset global `outline: none` tetap berbahaya dan melanggar WCAG 2.4.7.
- **Fix:** Hapus `outline: none` global, biarkan browser default kecuali untuk elemen spesifik yang sudah punya custom focus.

---

## 🟠 Temuan MAJOR (kualitas desain dan code)

### M1 — Accent color = AI Purple (`#6366e8`)
- **Masalah:** `--ui-primary: #6366e8` adalah tepat warna "AI indigo-purple" yang dilarang skill sebagai default. Bukan brand color yang dipilih dengan intent — ini LLM default.
- **Konteks JWIS:** Sistem manajemen sampah kota Jakarta → warnanya mestinya lebih grounded: deep teal/green (lingkungan), slate/stone (operasional pemerintah), bukan AI-startup purple.
- **Fix:** Ganti ke accent yang lebih kontekstual, misal `#0F766E` (teal-700) atau `#065F46` (emerald-800).

### M2 — Token font tidak konsisten
- **Masalah:**
  - `base.css`: font utama `"Plus Jakarta Sans"` (tidak ada di `package.json` atau CDN import, hanya fallback ke Geist)
  - `styles.css`: Hanya import `@fontsource/geist-sans` dan `@fontsource/geist-mono`
  - Artinya: Plus Jakarta Sans tidak pernah dimuat → browser fallback ke Geist/system font
- **Fix:** Pilih satu: kalau Geist (sudah diimport), set sebagai font-family utama. Kalau Plus Jakarta Sans, tambahkan importnya.

### M3 — `legacy.css` (1470 baris / 28KB) — nama "legacy" sudah mendeskripsikan masalahnya
- **Masalah:** File ini berisi semua CSS feature-specific (map, forecast, planning, report, simulation) dijadikan satu file. Tidak terstruktur, ada banyak override, magic number.
- **Fix:** Pecah sesuai domain (map.css, forecast.css, planning.css) atau minimal bersihkan dari override and magic number.

### M4 — `components.css` L75-79: `.icon-button` background `var(--ui-ink)` (near-black)
- **Masalah:** Icon button background default adalah near-black (`#0f172a`) — ini kontras tinggi tapi bukan default yang natural untuk sebuah icon action button di dashboard. Refresh button di topbar tampil sebagai blok hitam solid di antara elemen lain.
- **Fix:** Ganti ke `var(--ui-surface)` + border, atau subtle tinted variant.

### M5 — Halaman Login: layout `login-proof` (panel kanan) tidak diketahui kondisi responsifnya
- **Masalah:** Login layout punya `login-card` + `login-proof` (aside kanan). Tidak jelas bagaimana behavior di mobile dari code yang dibaca.
- **Check needed:** Buka `legacy.css` untuk class `.login-shell`, `.login-surface` untuk memverifikasi responsive collapse.

### M6 — Navigation items: `weighbridge` lowercase (inkonsistensi label)
- **Masalah:** Di `AppShell.jsx` L23: `label: "weighbridge Logs"` — huruf 'w' kecil, sementara semua label lain Title Case.
- **Fix:** Ganti ke `"Weighbridge Logs"`.

### M7 — Topbar search input `readOnly`
- **Masalah:** Search input di topbar punya `readOnly` attribute — tidak fungsional. Placeholder untuk fitur yang belum diimplementasi, tapi melanggar aturan skill complete-output (no stubs).
- **Opsi:** Implementasi atau hilangkan search input sepenuhnya sampai ada implementasinya.

---

## 🟡 Temuan MINOR (polish, konsistensi)

### m1 — `nav-tab-btn.active` background `#e5e6ff` tidak pakai CSS variable
- Hardcoded hex `#e5e6ff` dan `#f4f4ff` di `shell.css` L92-98, bukan derived dari `--ui-accent-soft`. Kalau accent color diganti, ini tidak ikut berubah.

### m2 — Spacing value `gap: 14px` dan `padding: 20px 14px` di sidebar
- Nilai `14px` tidak ada di spacing scale standar (4, 8, 12, 16, 24...). Magic number.

### m3 — Profile widget di topbar selalu tampilkan "JWIS Team / DLH Operator"
- Tidak membaca role dari `localStorage.getItem("jwis_role")` yang sudah disimpan saat login. User yang login sebagai "auditor" tetap lihat "DLH Operator".

### m4 — `StatusBadge` terduplikasi di topbar dan sidebar
- Topbar: "API connected / Offline demo"
- Sidebar: "Connected / Demo fallback"
- Dua badge dengan informasi sama tapi label berbeda = competing CTA information.

### m5 — `--ui-shadow: none` and `--shadow: none`
- Shadow tokens diset ke `none` tapi ada `--shadow-hover` yang digunakan. Inkonsistensi — shadow tidak punya sistem yang koheren.

---

## ✅ Yang Sudah Bagus

| Aspek | Keterangan |
|---|---|
| **Font loading** | Geist Sans + Geist Mono via `@fontsource` — benar (bukan Google Fonts CDN link) |
| **CSS Variables / Design tokens** | Ada sistem token di `tokens.css`, cukup komprehensif |
| **CSS custom properties aliasing** | Feature aliases (`--green`, `--amber`, dll.) membantu transisi legacy |
| **Accessibility: focus trap mobile nav** | `AppShell.jsx` punya implementasi focus trap yang baik untuk mobile nav drawer |
| **Reduced motion** | `base.css` punya `prefers-reduced-motion` global |
| **Z-index scale** | Token z-index terstruktur (`--z-dropdown: 20` sampai `--z-tooltip: 70`) |
| **ARIA attributes** | Mobile nav punya `aria-modal`, `aria-hidden`, `aria-expanded`, `inert` — baik |
| **Offline fallback** | `useSnapshot()` punya try/catch dengan fallbackSnapshot |
| **Font rendering** | `text-rendering: optimizeLegibility`, `font-synthesis: none` |
| **Keyboard navigation** | Tab keyboard di FleetOperations pakai ArrowRight/Left/Home/End — benar |
| **Routing sederhana** | `/field` vs root dengan `window.location.pathname` — ringan dan efektif |

---

## 📊 Ringkasan Audit

| Kategori | Jumlah |
|---|---|
| 🔴 Critical | 4 |
| 🟠 Major | 7 |
| 🟡 Minor | 5 |

---

## 🗺️ Rekomendasi Prioritas Pengerjaan

Kalau mau mulai dari yang paling berdampak:

1. **[QUICK WIN]** Fix label "weighbridge" → "Weighbridge", fix duplikasi StatusBadge, fix profile role display dari localStorage
2. **[DESAIN]** Ganti accent color dari AI purple ke teal/emerald yang lebih kontekstual untuk DLH/lingkungan
3. **[DESAIN]** Fix font inconsistency: pilih antara Geist atau Plus Jakarta Sans, import yang benar
4. **[CODE QUALITY]** Pecah `main.jsx` 2557 baris ke komponen terpisah (butuh perencanaan, ini besar)
5. **[A11Y]** Hapus `outline: none` global, tambahkan loading state di login
6. **[CLEANUP]** Ganti hardcoded hex di shell.css ke CSS variables
