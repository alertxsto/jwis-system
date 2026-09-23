import React from "react";
import { useLanguage } from "../i18n.jsx";
import {
  CloudRain,
} from "lucide-react";

export function PredictionPanel({ predictions, allPredictions = predictions }) {
  const { t, lang } = useLanguage();
  const totalExtraTrucks = predictions.reduce((sum, item) => sum + (item.recommended_extra_trucks || 0), 0);
  const totalExtraCrews = predictions.reduce((sum, item) => sum + (item.recommended_extra_crews || 0), 0);
  const highestSpike = predictions.reduce(
    (max, item) => Math.max(max, item.spike_percent || 0),
    0,
  );
  const displayRows = [...predictions].sort((a, b) => (b.predicted_tons || 0) - (a.predicted_tons || 0));

  return (
    <section className="panel wide prediction-panel">
      <div className="panel-title">
        <div>
          <h2>{t("fc_pred_title")}</h2>
          <p>{t("fc_pred_sub")}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <CloudRain size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_hr_districts")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-danger)" }}>{predictions.length} {lang === "id" ? "distrik" : "districts"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_peak_spike")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-warning)" }}>+{highestSpike}%</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_extra_cap")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{totalExtraTrucks} {lang === "id" ? "truk" : "trucks"} · {totalExtraCrews} {lang === "id" ? "kru" : "crews"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "24%" }}>{t("fc_th_district")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("fc_th_date")}</th>
              <th scope="col" style={{ width: "18%" }}>{t("fc_th_volume")}</th>
              <th scope="col" style={{ width: "20%" }}>{t("fc_th_spike")}</th>
              <th scope="col" style={{ width: "22%" }}>{t("fc_th_backup")}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((item, idx) => {
              const spike = item.spike_percent || 0;
              const isCrit = spike >= 40 || item.risk_level === "critical";
              const isHigh = spike >= 30 || item.risk_level === "high";
              const tone = isCrit ? "danger" : isHigh ? "warning" : "info";

              return (
                <tr key={`${item.district}-${item.date}-${idx}`}>
                  <td>
                    <strong style={{ color: "var(--ui-ink)", fontWeight: 700 }}>{item.district}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                      {item.date}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600, color: "var(--ui-ink)" }}>
                      {item.predicted_tons?.toFixed(1) || "0.0"} {lang === "id" ? "t/hari" : "t/day"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, spike * 2)}%`, background: isCrit ? "var(--ui-danger)" : isHigh ? "var(--ui-warning)" : "var(--ui-accent)" }} />
                      </div>
                      <span className={`pill ${tone}`} style={{ minWidth: "48px", justifyContent: "center" }}>
                        +{spike}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="zone-tag">
                      {item.recommended_extra_trucks || 0} {lang === "id" ? "truk" : "trucks"} · {item.recommended_extra_crews || 0} {lang === "id" ? "kru" : "crews"}
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
