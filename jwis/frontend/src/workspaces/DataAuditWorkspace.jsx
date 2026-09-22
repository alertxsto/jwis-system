import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import {
  Truck,
  Users,
  Database,
  Cpu,
} from "lucide-react";

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
          fetch(`${API_URL}/ml/suitability`)
        ]);
        setProvenance(await provRes.json());
        setFleet(await fleetRes.json());
        setSuitability(await suitRes.json());
      } catch (e) {
        console.error("Failed to load audit data", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading audit data...</div>;
  }

  const records = provenance?.records || [];
  const fleetTypes = fleet?.by_vehicle_type || {};

  return (
    <div className="audit-workspace grid-col-12" data-testid="audit-workspace">
      <div className="audit-header">
        <h1>Data & ML Audit Registry</h1>
        <p>Data provenance, ML suitability, and physical fleet inventory for JWIS decision evidence.</p>
      </div>

      <div className="audit-grid">
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Data Provenance Registry</h2>
              <p>Source manifest with row counts, freshness, granularity, and operational limitations.</p>
            </div>
            <Database size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Data provenance registry">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Source URL</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Freshness</th>
                  <th scope="col">Granularity</th>
                  <th scope="col">Classification</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div><strong>{r.name}</strong></div>
                      <div className="table-subtext">{r.limitations}</div>
                    </td>
                    <td>
                      {r.source_url.startsWith("http") ? (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="audit-link">
                          Open source
                        </a>
                      ) : (
                        <span>{r.source_url}</span>
                      )}
                    </td>
                    <td>{r.row_count?.toLocaleString("en-US") || "—"}</td>
                    <td>{r.freshness}</td>
                    <td><code>{r.granularity}</code></td>
                    <td>
                      <span className={`role-badge ${r.classification === "real" ? "dispatcher" : "driver"}`}>
                        {r.classification.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>ML Model Suitability Map</h2>
              <p>Prophet+XGBoost suitability evidence by data resolution level.</p>
            </div>
            <Cpu size={20} />
          </div>
          <div className="suitability-list">
            {Object.entries(fleetTypes).length > 0 && Object.entries(suitability?.resolutions || {}).map(([res, status]) => (
              <div key={res} className="suitability-item">
                <div className="suitability-head">
                  <strong><code>{res.replace(/_/g, "-")}</code></strong>
                  <span className={`status-pill ${status === "reliable" || status === "high" ? "success" : "warning"}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="suitability-notes">
                  {res === "city_day" && "Verified against daily city-level weighbridge totals."}
                  {res === "district_week" && "Weekly district totals aligned with official retribution billing records."}
                  {res === "district_day" && "Daily district resolution used as calibrated dynamic simulation."}
                  {res === "district_month" && "Monthly district totals used for budget planning."}
                  {res === "hotspot_rank" && "Spatial ranking for high-risk operating areas."}
                </p>
              </div>
            ))}
          </div>
          <p className="audit-note"><strong>Model honesty note:</strong> {suitability?.note}</p>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Fleet Type Composition (2023 Census)</h2>
              <p>Inventory of DKI Jakarta sanitation fleet units by vehicle type.</p>
            </div>
            <Truck size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Physical fleet characteristics">
              <thead>
                <tr>
                  <th scope="col">Vehicle type</th>
                  <th scope="col">Unit count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleetTypes).map(([type, count]) => (
                  <tr key={type}>
                    <td><strong>{type.toUpperCase()}</strong></td>
                    <td>{count?.toLocaleString("en-US")} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Administrative Distribution (2023 Census)</h2>
              <p>Distribution of sanitation fleet units across five administrative cities and the regency.</p>
            </div>
            <Users size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Census area distribution">
              <thead>
                <tr>
                  <th scope="col">Administrative area</th>
                  <th scope="col">Unit count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleet?.by_wilayah || {}).map(([wilayah, count]) => (
                  <tr key={wilayah}>
                    <td><strong>{wilayah}</strong></td>
                    <td>{count?.toLocaleString("en-US")} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fleet-totals">
            <div className="fleet-total-row">
              <span>Total registered fleet units:</span>
              <b>{fleet?.total_units?.toLocaleString("en-US")} units</b>
            </div>
            <div className="fleet-total-row">
              <span>Census data source:</span>
              <span>{fleet?.source}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
