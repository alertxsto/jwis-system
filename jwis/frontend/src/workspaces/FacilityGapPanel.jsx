import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Factory,
} from "lucide-react";

export function FacilityGapPanel({ rainfall = 0, attendance = 0 }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    const params = new URLSearchParams({
      rainfall_mm: String(rainfall),
      event_attendance: String(attendance),
    });
    fetch(`${API_URL}/facilities/gap-analysis?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  }, [rainfall, attendance]);

  const areas = data?.areas || [];
  const summary = data?.summary || {};
  const shown = showAll ? areas : areas.slice(0, 6);
  const sevColor = { critical: "#dc2626", watch: "#d97706", ok: "#16a34a", unknown: "#64748b" };

  return (
    <section className="panel wide" data-testid="facility-gap-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Kesiapan Fasilitas & Analisis Kesenjangan TPS" : "Facility Readiness & Gap Analysis"}</h2>
          <p>
            {lang === "id"
              ? "Perbandingan kebutuhan timbulan sampah vs kapasitas TPS — mendeteksi distrik yang kekurangan fasilitas pembuangan."
              : "Predicted demand vs TPS capacity proxy — where disposal and transport facilities are missing, and where to site them."}
          </p>
        </div>
        <div className="panel-header-icon-wrap">
          <Factory size={18} />
        </div>
      </div>

      {loading && <p className="panel-loading">{lang === "id" ? "Menyiapkan analisis kesenjangan fasilitas..." : "Preparing facility gap analysis…"}</p>}
      {!loading && !data && <p className="panel-loading">{lang === "id" ? "Analisis kesenjangan tidak tersedia." : "Gap analysis unavailable."}</p>}

      {data && (
        <>
          <div className="facility-summary">
            <div><b>{summary.critical_count}</b><span>{lang === "id" ? "distrik kritis" : "critical districts"}</span></div>
            <div><b>{summary.total_gap_ton_per_day?.toLocaleString(lang === "id" ? "id-ID" : "en-US")} t</b><span>{lang === "id" ? "kesenjangan kapasitas/hari" : "daily capacity gap"}</span></div>
            <div><b>{summary.total_extra_trucks_needed}</b><span>{lang === "id" ? "tambahan ritase/hari" : "extra trips/day"}</span></div>
            <div><b>{summary.total_new_tps_sites_needed}</b><span>{lang === "id" ? "lokasi TPS baru dibutuhkan" : "new TPS sites (bounded share)"}</span></div>
            <div><b>{Math.round((summary.citywide_proxy_coverage_ratio || 0) * 100)}%</b><span>{lang === "id" ? "cakupan estimasi" : "proxy coverage"}</span></div>
          </div>

          <div className="facility-list">
            {shown.map((a) => (
              <article key={a.slug} className="facility-row">
                <div className="facility-head">
                  <strong>{a.kecamatan}</strong>
                  <span className="facility-sev" style={{ color: sevColor[a.severity] }}>{a.severity}</span>
                </div>
                <div className="facility-meta">
                  <span>{lang === "id" ? "timbulan" : "demand"} {a.predicted_tons_per_day.toLocaleString(lang === "id" ? "id-ID" : "en-US")} t/{lang === "id" ? "hari" : "day"} vs {lang === "id" ? "kapasitas" : "capacity"} {a.tps_capacity_proxy_ton_per_day ?? "?"} t</span>
                  <span>{lang === "id" ? "gap" : "gap"} <b>{a.gap_ton_per_day ?? "?"} t</b> · +{a.recommended_extra_trips_per_day} {lang === "id" ? "ritase/hari" : "trips/day"} · {a.recommended_new_tps_sites} TPS</span>
                </div>
                {a.siting_candidates?.length > 0 && (
                  <div className="facility-siting">
                    {lang === "id" ? "Rekomendasi lokasi:" : "Site near:"} {a.siting_candidates.map((c) => `${c.kelurahan} (${c.predicted_tons} t, ${c.existing_tps_sites} TPS)`).join(" · ")}
                  </div>
                )}
              </article>
            ))}
          </div>

          {areas.length > 6 && (
            <button className="text-button show-more-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? (lang === "id" ? "Tampilkan lebih sedikit" : "Show fewer") : `${lang === "id" ? "Tampilkan semua" : "Show all"} (${areas.length} ${lang === "id" ? "distrik" : "districts"})`}
            </button>
          )}
          <p className="kec-note">{data.assumptions?.coverage_note}</p>
        </>
      )}
    </section>
  );
}
