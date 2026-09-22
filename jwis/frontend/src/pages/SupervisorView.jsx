import React, { useEffect, useState } from "react";
import { ArrowRight, Map, Radio, Route, ShieldCheck } from "lucide-react";
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
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const alerts = snapshot?.alerts || [];

  return (
    <main className="supervisor-view" data-testid="supervisor-view">
      <header className="supervisor-header">
        <span className="supervisor-brand-mark"><Route size={19} /></span>
        <span className="supervisor-brand-copy"><strong>JWIS</strong><small>Pengawas lapangan</small></span>
        <span className="supervisor-live"><Radio size={13} /> Daring</span>
      </header>

      <section className="supervisor-intro">
        <span>Keputusan berikutnya</span>
        <h1>Prioritas operasi</h1>
        <p>Tangani gangguan terbesar, lalu tinjau antrean lainnya.</p>
      </section>

      {snapshot ? <ActionCard snapshot={snapshot} /> : <p className="supervisor-loading">{t("sv_loading")}</p>}

      <details className="supervisor-alerts">
        <summary><span><ShieldCheck size={18} /> Semua peringatan</span><b>{alerts.length}</b></summary>
        <ul className="supervisor-alert-list">
          {alerts.map((alert) => <li key={alert.id} className="supervisor-alert-item"><strong>{alert.truck_code} — {alert.title}</strong><p>{alert.description}</p></li>)}
          {alerts.length === 0 && <li className="supervisor-alert-item">{t("ac_no_alerts")}</li>}
        </ul>
      </details>

      <a className="supervisor-map-link" href="/"><Map size={18} /><span>{t("sv_open_map")}</span><ArrowRight size={17} /></a>
    </main>
  );
}
