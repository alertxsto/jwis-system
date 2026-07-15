import React from "react";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const stages = [
  { number: 1, title: "Scenario inputs", key: "inputs" },
  { number: 2, title: "Recommended plan", key: "recommendation" },
];

export function IntegratedPlanning({ summary, scenario, evidence, unmetCount }) {
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
            <h2 id="planning-stage-3">Evidence and approval</h2>
            {unmetCount > 0 ? (
              <StatusBadge tone="danger">{unmetCount} constraints unmet</StatusBadge>
            ) : (
              <StatusBadge tone="success">Ready for approval</StatusBadge>
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
