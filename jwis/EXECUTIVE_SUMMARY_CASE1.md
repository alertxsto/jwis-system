# EXECUTIVE SUMMARY — CASE 1
## Fleet Monitoring & Supervision (JWIS)
*AI Open Innovation Challenge 2026 · DLH DKI Jakarta*

### MASALAH
Pengawasan armada truk sampah DKI Jakarta masih manual. Dua titik nyeri utama:
1. **Antrian TPA Bantargebang** mencapai 116 menit karena kedatangan armada menumpuk tidak terjadwal.
2. **Deviasi rute ilegal** sopir memotong koridor non-izin tanpa terdeteksi otomatis.

### SOLUSI JWIS
Pusat komando real-time yang menggabungkan tracking GPS, deteksi anomali ML, dan simulator penjadwalan:
- **Deteksi Deviasi Rute (Isolation Forest ML):** memantau koordinat + kecepatan armada. Akurasi **77%**, precision outlier **96.55%** (false alarm minimum). Alert instan muncul di dashboard saat truk keluar koridor resmi.
- **OSRM Dynamic Routing:** rekomendasi rute alternatif permit-compliant dengan skor gabungan ETA + macet + risiko banjir.
- **Staggered Dispatch Simulator:** penjadwalan keberangkatan bertahap (interval 15 menit) untuk meratakan beban jembatan timbang.

### DAMPAK TERUKUR
| Metrik | Sebelum | Dengan JWIS | Perbaikan |
|---|---|---|---|
| Waktu tunggu TPA | peak-hour crowding | staggered arrivals | **turun (simulasi discrete-event)** |
| Truk antri puncak | 47 unit | 19 unit | **-59.6%** |
| Kepatuhan koridor rute | manual/tak terukur | 80% terpantau | real-time |
| Emisi karbon (optimasi rute) | — | 17.58 kg CO2/hari dihemat | 527 kg/bln |

### KESIAPAN OPERASIONAL
Dashboard dilengkapi Digital Twin (animasi armada), Voice Command Bahasa Indonesia (hands-free untuk operator), riwayat perjalanan per truk dengan filter tanggal, integrasi WhatsApp Alert ke sopir, dan Field App konfirmasi tugas di lapangan.
