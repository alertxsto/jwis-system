import React, { useEffect, useState } from "react";
import { Truck, AlertTriangle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function UnlicensedCollectorAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enforced, setEnforced] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/fleet/unlicensed-collectors`);
      if (res.ok) setAlerts(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleEnforce(plate) {
    setEnforced(prev => ({ ...prev, [plate]: true }));
  }

  if (loading) return <div>Memuat data deteksi...</div>;
  if (!alerts || !alerts.alerts || alerts.alerts.length === 0) return null;

  return (
    <section className="panel unlicensed-alerts-panel">
      <div className="panel-title">
        <div>
          <h2>Deteksi Kolektor Sampah Liar (Case 1)</h2>
          <p>Daftar kendaraan operasional tanpa izin resmi yang terdeteksi di area DKI Jakarta.</p>
        </div>
        <AlertTriangle size={20} />
      </div>
      <div className="table-wrap">
        <table aria-label="Deteksi kolektor liar">
          <thead>
            <tr>
              <th scope="col">Plat Nomor</th>
              <th scope="col">Lokasi Koordinat</th>
              <th scope="col">Status</th>
              <th scope="col">Aksi Penertiban</th>
            </tr>
          </thead>
          <tbody>
            {alerts.alerts.map((a, i) => (
              <tr key={i}>
                <td><strong>{a.plate || "Unknown"}</strong></td>
                <td><code>{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</code></td>
                <td>
                  <span className={`status-pill ${enforced[a.plate] ? "success" : "warning"}`}>
                    {enforced[a.plate] ? "PATROL DISPATCHED" : "UNAUTHORIZED"}
                  </span>
                </td>
                <td>
                  <button
                    className="primary-button compact"
                    onClick={() => handleEnforce(a.plate)}
                    disabled={enforced[a.plate]}
                  >
                    {enforced[a.plate] ? "Telah Ditindak" : "Kirim Patroli"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="stagger-schedule-note">
        Sumber data: Plat terdaftar di database DLH 2023. Pencocokan otomatis via plat nomor kendaraan komersial/swasta.
      </p>
    </section>
  );
}
