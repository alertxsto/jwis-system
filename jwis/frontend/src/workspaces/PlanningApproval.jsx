import React from "react";
import {
  Check,
} from "lucide-react";

export function ScenarioPanel({ mode, children }) {
  return <div className={`scenario-panel scenario-${mode}`}>{children}</div>;
}

export function PlanningApproval({ plan, planLoading, approved, approvePlan, role }) {
  const unmetCount = plan?.unmet_reasons?.length || 0;

  return (
    <div className="planning-approval">
      <div className="planning-approval-head">
        <strong>Decision authority</strong>
        <span className="role-badge">Role: <b>{role}</b></span>
      </div>
      {!plan && <p className="planning-approval-note">Generate a dispatch plan to review approval evidence.</p>}
      {plan && (
        <dl className="approval-evidence-list">
          <div><dt>Plan</dt><dd>{plan.plan_id}</dd></div>
          <div><dt>Assigned demand</dt><dd>{plan.total_assigned_tons} / {plan.total_demand_tons} tons</dd></div>
          <div><dt>Permit evidence</dt><dd>{plan.assignments.filter((assignment) => assignment.evidence.permit_compliant).length} compliant assignments</dd></div>
        </dl>
      )}
      {plan?.status === "proposed" && unmetCount === 0 && (
        <button className="primary-button approve-dispatch-btn" onClick={approvePlan} disabled={planLoading}>
          {planLoading ? "Approving Plan..." : "Approve & Dispatch Plan"}
        </button>
      )}
      {plan?.status === "proposed" && unmetCount > 0 && (
        <p className="planning-approval-note planning-approval-blocked">Approval remains unavailable until every constraint warning is resolved.</p>
      )}
      {approved && (
        <div className="optimizer-success">
          <Check size={16} /> Plan approved. Dispatches generated & pushed to field app!
        </div>
      )}
    </div>
  );
}
