import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  ShieldCheck,
} from "lucide-react";

export function ExecutiveSummary({ summary, queue }) {
  const { lang } = useLanguage();
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/reports/executive-summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.queue_impact) setImpact(data.queue_impact); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Ringkasan Eksekutif" : "Executive Summary"}</h2>
          <p>{lang === "id" ? "Disiapkan untuk pimpinan Dinas Lingkungan Hidup (DLH) DKI Jakarta." : "Prepared for DLH leadership and case-provider review."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <ShieldCheck size={18} />
        </div>
      </div>
      <h3>{summary.headline}</h3>
      <ul>
        {summary.points.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <div className="queue-box">
        <strong>{lang === "id" ? "Antrean TPA Bantargebang" : "TPA Bantargebang queue"}</strong>
        <span>{queue.trucks_waiting} {lang === "id" ? "truk mengantre" : "trucks waiting"} - {queue.estimated_wait_minutes} {lang === "id" ? "menit estimasi keterlambatan" : "min estimated delay"}</span>
        <p>{queue.recommendation}</p>
      </div>
      {impact && (
        <div className="exec-impact">
          <div className="exec-impact-head"><strong>{lang === "id" ? "Dampak Optimasi — Keberangkatan Bertahap" : "Optimization Impact — Staggered Dispatch"}</strong></div>
          <div className="exec-impact-grid">
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Baseline (semua truk jam puncak)" : "Baseline (all trucks peak)"}</span>
              <strong>{impact.baseline_queue_trucks} {lang === "id" ? "truk" : "trucks"} · {impact.baseline_wait_minutes} {lang === "id" ? "menit antre" : "min wait"}</strong>
              <small>p95 {impact.baseline_p95_minutes} min</small>
            </div>
            <div className="exec-impact-arrow" aria-hidden="true">→</div>
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Dengan keberangkatan bertahap" : "With staggered dispatch"}</span>
              <strong>{impact.optimized_queue_trucks} {lang === "id" ? "truk" : "trucks"} · {impact.optimized_wait_minutes} {lang === "id" ? "menit antre" : "min wait"}</strong>
              <small>p95 {impact.optimized_p95_minutes} min</small>
            </div>
            <div className="exec-impact-delta">
              <strong>−{impact.queue_reduction_percent}% {lang === "id" ? "antrean" : "wait"}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
