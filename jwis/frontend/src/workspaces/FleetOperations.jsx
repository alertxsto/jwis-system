import React, { useState } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";

const detailTabs = [
  { id: "fleet", label: "Fleet", surface: "fleet-table-surface" },
  { id: "history", label: "Trip history", surface: "fleet-history-surface" },
  { id: "queue", label: "TPA queue", surface: "fleet-queue-surface" },
  { id: "evidence", label: "Route evidence", surface: "fleet-evidence-surface" },
  { id: "impact", label: "Carbon impact", surface: "fleet-impact-surface" },
];

export function FleetOperations({
  metrics,
  map,
  alerts,
  routeEvidence,
  rerouting,
  queue,
  fleetTable,
  history,
  carbon,
}) {
  const [detailTab, setDetailTab] = useState("fleet");
  const activeTab = detailTabs.find((tab) => tab.id === detailTab);
  const surfaces = {
    fleet: fleetTable,
    history,
    queue,
    evidence: routeEvidence,
    impact: carbon,
  };

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

      <div className="workspace-tabs" role="tablist" aria-label="Fleet details">
        {detailTabs.map((tab) => (
          <button
            key={tab.id}
            id={tab.id}
            className="workspace-tab"
            type="button"
            role="tab"
            aria-selected={detailTab === tab.id}
            aria-controls={tab.surface}
            onClick={() => setDetailTab(tab.id)}
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
