import React from "react";
import { StatusPill } from "../ui/StatusPill.jsx";
import { WorkspaceHeader } from "../ui/WorkspaceHeader.jsx";

/* Three stages, in the order an operator actually decides: set the scenario,
   read the recommendation, then judge whether it is safe to approve. The
   numbering is real sequence, not decoration. */
const stages = [
  { number: 1, title: "Scenario inputs", key: "inputs" },
  { number: 2, title: "Recommended plan", key: "recommendation" },
];

export function IntegratedPlanning({ summary, scenario, evidence, unmetCount }) {
  return (
    <section className="planning-workspace" data-testid="planning-workspace">
      <WorkspaceHeader
        title="Integrated Planning"
        description="Turn the forecast into a dispatch plan, and see exactly which constraints the plan cannot satisfy before approving it."
      />

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
              <StatusPill tone="danger">{unmetCount} constraints unmet</StatusPill>
            ) : (
              <StatusPill tone="success">Ready for approval</StatusPill>
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
