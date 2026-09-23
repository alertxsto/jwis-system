import React, { useState } from "react";
import { useLanguage } from "../i18n.jsx";
import {
  Search,
} from "lucide-react";

export function FleetTable({ trucks, onOpenTripHistory }) {
  const { t, lang } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = trucks.filter(
    (t) =>
      t.truck_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assigned_zone?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const shown = showAll ? filtered : filtered.slice(0, 12);
  const damagedCount = trucks.filter((t) => t.is_damaged).length;
  const violationCount = trucks.filter((t) => t.deviation?.violated).length;

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{t("ft_title")}</h2>
          <p>{trucks.length} {lang === "id" ? "unit dipantau real-time" : "units monitored in real-time"} · {damagedCount} {lang === "id" ? "peringatan perbaikan" : "maintenance alerts"} · {violationCount} {lang === "id" ? "deviasi rute" : "corridor deviations"}.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="input-shell" style={{ width: "220px", height: "36px" }}>
            <Search size={14} />
            <input
              type="text"
              placeholder={t("ft_search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: "12.5px" }}
            />
          </div>
        </div>
      </div>
      <div className="table-wrap fleet-table-wrap">
        <table className="fleet-state-table" aria-label={lang === "id" ? "Status operasional armada" : "Fleet operational status"}>
          <thead>
            <tr>
              <th scope="col" style={{ width: "18%" }}>{t("ft_th_truck")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_driver")}</th>
              <th scope="col" style={{ width: "14%" }}>{t("ft_th_zone")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_comp")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_activity")}</th>
              <th scope="col" style={{ width: "10%" }}>{t("ft_th_speed")}</th>
              <th scope="col" style={{ width: "10%" }}>{t("ft_th_action")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--ui-muted)" }}>
                  {lang === "id" ? `Tidak ada kendaraan yang cocok dengan "${searchTerm}".` : `No vehicles found matching "${searchTerm}".`}
                </td>
              </tr>
            ) : (
              shown.map((truck) => {
                const isViolation = Boolean(truck.deviation?.violated);
                const isBreakdown = Boolean(truck.is_damaged);
                const complianceTone = isViolation ? "danger" : isBreakdown ? "warning" : "success";
                const complianceLabel = isViolation
                  ? `${lang === "id" ? "Pelanggaran" : "Violation"} (${Math.round(truck.deviation.distance_meters >= 1000 ? truck.deviation.distance_meters / 1000 : truck.deviation.distance_meters)}${truck.deviation.distance_meters >= 1000 ? "km" : "m"})`
                  : isBreakdown
                    ? (truck.damage_status?.state === "breakdown" ? (lang === "id" ? "Mogok" : "Breakdown") : (lang === "id" ? "Perawatan" : "Maintenance"))
                    : (lang === "id" ? "Sesuai" : "Compliant");

                return (
                  <tr key={truck.truck_code}>
                    <td>
                      <div className="truck-cell" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong className="plate-badge">{truck.truck_code}</strong>
                        <span style={{ fontSize: "11.5px", color: "var(--ui-muted)", fontFamily: "var(--mono, monospace)" }}>
                          {truck.plate_number}
                        </span>
                      </div>
                    </td>
                    <td className="driver-name-cell">
                      <strong style={{ color: "var(--ui-ink)", fontWeight: 600 }}>{truck.driver_name}</strong>
                    </td>
                    <td><span className="zone-tag">{truck.assigned_zone}</span></td>
                    <td>
                      <span className={`pill ${complianceTone}`}>
                        <span className={`status-dot ${complianceTone}`} />
                        {complianceLabel}
                      </span>
                    </td>
                    <td>
                      <div className="activity-cell" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className={`activity-dot ${isViolation ? "danger" : isBreakdown ? "warning" : "active"}`} />
                        <span style={{ fontSize: "12.5px" }}>{truck.activity?.label || (lang === "id" ? "Siaga" : "Idle")}</span>
                      </div>
                    </td>
                    <td className="speed-cell">
                      <span className="speed-badge">{truck.latest_position?.speed_kmh || 0} km/h</span>
                    </td>
                    <td>
                      <button className="text-button" type="button" aria-label={lang === "id" ? `Lihat riwayat perjalanan ${truck.truck_code}` : `View ${truck.truck_code} trip history`} onClick={() => onOpenTripHistory?.(truck.truck_code)} style={{ height: "30px", padding: "0 10px", fontSize: "12px" }}>
                        {t("btn_trip_history")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 12 && (
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "center" }}>
          <button className="text-button show-more-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? (lang === "id" ? "Tampilkan lebih sedikit" : "Show fewer") : `${lang === "id" ? "Tampilkan semua" : "Show all"} (${filtered.length} ${lang === "id" ? "unit" : "units"})`}
          </button>
        </div>
      )}
    </section>
  );
}
