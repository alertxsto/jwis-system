import React, { useRef } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { useLanguage } from "../i18n.jsx";

const detailTabs = [
  { id: "fleet", key: "tab_fleet", label: "Fleet State", surface: "fleet-table-surface" },
  { id: "unlicensed", key: "tab_unlicensed", label: "Unlicensed Collectors", surface: "fleet-unlicensed-surface" },
  { id: "history", key: "tab_history", label: "Trip History", surface: "fleet-history-surface" },
  { id: "queue", key: "tab_queue", label: "TPA Queue & Optimization", surface: "fleet-queue-surface" },
  { id: "evidence", key: "tab_evidence", label: "Route Evidence", surface: "fleet-evidence-surface" },
  { id: "impact", key: "tab_impact", label: "Carbon Footprint", surface: "fleet-impact-surface" },
  { id: "spj", key: "tab_spj", label: "Surat Perintah Jalan", surface: "fleet-spj-surface" },
];

export function FleetOperations({
  detailTab,
  onDetailTabChange,
  metrics,
  map,
  mapFooter,
  alerts,
  routeEvidence,
  rerouting,
  queue,
  fleetTable,
  unlicensedTable,
  history,
  carbon,
  spj,
}) {
  const { t } = useLanguage();
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
    <section className="fleet-workspace" data-testid="fleet-workspace">
      <MetricStrip metrics={metrics} />

      <div className="fleet-stage">
        <div className="fleet-map-stage" data-testid="fleet-map-stage" style={{ width: "100%", borderRight: "none" }}>
          {map}
        </div>
      </div>

      {mapFooter}

      <div className="workspace-tabs" role="tablist" aria-label="Fleet details">
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

      <div
        id={activeTab.surface}
        className="fleet-detail-surface"
        role="tabpanel"
        aria-labelledby={activeTab.id}
        data-testid={activeTab.surface}
      >
        {surfaces[detailTab]}
      </div>
    </section>
  );
}
