import React from "react";
import { ShieldCheck } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

export function KpiCard({ icon: Icon, label, value, helper, tone = "neutral" }) {
  return (
    <section className={`kpi ${tone}`}>
      <div className="kpi-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </section>
  );
}
