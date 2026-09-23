import React, { useEffect, useState } from "react";
import { ArrowRight, Map, Radio, Route, ShieldCheck } from "lucide-react";
import { ActionCard } from "../workspaces/ActionCard.jsx";
import { useLanguage } from "../i18n.jsx";
import { API_URL } from "../config.js";

const copy = {
  en: {
    role: "Field supervisor",
    online: "Online",
    connecting: "Connecting",
    offline: "Connection interrupted",
    next: "Next decision",
    priority: "Operational priority",
    intro: "Address the biggest disruption, then review the remaining queue.",
    alerts: "All alerts",
    error: "Could not load current operational data. Retrying automatically.",
    deviation: "Deviated from assigned corridor",
    damage: "Compactor issue reported",
    damageAction: "Move this truck to lower-priority pickups and assign backup capacity.",
    sustained: (threshold) => `Truck remains off the assigned corridor (sustained-deviation latch, clears under ${threshold} m).`,
    distance: (distance) => `Truck is ${distance} meters from the assigned corridor.`,
    codes: {
      active: "Active", resolved: "Resolved", acknowledged: "Acknowledged",
      critical: "Critical", warning: "Warning", normal: "Normal",
      route_deviation: "Route deviation", fleet_damage: "Fleet damage",
    },
  },
  id: {
    role: "Pengawas lapangan",
    online: "Daring",
    connecting: "Menghubungkan",
    offline: "Koneksi terputus",
    next: "Keputusan berikutnya",
    priority: "Prioritas operasi",
    intro: "Tangani gangguan terbesar, lalu tinjau antrean lainnya.",
    alerts: "Semua peringatan",
    error: "Gagal memuat data operasional terkini. Mencoba lagi secara otomatis.",
    deviation: "Menyimpang dari koridor tugas",
    damage: "Masalah pemadat dilaporkan",
    damageAction: "Alihkan truk ini ke pengangkutan berprioritas lebih rendah dan siapkan armada cadangan.",
    sustained: (threshold) => `Truk masih berada di luar koridor tugas (deviasi berkelanjutan; pulih jika jarak di bawah ${threshold} m).`,
    distance: (distance) => `Truk berada ${distance} meter dari koridor tugas.`,
    codes: {
      active: "Aktif", resolved: "Selesai", acknowledged: "Dikonfirmasi",
      critical: "Kritis", warning: "Peringatan", normal: "Normal",
      route_deviation: "Penyimpangan rute", fleet_damage: "Kerusakan armada",
    },
  },
};

function alertCopy(alert, lang, words) {
  const code = alert.truck_code || "";
  const title = alert.title || "";
  const description = alert.description || "";
  const knownDeviation = alert.type === "route_deviation" &&
    (!title || title === `${code} deviated from assigned corridor`);
  const knownDamage = alert.type === "fleet_damage" &&
    (!title || title === `${code} reports compactor issue`);
  const match = alert.type === "route_deviation"
    ? /^Truck is (\d+) meters from the assigned corridor\.$/.exec(description)
    : null;
  const sustained = alert.type === "route_deviation"
    ? /^Truck remains off the assigned corridor \(sustained-deviation latch, clears under (\d+) m\)\.$/.exec(description)
    : null;
  const distance = match
    ? Number(match[1]).toLocaleString(lang === "id" ? "id-ID" : "en-US")
    : null;
  return {
    title: knownDeviation ? words.deviation : knownDamage ? words.damage : title || words.codes[alert.type] || alert.type,
    description: distance !== null ? words.distance(distance)
      : sustained ? words.sustained(sustained[1])
        : alert.type === "fleet_damage" && description === copy.en.damageAction
          ? words.damageAction : description,
    status: [alert.severity, alert.status]
      .filter(Boolean)
      .map((value) => words.codes[value] || value)
      .join(" · "),
    prefixed: knownDeviation || knownDamage || !title || !title.startsWith(`${code} `),
  };
}

export function SupervisorView() {
  const { t, lang } = useLanguage();
  const words = copy[lang] || copy.en;
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/command-center`);
        if (!res.ok) throw new Error("api unavailable");
        const data = await res.json();
        if (!cancelled) {
          setSnapshot(data);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const alerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts : [];

  return (
    <main className="supervisor-view" data-testid="supervisor-view">
      <header className="supervisor-header">
        <span className="supervisor-brand-mark" aria-hidden="true"><Route size={19} /></span>
        <span className="supervisor-brand-copy"><strong>JWIS</strong><small>{words.role}</small></span>
        <span className="supervisor-live"><Radio size={13} aria-hidden="true" /> {loadError ? words.offline : snapshot ? words.online : words.connecting}</span>
      </header>

      <section className="supervisor-intro">
        <span>{words.next}</span>
        <h1>{words.priority}</h1>
        <p>{words.intro}</p>
      </section>

      {snapshot ? <ActionCard snapshot={snapshot} /> : !loadError && <p className="supervisor-loading" role="status">{t("sv_loading")}</p>}
      {loadError && <p className="supervisor-loading" role="alert">{words.error}</p>}

      {snapshot && <details className="supervisor-alerts">
        <summary><span><ShieldCheck size={18} aria-hidden="true" /> {words.alerts}</span><b>{alerts.length}</b></summary>
        <ul className="supervisor-alert-list">
          {alerts.map((alert) => {
            const text = alertCopy(alert, lang, words);
            return (
              <li key={alert.id} className="supervisor-alert-item">
                <strong>{text.prefixed && alert.truck_code ? `${alert.truck_code} — ` : ""}{text.title}</strong>
                {text.status && <small> · {text.status}</small>}
                {text.description && <p>{text.description}</p>}
              </li>
            );
          })}
          {alerts.length === 0 && <li className="supervisor-alert-item">{t("ac_no_alerts")}</li>}
        </ul>
      </details>}

      <a className="supervisor-map-link" href="/"><Map size={18} aria-hidden="true" /><span>{t("sv_open_map")}</span><ArrowRight size={17} aria-hidden="true" /></a>
    </main>
  );
}
