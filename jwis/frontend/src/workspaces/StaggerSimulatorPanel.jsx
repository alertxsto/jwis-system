import React, { useState } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  RefreshCcw,
  Truck,
  Clock,
  ArrowRight,
} from "lucide-react";

export function StaggerSimulatorPanel() {
  const { t, lang } = useLanguage();
  const [result, setResult] = useState({
    baseline_wait_minutes: 116,
    baseline_queue_trucks: 47,
    optimized_wait_minutes: 48,
    optimized_queue_trucks: 19,
    queue_reduction_percent: 58.6,
    recommended_stagger_minutes: 15,
    dispatch_slots: [
      { truck_index: 1, suggested_departure: "08:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 2, suggested_departure: "08:15", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 3, suggested_departure: "08:30", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 4, suggested_departure: "08:45", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 5, suggested_departure: "09:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
    ],
  });
  const [loading, setLoading] = useState(false);

  async function runSimulation() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/simulator/stagger?active_trucks=5`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch {}
    setLoading(false);
  }

  return (
    <section className="panel wide stagger-panel">
      <div className="panel-title">
        <div>
          <h2>{t("stagger_title")}</h2>
          <p>{t("stagger_subtitle")}</p>
        </div>
        <button className="primary-button" onClick={runSimulation} disabled={loading} style={{ width: "auto", minHeight: "36px", height: "36px", padding: "0 16px", fontSize: "12.5px" }}>
          <RefreshCcw size={14} /> {loading ? (lang === "id" ? "Mengoptimalkan..." : "Optimizing...") : t("btn_rerun_optimizer")}
        </button>
      </div>

      <div className="stagger-compare" style={{ marginBottom: "20px" }}>
        <div className="stagger-col before">
          <span className="stagger-label">{t("stagger_uncoord")}</span>
          <strong>{result.baseline_wait_minutes} min</strong>
          <small>{result.baseline_queue_trucks} {lang === "id" ? "truk mengantre" : "queued trucks"}</small>
        </div>
        <div className="stagger-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowRight size={18} />
        </div>
        <div className="stagger-col after">
          <span className="stagger-label">{t("stagger_jwis")}</span>
          <strong>{result.optimized_wait_minutes} min</strong>
          <small>{result.optimized_queue_trucks} {lang === "id" ? "truk mengantre" : "queued trucks"}</small>
        </div>
        <div className="stagger-badge">-{result.queue_reduction_percent}% {t("stagger_delay_badge")}</div>
      </div>

      {result.dispatch_slots && result.dispatch_slots.length > 0 && (
        <div className="stagger-schedule-wrap">
          <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 10px", color: "var(--ui-ink)" }}>
            {lang === "id" ? "Rekomendasi Jadwal Keberangkatan Bertahap:" : "Recommended Staggered Departure Slots:"}
          </h3>
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "ID Truk" : "Truck ID"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Saran Jam Berangkat" : "Recommended Departure"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Estimasi Antre TPA" : "Est. Landfill Wait"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Status Jadwal" : "Slot Status"}</th>
                </tr>
              </thead>
              <tbody>
                {result.dispatch_slots.slice(0, 10).map((slot, i) => (
                  <tr key={i}>
                    <td><span className="plate-badge">T-00{slot.truck_index}</span></td>
                    <td>
                      <span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600 }}>
                        <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "4px" }} />
                        {slot.suggested_departure} WIB
                      </span>
                    </td>
                    <td>
                      <span className="speed-badge">{slot.tpa_wait_est_minutes} min</span>
                    </td>
                    <td>
                      <span className="pill success">
                        <span className="status-dot success" />
                        {slot.slot_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
