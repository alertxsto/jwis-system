import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Clock,
  Cctv,
} from "lucide-react";

export function LiveSurveillancePanel() {
  const { lang } = useLanguage();
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState("");

  async function fetchFeed() {
    try {
      const res = await fetch(`${API_URL}/cv/surveillance-feed`);
      if (res.ok) {
        setFeed(await res.json());
        setError("");
      }
    } catch {
      setError("CV feed endpoint unavailable");
    }
  }

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, []);

  const events = feed?.events || [];
  const last = events[0] || null;
  const streaming = feed?.status === "streaming";

  return (
    <section className="panel wide" data-testid="live-surveillance-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Pengawasan Gerbang ANPR Real-Time" : "Live Surveillance — ANPR Gate Feed"}</h2>
          <p>
            {feed?.source === "simulated"
              ? (lang === "id" ? "Telemetri kamera gerbang: Deteksi truk YOLO + pengenalan plat OCR dengan verifikasi izin DLH." : "Automated gate camera telemetry: YOLO vehicle detection + OCR plate recognition with whitelist verification.")
              : (lang === "id" ? "Pengenalan Plat Nomor Otomatis di gerbang operasional TPA dan transfer station." : "Automatic Number-Plate Recognition at operational landfill & transfer station gates.")}
          </p>
        </div>
        <div className="panel-header-icon-wrap">
          <Cctv size={18} />
        </div>
      </div>

      <div className="tpa-status-grid">
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Status Aliran Kamera" : "Camera Stream Status"}</span>
          <strong className={streaming ? "text-success" : "text-danger"}>
            <span className={`status-dot ${streaming ? "success" : "danger"}`} style={{ display: "inline-block", marginRight: "6px" }} />
            {streaming ? (lang === "id" ? "STREAMING (24 FPS)" : "STREAMING (24 FPS)") : (feed?.status || "OFFLINE").toUpperCase()}
          </strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Mesin Inferensi" : "Inference Engine"}</span>
          <strong>{feed?.device === "cuda" ? (lang === "id" ? "Akselerasi GPU (CUDA)" : "GPU Accelerated (CUDA)") : (feed?.device || "Edge CPU")}</strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Total Plat Terbaca" : "Total Plates Read"}</span>
          <strong style={{ color: "var(--ui-ink)" }}>{feed?.plates_read ?? 0} {lang === "id" ? "terbaca" : "scanned"}</strong>
        </div>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {feed?.error && <p className="text-danger">Feed error: {feed.error}</p>}
      {feed && !feed.error && (
        <p className="text-muted small" style={{ marginBottom: "16px" }}>
          {feed.trucks_detected || 0} {lang === "id" ? "truk terdeteksi" : "trucks detected"} · {feed.frames_processed || 0} {lang === "id" ? "frame diproses" : "frames processed"} · {feed.video || "gate-cam-01.mp4"}
        </p>
      )}

      {last && (
        <div className={`cv-last-event ${last.severity === "critical" ? "cv-event-critical" : "cv-event-ok"}`} style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="plate-badge" style={{ fontSize: "14px", padding: "4px 10px" }}>{last.plate}</span>
              <span className={`pill ${last.severity === "critical" ? "danger" : "success"}`}>
                <span className={`status-dot ${last.severity === "critical" ? "danger" : "success"}`} />
                {last.authorized ? (lang === "id" ? "KENDARAAN TERDAFTAR" : "AUTHORIZED VEHICLE") : (lang === "id" ? "KOLEKTOR LIAR TERDETEKSI" : "UNLICENSED DETECTED")}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--ui-muted)", fontFamily: "var(--mono, monospace)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Clock size={12} />
              {last.timestamp}
            </span>
          </div>
          <p style={{ margin: "8px 0 4px", fontSize: "13px", color: "var(--ui-ink)" }}>{last.reason}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <small style={{ color: "var(--ui-muted)" }}>{lang === "id" ? "Akurasi Pengenalan:" : "Recognition Confidence:"}</small>
            <div style={{ width: "120px", height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
              <div style={{ width: `${Math.round(last.confidence * 100)}%`, height: "100%", background: last.authorized ? "#16a34a" : "#dc2626" }} />
            </div>
            <small style={{ fontWeight: 700, color: "var(--ui-ink)" }}>{Math.round(last.confidence * 100)}%</small>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ui-border)", background: "var(--ui-surface-muted)" }}>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--ui-ink)" }}>{lang === "id" ? "Log Verifikasi Plat Gerbang Terkini" : "Recent Gate ANPR Verification Logs"}</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "18%" }}>{lang === "id" ? "Waktu" : "Timestamp"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Plat Kendaraan" : "Vehicle Plate"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Status Izin" : "Registry Status"}</th>
              <th scope="col" style={{ width: "18%" }}>{lang === "id" ? "Akurasi OCR" : "OCR Confidence"}</th>
              <th scope="col" style={{ width: "16%" }}>{lang === "id" ? "Tindakan Gerbang" : "Gate Action"}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--ui-muted)" }}>
                  {lang === "id" ? "Belum ada rekaman plat terdeteksi — menunggu kendaraan masuk." : "No plate events detected yet — awaiting incoming vehicle."}
                </td>
              </tr>
            ) : (
              events.map((ev, i) => {
                const isAuth = Boolean(ev.authorized);
                return (
                  <tr key={i}>
                    <td>
                      <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                        {ev.timestamp}
                      </span>
                    </td>
                    <td>
                      <span className="plate-badge">{ev.plate}</span>
                    </td>
                    <td>
                      <span className={`pill ${isAuth ? "success" : "danger"}`}>
                        <span className={`status-dot ${isAuth ? "success" : "danger"}`} />
                        {isAuth ? (lang === "id" ? "Terdaftar" : "Authorized") : (lang === "id" ? "Kolektor Liar" : "Unlicensed")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", fontWeight: 600 }}>
                          {Math.round(ev.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: isAuth ? "#15803d" : "#b91c1c" }}>
                        {isAuth ? (lang === "id" ? "Palang Dibuka" : "Gate Opened") : (lang === "id" ? "Diperiksa Petugas" : "Flagged for Inspection")}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
