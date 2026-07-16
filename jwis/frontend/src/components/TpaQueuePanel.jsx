import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function TpaQueuePanel() {
  const [queue, setQueue] = useState(null);

  async function fetchQueue() {
    try {
      const res = await fetch(`${API_URL}/tpa/queue-status`);
      if (res.ok) setQueue(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!queue) return null;

  return (
    <section className="panel tpa-queue-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang Landfill Queue Status (Case 1)</h2>
          <p>Real-time visualization of weighbridge throughput and final-disposal truck queues.</p>
        </div>
        <Clock size={20} />
      </div>

      <div className="tpa-status-grid">
        <div className="tpa-status-card">
          <span>Queued Trucks</span>
          <strong>{queue.trucks_in_queue} units</strong>
        </div>
        <div className="tpa-status-card">
          <span>Estimated Wait</span>
          <strong className={queue.avg_wait_minutes > 60 ? "text-danger" : "text-success"}>
            {queue.avg_wait_minutes} min
          </strong>
        </div>
        <div className="tpa-status-card">
          <span>Weighbridge</span>
          <strong className={queue.weighbridge_status.includes("DEGRADED") ? "text-danger" : "text-success"}>
            {queue.weighbridge_status}
          </strong>
        </div>
      </div>

      <div className="tpa-logs">
        <h3>Latest Weighbridge Log:</h3>
        <ul>
          {queue.scale_logs?.map((log, i) => (
            <li key={i}>
              <span className="time">{log.time}</span> -
              <span className="truck"> {log.truck}</span> |
              <span className="weight"> {log.weight_ton} ton</span> |
              <span className={`status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
