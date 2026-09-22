import React from "react";
import { CheckCircle2, CircleDot, Workflow } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import { useLanguage } from "../i18n.jsx";

export function IntegratedPlanning({ summary, scenario, evidence, unmetCount }) {
  const { lang } = useLanguage();
  const stages = [
    { number: "01", title: lang === "id" ? "Tetapkan skenario" : "Set scenario", description: lang === "id" ? "Uji permintaan dan cuaca" : "Test demand and weather", key: "inputs" },
    { number: "02", title: lang === "id" ? "Susun alokasi" : "Build allocation", description: lang === "id" ? "Optimalkan armada dan kru" : "Optimize fleet and crew", key: "recommendation" },
  ];

  return (
    <section className="planning-workspace workspace-page" data-testid="planning-workspace">
      <header className="workspace-heading">
        <div>
          <span className="workspace-kicker"><Workflow size={14} /> Ruang keputusan</span>
          <h1>{lang === "id" ? "Rencana operasi terpadu" : "Integrated operations plan"}</h1>
          <p>{lang === "id" ? "Ubah prediksi menjadi alokasi armada yang dapat ditinjau, disetujui, dan dijalankan." : "Turn forecasts into fleet allocations that can be reviewed, approved, and dispatched."}</p>
        </div>
        <div className="planning-status">
          {unmetCount > 0 ? <StatusBadge tone="danger">{unmetCount} kendala belum terpenuhi</StatusBadge> : <StatusBadge tone="success">Siap disusun</StatusBadge>}
        </div>
      </header>

      <ol className="planning-progress" aria-label="Tahapan perencanaan">
        <li className="active"><CircleDot size={17} /><span><b>01</b>Skenario</span></li>
        <li><span className="progress-line" /><CircleDot size={17} /><span><b>02</b>Alokasi</span></li>
        <li><span className="progress-line" /><CheckCircle2 size={17} /><span><b>03</b>Persetujuan</span></li>
      </ol>

      <div className="planning-decision-grid">
        {stages.map((stage) => (
          <section className={`planning-stage-card stage-${stage.number}`} key={stage.key} aria-labelledby={`planning-stage-${stage.number}`}>
            <header className="planning-stage-heading">
              <span>{stage.number}</span>
              <div><h2 id={`planning-stage-${stage.number}`}>{stage.title}</h2><p>{stage.description}</p></div>
            </header>
            <div className="planning-stage-content">{scenario[stage.key]}</div>
          </section>
        ))}

        <section className="planning-stage-card planning-approval-stage" aria-labelledby="planning-stage-03">
          <header className="planning-stage-heading">
            <span>03</span>
            <div><h2 id="planning-stage-03">Tinjau & setujui</h2><p>Pastikan kapasitas, antrean TPA, dan kewenangan keputusan.</p></div>
          </header>
          <div className="planning-review-grid">
            <div className="planning-summary">{summary}</div>
            <div className="planning-approval">{evidence}</div>
          </div>
        </section>
      </div>
    </section>
  );
}
