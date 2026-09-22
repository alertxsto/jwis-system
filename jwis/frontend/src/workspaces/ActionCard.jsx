import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock, Route, Send } from "lucide-react";
import { useLanguage } from "../i18n.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

function authHeaders() {
  const token = localStorage.getItem("jwis_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pickAlert(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;
  return alerts.find((a) => (a.recommended_routes?.length || 0) > 0) || alerts[0];
}

function localizeIssue(text, lang) {
  if (lang !== "id") return text;
  const corridor = String(text).match(/Truck is ([\d.]+) meters from the assigned corridor\.?/i);
  if (!corridor) return text;
  const meters = Number(corridor[1]);
  const distance = meters >= 1000
    ? `${(meters / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`
    : `${Math.round(meters)} m`;
  return `Kendaraan berada ${distance} di luar koridor tugas.`;
}

function localizeRoute(name, lang) {
  if (lang !== "id") return name;
  return String(name)
    .replace(/^Route /i, "Rute ")
    .replace("Recovery", "Pemulihan");
}

export function ActionCard({ snapshot, targetTruck = null }) {
  const { t, lang } = useLanguage();
  const [phase, setPhase] = useState("idle"); // idle | sending | sent | confirmed | error
  const [waConnected, setWaConnected] = useState(null); // null = unknown, checked on click
  const [confirmedAt, setConfirmedAt] = useState("");
  const pollRef = useRef(null);

  const fallbackAlert = pickAlert(snapshot?.alerts);
  const alerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts : [];
  const targetedAlert = targetTruck ? alerts.find((a) => a.truck_code === targetTruck) : null;
  const alert = targetedAlert || fallbackAlert;
  const truckCode = alert?.truck_code || "";
  const truck = (snapshot?.trucks || []).find((item) => item.truck_code === truckCode);
  const driverName = truck?.driver_name || t("ac_unknown_driver");
  const route = alert?.recommended_routes?.[0] || null;
  const issueText = localizeIssue(alert?.description || alert?.title || "", lang);
  // A map/table click on a truck with no active alert shows that truck as an
  // informational target; the action stays bound to the live alert flow.
  const targetOnly = Boolean(targetTruck) && !targetedAlert;
  const infoTruck = targetOnly ? (snapshot?.trucks || []).find((item) => item.truck_code === targetTruck) : null;

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    // Retargeting the overlay resets the send flow so a "sent/confirmed"
    // state never bleeds onto a different truck.
    setPhase("idle");
    setConfirmedAt("");
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, [truckCode]);

  function startConfirmationPoll(code) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/dispatch/${code}`, { headers: authHeaders() });
        if (!res.ok) return;
        const pending = await res.json();
        if (Array.isArray(pending) && pending.length === 0) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setConfirmedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
          setPhase("confirmed");
        }
      } catch {
        /* keep polling */
      }
    }, 8000);
  }

  async function handleSend() {
    if (!alert || phase === "sending" || phase === "sent") return;

    // Check the WhatsApp gateway once before sending.
    if (waConnected === null) {
      try {
        const res = await fetch(`${API_URL}/whatsapp/status`, { headers: authHeaders() });
        const body = await res.json();
        setWaConnected(body.connected === true);
      } catch {
        setWaConnected(false);
      }
    }

    setPhase("sending");
    const instruction = route
      ? `${t("ac_instruction_route")} ${route.name}. ${t("ac_instruction_confirm")}`
      : `${t("ac_instruction_handle")}: ${issueText}`;

    try {
      const dispatchRes = await fetch(`${API_URL}/dispatch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          truck_code: truckCode,
          instruction,
          manager_id: localStorage.getItem("jwis_role") || "manager_central",
        }),
      });
      if (!dispatchRes.ok) throw new Error("dispatch failed");
    } catch {
      setPhase("error");
      return;
    }

    // Best-effort WhatsApp notification; failure must not roll back the dispatch.
    try {
      await fetch(`${API_URL}/whatsapp/alert`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          truck_code: truckCode,
          issue: issueText,
          route_name: route?.name || "",
          recommendation: route
            ? `${route.name} (ETA ${route.eta_minutes} ${t("ac_minutes")})`
            : t("ac_instruction_handle"),
        }),
      });
    } catch {
      /* gateway offline is surfaced via the warning */
    }

    setPhase("sent");
    startConfirmationPoll(truckCode);
  }

  if (!alert && !infoTruck) {
    return (
      <section className="action-card" data-testid="action-card">
        <div className="action-card-head">
          <span className="action-card-icon ok"><Check size={22} /></span>
          <h2 className="action-card-title">{t("ac_no_alerts")}</h2>
        </div>
      </section>
    );
  }

  if (infoTruck) {
    const zone = infoTruck.assigned_zone || infoTruck.zone || "";
    const activity = infoTruck.activity || infoTruck.status || "";
    return (
      <section className="action-card action-card-info" data-testid="action-card">
        <div className="action-card-head">
          <span className="action-card-icon ok"><Check size={22} /></span>
          <div>
            <h2 className="action-card-title">
              {infoTruck.truck_code} — {infoTruck.driver_name || t("ac_unknown_driver")}
            </h2>
            <p className="action-card-issue">
              {(lang === "id" ? "Tidak ada peringatan aktif untuk unit ini." : "No active alert for this unit.")}
              {zone ? ` ${zone}` : ""}{activity ? ` · ${activity}` : ""}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="action-card" data-testid="action-card">
      <div className="action-card-head">
        <span className="action-card-icon"><AlertTriangle size={22} /></span>
        <div>
          <h2 className="action-card-title">
            {truckCode} — {driverName}
          </h2>
          <p className="action-card-issue">{issueText}</p>
        </div>
      </div>

      {route && (
        <div className="action-card-route">
          <Route size={18} />
          <div>
            <strong>{localizeRoute(route.name, lang)}</strong>
            <span className="action-card-route-meta">
              <Clock size={14} /> ETA {route.eta_minutes} {t("ac_minutes")}
            </span>
          </div>
        </div>
      )}

      {waConnected === false && phase !== "confirmed" && (
        <p className="action-card-warning" role="alert" data-testid="wa-warning">
          {t("ac_wa_offline")}
        </p>
      )}

      {phase === "sent" && (
        <p className="action-card-success" data-testid="action-card-sent">
          {t("ac_sent_waiting").replace("{driver}", driverName).replace("{truck}", truckCode)}
        </p>
      )}
      {phase === "confirmed" && (
        <p className="action-card-success" data-testid="action-card-confirmed">
          {t("ac_confirmed")} {confirmedAt}
        </p>
      )}
      {phase === "error" && (
        <p className="action-card-warning" role="alert" data-testid="action-card-error">
          {t("ac_send_failed")}
        </p>
      )}

      {(phase === "idle" || phase === "sending" || phase === "error") && (
        <button
          type="button"
          className="action-card-button"
          data-testid="action-card-button"
          onClick={handleSend}
          disabled={phase === "sending"}
        >
          <Send size={18} />
          {route ? t("ac_send_route") : t("ac_handle_alert")}
        </button>
      )}
    </section>
  );
}
