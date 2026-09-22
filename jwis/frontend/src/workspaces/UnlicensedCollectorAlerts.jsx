import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { StatusPill } from "../ui/StatusPill.jsx";
import {
  AlertTriangle,
  Check,
  ShieldCheck,
} from "lucide-react";

export function getDistrictFromCoords(lat, lng) {
  if (lat > -6.18 && lng < 106.78) return "Cengkareng, Jakbar";
  if (lat > -6.18 && lng >= 106.78 && lng < 106.86) return "Kemayoran, Jakpus";
  if (lat > -6.18 && lng >= 106.86) return "Tanjung Priok, Jakut";
  if (lat <= -6.18 && lat > -6.23 && lng < 106.82) return "Kebon Jeruk, Jakbar";
  if (lat <= -6.18 && lat > -6.23 && lng >= 106.82) return "Jatinegara, Jaktim";
  if (lat <= -6.23 && lng >= 106.85) return "Pasar Rebo, Jaktim";
  if (lat <= -6.23 && lng < 106.85) return "Pasar Minggu, Jaksel";
  return "DKI Jakarta Area";
}

export function UnlicensedCollectorAlerts() {
  const { t, lang } = useLanguage();
  const [flags, setFlags] = useState(null);
  const [resolved, setResolved] = useState({});

  useEffect(() => {
    const load = () => fetch(`${API_URL}/ai/unlicensed-flags`)
      .then((r) => r.json())
      .then((body) => setFlags(body.flags || []))
      .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const mark = (id, value) => setResolved((prev) => ({ ...prev, [id]: value }));

  if (!flags || flags.length === 0) {
    return (
      <section className="panel wide unlicensed-alerts-panel">
        <div className="panel-title">
          <div>
            <h2>{t("unlicensed_title")}</h2>
            <p>{t("unlicensed_subtitle")}</p>
          </div>
          <div className="panel-header-icon-wrap warning">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="ai-feed-empty">
          {flags === null
            ? (lang === "id" ? "Memuat telemetri deteksi..." : "Loading detection telemetry...")
            : "Tidak ada flag aktif — pola stop normal."}
        </div>
      </section>
    );
  }

  const pendingCount = flags.filter((f) => !resolved[f.collector_id]).length;

  return (
    <section className="panel wide unlicensed-alerts-panel">
      <div className="panel-title">
        <div>
          <h2>{t("unlicensed_title")}</h2>
          <p>{t("unlicensed_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="pill text-normal">Auto-detected AI</span>
          <StatusPill tone={pendingCount > 0 ? "danger" : "success"}>
            {pendingCount} {lang === "id" ? "tanpa izin" : "unauthorized"}
          </StatusPill>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "16%" }}>{t("unlicensed_th_plate")}</th>
              <th scope="col" style={{ width: "22%" }}>{t("unlicensed_th_loc")}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Diam" : "Stop"}</th>
              <th scope="col" style={{ width: "18%" }}>{lang === "id" ? "Situs Terdekat" : "Nearest Site"}</th>
              <th scope="col" style={{ width: "12%" }}>Confidence</th>
              <th scope="col" style={{ width: "18%" }}>{t("unlicensed_th_action")}</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => {
              const state = resolved[f.collector_id];
              const districtName = getDistrictFromCoords(f.lat, f.lng);
              return (
                <tr key={f.collector_id}>
                  <td>
                    <span className="plate-badge" style={{ fontSize: "13px" }}>{f.collector_id || "UNKNOWN"}</span>
                  </td>
                  <td>
                    <span className="zone-tag">{districtName}</span>
                  </td>
                  <td>{f.duration_min.toFixed(0)} min</td>
                  <td>{f.nearest_site_m.toFixed(0)} m</td>
                  <td>{(f.confidence * 100).toFixed(0)}%</td>
                  <td>
                    {state ? (
                      <span className={`pill ${state === "verified" ? "success" : "text-normal"}`}>
                        <span className={`status-dot ${state === "verified" ? "success" : ""}`} />
                        {state === "verified"
                          ? (lang === "id" ? "Terverifikasi" : "Verified")
                          : (lang === "id" ? "Ditandai aman" : "Marked safe")}
                      </span>
                    ) : (
                      <>
                        <button
                          className="compact-enforce-btn"
                          onClick={() => mark(f.collector_id, "verified")}
                        >
                          <Check size={13} /> {lang === "id" ? "Verifikasi" : "Verify"}
                        </button>
                        <button
                          className="compact-enforce-btn"
                          onClick={() => mark(f.collector_id, "safe")}
                        >
                          <ShieldCheck size={13} /> {lang === "id" ? "Tandai Aman" : "Mark Safe"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="unlicensed-footer-meta">
        <ShieldCheck size={14} style={{ color: "var(--ui-accent)", flexShrink: 0 }} />
        <span>{lang === "id" ? "Flag dihasilkan otomatis oleh engine AI dari pola stop telemetri terhadap jarak situs resmi." : "Flags are auto-generated by the AI engine from telemetry stop patterns against official site distance."}</span>
      </div>
    </section>
  );
}
