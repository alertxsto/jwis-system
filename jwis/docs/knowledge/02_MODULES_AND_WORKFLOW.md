# Modul & Workflow JWIS

JWIS adalah command center operasional DLH Jakarta yang menghubungkan pengawasan armada,
forecast sampah, perencanaan dispatch, konfirmasi lapangan, dan pelaporan audit dalam satu alur kerja.

## Alur Tertutup (Closed Loop)

`detect -> predict -> recommend -> approve -> dispatch -> confirm -> audit`

- **detect:** deviasi rute, kerusakan truk, pengumpul ilegal (collector_registry), antrean TPA.
- **predict:** Waste Forecast 7 hari (hybrid Prophet + XGBoost per kelurahan; driver cuaca/event/weekend/libur).
- **recommend:** rekomendasi rute (skor ETA/traffic/flood), tambahan truk/kru/bin kebersihan,
  staggered dispatch.
- **approve:** manajer menyetujui plan operasional (output CP-SAT optimizer) di dashboard.
- **dispatch:** instruksi dikirim ke sopir melalui FieldApp dan/atau WhatsApp Gateway (Baileys).
- **confirm:** status diubah (dispatch/selesai) dan tersimpan di HistoryStore.
- **audit:** riwayat semua event (`dispatch_created`, `dispatch_confirmed`, `assistant_query`,
  `executive_summary`) di `/api/history`; executive summary otomatis per tanggal.

## 8 Modul

1. **Command Center** — KPI (truk aktif, isu, antrean TPA), alert aktif, headline eksekutif, snapshot.
2. **Fleet Operations** — peta MapyLibre live, status koridor, T-047 demo deviasi, route recovery.
3. **Waste Forecast** — prediksi per kelurahan/kecamatan, spike%, man-hours, bins, tonase, CO2.
4. **Integrated Planning** — CP-SAT optimizer: demand -> assignment truk, plan approve.
5. **Dispatch & WhatsApp** — instruksi ke FieldApp + gateway Baileys; status OpenWA live.
6. **Field App** — halaman `/field`: driver melihat misi, konfirmasi status.
7. **Model Audit** — `/api/ml/models`, suitability, metrik evaluasi (MAE/WAPE/MASE).
8. **History & Reports** — executive summary, export, replay event.

## Layout Frontend

- Dashboard utama pada frontend `main.jsx`; FieldApp terpisah di `field/FieldApp.jsx`;
  LiveFleetMap.jsx untuk peta.
- Backend: `main.py` membawa seluruh route; logika terpisah di `app/*.py` (engine, data,
  tools, astar_routing, osrm, dsb).