# JWIS — Jakarta Waste Intelligence System

**AI Command Center untuk Pengelolaan Sampah Jakarta** — solusi lomba **AI Open Innovation Challenge 2026** dengan Case Provider **Dinas Lingkungan Hidup (DLH) DKI Jakarta**.

JWIS (Jakarta Waste Intelligence System) adalah purwarupa sistem command center AI yang menyelesaikan **dua kasus sekaligus** dari DLH sebagai case provider:

- **Case 1 — AI-Based Waste Transportation Monitoring & Supervision System**: monitoring armada pengangkutan sampah secara real-time, deteksi pelanggaran, dan optimasi penjadwalan.
- **Case 2 — Waste Volume Prediction System Berdasarkan Data Historis & Event**: prediksi volume dan lokasi sampah di area ramai secara prediktif (bukan reaktif).

> Kompetisi: [AI Open Innovation Challenge 2026](https://ai-open.president.ac.id/) · Case Provider: DLH Jakarta · Tim JWIS (Team Dwi Candra dkk.)

---

## Daftar Isi

- [Konteks Kasus](#konteks-kasus)
  - [Case 1 — Monitoring & Supervision Angkutan Sampah](#case-1--monitoring--supervisi-angkutan-sampah)
  - [Case 2 — Prediksi Volume Sampah](#case-2--prediksi-volume-sampah)
- [Solusi Kami](#solusi-kami)
- [Fitur](#fitur)
- [Arsitektur](#arsitektur)
- [Struktur Repositori](#struktur-repositori)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Akun Demo](#akun-demo)
- [Alur Demo](#alur-demo)
- [Testing](#testing)
- [Keamanan & Kredensial](#keamanan--kredensial)
- [Dokumentasi](#dokumentasi)

---

## Konteks Kasus

### Kasus 1 — Monitoring & Supervisi Angkutan Sampah

**Latar belakang:** Aktivitas pengumpulan sampah di DKI Jakarta menghadapi berbagai tantangan: armada tidak terpantau, rute tidak optimal, dan keberadaan pengumpul sampah ilegal. Pengawasan saat ini mengandalkan laporan manual dan inspeksi lapangan yang reaktif.

**Tantangan utama:** Bagaimana memastikan seluruh proses pengumpulan sampah berjalan sesuai regulasi, transparan, dan dapat dimonitor secara real-time...

**Ruang lingkup yang harus dipenuhi:**
- Visualisasi live-tracking dilapisi (*overlay*) pada peta dasar.
- Optimasi penjadwalan transportasi dengan mempertimbangkan estimasi waktu tempuh, status kerusakan armada, dan status antrean di TPA.
- Rekomendasi rute alternatif yang mematuhi regulasi lalu lintas dan izin yang berlaku.

**Output yang diminta:** Model, Dashboard (live route, kondisi armada, riwayat perjalanan, status antrean TPA real-time), Simulator (penjadwalan, estimasi waktu tempuh, rekomendasi rute alternatif), serta Executive Summary (optimasi jadwal dan pengurangan antrean di TPA).

### Case 2 — Prediksi Volume Sampah

**Latar belakang:** Lonjakan volume sampah sering terjadi pada musim hujan, hari besar, atau acara khusus — namun penanganan selama ini dilakukan *setelah* masalah muncul, bukan berdasarkan prediksi yang terukur.

**Tugas utama:** Bagaimana mengubah pendekatan pengelolaan sampah darI *reaktif* menjadi *prediktif*.

**Ruang lingkup yang harus dipenuhi:**
- Estimasi lokasi dan volume sampah dimetakan secara temporal & spasial.
- Estimasi kebutuhan dan lokasi fasilitas pembuangan serta armada transportasi di setiap area ramai, berbasis data izin keramaian (*crowd permit*).

**Output yang diminta:** Model, Dashboard (estimasi lokasi & volume sampah di area ramai, kebutuhan *man-hour*), Simulator (lokasi keramaian, kebutuhan fasilitas & armada), Executive Summary (optimasi fasilitas, jam operasional, dan jadwal pengumpulan).

---

## Solusi Kami

JWIS adalah **AI Command Center** yang menggabungkan tiga lapisan kerja:

| Lapisan | Teknologi | Untuk Apa |
|---|---|---|
| **Command Center** (Dashboard) | React + Vite + MapLibre GL | Visualisasi real-time: armada, rute, TPA, prediksi, kasus & laporan |
| **AI & Optimization Engine** (Backend) | Python FastAPI · OR-Tools CP-SAT · Prophet · XGBoost | Penjadwalan optimasi, prediksi sampah, routing A*, asisten AI berbasis RAG |
| **Alerting** (Skala Lapangan) | Node.js Express + WhatsApp Baileys | Kirim instruksi & peringatan langsung ke telepon petugas/driver |

Keduanya kasus di atas diselesaikan **dalam satu sistem terpadu** — dashboard, simulator, dan model yang terkoneksi, dengan alur *dispatch → konfirmasi → audit* yang dapat dilacak oleh manajer / pemerintah.

---

## Fitur

### Kelola Armada (Kasus 1)
- **Peta Armada Live (full-width)** — posisi GPS armada & status (on-corridor / off-corridor).
- **Deteksi pelanggaran** — armada di luar koridor ditandai (contoh: `T-047` berwarna kuning).
- **Simulasi Kemacetan (A\*)** — penghitungan ulang rute mengikuti jalan menuju TPA Bantargebang secara dinamis.
- **Antrean TPA real-time** — status kuota masuk & jadwal kedatangan bergiliran (*staggered dispatch). 
- **Alert WhatsApp** — instruksi reroute dikirim langsung ke armada via WhatsApp Gateway (Baileys).
- **Field App** — tampilan `/field` untuk driver (username `driver`) untuk memeriksa & memconfirm perintah; sinkronisasi dengan dashboard secara instan.
- **Riwayat perjalanan & bukti rute** — terlacak untuk pelaporan manajemen.

### Prediksi & Asisten AI (Kasus 2)
- **Prediksi volume sampah per Kecatman** — 42 Kecav Jakarta, dibandingkan dengan Prediksi waktu produksi, emisi karbon, jumlah kru, dan campuran armada yang dibutuhkan.
- **Asisten AI Operasional (RAG)** — tanya-jawab berbasis pengetahuan domain pengelolaan sampah Jakarta via gateway 9Router (dengan `jwis/backend/app/rag.py`).
- **Landfill Planning** — perencanaan terpadu (Constraints, pengesahan rencana antrean mingguan) dengan   **OR-Tools CP-SAT**.

### Audit & Transparansi
- **Audit Data & ML** — metrik akurasi model (WAPE, MAE), batas pelatihan, dan asal-usul data (provenance) dapat diaudit langsung dari dashboard.

---

## Arsitektur

```text
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite, MapLibre GL)  · port 5175          │
│  Command Center  ·  Field App (/field)  ·  Landing Page     │
└───────────────┬──────────────────────────────┴─────────────┘
                │ HTTP / JSON
┌───────────────▼──────────────────────────────────────────────┐
│  Backend (Python FastAPI)                      · port 8001   │
│  • OR-Tools CP-SAT — perencanaan / constrained          │
│  • Prophet + XGBoost — prediksi sampah (cache warming) │
│  • Asisten AI (RAG) — via gateway 9Router (OpenAI)    │
└───────────────┬──────────────────────────────┴─────────────┘
                │ HTTP / JSON
┌───────────────▼──────────────────────────────────────────────┐
│  WhatsApp Gateway (Node.js + Baileys)          · port 2785        │
│  QR autentikasi → notifikasi & perintah ke HP petugas          │
└───────────────────────────────────────────────────────────────┘
```

---

## Struktur Repositori

```
jwis-system/
├── README.md                  ← Dokumen ini
├── COMPETITION_CHECKLIST_STATUS.md
├── START_JWIS.bat            ← One-click runner (Windows)
├── jakarta_waste_ai_prd_v2.md ← PRD v2
├── TASK_retrain_models.md    ← Catatan retraining model
├── docs/superpowers/         ← Dokumentasi & rencana pengembangan
└── jwis/
    ├── backend/              ← FastAPI + model + WA Gateway
    │   ├── app/              (astar_routing, rag, whatsapp, main …)
    │   ├── wa-gateway/       (node server Baileys)
    │   ├── data/             ← dataset DLH & provenance
    │   └── tests/
    ├── frontend/             ← React + Vite dashboard + e2e tests
    └── PRODUCT.md            ← spesifikasi produk
```

---

## Menjalankan Secara Lokal

> Prerequisite: Python 3.10+, Node.js 18+, npm.

### 1. Backend API (FastAPI)

```powershell
cd "jwis/backend"
pip install -r requirements.txt

# Salin/konfigurasi kredensial: buat file .env di folder ini
# (jangan commit file tersebut — ia hanya local, sudah di-ignore)
Set-Content -Path .env -Value @'
OPENAI_API_KEY=your-9router-api-key
OPENAI_BASE_URL=http://your-gateway:20128/v1
OPENAI_MODEL=your-model
OPENWA_BASE_URL=http://localhost:2785/api
OPENWA_API_KEY=your-wa-api-key
OPENWA_SESSION_ID=default
'@

python -m uvicorn app.main:app --port 8001
```

Backend mem-warm cache prediksi Prophet + XGBoost saat start (±20–25 dtk) agar respons bisa instan.

### 2. WhatsApp Gateway (Baileys)

```powershell
cd "jwis/backend/wa-gateway"
npm install
node server.js
```

> QR Code akan tampil di terminal. Scan dengan WhatsApp (akun petugas/driver). Sesi tersimpan di `baileys_auth_info/` — **tidak masuk repository** (ignored).

### 3. Frontend (React + Vite)

```powershell
cd "jwis/frontend"
npm install
npm run build
npm run preview -- --port 5175
```

Buka **http://localhost:5175**

> Ada juga `START_JWIS.bat` di root untuk menjalankan semuanya sekali jalan.

---

## Akun Demo

| Role | Username | Password |
|---|---|---|
| Dispatcher (dash) | `dispatcher` | `dispatcher-demo-pass` |
| Driver (field) | `driver` | — |

---

## Alur Demo (End-to-End)

1. Login `dispatcher` di dashboard.
2. **Fleet Operations (Case 1):** lihat peta live, amati `T-047` di luar jalur (kuning) → klik **A\* Simulate Jam** → lihat `T-047` menghitung route baru ke TPA Bantargebang → periksa antrean TPA & slot pengiriman → klik **Send Alert** → buka `/field` di tab lain, login `driver`, konfirmasi instruksi → kembalil ke dashboard, konfirmasi sync instan.
3. **Waste Forecast &amp; AI Assistant (Case 2):** buka **Waste Forecast**, saring/filter 42 Kecamatan, klik kecamatan untuk melihat dashboard optimasi sumber daya (prediksi tonase, bahan bakar, emisi, kru, armada). Gunakan **Operational AI Assistant** untuk bertanya — jawaban dari RAG domain via gateway.
4. **Integrated Planning:** review batasan & approve rencana antrean mingguan.
5. **Data & ML Audit:** audit metrik WAPE/MAE, limit training, dan asal-usul data.

---

## Testing

```powershell
cd "jwis/frontend"
npx playwright test --workers 1
```
E2E Playwright: **42 test** (headless).

---

## Keamanan & Kredensial

- **File `.env` TIDAK boleh masuk ke repo** — sudah di-`gitignore` (`git rm --cached` pada branch ini). Gunakan `.env.example` sebagai template nama key.
- **Sesi WhatsApp Baileys** (`jwis/backend/wa-gateway/baileys_auth_info/`) berisi kredensial pribadi (initialKeys, token, nomor HP) — **tidak boleh di-push**. Sudah di-`gitignore` + untrack sejak branch ini.
- **Log runtime** (`*.log`) juga di-ignore.
- Jika API key / sesi pernah ter-push ke riwayat publik sebelumnya: **rotasikan kredensialnya** (generate key baru) agar aman. Riwayat lama tidak bisa dihapus tanpa *history rewrite* (force push) — sebaiknya hindari force push di repo ber-fork.

---

## Riwayat Jalan

- `84d8f87` … `997ecb0` — Bahkan PR "frontend refactor" bisa ada di main
- Branch `development` ini = snap kerja lokal terbaru (RAG assistant baru, routing improvement, polish workspace/design) — **tanpa kredensial**.

*Proyek original oleh **Tim JWIS** untuk AI Open Innovation Challenge 2026.*