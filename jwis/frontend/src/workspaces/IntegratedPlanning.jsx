import React from "react";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import { useLanguage } from "../i18n.jsx";

export function IntegratedPlanning({ summary, scenario, evidence, unmetCount }) {
  const { t } = useLanguage();
  const stages = [
    { number: 1, title: t("stage_1_title"), key: "inputs" },
    { number: 2, title: t("stage_2_title"), key: "recommendation" },
  ];

  return (
    <section className="planning-workspace" data-testid="planning-workspace">
      {stages.map((stage) => (
        <section className="decision-stage" key={stage.key} aria-labelledby={`planning-stage-${stage.number}`}>
          <header className="decision-stage-header">
            <span className="decision-stage-marker" aria-hidden="true">{stage.number}</span>
            <h2 id={`planning-stage-${stage.number}`}>{stage.title}</h2>
          </header>
          <div className="decision-stage-content">{scenario[stage.key]}</div>
        </section>
      ))}

      <section className="decision-stage" aria-labelledby="planning-stage-3">
        <header className="decision-stage-header">
          <span className="decision-stage-marker" aria-hidden="true">3</span>
          <div className="decision-stage-title-row">
            <h2 id="planning-stage-3">{t("stage_3_title")}</h2>
            {unmetCount > 0 ? (
              <StatusBadge tone="danger">{unmetCount} constraints unmet</StatusBadge>
            ) : (
              <StatusBadge tone="success">{t("stage_ready_approval")}</StatusBadge>
            )}
          </div>
        </header>
        <div className="decision-stage-content decision-evidence">
          {summary}
          {evidence}
        </div>
      </section>
    </section>
  );
}
