import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { ShieldCheck } from "lucide-react";

export function ExecutiveSummary({ snapshot, queue }) {
  const { lang } = useLanguage();
  const locale = lang === "id" ? "id-ID" : "en-US";
  const number = (value) => Number(value ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 });
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/reports/executive-summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setImpact(data?.queue_impact || null); })
      .catch(() => { if (!cancelled) setImpact(null); });
    return () => { cancelled = true; };
  }, []);

  // Summary prose supplied by the snapshot is English-only. Compose both languages
  // from its typed evidence so a locale change never reparses or mistranslates prose.
  const predictions = snapshot?.predictions || [];
  const peak = predictions.reduce((best, item) =>
    !best || (item.predicted_tons - item.baseline_tons) > (best.predicted_tons - best.baseline_tons) ? item : best, null);
  const sameDay = peak ? predictions.filter((item) => item.date === peak.date) : [];
  const extraTrucks = sameDay.reduce((sum, item) => sum + (item.recommended_extra_trucks || 0), 0);
  const extraCrews = sameDay.reduce((sum, item) => sum + (item.recommended_extra_crews || 0), 0);
  const deviation = snapshot?.alerts?.find((alert) => alert.type === "route_deviation" && alert.status === "active");
  const routeName = deviation?.recommended_routes?.[0]?.name;
  const route = lang === "id" && routeName
    ? routeName.replace(/^Route /i, "Rute ").replace("Recovery", "Pemulihan")
    : routeName;
  const hasQueue = queue?.estimated_wait_minutes != null && Number.isFinite(Number(queue.estimated_wait_minutes));
  const wait = queue?.estimated_wait_minutes;
  const queueDelayed = hasQueue && Number(wait) >= 45;
  const headline = peak
    ? (lang === "id" ? `${peak.district} membutuhkan tambahan kapasitas.` : `${peak.district} needs additional capacity.`)
    : (lang === "id" ? "Belum ada prediksi wilayah untuk ditinjau." : "No district forecast is available for review.");
  const points = [];
  if (peak) {
    points.push(lang === "id"
      ? `Lonjakan prediksi terbesar +${number(peak.spike_percent)}% di ${peak.district}; kebutuhan tanggal tersebut: ${number(extraTrucks)} truk tambahan dan ${number(extraCrews)} kru tambahan.`
      : `Largest forecast increase: +${number(peak.spike_percent)}% in ${peak.district}; that day's need is ${number(extraTrucks)} extra trucks and ${number(extraCrews)} extra crews.`);
  }
  if (deviation) {
    points.push(lang === "id"
      ? `${deviation.truck_code} menyimpang dari koridor yang ditetapkan.${route ? ` Tinjau ${route} sebagai rute alternatif.` : " Tinjau rute alternatif."}`
      : `${deviation.truck_code} has deviated from its assigned corridor.${route ? ` Review ${route} as an alternative route.` : " Review alternative routes."}`);
  }
  if (hasQueue) {
    points.push(queueDelayed
      ? (lang === "id" ? `Antrean TPA Bantargebang diperkirakan ${number(wait)} menit; pertimbangkan keberangkatan bertahap.` : `The TPA Bantargebang queue is estimated at ${number(wait)} minutes; consider staggered dispatch.`)
      : (lang === "id" ? `Antrean TPA Bantargebang diperkirakan ${number(wait)} menit.` : `The TPA Bantargebang queue is estimated at ${number(wait)} minutes.`));
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Ringkasan eksekutif" : "Executive summary"}</h2>
          <p>{lang === "id" ? "Disiapkan untuk pimpinan Dinas Lingkungan Hidup (DLH) DKI Jakarta." : "Prepared for DLH Jakarta leadership."}</p>
        </div>
        <div className="panel-header-icon-wrap"><ShieldCheck size={18} /></div>
      </div>
      <h3>{headline}</h3>
      {points.length > 0 && <ul>{points.map((point) => <li key={point}>{point}</li>)}</ul>}
      <div className="queue-box">
        <strong>{lang === "id" ? "Antrean TPA Bantargebang" : "TPA Bantargebang queue"}</strong>
        {hasQueue ? (
          <>
            <span>{queue.trucks_waiting != null ? `${number(queue.trucks_waiting)} ${lang === "id" ? "truk mengantre" : "trucks waiting"} · ` : ""}{number(wait)} {lang === "id" ? "menit perkiraan tunggu" : "min estimated wait"}</span>
            <p>{queueDelayed
              ? (lang === "id" ? "Tunda keberangkatan truk yang tidak mendesak selama 30–45 menit untuk mengurangi antrean." : "Delay non-essential departures by 30–45 minutes to ease the queue.")
              : (lang === "id" ? "Koridor lancar; keberangkatan normal dapat dilanjutkan." : "The corridor is clear; normal dispatch may continue.")}</p>
          </>
        ) : <p>{lang === "id" ? "Data antrean belum tersedia." : "Queue data is unavailable."}</p>}
      </div>
      {impact && (
        <div className="exec-impact">
          <div className="exec-impact-head"><strong>{lang === "id" ? "Dampak optimasi — keberangkatan bertahap" : "Optimization impact — staggered dispatch"}</strong></div>
          <div className="exec-impact-grid">
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Awal (semua truk saat jam puncak)" : "Baseline (all trucks at peak)"}</span>
              <strong>{number(impact.baseline_queue_trucks)} {lang === "id" ? "truk" : "trucks"} · {number(impact.baseline_wait_minutes)} {lang === "id" ? "menit tunggu" : "min wait"}</strong>
              <small>p95 {number(impact.baseline_p95_minutes)} {lang === "id" ? "menit" : "min"}</small>
            </div>
            <div className="exec-impact-arrow" aria-hidden="true">→</div>
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Dengan keberangkatan bertahap" : "With staggered dispatch"}</span>
              <strong>{number(impact.optimized_queue_trucks)} {lang === "id" ? "truk" : "trucks"} · {number(impact.optimized_wait_minutes)} {lang === "id" ? "menit tunggu" : "min wait"}</strong>
              <small>p95 {number(impact.optimized_p95_minutes)} {lang === "id" ? "menit" : "min"}</small>
            </div>
            <div className="exec-impact-delta"><strong>−{number(impact.queue_reduction_percent)}% {lang === "id" ? "antrean" : "queue"}</strong></div>
          </div>
        </div>
      )}
    </section>
  );
}
