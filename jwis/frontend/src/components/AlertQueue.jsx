import React from "react";
import { AlertTriangle, Route, Send, MessageCircle } from "lucide-react";

export function AlertQueue({ alerts, onDispatch, onWhatsApp }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Action Queue</h2>
          <p>Alerts are linked to route recommendations and field instructions.</p>
        </div>
        <span className={`pill danger`}>{alerts.length} active</span>
      </div>
      <div className="alert-list">
        {alerts.map((alert) => (
          <article className="alert-item" key={alert.id}>
            <div className="alert-head">
              <AlertTriangle size={18} />
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
              </div>
            </div>
            {alert.recommended_routes?.[0] && (
              <div className="route-rec">
                <Route size={17} />
                <div>
                  <strong>{alert.recommended_routes[0].name}</strong>
                  <span>{alert.recommended_routes[0].eta_minutes} min ETA - score {alert.recommended_routes[0].score}</span>
                </div>
              </div>
            )}
            <div className="alert-actions">
              <button className="primary-button" onClick={() => onDispatch(alert)}>
                <Send size={16} /> Approve &amp; Dispatch
              </button>
              <button className="ghost-button alert-wa-button" onClick={() => onWhatsApp(alert)}>
                <MessageCircle size={16} /> WA Alert
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
