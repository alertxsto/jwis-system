import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  FileText,
  Layers,
  Radio,
  Route,
  Truck,
  Wrench,
} from "lucide-react";
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

const documentTabs = detailTabs.filter((tab) => ["spj", "damage", "unlicensed", "impact"].includes(tab.id));
const primaryTabs = detailTabs.filter((tab) => !documentTabs.includes(tab));

function truckDeviationMeters(truck) {
  const value = truck?.deviation?.distance_meters ?? truck?.deviation_m ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDistance(meters, lang) {
  if (meters >= 1000) {
    return `${(meters / 1000).toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(meters)} m`;
}

export function FleetOperations({
  detailTab,
  onDetailTabChange,
  actionCard,
  metrics,
  map,
  mapTools,
  routeEvidence,
  queue,
  fleetTable,
  unlicensedTable,
  history,
  carbon,
  spj,
  damage,
  trucks = [],
  queueTrucks = 0,
  queueWaitMinutes = 0,
  onFocusProblem = () => {},
}) {
  const { t, lang } = useLanguage();
  const tabRefs = useRef([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
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

  // Problem strip: counts derive from the same snapshot the map renders, so a
  // chip click never promises a filter the map cannot show.
  const deviating = trucks.filter((truck) => truckDeviationMeters(truck) > 500);
  const worstDeviation = deviating.reduce((worst, truck) => (
    truckDeviationMeters(truck) > truckDeviationMeters(worst) ? truck : worst
  ), deviating[0] || null);
  const damaged = trucks.filter((truck) => {
    const status = String(truck?.status || truck?.operational_status || "").toLowerCase();
    return status.includes("rusak") || status.includes("damage") || status.includes("maintenance") || status.includes("perawatan");
  });
  const showQueueChip = queueTrucks > 0 || queueWaitMinutes > 0;

  useEffect(() => {
    // Keep the mobile sheet aligned with the actual decision: nothing to act
    // on means nothing covering the map.
    if (!worstDeviation) setSheetExpanded(false);
  }, [worstDeviation]);

  function selectTab(tabId) {
    onDetailTabChange(tabId);
  }

  function handleTabKeyDown(event, index, tabs) {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    // Roving-tabindex pattern: selection and focus move together so keyboard
    // and screen-reader users land on the tab they just activated.
    selectTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function focusWorstDeviation() {
    if (worstDeviation) onFocusProblem(worstDeviation.truck_code);
  }

  const decisionOverlay = worstDeviation ? (
    <div className="deck-decision-body">
      <div className="deck-decision-heading">
        <span className="deck-decision-kicker"><AlertTriangle size={13} /> {lang === "id" ? "Perlu keputusan" : "Needs a decision"}</span>
        <h2>{lang === "id" ? "Tindakan prioritas" : "Priority action"}</h2>
      </div>
      {actionCard}
    </div>
  ) : null;

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

      <div className="fleet-problem-strip" role="group" aria-label={lang === "id" ? "Masalah operasional" : "Operational problems"}>
        <button
          type="button"
          className="problem-chip"
          data-testid="problem-chip-deviation"
          disabled={deviating.length === 0}
          onClick={focusWorstDeviation}
        >
          <Route size={15} />
          <strong>{deviating.length}</strong>
          <span>{lang === "id" ? "deviasi rute" : "route deviations"}</span>
          {worstDeviation && <em>{worstDeviation.truck_code} · {formatDistance(truckDeviationMeters(worstDeviation), lang)}</em>}
        </button>
        <button
          type="button"
          className="problem-chip"
          data-testid="problem-chip-damage"
          disabled={damaged.length === 0}
          onClick={() => selectTab("damage")}
        >
          <Wrench size={15} />
          <strong>{damaged.length}</strong>
          <span>{lang === "id" ? "perawatan/kerusakan" : "maintenance/damage"}</span>
        </button>
        <button
          type="button"
          className="problem-chip"
          data-testid="problem-chip-queue"
          disabled={!showQueueChip}
          onClick={() => selectTab("queue")}
        >
          <Truck size={15} />
          <strong>{queueWaitMinutes}m</strong>
          <span>{lang === "id" ? `antrean TPA · ${queueTrucks} truk` : `TPA queue · ${queueTrucks} trucks`}</span>
        </button>
      </div>

      <div className="fleet-deck">
        <div className="fleet-deck-stage" data-testid="fleet-map-stage">
          {map}

          <button
            type="button"
            className="deck-tools-toggle"
            data-testid="deck-tools-toggle"
            aria-expanded={toolsOpen}
            aria-controls="deck-tools-panel"
            onClick={() => setToolsOpen((open) => !open)}
          >
            <Layers size={16} />
            {lang === "id" ? "Lapisan & kontrol" : "Layers & controls"}
          </button>
          {toolsOpen && (
            <div className="deck-tools-panel" id="deck-tools-panel" data-testid="deck-tools-panel">
              <div className="deck-tools-head">
                <strong>{lang === "id" ? "Lapisan & kontrol peta" : "Map layers & controls"}</strong>
                <button type="button" className="deck-tools-close" onClick={() => setToolsOpen(false)}>
                  {lang === "id" ? "Tutup" : "Close"}
                </button>
              </div>
              {mapTools}
            </div>
          )}

          {decisionOverlay && (
            <aside className="deck-decision-overlay" data-testid="decision-overlay" aria-label={lang === "id" ? "Keputusan prioritas" : "Priority decision"}>
              {decisionOverlay}
            </aside>
          )}
        </div>

        {decisionOverlay && (
          <div className={`deck-action-sheet ${sheetExpanded ? "expanded" : ""}`} data-testid="deck-action-sheet">
            <button
              type="button"
              className="deck-sheet-handle"
              aria-expanded={sheetExpanded}
              onClick={() => setSheetExpanded((open) => !open)}
            >
              <span className="deck-sheet-grip" />
              <span className="deck-sheet-title">
                {worstDeviation.truck_code} · {lang === "id" ? "deviasi" : "deviation"} {formatDistance(truckDeviationMeters(worstDeviation), lang)}
              </span>
            </button>
            {sheetExpanded && decisionOverlay}
          </div>
        )}
      </div>

      <section className="fleet-records-surface">
        <div className="records-heading">
          <div><span className="surface-kicker">Bukti operasional</span><h2>Detail armada</h2></div>
          <nav className="records-doc-links" aria-label={lang === "id" ? "Dokumen operasional" : "Operational documents"}>
            <FileText size={15} />
            {documentTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`records-doc-link ${detailTab === tab.id ? "active" : ""}`}
                onClick={() => selectTab(tab.id)}
              >
                {t(tab.key) || tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="Detail armada">
          {primaryTabs.map((tab, index) => (
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
              onKeyDown={(event) => handleTabKeyDown(event, index, primaryTabs)}
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
