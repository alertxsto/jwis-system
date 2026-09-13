import React, { useState } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { WorkspaceHeader } from "../ui/WorkspaceHeader.jsx";

/* Only 7 days exists upstream. The other two are shown disabled rather than
   hidden, so the control states the real capability instead of implying a
   longer horizon is one click away. */
const horizonOptions = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days", disabled: true, title: "Unavailable: source provides 7 days" },
  { value: "30d", label: "30 days", disabled: true, title: "Unavailable: source provides 7 days" },
];

export function WasteForecast({
  metrics,
  forecast,
  weather,
  events,
  districts,
  assistant,
  reportActions,
}) {
  const [horizon, setHorizon] = useState("7d");

  return (
    <section className="forecast-workspace" data-testid="forecast-workspace">
      <WorkspaceHeader
        title="Waste Forecast"
        description="Projected district demand, the weather and event drivers behind it, and the resources required to absorb the spike."
      >
        <div className="forecast-horizon-control">
          <SegmentedControl
            label="Forecast horizon"
            describedBy="forecast-horizon-source-limit"
            value={horizon}
            options={horizonOptions}
            onChange={setHorizon}
          />
          <p id="forecast-horizon-source-limit" className="forecast-source-limit">
            Source provides a 7-day forecast.
          </p>
        </div>
      </WorkspaceHeader>

      <MetricStrip metrics={metrics} />

      <div className="forecast-analysis-grid">
        <div className="forecast-primary-analysis" data-testid="forecast-primary-analysis">
          {districts}
          {forecast}
        </div>
        <aside className="forecast-driver-rail" data-testid="forecast-driver-rail" aria-label="Forecast drivers">
          {weather}
          {events}
        </aside>
      </div>

      <div className="forecast-tools" aria-label="Forecast tools">
        {assistant}
        {reportActions}
      </div>
    </section>
  );
}
