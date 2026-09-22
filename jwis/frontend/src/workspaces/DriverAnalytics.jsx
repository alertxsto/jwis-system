import React from "react";
import { useLanguage } from "../i18n.jsx";
import {
  Truck,
} from "lucide-react";

export function DriverAnalytics() {
  const { lang } = useLanguage();
  const drivers = [
    { name: "Budi Santoso", truck: "T-001", score: 98, fuel: 4.8, trips: 142, deviations: 0 },
    { name: "Agus Pratama", truck: "T-047", score: 72, fuel: 3.5, trips: 118, deviations: 12 },
    { name: "Joko Wijaya", truck: "T-088", score: 95, fuel: 4.6, trips: 135, deviations: 1 },
    { name: "Rizky Maulana", truck: "T-112", score: 90, fuel: 4.2, trips: 98, deviations: 0 },
  ];

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Analisis Kinerja Pengemudi" : "Driver Performance Analytics"}</h2>
          <p>{lang === "id" ? "Penilaian skor kepatuhan koridor rute, keselamatan, dan efisiensi bahan bakar driver." : "Real-time scoring of route corridor compliance, safety, and fuel efficiency across active drivers."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Truck size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Rata-rata Skor" : "Fleet Avg Score"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>88.75%</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Pengemudi Aktif" : "Active Drivers"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{drivers.length} {lang === "id" ? "orang" : "personnel"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Efisiensi BBM" : "Avg Fuel Economy"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>4.28 km/L</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Bebas Pelanggaran" : "Zero-Deviation"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#15803d" }}>50% {lang === "id" ? "patuh" : "compliant"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "22%" }}>{lang === "id" ? "Nama Pengemudi" : "Driver Name"}</th>
              <th scope="col" style={{ width: "16%" }}>{lang === "id" ? "Kode Truk" : "Assigned Truck"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Skor Kepatuhan Koridor" : "Compliance Score"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Efisiensi Bahan Bakar" : "Fuel Economy"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Total Trip" : "Trips"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Deviasi Rute" : "Deviations"}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const isHigh = d.score >= 90;
              const isMed = d.score >= 80;
              const scoreTone = isHigh ? "success" : isMed ? "warning" : "danger";
              return (
                <tr key={d.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: 700, color: "#334155" }}>
                        {d.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <strong style={{ color: "var(--ui-ink)", fontWeight: 600 }}>{d.name}</strong>
                    </div>
                  </td>
                  <td><span className="plate-badge">{d.truck}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1, height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
                        <div style={{ height: "100%", width: `${d.score}%`, background: isHigh ? "#16a34a" : isMed ? "#d97706" : "#dc2626", borderRadius: "9999px" }} />
                      </div>
                      <span className={`pill ${scoreTone}`} style={{ minWidth: "46px", justifyContent: "center" }}>{d.score}%</span>
                    </div>
                  </td>
                  <td><span className="speed-badge">{d.fuel} km/L</span></td>
                  <td><span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600 }}>{d.trips}</span></td>
                  <td>
                    <span className={`pill ${d.deviations > 0 ? "danger" : "success"}`}>
                      <span className={`status-dot ${d.deviations > 0 ? "danger" : "success"}`} />
                      {d.deviations > 0 ? `${d.deviations} ${lang === "id" ? "kali" : "alerts"}` : (lang === "id" ? "Nihil" : "None")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
