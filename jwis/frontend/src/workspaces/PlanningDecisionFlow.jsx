import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { IntegratedPlanning } from "./IntegratedPlanning.jsx";
import { ExecutiveSummary } from "./ExecutiveSummary.jsx";
import { PlanningApproval, ScenarioPanel } from "./PlanningApproval.jsx";
import {
  Users,
  Workflow,
} from "lucide-react";

export function PlanningDecisionFlow({ attendance, setAttendance, rainfall, setRainfall, eventLat, eventLng, snapshot, queue }) {
  const { t, lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const forecastRequest = useRef(0);
  const planRequest = useRef(0);
  const [forecastError, setForecastError] = useState(false);
  // Operations optimizer state for forecast-to-dispatch handoff.
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [optimizerError, setOptimizerError] = useState(null);

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
    const request = ++forecastRequest.current;
    ++planRequest.current;
    setPlanLoading(false);
    setLoading(true);
    setData(null);
    setForecastError(false);
    setPlan(null);
    setApproved(false);
    setOptimizerError(null);
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
      });
      if (eventLat !== undefined && eventLat !== null) params.append("event_lat", String(eventLat));
      if (eventLng !== undefined && eventLng !== null) params.append("event_lng", String(eventLng));
      const res = await fetch(`${API_URL}/predictions/kecamatan?${params.toString()}`);
      if (!res.ok) throw new Error("forecast");
      const result = await res.json();
      if (request === forecastRequest.current) setData(result);
    } catch {
      if (request === forecastRequest.current) setForecastError(true);
    } finally {
      if (request === forecastRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, rainfall, eventLat, eventLng]);

  async function generatePlan() {
    const request = ++planRequest.current;
    setPlanLoading(true);
    setApproved(false);
    setOptimizerError(null);
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
      if (!response.ok) {
        if (request === planRequest.current) setOptimizerError({ status: response.status, action: "generate" });
        return;
      }
      const planData = await response.json();
      if (request === planRequest.current) setPlan(planData);
    } catch {
      if (request === planRequest.current) setOptimizerError({ status: 0, action: "generate" });
    } finally {
      if (request === planRequest.current) setPlanLoading(false);
    }
  }

  async function approvePlan() {
    if (!plan) return;
    const request = ++planRequest.current;
    setPlanLoading(true);
    setOptimizerError(null);
    try {
      const response = await fetch(`${API_URL}/operations/${encodeURIComponent(plan.plan_id)}/approve`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        if (request === planRequest.current) setOptimizerError({ status: response.status, action: "approve" });
        return;
      }
      const approvedData = await response.json();
      if (request === planRequest.current) {
        setPlan(approvedData);
        setApproved(true);
      }
    } catch {
      if (request === planRequest.current) setOptimizerError({ status: 0, action: "approve" });
    } finally {
      if (request === planRequest.current) setPlanLoading(false);
    }
  }

  const top5 = (data?.top_hotspots || []).slice(0, 5);
  const totalTons = data?.total_predicted_tons || 0;
  const manHours = top5.reduce((s, k) => s + (k.man_hours_required || 0), 0);
  const crews = top5.reduce((s, k) => s + (k.crews_required || 0), 0);
  const trucks = top5.reduce((s, k) => s + (k.trucks_required || 0), 0);
  const bins = top5.reduce((s, k) => s + (k.disposal_bins_required || 0), 0);

  const locale = lang === "id" ? "id-ID" : "en-US";
  const number = (value) => Number(value ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 });
  const reason = (code) => {
    if (code === "no_permit_compliant_vehicle") return lang === "id" ? "Tidak ada kendaraan dengan izin yang sesuai." : "No permit-compliant vehicle is available.";
    if (code === "no_available_vehicle") return lang === "id" ? "Tidak ada kendaraan yang tersedia." : "No vehicle is available.";
    if (code === "no_feasible_assignment") return lang === "id" ? "Tidak ditemukan alokasi yang memenuhi kendala." : "No allocation satisfies the constraints.";
    if (code.startsWith("insufficient_capacity:")) {
      const area = code.slice("insufficient_capacity:".length).replace(/_/g, " ");
      return lang === "id" ? `Kapasitas tidak mencukupi untuk ${area}.` : `Insufficient capacity for ${area}.`;
    }
    return lang === "id" ? "Ada kendala alokasi yang perlu ditinjau." : "An allocation constraint needs review.";
  };
  const errorMessage = optimizerError && (
    optimizerError.status === 401 ? (lang === "id" ? "Sesi berakhir. Masuk kembali untuk melanjutkan." : "Session expired. Sign in again to continue.")
      : optimizerError.status === 403 ? (lang === "id" ? "Peran Anda tidak berwenang melakukan tindakan ini." : "Your role is not authorized to perform this action.")
        : optimizerError.status === 404 ? (lang === "id" ? "Rencana tidak ditemukan. Susun rencana baru." : "Plan not found. Generate a new plan.")
          : optimizerError.status === 422 ? (lang === "id" ? "Parameter skenario tidak valid. Periksa input lalu coba lagi." : "Invalid scenario parameters. Review the inputs and try again.")
            : optimizerError.status === 429 ? (lang === "id" ? "Terlalu banyak permintaan. Coba lagi nanti." : "Too many requests. Try again shortly.")
              : optimizerError.status === 0 ? (lang === "id" ? "Koneksi gagal. Periksa jaringan lalu coba lagi." : "Connection failed. Check your network and try again.")
                : optimizerError.action === "approve" ? (lang === "id" ? "Persetujuan gagal. Coba lagi." : "Approval failed. Try again.")
                  : (lang === "id" ? "Rencana gagal disusun. Coba lagi." : "Could not generate the plan. Try again.")
  );

  return (
    <IntegratedPlanning
      summary={<ExecutiveSummary snapshot={snapshot} queue={queue} />}
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
          <div className="ai-feed-empty">{lang === "id" ? "Prediksi belum tersedia." : "Outlook is not available yet."}</div>
        ) : (
          <table className="ai-outlook-table">
            <thead>
              <tr><th>{lang === "id" ? "Tanggal" : "Date"}</th><th>{lang === "id" ? "Hujan" : "Rain"}</th><th>{lang === "id" ? "Acara" : "Event"}</th><th>Δ Volume</th></tr>
            </thead>
            <tbody>
              {outlook.map((d) => (
                <tr key={d.date}>
                  <td>
                    {new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                    {d.is_holiday ? (lang === "id" ? " (libur)" : " (holiday)") : ""}
                  </td>
                  <td>{number(d.rainfall_mm)} mm</td>
                  <td>{d.events?.length
                    ? d.events.map((e) => `${e.name} (${number(e.expected_attendance)} ${lang === "id" ? "orang" : "people"})`).join(", ")
                    : "—"}</td>
                  <td className={d.volume_delta_pct > 15 ? "text-danger"
                    : d.volume_delta_pct > 5 ? "text-warning" : "text-normal"}>
                    {d.volume_delta_pct > 0 ? "+" : ""}{number(d.volume_delta_pct)}%
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
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{number(attendance)} {lang === "id" ? "orang" : "people"}</small>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui-muted)" }}>{t("plan_rain")}</span>
          <input type="range" min="0" max="100" step="1" value={rainfall} onChange={(event) => setRainfall(Number(event.target.value))} />
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{number(rainfall)} mm / {lang === "id" ? "hari" : "day"}</small>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button className="primary-button" onClick={run} disabled={loading} style={{ width: "auto", minHeight: "36px", height: "36px", padding: "0 20px" }}>
          {loading ? (lang === "id" ? "Menghitung..." : "Calculating...") : t("btn_run_scenario")}
        </button>
      </div>
      </details>
      {forecastError && <p className="unmet-reasons-box optimizer-error" role="alert">{lang === "id" ? "Prediksi gagal dimuat. Jalankan ulang skenario." : "Forecast could not load. Run the scenario again."}</p>}
      <div className="scenario-result" style={{ marginBottom: "16px" }}>
        {data ? (
          <>
            <strong>{lang === "id" ? `Total estimasi timbulan ${number(totalTons)} ton/hari` : `Total forecast ${number(totalTons)} tons/day`}{data.kecamatan_count != null ? ` (${number(data.kecamatan_count)} ${lang === "id" ? "kecamatan" : "districts"})` : ""}</strong>
            <span>{top5[0] ? `${lang === "id" ? "Titik puncak" : "Peak hotspot"}: ${top5[0].kecamatan} — ${number(top5[0].predicted_tons)} ${lang === "id" ? "ton" : "tons"}` : (lang === "id" ? "Belum ada titik puncak pada skenario ini." : "No peak hotspot for this scenario.")}</span>
          </>
        ) : <span>{loading ? (lang === "id" ? "Menghitung kebutuhan skenario..." : "Calculating scenario demand...") : (lang === "id" ? "Belum ada hasil skenario." : "No scenario result is available.")}</span>}
      </div>
      {data && <div className="scenario-reqs" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{number(manHours)}</b><span>{lang === "id" ? "jam kerja kru (5 teratas)" : "crew-hours (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{number(crews)}</b><span>{lang === "id" ? "kru lapangan (5 teratas)" : "field crews (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{number(trucks)}</b><span>{lang === "id" ? "truk armada (5 teratas)" : "trucks (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{number(bins)}</b><span>{lang === "id" ? "tong besar (5 teratas)" : "large bins (top 5)"}</span></div>
      </div>}
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
            <div className="plan-preflight-grid" aria-label={lang === "id" ? "Tinjauan sebelum rencana" : "Plan preflight"} style={{ marginBottom: "16px" }}>
              <div>
                <span>{t("plan_demand")}</span>
                <strong>{data ? `${number(totalTons)} ${lang === "id" ? "ton/hari" : "tons/day"}` : "—"}</strong>
              </div>
              <div>
                <span>{t("plan_fleet_need")}</span>
                <strong>{data ? `${number(trucks)} ${lang === "id" ? "truk" : "trucks"} / ${number(crews)} ${lang === "id" ? "kru" : "crews"}` : "—"}</strong>
              </div>
              <div>
                <span>{t("plan_tpa_queue")}</span>
                <strong>{queue?.trucks_waiting != null && queue?.estimated_wait_minutes != null ? `${number(queue.trucks_waiting)} ${lang === "id" ? "truk" : "trucks"} / ${number(queue.estimated_wait_minutes)} ${lang === "id" ? "menit" : "min"}` : "—"}</strong>
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

        {errorMessage && (
          <div className="unmet-reasons-box optimizer-error" role="alert">
            <strong>{lang === "id" ? "Rencana:" : "Plan:"}</strong> {errorMessage}
          </div>
        )}

        {plan && (
          <div className="optimizer-plan-card">
            <div className="plan-header">
              <strong>{lang === "id" ? "ID rencana" : "Plan ID"}: {plan.plan_id}</strong>
              <span className={`plan-status-badge ${plan.status}`}>
                {plan.status === "proposed" ? (lang === "id" ? "DIUSULKAN" : "PROPOSED") : plan.status === "approved" ? (lang === "id" ? "DISETUJUI" : "APPROVED") : (lang === "id" ? "STATUS TIDAK DIKETAHUI" : "UNKNOWN STATUS")}
              </span>
            </div>
            
            <div className="plan-stats-grid">
              <div className="plan-stat-item">
                <span>{lang === "id" ? "Total kebutuhan" : "Total demand"}</span>
                <strong>{number(plan.total_demand_tons)} {lang === "id" ? "ton" : "tons"}</strong>
              </div>
              <div className="plan-stat-item">
                <span>{lang === "id" ? "Dialokasikan" : "Assigned"}</span>
                <strong>{number(plan.total_assigned_tons)} {lang === "id" ? "ton" : "tons"}</strong>
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
                    <li key={i}>{reason(r)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="assign-title">{lang === "id" ? "Penugasan hasil optimasi:" : "Optimizer assignments:"}</div>
            <div className="assignments-container">
              {(plan.assignments || []).map((a, i) => (
                <div key={i} className="assign-card">
                  <div className="assign-info">
                    <strong>{lang === "id" ? "Truk" : "Truck"} {a.truck_code}</strong>
                    <span>&rarr; {a.area.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div className="assign-evidence">
                    <span>{lang === "id" ? "Muatan" : "Assigned"}: <b>{number(a.assigned_tons)} {lang === "id" ? "ton" : "tons"}</b></span>
                    {a.evidence?.permit_compliant ? (
                      <span className="ok">{lang === "id" ? "Izin sesuai" : "Permit compliant"}</span>
                    ) : (
                      <span className="warn">{lang === "id" ? "Tanpa izin" : "No permit"}</span>
                    )}
                  </div>
                </div>
              ))}
              {!plan.assignments?.length && (
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
      planStatus={plan?.status}
    />
  );
}
