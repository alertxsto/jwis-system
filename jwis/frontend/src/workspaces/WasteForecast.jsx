import React from "react";
import { CalendarRange, CloudSun } from "lucide-react";
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
  const { lang } = useLanguage();
  const horizonOptions = [
    { value: "7d", label: lang === "id" ? "7 hari" : "7 days" },
    { value: "14d", label: lang === "id" ? "14 hari" : "14 days" },
    { value: "30d", label: lang === "id" ? "30 hari" : "30 days" },
  ];

  return (
    <section className="forecast-workspace workspace-page" data-testid="forecast-workspace" aria-labelledby="forecast-title">
      <header className="workspace-heading forecast-heading">
        <div>
          <span className="workspace-kicker"><CloudSun size={14} /> Intelijen permintaan</span>
          <h1 id="forecast-title">{lang === "id" ? "Prediksi timbulan sampah" : "Waste generation forecast"}</h1>
          <p>{lang === "id" ? "Temukan wilayah yang membutuhkan tambahan armada sebelum beban layanan meningkat." : "Find districts that need more fleet capacity before service demand rises."}</p>
        </div>
        <div className="forecast-heading-actions">
          <div className="forecast-horizon-control">
            <span className="control-label"><CalendarRange size={14} /> Rentang analisis</span>
            <SegmentedControl value={horizon} options={horizonOptions} onChange={onHorizonChange} />
          </div>
          {reportActions}
        </div>
      </header>

      <MetricStrip metrics={metrics} />

      <div className="forecast-command-grid" data-testid="forecast-command-grid">
        <section className="forecast-primary-analysis" data-testid="forecast-primary-analysis" aria-labelledby="forecast-analysis-title">
          <div className="section-intro">
            <div><span className="surface-kicker">Prioritas wilayah</span><h2 id="forecast-analysis-title">Peta kebutuhan layanan</h2></div>
            <p>Urutkan wilayah berdasarkan beban prediksi dan kesiapan sumber daya.</p>
          </div>
          {districts}
        </section>
        <aside className="forecast-context-rail" aria-label={lang === "id" ? "Faktor pemicu prediksi" : "Forecast drivers"}>
          <div className="section-intro compact">
            <div><span className="surface-kicker">Konteks keputusan</span><h2>Faktor pemicu</h2></div>
          </div>
          {weather}
          {events}
        </aside>
      </div>

      <section className="forecast-evidence-section" aria-labelledby="forecast-evidence-title">
        <div className="section-intro">
          <div><span className="surface-kicker">Bukti model</span><h2 id="forecast-evidence-title">Rincian prediksi</h2></div>
          <p>Gunakan rincian ini untuk memvalidasi wilayah sebelum masuk ke penyusunan rencana.</p>
        </div>
        {forecast}
      </section>
    </section>
  );
}
