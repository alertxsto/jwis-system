# Narasi Demo & Batas Data JWIS

Dokumen ini menjelaskan demo flow yang direkomendasikan dan klasifikasi data jujur
(real vs simulasi) yang wajib disampaikan saat presentasi lomba atau kunjungan.

## Demo Utama (Alur Cerita)

1. **Buka Command Center** — perlihatkan KPI dan alert. Narrasi: "JWIS mendeteksi
   2 kendala operasional di lapangan dan proyeksi lonjakan volume 41% di Jakarta Barat."
2. **Kasus rute (Case 1):** buka Fleet Operations, perlihatkan T-047 keluar koridor
   (>2 km), dan jelaskan sistem menjatuhkan recovery berupa Route B - Daan Mogot Recovery
   via OSRM/A* dynamic rerouting.
3. **Forecast:** buka Waste Forecast; jelaskan skenario "hujan ekstrem (>=30mm) +
   event 50jt + akhir pekan" menaikkan tonase; gunakan tool prediction di toma.
4. **Optimasi armada:** buka Integrated Planning; jelaskan CP-SAT menugaskan truk yang
   tersedia & berizin ke area paling terdampak; tampilkan plan yang dihasilkan dan approve.
5. **Loop tertutup:** dispatch ke WhatsApp / FieldApp, konfirmasi kembali, tinjau
   history + executive summary di akhir session.

## Klasifikasi Data (WAJIB Jujur)

- **REAL**: baseline SILIKA 2023 DLH (TPS & wajib retribusi), Open-Meteo forecast/cuaca
  historis, kalender libur Indonesia, batas admin Jakarta, OSRM public routing, event resmi.
- **SIMULATED untuk prototype**: fleet GPS positions, breadcrumbs, keramaian event,
  pengumpul ilegal, sebagian sampah seed. Jika data disajikan ke juri, tandai sumbernya.
- **Model**: Prophet + XGBoost hybrid; resolusi harian per-kecamatan berlabel
  "kalibrasi-sintetik" (bukan akurasi terukur); metrik MAE/WAPE/MASE tersedia di audit.

## Narasi Lomba (Positioning)

- "JWIS, alat kendali operasional logistik sampah DLH Jakarta bertpragma layanan 3:
  pengawasan armada, prediksi timbulan, perencanaan optimal rendah emisi."
- Rendah-kepercayaan: peran Ana (asisten) mendata — tegas soal batas demo, tidak mengarang
  angka, dan selalu menyarankan operator bertindak di dashboard.

## Demo yang Perlu Dihindari

- Jangan klaim WhatsApp terkirim bila gateway `connected=false`.
- Jangan presentasikan angka simulasi sebagai angka lapangan.
- Jangan lel menjelaskan field teknis mentah (snake_case, koordinat) kepada audiens umum;
  gunakan bahasa manusia.