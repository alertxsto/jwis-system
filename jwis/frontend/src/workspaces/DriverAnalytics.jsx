import React, { useEffect, useState } from "react";
import { AlertTriangle, Clock3, Route, Truck, Users, Wrench } from "lucide-react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";


function initials(name) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

export function DriverAnalytics() {
  const { lang } = useLanguage();
  const id = lang === "id";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let controller;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`${API_URL}/fleet/driver-analytics`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload.drivers) || !Number.isFinite(Date.parse(payload.sampled_at))
          || !payload.provenance?.id || !payload.provenance?.en || !payload.source) {
          throw new Error("Invalid driver analytics response");
        }
        if (!active) return;
        setData(payload);
        setError(false);
        setNow(Date.now());
      } catch (reason) {
        if (active && reason.name !== "AbortError") setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(() => {
      setNow(Date.now());
      load();
    }, 15000);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
    };
  }, [refreshKey]);

  const drivers = data?.drivers || [];
  const stale = Boolean(data && (error || now - Date.parse(data.sampled_at) > 30000));
  const deviations = drivers.filter((driver) => driver.deviation_violated);
  const damaged = drivers.filter((driver) => driver.is_damaged);
  const priority = deviations.reduce((worst, driver) => (
    !worst || (driver.deviation_meters ?? 0) > (worst.deviation_meters ?? 0) ? driver : worst
  ), null) || damaged[0];
  const distance = (value) => Number.isFinite(value)
    ? `${Math.round(value).toLocaleString(id ? "id-ID" : "en-US")} m`
    : (id ? "Tidak tersedia" : "Unavailable");

  return (
    <section className="driver-workspace workspace-page">
      <header className="workspace-heading">
        <div>
          <h1>{id ? "Kondisi pengemudi dan armada" : "Driver and fleet status"}</h1>
          <p>{id
            ? "Penugasan kendaraan dan sinyal operasi saat ini; bukan nilai kinerja historis."
            : "Current vehicle assignments and operational signals, not historical performance scores."}</p>
        </div>
        {data && (
          <div className="workspace-freshness" role="status">
            <Clock3 size={16} />
            <span>{stale ? (id ? "Data tidak mutakhir" : "Data is stale") : (id ? "Cuplikan armada" : "Fleet snapshot")}</span>
            <strong><time dateTime={data.sampled_at}>{new Date(data.sampled_at).toLocaleTimeString(id ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></strong>
          </div>
        )}
      </header>

      {loading && !data && <p role="status">{id ? "Memuat data pengemudi…" : "Loading driver records…"}</p>}
      {error && (
        <div role="alert">
          <p>{data
            ? (id ? "Pembaruan gagal. Data terakhir tetap ditampilkan sebagai data tidak mutakhir." : "Refresh failed. The last snapshot remains visible as stale data.")
            : (id ? "Data pengemudi tidak dapat dimuat. Periksa koneksi lalu coba lagi." : "Driver records could not be loaded. Check your connection and try again.")}</p>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>{id ? "Coba lagi" : "Try again"}</button>
        </div>
      )}
      {data && (
        <>
          <p className="workspace-data-note">
            {id ? "Sumber" : "Source"}: {data.source}. {data.provenance[lang]}
          </p>
          <div className="driver-metric-strip">
            <div><Truck size={18} /><span>{id ? "Unit tercatat" : "Assigned units"}<strong>{drivers.length}</strong></span></div>
            <div><Users size={18} /><span>{id ? "Nama pengemudi" : "Named drivers"}<strong>{new Set(drivers.map((driver) => driver.driver_name)).size}</strong></span></div>
            <div><Route size={18} /><span>{id ? "Deviasi saat ini" : "Current deviations"}<strong>{deviations.length}</strong></span></div>
            <div><Wrench size={18} /><span>{id ? "Unit bermasalah" : "Damaged units"}<strong>{damaged.length}</strong></span></div>
          </div>

          {drivers.length === 0 ? (
            <p role="status">{id ? "Belum ada penugasan pengemudi dalam cuplikan armada." : "No driver assignments in this fleet snapshot."}</p>
          ) : (
            <div className="driver-command-grid">
              <section className="driver-table-surface">
                <div className="section-intro compact">
                  <div><h2>{id ? "Penugasan per kendaraan" : "Assignments by vehicle"}</h2></div>
                </div>
                <div className="table-wrap">
                  <table className="driver-table">
                    <thead><tr>
                      <th scope="col">{id ? "Pengemudi" : "Driver"}</th>
                      <th scope="col">{id ? "Kendaraan" : "Vehicle"}</th>
                      <th scope="col">{id ? "Wilayah" : "Zone"}</th>
                      <th scope="col">{id ? "Kondisi" : "Condition"}</th>
                      <th scope="col">{id ? "Deviasi rute saat ini" : "Current route deviation"}</th>
                    </tr></thead>
                    <tbody>
                      {drivers.map((driver) => (
                        <tr key={driver.truck_code} className={driver.deviation_violated || driver.is_damaged ? "needs-attention" : ""}>
                          <td><span className="driver-person"><i aria-hidden="true">{initials(driver.driver_name)}</i><strong>{driver.driver_name}</strong></span></td>
                          <td><code>{driver.truck_code}</code></td>
                          <td>{driver.assigned_zone || "—"}</td>
                          <td><span className={`deviation-badge ${driver.is_damaged ? "danger" : "success"}`}>
                            {driver.is_damaged ? (id ? "Perawatan / rusak" : "Maintenance / damaged") : (id ? "Beroperasi" : "Operating")}
                          </span></td>
                          <td><span className={`deviation-badge ${driver.deviation_violated ? "warning" : "success"}`}>
                            {driver.deviation_violated ? distance(driver.deviation_meters) : (id ? "Tidak terdeteksi" : "None flagged")}
                          </span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="driver-attention-rail">
                <span className="attention-icon"><AlertTriangle size={19} /></span>
                <h2>{id ? "Prioritas operasional" : "Operational priority"}</h2>
                {priority ? (
                  <>
                    <p>{priority.driver_name} · {priority.truck_code}</p>
                    <p>{priority.deviation_violated
                      ? (id
                        ? `Deviasi rute saat ini: ${distance(priority.deviation_meters)} dari koridor.`
                        : `Current route deviation: ${distance(priority.deviation_meters)} from the corridor.`)
                      : (id ? "Kendaraan ditandai untuk perawatan atau kerusakan." : "Vehicle flagged for maintenance or damage.")}</p>
                    <div className="attention-note"><strong>{id ? "Langkah berikutnya" : "Next step"}</strong>
                      <span>{priority.deviation_violated
                        ? (id ? "Tinjau bukti rute kendaraan sebelum menghubungi pengemudi." : "Review this vehicle’s route evidence before contacting the driver.")
                        : (id ? "Periksa laporan kerusakan kendaraan sebelum menugaskan perjalanan berikutnya." : "Review vehicle damage reports before the next assignment.")}</span>
                    </div>
                  </>
                ) : (
                  <p>{id ? "Tidak ada deviasi atau kerusakan yang ditandai dalam cuplikan ini." : "No flagged deviations or damaged vehicles in this snapshot."}</p>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </section>
  );
}
