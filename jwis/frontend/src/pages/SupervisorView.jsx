import React, { useEffect, useState } from "react";
import { Map } from "lucide-react";
import { ActionCard } from "../workspaces/ActionCard.jsx";
import { useLanguage } from "../i18n.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

export function SupervisorView() {
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/command-center`);
        if (!res.ok) throw new Error("api unavailable");
        if (!cancelled) setSnapshot(await res.json());
      } catch {
        if (!cancelled) setSnapshot({ alerts: [], trucks: [] });
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const alerts = snapshot?.alerts || [];

  return (
    <main className="supervisor-view" data-testid="supervisor-view">
      <header className="supervisor-header">
        <strong>JWIS</strong>
        <span>{t("nav_pengawas")}</span>
      </header>

      {snapshot ? <ActionCard snapshot={snapshot} /> : <p className="supervisor-loading">{t("sv_loading")}</p>}

      <details className="supervisor-alerts">
        <summary>{t("ac_all_alerts").replace("{n}", alerts.length)}</summary>
        <ul className="supervisor-alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="supervisor-alert-item">
              <strong>{alert.truck_code}</strong> — {alert.title}
              <p>{alert.description}</p>
            </li>
          ))}
          {alerts.length === 0 && <li className="supervisor-alert-item">{t("ac_no_alerts")}</li>}
        </ul>
      </details>

      <a className="supervisor-map-link" href="/">
        <Map size={18} /> {t("sv_open_map")}
      </a>
    </main>
  );
}
