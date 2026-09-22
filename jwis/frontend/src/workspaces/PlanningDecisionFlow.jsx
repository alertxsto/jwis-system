import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { IntegratedPlanning } from "./IntegratedPlanning.jsx";
import { ExecutiveSummary } from "./ExecutiveSummary.jsx";
import { PlanningApproval, ScenarioPanel } from "./PlanningApproval.jsx";
import {
  Truck,
  Users,
  Workflow,
} from "lucide-react";

export function PlanningDecisionFlow({ attendance, setAttendance, rainfall, setRainfall, eventLat, eventLng, summary, queue }) {
  const { t, lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Operations optimizer state for forecast-to-dispatch handoff.
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");

  const role = localStorage.getItem("jwis_role") || "guest";
  const token = localStorage.getItem("jwis_token");

  const [outlook, setOutlook] = useState([]);

  useEffect(() => {
    const load = () => fetch(`${API_URL}/ai/event-forecast`)
      .then((r) => r.json())
      .then((body) => setOutlook(body.outlook || []))
      .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  async function run() {
    setLoading(true);
    setPlan(null);
    setApproved(false);
    setOptimizerError("");
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
      });
      if (eventLat !== undefined && eventLat !== null) params.append("event_lat", String(eventLat));
      if (eventLng !== undefined && eventLng !== null) params.append("event_lng", String(eventLng));
      const res = await fetch(`${API_URL}/predictions/kecamatan?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, rainfall, eventLat, eventLng]);

  async function generatePlan() {
    setPlanLoading(true);
    setApproved(false);
    setOptimizerError("");
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
        top_n: "5",
      });
      if (eventLat !== undefined && eventLat !== null) params.append("event_lat", String(eventLat));
      if (eventLng !== undefined && eventLng !== null) params.append("event_lng", String(eventLng));
      const response = await fetch(`${API_URL}/operations/plan?${params.toString()}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Failed to generate plan");
      const planData = await response.json();
      setPlan(planData);
    } catch (err) {
      setOptimizerError(err.message || "Failed to generate plan.");
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }

  async function approvePlan() {
    if (!plan) return;
    setPlanLoading(true);
    setOptimizerError("");
    try {
      const response = await fetch(`${API_URL}/operations/${plan.plan_id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        throw new Error("Unauthorized - Please log in again.");
      }
      if (response.status === 403) {
        throw new Error(`Role '${role}' lacks permission to approve plans (requires supervisor or administrator).`);
      }
      if (!response.ok) {
        throw new Error("Failed to approve plan");
      }
      const approvedData = await response.json();
      setPlan(approvedData);
      setApproved(true);
    } catch (err) {
      setOptimizerError(err.message || "Failed to approve plan.");
    } finally {
      setPlanLoading(false);
    }
  }

  const top5 = (data?.top_hotspots || []).slice(0, 5);
  const totalTons = data?.total_predicted_tons || 0;
  const manHours = top5.reduce((s, k) => s + (k.man_hours_required || 0), 0);
  const crews = top5.reduce((s, k) => s + (k.crews_required || 0), 0);
  const trucks = top5.reduce((s, k) => s + (k.trucks_required || 0), 0);
  const bins = top5.reduce((s, k) => s + (k.disposal_bins_required || 0), 0);

  return (
    <IntegratedPlanning
      summary={<ExecutiveSummary summary={summary} queue={queue} />}
      scenario={{
        inputs: (
          <ScenarioPanel mode="inputs">
      <div className="panel-title">
        <div>
          <h2>{t("plan_sim_title")}</h2>
          <p>{t("plan_sim_sub")}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Users size={18} />
        </div>
      </div>
      <div className="ai-outlook">
        <h4>{lang === "id" ? "Prediksi AI 7 hari" : "AI 7-day outlook"}</h4>
        {outlook.length === 0 ? (
          <div className="ai-feed-empty">Outlook belum tersedia.</div>
        ) : (
          <table className="ai-outlook-table">
            <thead>
              <tr><th>{lang === "id" ? "Tanggal" : "Date"}</th><th>{lang === "id" ? "Hujan" : "Rain"}</th><th>{lang === "id" ? "Acara" : "Event"}</th><th>Δ Volume</th></tr>
            </thead>
            <tbody>
              {outlook.map((d) => (
                <tr key={d.date}>
                  <td>
                    {new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    {d.is_holiday ? " (libur)" : ""}
                  </td>
                  <td>{(d.rainfall_mm ?? 0).toFixed(0)} mm</td>
                  <td>{d.events.length
                    ? d.events.map((e) => `${e.name} (${(e.expected_attendance / 1000).toFixed(0)}k)`).join(", ")
                    : "—"}</td>
                  <td className={d.volume_delta_pct > 15 ? "text-danger"
                    : d.volume_delta_pct > 5 ? "text-warning" : "text-normal"}>
                    {d.volume_delta_pct > 0 ? "+" : ""}{d.volume_delta_pct.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <details open className="manual-whatif">
        <summary>{lang === "id" ? "Penyesuaian manual" : "Manual adjustment"}</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui-muted)" }}>{t("plan_att")}</span>
          <input type="range" min="0" max="200000" step="5000" value={attendance} onChange={(event) => setAttendance(Number(event.target.value))} />
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{attendance.toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "orang" : "people"}</small>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui-muted)" }}>{t("plan_rain")}</span>
          <input type="range" min="0" max="100" step="1" value={rainfall} onChange={(event) => setRainfall(Number(event.target.value))} />
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{rainfall} mm / {lang === "id" ? "hari" : "day"}</small>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button className="primary-button" onClick={run} disabled={loading} style={{ width: "auto", minHeight: "36px", height: "36px", padding: "0 20px" }}>
          {loading ? (lang === "id" ? "Menghitung..." : "Calculating...") : t("btn_run_scenario")}
        </button>
      </div>
      </details>
      <div className="scenario-result" style={{ marginBottom: "16px" }}>
        <strong>{lang === "id" ? `Total estimasi timbulan ${totalTons.toLocaleString("id-ID")} ton/hari (${data?.kecamatan_count || 42} distrik)` : `Total forecast ${totalTons.toLocaleString("en-US")} tons/day (${data?.kecamatan_count || 42} districts)`}</strong>
        <span>{lang === "id" ? "Titik Puncak:" : "Peak Hotspot:"} {top5[0]?.kecamatan || "..."} — {top5[0]?.predicted_tons?.toLocaleString(lang === "id" ? "id-ID" : "en-US") || "..."} {lang === "id" ? "ton" : "tons"}</span>
      </div>
      <div className="scenario-reqs" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{manHours}</b><span>{lang === "id" ? "jam-kerja kru (top 5)" : "man-hours (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{crews}</b><span>{lang === "id" ? "kru lapangan (top 5)" : "field crews (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{trucks}</b><span>{lang === "id" ? "truk armada (top 5)" : "trucks (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{bins}</b><span>{lang === "id" ? "tong sampah besar (top 5)" : "large bins (top 5)"}</span></div>
      </div>
          </ScenarioPanel>
        ),
        recommendation: (
          <ScenarioPanel mode="recommendation">
      <div className="optimizer-section">
        <div className="optimizer-head">
          <h3>{t("plan_opt_title")}</h3>
        </div>
        
        {!plan && (
          <>
            <div className="plan-preflight-grid" aria-label="Plan preflight" style={{ marginBottom: "16px" }}>
              <div>
                <span>{t("plan_demand")}</span>
                <strong>{totalTons.toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "ton/hari" : "tons/day"}</strong>
              </div>
              <div>
                <span>{t("plan_fleet_need")}</span>
                <strong>{trucks} {lang === "id" ? "truk" : "trucks"} / {crews} {lang === "id" ? "kru" : "crews"}</strong>
              </div>
              <div>
                <span>{t("plan_tpa_queue")}</span>
                <strong>{queue.trucks_waiting} {lang === "id" ? "truk" : "trucks"} / {queue.estimated_wait_minutes} min</strong>
              </div>
            </div>

            <button className="primary-button" onClick={generatePlan} disabled={planLoading || loading} style={{ width: "auto", minHeight: "38px", height: "38px", padding: "0 24px", marginBottom: "14px" }}>
              {planLoading ? (lang === "id" ? "Mengoptimalkan Alokasi..." : "Optimizing Assignments...") : t("btn_generate_plan")}
            </button>

            <div className="optimizer-empty-state" aria-live="polite" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <Workflow size={18} style={{ color: "var(--ui-accent)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ fontSize: "13px" }}>{t("plan_awaiting_title")}</strong>
                  <p style={{ fontSize: "12px", color: "var(--ui-muted)" }}>
                    {t("plan_awaiting_desc")}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {optimizerError && (
          <div className="unmet-reasons-box optimizer-error">
            <strong>Error:</strong> {optimizerError}
          </div>
        )}

        {plan && (
          <div className="optimizer-plan-card">
            <div className="plan-header">
              <strong>{lang === "id" ? "ID rencana" : "Plan ID"}: {plan.plan_id}</strong>
              <span className={`plan-status-badge ${plan.status}`}>
                {plan.status.toUpperCase()}
              </span>
            </div>
            
            <div className="plan-stats-grid">
              <div className="plan-stat-item">
                <span>{lang === "id" ? "Total kebutuhan" : "Total demand"}</span>
                <strong>{plan.total_demand_tons} {lang === "id" ? "ton" : "tons"}</strong>
              </div>
              <div className="plan-stat-item">
                <span>{lang === "id" ? "Dialokasikan" : "Assigned"}</span>
                <strong>{plan.total_assigned_tons} {lang === "id" ? "ton" : "tons"}</strong>
              </div>
              <div className="plan-stat-item">
                <span>Status</span>
                <strong className={plan.unmet_reasons?.length ? "text-danger" : "text-success"}>
                  {plan.unmet_reasons?.length ? (lang === "id" ? "Kebutuhan belum terpenuhi" : "Unmet demand") : (lang === "id" ? "Layak dijalankan" : "Feasible")}
                </strong>
              </div>
            </div>

            {plan.unmet_reasons?.length > 0 && (
              <div className="unmet-reasons-box">
                <strong>{lang === "id" ? "Peringatan kendala:" : "Constraint warnings:"}</strong>
                <ul>
                  {plan.unmet_reasons.map((r, i) => (
                    <li key={i}>{r.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="assign-title">{lang === "id" ? "Penugasan hasil optimasi:" : "Optimizer assignments:"}</div>
            <div className="assignments-container">
              {plan.assignments.map((a, i) => (
                <div key={i} className="assign-card">
                  <div className="assign-info">
                    <strong>{lang === "id" ? "Truk" : "Truck"} {a.truck_code}</strong>
                    <span>&rarr; {a.area.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div className="assign-evidence">
                    <span>{lang === "id" ? "Muatan" : "Assigned"}: <b>{a.assigned_tons} t</b></span>
                    {a.evidence.permit_compliant ? (
                      <span className="ok">{lang === "id" ? "Izin sesuai" : "Permit compliant"}</span>
                    ) : (
                      <span className="warn">{lang === "id" ? "Tanpa izin" : "No permit"}</span>
                    )}
                  </div>
                </div>
              ))}
              {plan.assignments.length === 0 && (
                <p className="kec-note optimizer-empty">{lang === "id" ? "Belum ada penugasan truk." : "No truck assignments generated."}</p>
              )}
            </div>

          </div>
        )}
      </div>
          </ScenarioPanel>
        ),
      }}
      evidence={(
        <PlanningApproval
          plan={plan}
          planLoading={planLoading}
          approved={approved}
          approvePlan={approvePlan}
          role={role}
        />
      )}
      unmetCount={plan?.unmet_reasons?.length || 0}
    />
  );
}
