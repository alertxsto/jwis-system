import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Clock,
} from "lucide-react";

export function TpaQueuePanel() {
  const { t, lang } = useLanguage();
  const [live, setLive] = useState(null);
  const [queue, setQueue] = useState(null);
  const [mode, setMode] = useState("live");
  const [scenario, setScenario] = useState("peak");

  async function fetchQueue(sc = scenario) {
    try {
      const res = await fetch(`${API_URL}/tpa/queue-status?scenario=${sc}`);
      if (res.ok) setQueue(await res.json());
    } catch {}
  }

  useEffect(() => {
    const load = () => fetch(`${API_URL}/ai/tpa-queue-live`)
      .then((r) => r.json())
      .then(setLive)
      .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== "whatif") return;
    fetchQueue(scenario);
    const interval = setInterval(() => fetchQueue(scenario), 6000);
    return () => clearInterval(interval);
  }, [mode, scenario]);

  const congestionClass = {
    low: "text-normal", moderate: "text-warning",
    high: "text-diverted", severe: "text-danger",
  }[live?.congestion_level] || "text-normal";
  const trendArrow = { rising: "↑", falling: "↓", stable: "→" }[live?.trend] || "→";

  return (
    <section className="panel tpa-queue-panel">
      <div className="panel-title">
        <div>
          <h2>Prediksi Antrian TPA</h2>
          <p>{t("tpa_subtitle")}</p>
        </div>
        <div className="tpa-scenario-toggle" role="group" aria-label="Queue mode">
          {[["live", "Live"], ["whatif", "What-if"]].map(([id, label]) => (
            <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        <div className="panel-header-icon-wrap">
          <Clock size={18} />
        </div>
      </div>
      {mode === "live" ? (
        !live || live.status === "no_data" ? (
          <div className="ai-feed-empty">Menunggu engine AI…</div>
        ) : (
          <div className="tpa-live-gauge">
            <div className={`tpa-wait-number ${congestionClass}`}>
              {Math.round(live.predicted_wait_min)}<span> min</span> {trendArrow}
            </div>
            <div className="tpa-live-stats">
              <div><span>{lang === "id" ? "Dalam antrian" : "In queue"}</span><strong>{live.trucks_in_queue} {lang === "id" ? "truk" : "trucks"}</strong></div>
              <div><span>{lang === "id" ? "Datang <30 min" : "Arriving <30 min"}</span><strong>{live.arriving_soon} {lang === "id" ? "truk" : "trucks"}</strong></div>
              <div><span>Arrival rate</span><strong>{live.arrival_rate_per_h.toFixed(0)}/jam</strong></div>
              <div><span>CI95</span><strong>{live.wait_ci95.map((v) => v.toFixed(0)).join("–")} min</strong></div>
            </div>
            <div className={`pill ${congestionClass}`}>
              {live.congestion_level.toUpperCase()}
            </div>
          </div>
        )
      ) : (
        <div className="tpa-whatif">
          <div className="tpa-scenario-toggle" role="group" aria-label="Arrival scenario">
            {[["peak", lang === "id" ? "Jam Puncak" : "Peak hour"], ["live", lang === "id" ? "Waktu Nyata" : "Live clock"]].map(([id, label]) => (
              <button key={id} className={scenario === id ? "active" : ""} onClick={() => setScenario(id)}>{label}</button>
            ))}
          </div>
          {queue && (
            <>
              {queue.arrival_profile && (
                <p className="tpa-scenario-note">{lang === "id" ? "Profil kedatangan:" : "Arrival profile:"} {queue.arrival_profile} · {queue.method}</p>
              )}

              <div className="tpa-status-grid">
                <div className="tpa-status-card">
                  <span>{lang === "id" ? "Truk Mengantre" : "Queued Trucks"}</span>
                  <strong>{queue.trucks_in_queue} {lang === "id" ? "unit" : "units"}</strong>
                </div>
                <div className="tpa-status-card">
                  <span>{lang === "id" ? "Estimasi Waktu Antre" : "Estimated Wait"}</span>
                  <strong className={queue.avg_wait_minutes > 60 ? "text-danger" : "text-success"}>
                    {queue.avg_wait_minutes} min
                  </strong>
                </div>
                <div className="tpa-status-card">
                  <span>{lang === "id" ? "Status Jembatan Timbang" : "Weighbridge"}</span>
                  <strong className={queue.weighbridge_status.includes("DEGRADED") ? "text-danger" : "text-success"}>
                    {queue.weighbridge_status}
                  </strong>
                </div>
              </div>

              <div className="tpa-logs">
                <h3>{lang === "id" ? "Log Timbangan Terkini" : "Latest Weighbridge Log"}</h3>
                <ul>
                  {queue.scale_logs?.map((log, i) => (
                    <li key={i}>
                      <span className="time"><Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />{log.time}</span>
                      <span className="truck">{log.truck}</span>
                      <span className="weight">{log.weight_ton} {lang === "id" ? "ton" : "tons"}</span>
                      <span className={`status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
