import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock, Route, Send } from "lucide-react";
import { useLanguage } from "../i18n.jsx";
import { authenticatedRequest, createAlertDispatch } from "../dispatchApi.js";

function pickAlert(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;
  return alerts.find((a) => (a.recommended_routes?.length || 0) > 0) || alerts[0];
}

function localizeIssue(text, lang) {
  if (lang !== "id") return text;
  const corridor = String(text).match(/Truck is ([\d.]+) meters from the assigned corridor\.?/i);
  if (String(text).trim() === "Move this truck to lower-priority pickups and assign backup capacity.") {
    return "Alihkan kendaraan ini ke pengangkutan prioritas lebih rendah dan tugaskan armada cadangan.";
  }
  if (String(text).trim() === "Truck remains off the assigned corridor (sustained-deviation latch, clears under 50 m).") {
    return "Kendaraan masih di luar koridor tugas (deviasi berlanjut, pulih saat jarak di bawah 50 m).";
  }
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
  const [phase, setPhase] = useState("idle"); // idle | sending | sent | confirmed | escalated | cancelled | error
  const [waConnected, setWaConnected] = useState(null);
  const [confirmedAt, setConfirmedAt] = useState("");
  const [fieldNote, setFieldNote] = useState("");
  const [statusError, setStatusError] = useState("");
  const [sendError, setSendError] = useState("");
  const pollRef = useRef(null);
  const inFlightRef = useRef(false);
  const requestGeneration = useRef(0);

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
      requestGeneration.current += 1;
      clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    // An old request must not update the card after the operator retargets it.
    requestGeneration.current += 1;
    inFlightRef.current = false;
    setPhase("idle");
    setConfirmedAt("");
    setFieldNote("");
    setStatusError("");
    setSendError("");
    setWaConnected(null);
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, [truckCode]);

  function startConfirmationPoll(dispatchId, generation) {
    clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const response = await authenticatedRequest(`/dispatch/${encodeURIComponent(dispatchId)}/status`);
        if (generation !== requestGeneration.current) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setStatusError(response.status === 401
              ? (lang === "id" ? "Sesi berakhir. Masuk kembali untuk memeriksa respons lapangan." : "Session expired. Sign in again to check the field response.")
              : (lang === "id" ? "Akses ditolak. Tidak dapat memeriksa respons lapangan." : "Access denied. Cannot check the field response."));
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }
        const dispatch = await response.json();
        if (generation !== requestGeneration.current || dispatch.id !== dispatchId) return;
        const status = dispatch.field_status?.toUpperCase();
        if (status === "PENDING") return;
        if (status === "READY" || status === "ISSUE" || status === "CANCELLED" || status === "CANCELED") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setFieldNote(dispatch.confirmed_note || "");
          if (status === "READY") {
            setConfirmedAt(new Date(dispatch.confirmed_at || Date.now()).toLocaleTimeString(
              lang === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit" },
            ));
            setPhase("confirmed");
          } else {
            setPhase(status === "ISSUE" ? "escalated" : "cancelled");
          }
        }
      } catch {
        // Retain pending status until a later poll can read an actual field response.
      }
    };
    poll();
    pollRef.current = setInterval(poll, 8000);
  }

  async function handleSend() {
    if (!alert || inFlightRef.current || phase !== "idle" && phase !== "error") return;
    inFlightRef.current = true;
    const generation = requestGeneration.current;
    setPhase("sending");
    setSendError("");

    try {
      const dispatchRes = await createAlertDispatch(alert, t, issueText);
      if (generation !== requestGeneration.current) return;
      if (!dispatchRes.ok) {
        setSendError(dispatchRes.status === 401
          ? (lang === "id" ? "Sesi berakhir. Masuk kembali untuk mengirim instruksi." : "Session expired. Sign in again to dispatch.")
          : dispatchRes.status === 403
            ? (lang === "id" ? "Akses ditolak. Anda tidak dapat mengirim instruksi." : "Access denied. You cannot dispatch this instruction.")
            : t("ac_send_failed"));
        setPhase("error");
        return;
      }
      const created = await dispatchRes.json();
      if (generation !== requestGeneration.current) return;
      setPhase("sent");
      if (created.id) startConfirmationPoll(created.id, generation);

      // Notification failure does not undo an already persisted dispatch.
      try {
        const status = await authenticatedRequest("/whatsapp/status");
        if (generation !== requestGeneration.current) return;
        const gateway = status.ok ? await status.json() : null;
        if (generation !== requestGeneration.current) return;
        setWaConnected(gateway?.connected === true);
        const notification = await authenticatedRequest("/whatsapp/alert", {
          method: "POST",
          body: JSON.stringify({
            truck_code: truckCode,
            issue: issueText,
            recommendation: route
              ? `${route.name} (ETA ${route.eta_minutes} ${t("ac_minutes")})`
              : t("ac_instruction_handle"),
          }),
        });
        if (generation !== requestGeneration.current) return;
        if (notification.status === 401 || notification.status === 403) {
          setStatusError(notification.status === 401
            ? (lang === "id" ? "Instruksi tersimpan, tetapi sesi berakhir sebelum notifikasi WhatsApp dikirim." : "Dispatch saved, but the session expired before WhatsApp notification.")
            : (lang === "id" ? "Instruksi tersimpan, tetapi akses notifikasi WhatsApp ditolak." : "Dispatch saved, but WhatsApp notification access was denied."));
        } else if (!notification.ok) {
          setWaConnected(false);
        } else {
          const result = await notification.json();
          if (generation === requestGeneration.current && !result.sent) setWaConnected(false);
        }
      } catch {
        if (generation === requestGeneration.current) setWaConnected(false);
      }
    } catch {
      if (generation === requestGeneration.current) {
        setSendError(t("ac_send_failed"));
        setPhase("error");
      }
    } finally {
      if (generation === requestGeneration.current) inFlightRef.current = false;
    }
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
      {statusError && <p className="action-card-warning" role="alert">{statusError}</p>}

      {phase === "sent" && (
        <p className="action-card-issue" role="status" data-testid="action-card-sent">
          {t("ac_sent_waiting").replace("{driver}", driverName).replace("{truck}", truckCode)}
        </p>
      )}
      {phase === "confirmed" && (
        <p className="action-card-success" role="status" data-testid="action-card-confirmed">
          {t("ac_confirmed")} {confirmedAt}
        </p>
      )}
      {phase === "escalated" && (
        <p className="action-card-warning" role="alert" data-testid="action-card-escalated">
          {lang === "id" ? "Masalah dilaporkan dari lapangan. Eskalasi ke pengawas." : "Field issue reported. Escalate to the supervisor."}
          {fieldNote && <> {lang === "id" ? "Catatan:" : "Note:"} {fieldNote}</>}
        </p>
      )}
      {phase === "cancelled" && (
        <p className="action-card-issue" role="status" data-testid="action-card-cancelled">
          {lang === "id" ? "Instruksi dibatalkan di lapangan. Tinjau sebelum mengirim ulang." : "Instruction cancelled in the field. Review before dispatching again."}
          {fieldNote && <> {lang === "id" ? "Catatan:" : "Note:"} {fieldNote}</>}
        </p>
      )}
      {phase === "error" && (
        <p className="action-card-warning" role="alert" data-testid="action-card-error">
          {sendError || t("ac_send_failed")}
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
