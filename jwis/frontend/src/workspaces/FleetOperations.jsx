import React, { useRef } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";

const detailTabs = [
  { id: "fleet", label: "Fleet", surface: "fleet-table-surface" },
  { id: "history", label: "Trip history", surface: "fleet-history-surface" },
  { id: "queue", label: "TPA queue", surface: "fleet-queue-surface" },
  { id: "evidence", label: "Route evidence", surface: "fleet-evidence-surface" },
  { id: "impact", label: "Carbon impact", surface: "fleet-impact-surface" },
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
  history,
  carbon,
}) {
  const tabRefs = useRef([]);
  const activeTab = detailTabs.find((tab) => tab.id === detailTab) || detailTabs[0];
  const surfaces = {
    fleet: fleetTable,
    history,
    queue,
    evidence: routeEvidence,
    impact: carbon,
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
        <div className="fleet-map-stage" data-testid="fleet-map-stage">
          {map}
        </div>
        <aside className="fleet-inspector">
          {alerts}
          {rerouting}
        </aside>
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
            {tab.label}
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
