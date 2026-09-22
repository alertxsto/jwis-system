# Panduan Operator Dashboard JWIS

Panduan ini menjelaskan cara membaca KPI, menginterpretasi alert, dan mengambil tindakan
operasional yang tepat di dashboard JWIS. Berlaku untuk role: executive, dispatcher,
supervisor, driver, auditor, dan administrator.

## Login & Role

- Login dilakukan di halaman depan dashboard dengan username = role (misal `dispatcher`)
  dan password default `<role>-demo-pass` (dapat dioverride via env `JWIS_PW_<ROLE>`).
- Role: executive, dispatcher, supervisor, driver, auditor, administrator.
- Permission: dispatcher (dashboard:read, operations:plan, dispatch:create, history:read);
  supervisor (+ operations:approve); driver (dispatch:confirm); auditor (history/report/provenance);
  administrator (semua + admin:manage).

## Panel Command Center

- **active_trucks**: jumlah kendaraan berstatus aktif atau deviasi.
- **trucks_with_issues**: kendaraan yang melanggar koridor ATAU dilaporkan rusak -> prioritas tindakan.
- **tpa_wait_minutes**: estimasi waktu tunggu di TPST Bantargebang (dari simulasi antrian).
  - < 45 mnt: hijau, normal.
  - 45-90: kuning, stagger keberangkatan 20 menit.
  - >= 90: merah, tunda keberangkatan truk non-esensial 30-45 menit.
- **pending_dispatches**: jumlah instruksi yang belum dikonfirmasi lapangan; tindak lanjuti
  untuk menutup loop.
- **predicted_spike_percent**: lonjakan tertinggi di antara prediksi; hubungkan ke kecamatan hotspot.

## Membaca Alert

- Alert berasal dari `build_alerts()` pada snapshot: status kerusakan, deviasi koridor.
- Alert kritis ditandai di panel dan ana dapat menjelaskan alasannya (jarak point-to-polyline,
  posisi, rekomendasi rute recovery).
- Urutan tindakan: konfirmasi truk -> kirim instruksi recovery -> verifikasi FieldApp -> audit.

## Aksi yang Disarankan per Skenario

1. **Alert deviasi T-047**: redirect ke Route B - Daan Mogot Recovery (OSRM/atan A* recovery);
   lihat `/fleet/route-decision` untuk sinyal terpadu (ETA, kerusakan, antrean, izin).
2. **Antrean TPA merah**: aktifkan staggered dispatch (interval 15 menit) dan tunda
   keberangkatan non-prioritas.
3. **Spike prediksi >= 30%**: tambah kru/truk/bin di hotspot (`/api/predictions/kecamatan`),
   prioritaskan dispatch pertama ke zona tersebut.
4. **Truk rusak**: alokasikan kapasitas cadangan; jangan masukkan truk rusak ke plan alokasi.

## Field App & WhatsApp

- `/field` menampilkan instruksi khusus sopir; konfirmasi mengubah status dispatch.
- WhatsApp Gateway (Baileys): status Live di `/api/whatsapp/status`; gunakan hanya kondisi
  gateway `connected=true`; jangan pernah mengklaim terkirim jika tidak.
- Ana (asisten) bersifat read-only: dia bisa merekomendasikan dan menganalisis apa pun,
  tetapi tidak pernah mengirim dispatch/alert; operator yang menekan tombol.

## Batas Data (Kejujuran)

- Data yang berlabel SIMULATED: fleet breadcrumbs, event attendance, pengumpul ilegal,
  seed waste. Data resmi: baseline SILIKA DLH, Open-Meteo weather, kalender libur RI,
  OSRM public routing, event resmi. Jangan memaparkan SIMUL sebagai data terukur.