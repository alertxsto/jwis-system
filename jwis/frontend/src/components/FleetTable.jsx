import React from "react";
import { Truck } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

export function FleetTable({ trucks, onOpenTripHistory }) {
  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Fleet state</h2>
          <p>Each row is directly actionable and audit-ready.</p>
        </div>
      </div>
      {trucks.length === 0 ? (
        <p className="panel-state" role="status">
          No vehicle positions available. The fleet feed has not returned data.
        </p>
      ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Truck</th>
              <th>Driver</th>
              <th>Zone</th>
              <th>Status</th>
              <th>Speed</th>
              <th>Deviation</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map((truck) => (
              <tr key={truck.truck_code}>
                <td><b>{truck.truck_code}</b><span>{truck.plate_number}</span></td>
                <td>{truck.driver_name}</td>
                <td>{truck.assigned_zone}</td>
                <td>
                  {truck.deviation?.violated ? (
                    <StatusPill tone="danger">Route violation</StatusPill>
                  ) : truck.is_damaged ? (
                    <StatusPill tone="warning">Damaged</StatusPill>
                  ) : (
                    <StatusPill tone="success">Normal</StatusPill>
                  )}
                </td>
                <td>{truck.latest_position?.speed_kmh} km/h</td>
                <td>{Math.round(truck.deviation?.distance_meters || 0)} m</td>
                <td>
                  <button
                    className="ghost-button"
                    type="button"
                    aria-label={`View ${truck.truck_code} trip history`}
                    onClick={() => onOpenTripHistory?.(truck.truck_code)}
                  >
                    Trip history
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
