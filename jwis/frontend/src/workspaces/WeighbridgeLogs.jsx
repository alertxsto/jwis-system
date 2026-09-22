import React from "react";
import { useLanguage } from "../i18n.jsx";
import {
  Truck,
  Clock,
  Workflow,
} from "lucide-react";

export function WeighbridgeLogs() {
  const { lang } = useLanguage();
  const logs = [
    { time: "16:45:12", truck: "T-001", type: "Dump Truck Besar", gross: 24.2, tare: 6.0, net: 18.2, status: "SUCCESS" },
    { time: "16:42:05", truck: "T-088", type: "Arm Roll Besar", gross: 23.8, tare: 5.8, net: 18.0, status: "SUCCESS" },
    { time: "16:35:50", truck: "T-136", type: "Dump Truck Kecil", gross: 12.5, tare: 3.5, net: 9.0, status: "SUCCESS" },
    { time: "16:30:14", truck: "T-112", type: "Compactor Kecil", gross: 11.2, tare: 3.2, net: 8.0, status: "SUCCESS" },
    { time: "16:15:22", truck: "T-047", type: "Compactor Besar", gross: 24.5, tare: 6.2, net: 18.3, status: "SUCCESS" },
  ];

  const totalNet = logs.reduce((sum, l) => sum + l.net, 0);

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Catatan Penimbangan Jembatan Timbang" : "Weighbridge Weighing Records"}</h2>
          <p>{lang === "id" ? "Transaksi real-time dari sensor timbangan digital TPA Bantargebang." : "Real-time transactions ingested from Bantargebang weighbridge digital telemetry scales."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Workflow size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Total Muatan Masuk" : "Total Ingested Load"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{totalNet.toFixed(1)} {lang === "id" ? "ton" : "tons"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Status Timbangan" : "Scale Status"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#15803d" }}>{lang === "id" ? "Timbangan #01 — Aktif" : "Scale #01 — Online"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Rata-rata Muatan Bersih" : "Avg Net Tonnage"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{(totalNet / logs.length).toFixed(1)} t / {lang === "id" ? "truk" : "truck"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Waktu Transaksi" : "Timestamp"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Kode Truk" : "Truck Code"}</th>
              <th scope="col" style={{ width: "22%" }}>{lang === "id" ? "Kategori Kendaraan" : "Vehicle Category"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Berat Kotor" : "Gross Weight"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Berat Tara" : "Tare Weight"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Berat Bersih" : "Net Weight"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Status" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, idx) => (
              <tr key={idx}>
                <td>
                  <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                    <Clock size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />
                    {l.time}
                  </span>
                </td>
                <td><span className="plate-badge">{l.truck}</span></td>
                <td><span className="zone-tag">{l.type}</span></td>
                <td><span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 500 }}>{l.gross} t</span></td>
                <td><span style={{ fontFamily: "var(--mono, monospace)", color: "var(--ui-muted)" }}>{l.tare} t</span></td>
                <td><strong style={{ fontFamily: "var(--mono, monospace)", color: "var(--ui-ink)", fontWeight: 700 }}>{l.net} t</strong></td>
                <td>
                  <span className="pill success">
                    <span className="status-dot success" />
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
