import React from "react";
import { useLanguage } from "../i18n.jsx";
import {
  Check,
} from "lucide-react";

export function ScenarioPanel({ mode, children }) {
  return <div className={`scenario-panel scenario-${mode}`}>{children}</div>;
}

export function PlanningApproval({ plan, planLoading, approved, approvePlan, role }) {
  const { lang } = useLanguage();
  const locale = lang === "id" ? "id-ID" : "en-US";
  const number = (value) => Number(value ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 });
  const roleName = {
    administrator: lang === "id" ? "Administrator" : "Administrator",
    supervisor: lang === "id" ? "Pengawas" : "Supervisor",
    dispatcher: lang === "id" ? "Pengatur armada" : "Dispatcher",
    executive: lang === "id" ? "Pimpinan" : "Executive",
    auditor: lang === "id" ? "Auditor" : "Auditor",
    driver: lang === "id" ? "Pengemudi" : "Driver",
    guest: lang === "id" ? "Tamu" : "Guest",
  }[role] || (lang === "id" ? "Tidak diketahui" : "Unknown");
  const unmetCount = plan?.unmet_reasons?.length || 0;

  return (
    <div className="planning-approval">
      <div className="planning-approval-head">
        <strong>{lang === "id" ? "Kewenangan keputusan" : "Decision authority"}</strong>
        <span className="role-badge">{lang === "id" ? "Peran" : "Role"}: <b>{roleName}</b></span>
      </div>
      {!plan && <p className="planning-approval-note">{lang === "id" ? "Susun rencana penugasan untuk meninjau bukti persetujuan." : "Generate a dispatch plan to review approval evidence."}</p>}
      {plan && (
        <dl className="approval-evidence-list">
          <div><dt>{lang === "id" ? "Rencana" : "Plan"}</dt><dd>{plan.plan_id}</dd></div>
          <div><dt>{lang === "id" ? "Kebutuhan teralokasi" : "Assigned demand"}</dt><dd>{number(plan.total_assigned_tons)} / {number(plan.total_demand_tons)} {lang === "id" ? "ton" : "tons"}</dd></div>
          <div><dt>{lang === "id" ? "Bukti izin" : "Permit evidence"}</dt><dd>{number((plan.assignments || []).filter((assignment) => assignment.evidence?.permit_compliant).length)} {lang === "id" ? "penugasan sesuai izin" : "compliant assignments"}</dd></div>
        </dl>
      )}
      {plan?.status === "proposed" && unmetCount === 0 && (
        <button className="primary-button approve-dispatch-btn" onClick={approvePlan} disabled={planLoading}>
          {planLoading ? (lang === "id" ? "Menyetujui rencana..." : "Approving plan...") : (lang === "id" ? "Setujui & kirim rencana" : "Approve & dispatch plan")}
        </button>
      )}
      {plan?.status === "proposed" && unmetCount > 0 && (
        <p className="planning-approval-note planning-approval-blocked">{lang === "id" ? "Persetujuan belum tersedia sampai seluruh kendala ditangani." : "Approval is unavailable until every constraint warning is resolved."}</p>
      )}
      {approved && (
        <div className="optimizer-success">
          <Check size={16} /> {lang === "id" ? "Rencana disetujui. Penugasan dibuat dan dikirim ke aplikasi lapangan." : "Plan approved. Dispatches created and sent to the field app."}
        </div>
      )}
    </div>
  );
}
