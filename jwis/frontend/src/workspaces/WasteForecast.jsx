import React from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { useLanguage } from "../i18n.jsx";

export function WasteForecast({
  metrics,
  forecast,
  weather,
  events,
  districts,
  reportActions,
  horizon,
  onHorizonChange,
}) {
  const { t, lang } = useLanguage();
  const horizonOptions = [
    { value: "7d", label: lang === "id" ? "7 hari" : "7 days" },
    { value: "14d", label: lang === "id" ? "14 hari" : "14 days" },
    { value: "30d", label: lang === "id" ? "30 hari" : "30 days" },
  ];

  return (
    <section className="forecast-workspace" data-testid="forecast-workspace">
      <div className="forecast-heading">
        <div>
          <h1>{t("fc_title")}</h1>
          <p>{t("fc_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div className="forecast-horizon-control">
            <SegmentedControl
              label={lang === "id" ? "Horizon prediksi" : "Forecast horizon"}
              describedBy="forecast-horizon-source-limit"
              value={horizon}
              options={horizonOptions}
              onChange={onHorizonChange}
            />
          </div>
          {reportActions}
        </div>
      </div>

      <MetricStrip metrics={metrics} />

      <div className="forecast-command-grid" data-testid="forecast-command-grid">
        <div className="forecast-primary-analysis" data-testid="forecast-primary-analysis">
          {districts}
        </div>
      </div>

      <div className="forecast-tools" aria-label="Forecast tools">
        {forecast}
        {weather}
        {events}
      </div>
    </section>
  );
}
