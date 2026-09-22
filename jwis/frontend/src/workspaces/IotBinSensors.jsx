import React from "react";
import {
  Activity,
} from "lucide-react";

export function IotBinSensors() {
  const sensors = [
    { loc: "Kawasan Monas, Jakarta Pusat", id: "RAD-MONAS-01", fill: 82, status: "CRITICAL", batt: "88%", last: "3 mins ago" },
    { loc: "Gelora Bung Karno, Senayan", id: "RAD-GBK-02", fill: 45, status: "NORMAL", batt: "94%", last: "5 mins ago" },
    { loc: "Bundaran HI - Jl. Sudirman", id: "RAD-HI-03", fill: 94, status: "CRITICAL", batt: "90%", last: "1 min ago" },
    { loc: "Taman Fatahillah, Kota Tua", id: "RAD-KOTUA-04", fill: 20, status: "NORMAL", batt: "92%", last: "12 mins ago" },
  ];

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>IoT Radar Bin Sensors</h2>
          <p>Radar ultrasonic volume capacity tracking deployed at public trash bins.</p>
        </div>
        <Activity size={20} />
      </div>
      <div className="grid-autofit mt-16">
        {sensors.map((s) => (
          <div key={s.id} className="event-item-card">
            <div className="event-header">
              <h3>{s.id}</h3>
              <span className={`pill ${s.status === "CRITICAL" ? "danger" : "success"}`}>{s.status}</span>
            </div>
            <p className="location">{s.loc}</p>
            <div className="iot-sensor-meta">
              <div>
                <span>Fill Capacity</span>
                <strong>{s.fill}%</strong>
              </div>
              <div className="iot-sensor-health">
                <span>Battery: {s.batt}</span>
                <span>Checked {s.last}</span>
              </div>
            </div>
            <div className="iot-fill-track">
              <span className={s.status === "CRITICAL" ? "critical" : "normal"} style={{ width: `${s.fill}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── COMMAND CENTER (main dashboard) ──────────────────────────────────
