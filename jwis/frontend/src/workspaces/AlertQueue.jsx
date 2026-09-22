import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { StatusPill } from "../ui/StatusPill.jsx";
import {
  AlertTriangle,
  Check,
  Route,
  Send,
  MessageCircle,
  Clock,
  Crosshair,
} from "lucide-react";

export function formatAlertDescription(desc) {
  if (!desc) return "";
  return desc
    .replace(/(\d+)\s*meters/gi, (match, val) => {
      const num = Number(val);
      if (isNaN(num)) return match;
      return num >= 1000 ? `${(num / 1000).toFixed(1)} km` : `${num} m`;
    })
    .replace("from the assigned corridor", "outside designated corridor");
}

export function AlertQueue({ alerts, onDispatch, onWhatsApp }) {
  const { t, lang } = useLanguage();
  const [followUps, setFollowUps] = useState({});
  const [notes, setNotes] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/alert/follow-ups`)
      .then((r) => (r.ok ? r.json() : []))
      .then((records) => {
        if (cancelled) return;
        const map = {};
        for (const rec of records) {
          if (rec.payload?.alert_id) map[rec.payload.alert_id] = { ...rec.payload, updated_at: rec.created_at };
        }
        setFollowUps(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function recordFollowUp(alert, status, noteOverride) {
    const note = noteOverride !== undefined ? noteOverride : (notes[alert.id] || "").trim();
    const payload = {
      alert_id: alert.id,
      status,
      operator: localStorage.getItem("jwis_role") || "dispatcher",
      note,
    };
    setFollowUps((s) => ({ ...s, [alert.id]: { ...payload, updated_at: new Date().toISOString() } }));
    setNotes((s) => ({ ...s, [alert.id]: "" }));
    try {
      await fetch(`${API_URL}/alert/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("Follow-up sync failed; kept local only", error);
    }
  }

  const activeCount = alerts.filter((a) => (followUps[a.id]?.status || "OPEN") !== "RESOLVED").length;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{t("aq_title")}</h2>
          <p>{t("aq_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <StatusPill tone="danger">{activeCount} {lang === "id" ? "aktif" : "active"}</StatusPill>
        </div>
      </div>
      <div className="alert-list">
        {alerts.map((alert) => {
          const recommendedRoute = alert.recommended_routes?.[0];
          const status = followUps[alert.id]?.status || "OPEN";
          const statusClass = status === "RESOLVED" ? "success" : status === "DISPATCHED" ? "warning" : "danger";
          const formattedDesc = formatAlertDescription(alert.description);

          return (
            <article className="alert-item" key={alert.id}>
              <div className="alert-head">
                <div className="alert-icon-box">
                  <AlertTriangle size={17} />
                </div>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{formattedDesc}</p>
                </div>
                <span className={`pill ${statusClass}`}>
                  <span className={`status-dot ${statusClass}`} />
                  {status === "OPEN" ? (lang === "id" ? "TERBUKA" : "OPEN") : status === "DISPATCHED" ? (lang === "id" ? "DIKIRIM" : "DISPATCHED") : (lang === "id" ? "SELESAI" : "RESOLVED")}
                </span>
              </div>
              <div className={`route-rec ${recommendedRoute ? "" : "route-rec-empty"}`}>
                {recommendedRoute ? (
                  <>
                    <div className="route-rec-icon">
                      <Route size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{recommendedRoute.name}</strong>
                      <div className="route-rec-meta">
                        <span className="route-rec-tag"><Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />{recommendedRoute.eta_minutes} min ETA</span>
                        <span className="route-rec-tag"><Crosshair size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />Score {recommendedRoute.score}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <strong>{t("aq_awaiting_rec")}</strong>
                    <span>{t("aq_awaiting_sub")}</span>
                  </div>
                )}
              </div>
              {status !== "RESOLVED" ? (
                <div className="alert-actions">
                  <div className="alert-btn-row">
                    <button className="primary-button" onClick={() => { onDispatch(alert); recordFollowUp(alert, "DISPATCHED", `Routed via ${recommendedRoute?.name || "backup route"}`); }}>
                      <Send size={14} /> {t("btn_approve_dispatch")}
                    </button>
                    <button className="alert-wa-button" onClick={() => onWhatsApp(alert)}>
                      <MessageCircle size={14} /> {t("btn_wa_alert")}
                    </button>
                  </div>
                  <div className="alert-resolve-row">
                    <input
                      type="text"
                      value={notes[alert.id] || ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [alert.id]: e.target.value }))}
                      placeholder={t("btn_resolve_placeholder")}
                    />
                    <button className="resolve-btn" onClick={() => recordFollowUp(alert, "RESOLVED")} disabled={!notes[alert.id]?.trim()}>
                      <Check size={14} /> {t("btn_mark_resolved")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alert-resolved-note">
                  <Check size={14} /> {lang === "id" ? "Diselesaikan oleh" : "Resolved by"} <b>{followUps[alert.id]?.operator}</b>: {followUps[alert.id]?.note || "closed"}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
