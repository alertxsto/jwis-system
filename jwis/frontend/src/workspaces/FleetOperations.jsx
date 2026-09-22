import React, { useRef } from "react";
import { Clock3, Radio, SlidersHorizontal } from "lucide-react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { useLanguage } from "../i18n.jsx";

const detailTabs = [
  { id: "fleet", key: "tab_fleet", label: "Kondisi armada", surface: "fleet-table-surface" },
  { id: "history", key: "tab_history", label: "Riwayat perjalanan", surface: "fleet-history-surface" },
  { id: "queue", key: "tab_queue", label: "Antrean TPA", surface: "fleet-queue-surface" },
  { id: "evidence", key: "tab_evidence", label: "Bukti rute", surface: "fleet-evidence-surface" },
  { id: "unlicensed", key: "tab_unlicensed", label: "Kolektor liar", surface: "fleet-unlicensed-surface" },
  { id: "impact", key: "tab_impact", label: "Jejak karbon", surface: "fleet-impact-surface" },
  { id: "spj", key: "tab_spj", label: "Surat jalan", surface: "fleet-spj-surface" },
  { id: "damage", key: "tab_damage", label: "Kerusakan", surface: "fleet-damage-surface" },
];

export function FleetOperations({
  detailTab,
  onDetailTabChange,
  actionCard,
  metrics,
  map,
  mapFooter,
  routeEvidence,
  queue,
  fleetTable,
  unlicensedTable,
  history,
  carbon,
  spj,
  damage,
}) {
  const { t, lang } = useLanguage();
  const tabRefs = useRef([]);
  const activeTab = detailTabs.find((tab) => tab.id === detailTab) || detailTabs[0];
  const surfaces = {
    fleet: fleetTable,
    unlicensed: unlicensedTable,
    history,
    queue,
    evidence: routeEvidence,
    impact: carbon,
    spj,
    damage,
  };

  function selectTab(tabId) {
    onDetailTabChange(tabId);
  }

  function handleTabKeyDown(event, index) {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % detailTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + detailTabs.length) % detailTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = detailTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(detailTabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="fleet-workspace workspace-page" data-testid="fleet-workspace">
      <header className="workspace-heading">
        <div>
          <span className="workspace-kicker"><Radio size={14} /> Kendali langsung</span>
          <h1>{lang === "id" ? "Operasi armada hari ini" : "Today’s fleet operations"}</h1>
          <p>{lang === "id" ? "Pantau pergerakan, prioritaskan gangguan, dan kirim keputusan dari satu layar." : "Monitor movement, prioritize disruptions, and dispatch decisions from one screen."}</p>
        </div>
        <div className="workspace-freshness"><Clock3 size={16} /><span>Diperbarui otomatis</span><strong>15 dtk</strong></div>
      </header>

      <MetricStrip metrics={metrics} />

      <div className="fleet-command-grid">
        <section className="fleet-map-surface" aria-label="Peta operasi armada">
          <div className="surface-heading">
            <div><span className="surface-kicker">Situasi lapangan</span><h2>Peta operasi</h2></div>
            <span className="live-indicator"><i /> LIVE</span>
          </div>
          <div className="fleet-map-stage" data-testid="fleet-map-stage">{map}</div>
        </section>
        <aside className="fleet-decision-rail" aria-label="Keputusan prioritas">
          <div className="decision-rail-heading">
            <span className="surface-kicker">Perlu keputusan</span>
            <h2>Tindakan prioritas</h2>
            <p>Selesaikan satu masalah terbesar sebelum membuka detail lain.</p>
          </div>
          {actionCard}
        </aside>
      </div>

      <details className="fleet-tools-drawer">
        <summary><SlidersHorizontal size={17} /> Kontrol peta & konteks operasi</summary>
        <div className="fleet-tools-content">{mapFooter}</div>
      </details>

      <section className="fleet-records-surface">
        <div className="records-heading">
          <div><span className="surface-kicker">Bukti operasional</span><h2>Detail armada</h2></div>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="Detail armada">
          {detailTabs.map((tab, index) => (
            <button
              key={tab.id}
              id={tab.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              className="workspace-tab"
              type="button"
              role="tab"
              aria-selected={detailTab === tab.id}
              aria-controls={tab.surface}
              tabIndex={detailTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {t(tab.key) || tab.label}
            </button>
          ))}
        </div>
        <div id={activeTab.surface} className="fleet-detail-surface" role="tabpanel" aria-labelledby={activeTab.id} data-testid={activeTab.surface}>
          {surfaces[detailTab]}
        </div>
      </section>
    </section>
  );
}
