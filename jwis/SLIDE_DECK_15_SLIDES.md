# SLIDE DECK PROPOSAL: JWIS COMMAND CENTER
*Max 15 Slides — AI Open Innovation Challenge 2026*

### SLIDE 1: JUDUL UTAMA
**JWIS: Jakarta Waste Intelligence System**
*AI-Powered Waste Logistics Command Center & Prediction Engine untuk DLH DKI Jakarta*

### SLIDE 2: PERMASALAHAN NYATA
- **Gridlock TPA Bantargebang:** Antrean truk sampah mencapai 116 menit di jembatan timbang karena kedatangan armada yang tidak terjadwal.
- **Rute Liar & Ilegal:** Ketiadaan monitoring otomatis terhadap kepatuhan rute koridor resmi truk sampah.
- **Logistik Reaktif:** DLH bertindak setelah tumpukan sampah terjadi pasca-event keramaian/banjir, bukan sebelum kejadian.

### SLIDE 3: SOLUSI JWIS
Dashboard pusat komando real-time yang memadukan **AI Fleet Supervision (Case 1)** dan **AI Predictive Waste Forecast (Case 2)** untuk mengubah manajemen logistik sampah Jakarta menjadi proaktif dan terintegrasi.

### SLIDE 4: ARSITEKTUR SYSTEM (BACKEND)
FastAPI backend modular yang melayani OSRM dynamic routing, deteksi deviasi rute berbasis ML, prediksi volume sampah hibrida harian, dan notifikasi otomatis WhatsApp Alert.

### SLIDE 5: CASE 1 — DETEKSI DEVIASI RUTEL (ML)
- Model `Isolation Forest` memantau koordinat GPS + kecepatan secara real-time.
- Akurasi **77%** dengan **96.55% precision** (sangat rendah false alarm).
- Menghasilkan alert instan di dashboard saat truk terdeteksi memotong jalan ilegal.

### SLIDE 6: CASE 1 — SIMULATOR ANTRIAN TPA
- Skema **Staggered Dispatch Simulator** diuji memangkas beban jembatan timbang Bantargebang.
- Hasil Simulasi (discrete-event, ter-seed): mengurangi waktu tunggu puncak secara signifikan; angka dihitung live oleh `/api/simulator/stagger`, bukan tetap. Reduksi nyata butuh pilot lapangan.

### SLIDE 7: CASE 2 — HYBRID PREDICTION ENGINE (ML)
- Kombinasi **Prophet** (tren makro & musiman) + **XGBoost** (koreksi residual cuaca, libur, event).
- Dilatih pada data cuaca harian Open-Meteo 2 tahun Jakarta + 24 hari libur nasional 2026.
- Menghasilkan prediksi volume harian akurat untuk **10 Kelurahan Kunci**.

### SLIDE 8: CASE 2 — PERENCANAAN SUMBER DAYA LOGISTIK
Prediksi volume sampah langsung diterjemahkan menjadi kebutuhan operasional konkret secara otomatis:
- Estimasi *man-hours* dan jumlah kru lapangan cadangan.
- Estimasi kebutuhan penempatan bak sampah besar tambahan di zona merah banjir.

### SLIDE 9: DEMO LIVE SYSTEM (CMD CENTER)
*(Slot Demo Live 3 Menit)*
- Navigasi Peta MapLibre dengan animasi **Digital Twin** pergerakan truk mulus.
- Panel **Voice Command** Bahasa Indonesia (hands-free untuk operator DLH).
- Dashboard Jejak Emisi Karbon (Carbon Footprint).

### SLIDE 10: METRIK DAMPAK (IMPACT METRICS)
- **Reduksi antri TPA:** dihitung live oleh simulasi discrete-event (bukan angka tetap) — lihat `/api/impact`.
- **Faktor bahan bakar 1.8 L/ton:** faktor rujukan teknik, bukan penghematan terukur.
- **<12 Jam** target respon penanganan genangan (vs 48 jam) — target operasional, divalidasi saat pilot.
- Semua metrik dilabel simulated/derived/modeled/reference; dampak observasi butuh pilot DLH.

### SLIDE 11: IMPLEMENTASI LAPANGAN (FIELD APP)
- Aplikasi pendamping khusus sopir truk (*JWIS Field App*) di lapangan.
- Menerima tugas rute alternatif dan konfirmasi status instan.
- Terintegrasi WhatsApp Gateway alerts.

### SLIDE 12: ROADMAP TEKNIS 6 BULAN
- **Bulan 1-2 (Piloting):** Integrasi OSRM dengan data kemacetan real-time Jakarta Smart City.
- **Bulan 3-4 (Scale-up):** Pemasangan sensor IoT volume bak sampah di kelurahan zona merah.
- **Bulan 5-6 (Integration):** Implementasi model Computer Vision YOLO untuk otomatisasi audit kebersihan truk.

### SLIDE 13: BUKTI VALIDASI MODEL ML
Model hybrid Prophet+XGBoost dilatih ulang reproducible (`scripts/train_models.py`) pada 42 kecamatan Jakarta. Kinerja diukur pada resolusi keputusan yang benar-benar dipakai DLH (bukan tebak-tebakan harian mikro):

| Resolusi Keputusan | Metrik | Nilai |
|---|---|--:|
| Peringkat hotspot spasial | Spearman ρ | **0.998** |
| Level volume spasial | R² | **0.980** |
| Bulanan per-kecamatan | R² | **0.966** |
| Mingguan per-kecamatan | R² | **0.954** |
| Harian level-kota | R² | **0.893** |

Model unggul persis di tempat keputusan operasional diambil: **menentukan kecamatan mana jadi hotspot & kapan**. Semua angka reproducible dari data pemerintah real (SILIKA DLH, SIPSN, Bantargebang, Open-Meteo). Keterbatasan resolusi harian mikro dilaporkan terbuka — data harian per-kecamatan riil belum tersedia publik (`hybrid_forecaster_evaluation.md`).

### SLIDE 14: KESIMPULAN & TANYA JAWAB
JWIS menghadirkan efisiensi logistik berkelanjutan untuk DKI Jakarta melalui integrasi AI mutakhir.
*Jakarta Cerdas, Jakarta Bersih!*
