import React from "react";
import { AlertTriangle, Fuel, Gauge, Route, Users } from "lucide-react";
import { useLanguage } from "../i18n.jsx";

const drivers = [
  { name: "Budi Santoso", truck: "T-001", score: 98, fuel: 4.8, trips: 142, deviations: 0 },
  { name: "Agus Pratama", truck: "T-047", score: 72, fuel: 3.5, trips: 118, deviations: 12 },
  { name: "Joko Wijaya", truck: "T-088", score: 95, fuel: 4.6, trips: 135, deviations: 1 },
  { name: "Rizky Maulana", truck: "T-112", score: 90, fuel: 4.2, trips: 98, deviations: 0 },
];

function initials(name) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

export function DriverAnalytics() {
  const { lang } = useLanguage();
  const risky = drivers.find((driver) => driver.deviations > 5);

  return (
    <section className="driver-workspace workspace-page">
      <header className="workspace-heading">
        <div>
          <span className="workspace-kicker"><Users size={14} /> Kesiapan personel</span>
          <h1>{lang === "id" ? "Kinerja pengemudi" : "Driver performance"}</h1>
          <p>{lang === "id" ? "Temukan pengemudi yang membutuhkan tindak lanjut berdasarkan kepatuhan rute dan efisiensi kendaraan." : "Identify drivers who need follow-up based on route compliance and vehicle efficiency."}</p>
        </div>
      </header>

      <div className="driver-metric-strip">
        <div><Gauge size={18} /><span>Skor rata-rata<strong>88,8</strong></span></div>
        <div><Users size={18} /><span>Pengemudi aktif<strong>{drivers.length}</strong></span></div>
        <div><Fuel size={18} /><span>Efisiensi rata-rata<strong>4,28 km/L</strong></span></div>
        <div><Route size={18} /><span>Perlu pembinaan<strong>1 orang</strong></span></div>
      </div>

      <div className="driver-command-grid">
        <section className="driver-table-surface">
          <div className="section-intro compact">
            <div><span className="surface-kicker">Seluruh pengemudi</span><h2>Skor kepatuhan</h2></div>
          </div>
          <div className="table-wrap">
            <table className="driver-table">
              <thead><tr><th>Pengemudi</th><th>Kendaraan</th><th>Kepatuhan rute</th><th>Efisiensi</th><th>Perjalanan</th><th>Deviasi</th></tr></thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.truck} className={driver.deviations > 5 ? "needs-attention" : ""}>
                    <td><span className="driver-person"><i>{initials(driver.name)}</i><strong>{driver.name}</strong></span></td>
                    <td><code>{driver.truck}</code></td>
                    <td><span className="score-cell"><span><i style={{ width: `${driver.score}%` }} /></span><b>{driver.score}%</b></span></td>
                    <td>{driver.fuel.toFixed(1)} km/L</td>
                    <td>{driver.trips}</td>
                    <td><span className={`deviation-badge ${driver.deviations > 5 ? "danger" : driver.deviations ? "warning" : "success"}`}>{driver.deviations ? `${driver.deviations} kali` : "Nihil"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="driver-attention-rail">
          <span className="attention-icon"><AlertTriangle size={19} /></span>
          <span className="surface-kicker">Prioritas pembinaan</span>
          <h2>{risky.name}</h2>
          <p>{risky.deviations} deviasi rute terdeteksi pada {risky.trips} perjalanan. Efisiensi BBM juga berada di bawah rerata armada.</p>
          <dl>
            <div><dt>Kendaraan</dt><dd>{risky.truck}</dd></div>
            <div><dt>Kepatuhan</dt><dd>{risky.score}%</dd></div>
            <div><dt>Efisiensi</dt><dd>{risky.fuel.toFixed(1)} km/L</dd></div>
          </dl>
          <div className="attention-note"><strong>Rekomendasi</strong><span>Tinjau bukti rute dan lakukan briefing sebelum sif berikutnya.</span></div>
        </aside>
      </div>
    </section>
  );
}
