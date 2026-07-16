import React, { useEffect, useState } from "react";
import { Database, Cpu, Truck, Users } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

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
      } catch (e) {
        console.error("Failed to load audit data", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="loading-state">Memuat data audit...</div>;

  const records = provenance?.records || [];
  const fleetTypes = fleet?.by_vehicle_type || {};

  return (
    <div className="audit-workspace grid-col-12" data-testid="audit-workspace">
      <div className="audit-header">
        <h1>Data &amp; ML Audit Registry</h1>
        <p>Transparansi asal data, kepatuhan model ML, dan inventori armada fisik JWIS.</p>
      </div>

      <div className="audit-grid">
        {/* Data Provenance */}
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Data Provenance Registry</h2>
              <p>Manifest sumber data riil, jumlah baris, tingkat kesegaran, dan limitasi operasional.</p>
            </div>
            <Database size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Data provenance registry">
              <thead>
                <tr>
                  <th scope="col">Nama Dataset</th>
                  <th scope="col">Sumber / URL</th>
                  <th scope="col">Baris</th>
                  <th scope="col">Kesegaran</th>
                  <th scope="col">Granularitas</th>
                  <th scope="col">Klasifikasi</th>
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
                          Buka Sumber
                        </a>
                      ) : (
                        <span>{r.source_url}</span>
                      )}
                    </td>
                    <td>{r.row_count?.toLocaleString("id-ID") || "—"}</td>
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

        {/* ML Suitability */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>ML Model Suitability Map</h2>
              <p>Metrik evaluasi akurasi Prophet+XGBoost untuk setiap tingkat resolusi data.</p>
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
                  {res === "city_day" && "Diverifikasi terhadap log harian total weighbridge Jembatan Timbang (real)."}
                  {res === "district_week" && "Total mingguan per kecamatan, selaras dengan tagihan retribusi (real)."}
                  {res === "district_day" && "Resolusi harian per kecamatan; hanya simulasi dinamis terkalibrasi."}
                  {res === "district_month" && "Total bulanan per kecamatan; digunakan untuk perencanaan anggaran."}
                  {res === "hotspot_rank" && "Penentuan urutan wilayah berisiko tinggi secara spasial."}
                </p>
              </div>
            ))}
          </div>
          <p className="audit-note"><strong>Catatan Kejujuran Model:</strong> {suitability?.note}</p>
        </section>

        {/* Fleet Composition */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Komposisi Tipe Armada (Sensus 2023)</h2>
              <p>Inventori unit truk kebersihan DKI Jakarta berdasarkan jenis kendaraan.</p>
            </div>
            <Truck size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Karakteristik armada fisik">
              <thead>
                <tr>
                  <th scope="col">Tipe Kendaraan</th>
                  <th scope="col">Jumlah Unit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleetTypes).map(([type, count]) => (
                  <tr key={type}>
                    <td><strong>{type.toUpperCase()}</strong></td>
                    <td>{count?.toLocaleString("id-ID")} unit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Regional Distribution */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Distribusi Wilayah (Sensus 2023)</h2>
              <p>Pembagian unit armada kebersihan di 5 Kota Administrasi &amp; Kabupaten.</p>
            </div>
            <Users size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Distribusi wilayah sensus">
              <thead>
                <tr>
                  <th scope="col">Wilayah Administrasi</th>
                  <th scope="col">Jumlah Unit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleet?.by_wilayah || {}).map(([wilayah, count]) => (
                  <tr key={wilayah}>
                    <td><strong>{wilayah}</strong></td>
                    <td>{count?.toLocaleString("id-ID")} unit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fleet-totals">
            <div className="fleet-total-row">
              <span>Total Unit Armada Tercatat:</span>
              <b>{fleet?.total_units?.toLocaleString("id-ID")} unit</b>
            </div>
            <div className="fleet-total-row">
              <span>Sumber Data Sensus:</span>
              <span>{fleet?.source}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
