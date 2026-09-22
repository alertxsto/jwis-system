import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "../config.js";

export function DamageReportsPanel() {
  const [reports, setReports] = useState([]);

  const load = useCallback(() => {
    fetch(`${API_URL}/damage-reports`).then((r) => r.json())
      .then((body) => setReports(body.reports || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const resolve = (id) => fetch(`${API_URL}/damage-reports/${id}/resolve`,
    { method: "POST" }).then(load).catch(() => {});

  return (
    <div className="panel-card damage-panel">
      <div className="panel-head">
        <h3>Laporan Kerusakan</h3>
        <span className="pill">{reports.length} laporan</span>
      </div>
      {reports.length === 0 ? (
        <div className="ai-feed-empty">Belum ada laporan kerusakan.</div>
      ) : (
        <table className="spj-table">
          <thead>
            <tr>
              <th>Waktu</th><th>Truk</th><th>Driver</th><th>Komponen</th>
              <th>Severity</th><th>Catatan</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.report_id}>
                <td>{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td>{r.truck_code}</td>
                <td>{r.driver_name}</td>
                <td>{r.component}</td>
                <td>
                  <span className={`pill ${r.severity === "berat" ? "danger" : ""}`}>
                    {r.severity}
                  </span>
                  {r.severity === "berat" && r.status !== "selesai" && (
                    <span className="pill danger">NON-OPERASIONAL</span>
                  )}
                </td>
                <td>{r.note}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== "selesai" && (
                    <button className="compact-enforce-btn"
                      onClick={() => resolve(r.report_id)}>
                      Selesaikan
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
