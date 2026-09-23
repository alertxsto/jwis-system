import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, ExternalLink, ShieldCheck, Truck } from "lucide-react";
import { API_URL } from "../config.js";

export function DataAuditWorkspace() {
  const [provenance, setProvenance] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [suitability, setSuitability] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [provRes, fleetRes, suitRes] = await Promise.all([
          fetch(`${API_URL}/data/provenance`),
          fetch(`${API_URL}/fleet/composition`),
          fetch(`${API_URL}/ml/suitability`),
        ]);
        setProvenance(await provRes.json());
        setFleet(await fleetRes.json());
        setSuitability(await suitRes.json());
      } catch (error) {
        console.error("Failed to load audit data", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="workspace-loading"><span />Memuat registri data…</div>;

  const records = provenance?.records || [];
  const fleetTypes = fleet?.by_vehicle_type || {};
  const resolutions = suitability?.resolutions || {};
  const currentRecords = records.filter((record) => record.freshness === "current" || record.freshness === "recent").length;
  const realRecords = records.filter((record) => record.classification === "real").length;

  return (
    <section className="audit-workspace workspace-page" data-testid="audit-workspace">
      <header className="workspace-heading">
        <div>
          <span className="workspace-kicker"><ShieldCheck size={14} /> Transparansi keputusan</span>
          <h1>Audit data & model</h1>
          <p>Periksa asal, kebaruan, keterbatasan, dan kelayakan data yang digunakan dalam keputusan JWIS.</p>
        </div>
      </header>

      <div className="audit-summary-strip">
        <div><span>Dataset terdaftar</span><strong>{records.length}</strong><small><Database size={14} /> sumber terdokumentasi</small></div>
        <div><span>Data aktual</span><strong>{realRecords}</strong><small><CheckCircle2 size={14} /> bukan proksi</small></div>
        <div><span>Mutakhir</span><strong>{currentRecords}</strong><small>diperbarui baru-baru ini</small></div>
        <div><span>Unit armada</span><strong>{fleet?.total_units?.toLocaleString("id-ID") || "—"}</strong><small><Truck size={14} /> sensus 2023</small></div>
      </div>

      <div className="audit-layout">
        <section className="audit-registry-surface">
          <div className="section-intro compact">
            <div><span className="surface-kicker">Registri sumber</span><h2>Asal dan keterbatasan data</h2></div>
            <p>{records.length} dataset</p>
          </div>
          <div className="table-wrap">
            <table className="audit-table" aria-label="Registri asal data">
              <thead><tr><th>Dataset</th><th>Status</th><th>Baris</th><th>Resolusi</th><th>Klasifikasi</th><th>Sumber</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.name}>
                    <td><strong>{record.name}</strong><small>{record.limitations}</small></td>
                    <td><span className={`freshness-badge ${record.freshness}`}>{record.freshness}</span></td>
                    <td>{record.row_count?.toLocaleString("id-ID") || "—"}</td>
                    <td><code>{record.granularity}</code></td>
                    <td><span className={`classification-badge ${record.classification}`}>{record.classification}</span></td>
                    <td>{String(record.source_url || "").startsWith("http") ? <a href={record.source_url} target="_blank" rel="noreferrer" aria-label={`Buka sumber ${record.name}`}><ExternalLink size={15} /></a> : <span>Internal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="audit-evidence-rail">
          <section>
            <span className="surface-kicker">Kelayakan model</span>
            <h2>Resolusi yang didukung</h2>
            <div className="suitability-list">
              {Object.entries(resolutions).map(([resolution, status]) => (
                <div key={resolution}><code>{resolution.replace(/_/g, "-")}</code><span className={status === "reliable" || status === "high" ? "good" : "limited"}>{status.replace(/_/g, " ")}</span></div>
              ))}
            </div>
            <p className="model-honesty-note"><strong>Catatan model</strong>{suitability?.note || "Belum tersedia."}</p>
          </section>

          <section>
            <span className="surface-kicker">Komposisi armada</span>
            <h2>Sensus kendaraan 2023</h2>
            <div className="fleet-composition-list">
              {Object.entries(fleetTypes).map(([type, count]) => <div key={type}><span>{type.replace(/_/g, " ")}</span><strong>{count?.toLocaleString("id-ID")}</strong></div>)}
            </div>
            <small className="audit-source">Sumber: {fleet?.source || "—"}</small>
          </section>
        </aside>
      </div>
    </section>
  );
}
