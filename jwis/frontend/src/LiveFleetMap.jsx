import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const JAKARTA_CENTER = [106.8456, -6.2088];
const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

function toLngLat(point) {
  return [point.lng, point.lat];
}

function buildActualPath(truck) {
  if (truck.actual_path?.length) return truck.actual_path.map(toLngLat);
  const assigned = truck.assigned_path || [];
  const latest = truck.latest_position ? [truck.latest_position.lng, truck.latest_position.lat] : null;
  if (!latest || assigned.length === 0) return [];
  return [toLngLat(assigned[0]), latest, toLngLat(assigned[assigned.length - 1])];
}

// Metres between two [lng,lat] points (equirectangular, small-area accurate).
function metersBetween(a, b) {
  const R = 6371000;
  const lat0 = (a[1] * Math.PI) / 180;
  const x = ((b[0] - a[0]) * Math.PI / 180) * Math.cos(lat0) * R;
  const y = ((b[1] - a[1]) * Math.PI / 180) * R;
  return Math.sqrt(x * x + y * y);
}

// Shortest metres from point p to a polyline (nearest vertex approximation).
function distToPolyline(p, line) {
  let min = Infinity;
  for (const v of line) min = Math.min(min, metersBetween(p, v));
  return min;
}

// Split an actual path into consecutive clean/violation segments by distance to
// the assigned corridor, so only the off-corridor portion is drawn red.
function splitByCorridor(actual, assigned, thresholdM = 500) {
  if (!assigned.length) return [{ kind: "actual-clean", coords: actual }];
  const segs = [];
  let cur = null;
  for (const pt of actual) {
    const violating = distToPolyline(pt, assigned) > thresholdM;
    const kind = violating ? "actual-violation" : "actual-clean";
    if (!cur || cur.kind !== kind) {
      if (cur) cur.coords.push(pt); // bridge so segments join visually
      cur = { kind, coords: cur ? [cur.coords[cur.coords.length - 1], pt] : [pt] };
      segs.push(cur);
    } else {
      cur.coords.push(pt);
    }
  }
  return segs;
}

function featureCollection(features) {
  return {
    type: "FeatureCollection",
    features,
  };
}

function routeFeature(id, coordinates, kind, truckCode) {
  return {
    type: "Feature",
    id,
    properties: { kind, truckCode },
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

export function LiveFleetMap({ trucks, onSelectTruck }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  
  // Track active markers and their previous coordinates for interpolation
  const activeMarkersRef = useRef({});
  const tpaMarkerRef = useRef(null);

  // A* dynamic rerouting state
  const [astarData, setAstarData] = useState(null);
  const [eventPermits, setEventPermits] = useState([]);


  useEffect(() => {
    async function fetchPermits() {
      try {
        const res = await fetch(`${API_URL}/events/permits`);
        if (res.ok) setEventPermits(await res.json());
      } catch {}
    }
    fetchPermits();
  }, []);

  useEffect(() => {
    async function fetchAstar() {
      try {
        const res = await fetch(`${API_URL}/fleet/astar-reroute`);
        if (res.ok) setAstarData(await res.json());
      } catch {}
    }
    fetchAstar();
    const interval = setInterval(fetchAstar, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: JAKARTA_CENTER,
      zoom: 10.7,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    setMapInstance(map);

    return () => {
      Object.values(activeMarkersRef.current).forEach((m) => m.marker.remove());
      activeMarkersRef.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    function renderFleet() {
      const map = mapInstance;
      if (!map) return;
      const assignedFeatures = [];
      const actualFeatures = [];

      trucks.forEach((truck) => {
        if (truck.assigned_path?.length) {
          assignedFeatures.push(
            routeFeature(
              `${truck.truck_code}-assigned`,
              truck.assigned_path.map(toLngLat),
              "assigned",
              truck.truck_code,
            ),
          );
        }

        const actualPath = buildActualPath(truck);
        if (actualPath.length) {
          const assignedLine = (truck.assigned_path || []).map(toLngLat);
          if (truck.deviation?.violated) {
            // Draw only the off-corridor portion red; keep in-corridor green.
            const segs = splitByCorridor(actualPath, assignedLine);
            segs.forEach((s, i) => {
              if (s.coords.length >= 2) {
                actualFeatures.push(routeFeature(`${truck.truck_code}-actual-${i}`, s.coords, s.kind, truck.truck_code));
              }
            });
          } else {
            actualFeatures.push(routeFeature(`${truck.truck_code}-actual`, actualPath, "actual-clean", truck.truck_code));
          }
        }
      });

      // A* recovery overlay appears only when the traffic-jam simulation is active.
      if (astarData?.jam_active && astarData?.active_route?.path) {
        const activePath = astarData.active_route.path.map(toLngLat);
        actualFeatures.push(
          routeFeature("astar-active", activePath, "astar-active", "T-047")
        );

        if (astarData.jam_active && astarData.abandoned_route?.path) {
          const abanPath = astarData.abandoned_route.path.map(toLngLat);
          assignedFeatures.push(
            routeFeature("astar-abandoned", abanPath, "astar-abandoned", "T-047")
          );
        }
      }

      // Congestion points for the active jam simulation.
      const jamFeatures = [];
      if (astarData?.jam_active && astarData.congestion_points) {
        astarData.congestion_points.forEach((pt, i) => {
          jamFeatures.push({
            type: "Feature",
            id: "jam-" + i,
            properties: { label: pt.label || "Congestion" },
            geometry: { type: "Point", coordinates: [pt.lng, pt.lat] },
          });
        });
      }

      const assignedData = featureCollection(assignedFeatures);
      const actualData = featureCollection(actualFeatures);

      if (import.meta.env.DEV) {
        window.__jwisMapFeatures = {
          actualKinds: actualFeatures.map((f) => f.properties?.kind),
        };
      }

      if (!map.getSource("assigned-routes")) {
        map.addSource("assigned-routes", { type: "geojson", data: assignedData });
        map.addLayer({
          id: "assigned-routes-line",
          type: "line",
          source: "assigned-routes",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "kind"], "astar-abandoned"],
              "#b42318",
              "#176b54",
            ],
            "line-width": [
              "case",
              ["==", ["get", "kind"], "astar-abandoned"],
              4,
              3,
            ],
            "line-dasharray": [1.5, 1],
            "line-opacity": 0.82,
          },
        });
      } else {
        map.getSource("assigned-routes").setData(assignedData);
      }

      if (!map.getSource("actual-routes")) {
        map.addSource("actual-routes", { type: "geojson", data: actualData });
        map.addLayer({
          id: "actual-routes-line",
          type: "line",
          source: "actual-routes",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "kind"], "actual-violation"],
              "#b42318",
              ["==", ["get", "kind"], "astar-active"],
              "#0891b2",
              "#176b54",
            ],
            "line-width": [
              "case",
              ["==", ["get", "kind"], "astar-active"],
              5,
              3,
            ],
            "line-opacity": 0.9,
          },
        });
      } else {
        map.getSource("actual-routes").setData(actualData);
      }

      // Digital Twin Interpolation Logic
      const nextMarkers = {};

      // Crowd event permit markers
      eventPermits.forEach((ev) => {
        const key = "event-" + ev.id;
        let existing = activeMarkersRef.current[key];
        
        if (!existing) {
          const element = document.createElement("button");
          element.className = "truck-marker event-permit-marker";
          element.type = "button";
          element.innerHTML = `<span>EV</span>`;
          
          const popup = new maplibregl.Popup({ offset: 25 })
            .setHTML(`
              <div class="event-popup" style="color: #0f172a; padding: 6px;">
                <h4 style="margin: 0 0 6px; font-weight: bold;">Event: ${ev.name}</h4>
                <p style="margin: 0 0 4px; font-size: 11px;"><b>Permit:</b> ${ev.permit_number}</p>
                <p style="margin: 0 0 4px; font-size: 11px;"><b>Forecast:</b> ${ev.predicted_waste_tons} tons of waste</p>
                <p style="margin: 0 0 4px; font-size: 11px;"><b>Field Crews:</b> ${ev.crews_required} people</p>
                <p style="margin: 0; font-size: 11px;"><b>Backup Fleet:</b> ${ev.backup_trucks_required} trucks</p>
                <p class="popup-src" style="margin: 6px 0 0;">${ev.data_class || "SIMULATED"} · ${ev.data_note || "illustrative event, not official permit data"}</p>
              </div>
            `);

          const marker = new maplibregl.Marker({ element, anchor: "bottom", offset: [0, -8] })
            .setLngLat([ev.lng, ev.lat])
            .setPopup(popup)
            .addTo(map);

          existing = {
            marker,
            element,
            coords: [ev.lng, ev.lat]
          };
        }
        
        nextMarkers[key] = existing;
        delete activeMarkersRef.current[key];
      });


      trucks
        .filter((truck) => truck.latest_position)
        .forEach((truck) => {
          const targetCoords = [truck.latest_position.lng, truck.latest_position.lat];
          const key = truck.truck_code;
          const isAnomalous = truck.deviation?.violated;
          const statusClass = isAnomalous ? "is-critical" : truck.is_damaged ? "is-warning" : "is-normal";
          
          let existing = activeMarkersRef.current[key];

          const popupHtml = `
              <div class="map-popup">
                <strong>${truck.truck_code}</strong>
                <span>${truck.driver_name} - ${truck.assigned_zone}</span>
                <p>${isAnomalous ? "Route violation" : truck.is_damaged ? "Fleet damage" : "Normal corridor"}</p>
                <small>${Math.round(truck.deviation?.distance_meters || 0)} m from assigned path - ${truck.latest_position.speed_kmh} km/h</small>
                <small>Updated ${truck.latest_position.updated_seconds_ago ?? "?"}s ago</small>
                <p class="popup-src">SIMULATION · not live GPS</p>
                <button class="popup-dispatch" data-truck="${truck.truck_code}">Dispatch ${truck.truck_code}</button>
              </div>
            `;

          if (!existing) {
            const element = document.createElement("button");
            element.className = `truck-marker ${statusClass}`;
            element.type = "button";
            element.setAttribute("aria-label", `${truck.truck_code} ${truck.assigned_zone}`);
            element.innerHTML = `<span>${truck.truck_code}</span>`;
            element.addEventListener("click", () => {
              map.flyTo({ center: targetCoords, zoom: 14, duration: 800 });
              if (typeof onSelectTruck === "function") onSelectTruck(truck.truck_code);
            });

            const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHtml);
            popup.on("open", () => {
              const btn = document.querySelector(`.popup-dispatch[data-truck="${truck.truck_code}"]`);
              if (btn && typeof onSelectTruck === "function") {
                btn.addEventListener("click", () => onSelectTruck(truck.truck_code, true));
              }
            });

            const marker = new maplibregl.Marker({ element, anchor: "bottom", offset: [0, -8] })
              .setLngLat(targetCoords)
              .setPopup(popup)
              .addTo(map);

            nextMarkers[key] = { marker, element, coords: targetCoords };
          } else {
            existing.element.className = `truck-marker ${statusClass}`;
            const popup = existing.marker.getPopup();
            if (popup) {
              popup.setHTML(popupHtml);
            }

            // Digital twin smooth interpolation loop
            const startCoords = existing.coords;
            const startTime = performance.now();
            const duration = 1200; // 1.2s smooth slide

            function animate(now) {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function
              const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

              const currentLng = startCoords[0] + (targetCoords[0] - startCoords[0]) * ease;
              const currentLat = startCoords[1] + (targetCoords[1] - startCoords[1]) * ease;
              
              existing.marker.setLngLat([currentLng, currentLat]);

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            }
            
            requestAnimationFrame(animate);
            existing.coords = targetCoords;
            nextMarkers[key] = existing;
            delete activeMarkersRef.current[key];
          }
        });

      // Remove active markers that are no longer in the current payload
      Object.values(activeMarkersRef.current).forEach((m) => m.marker.remove());
      activeMarkersRef.current = nextMarkers;

      const jamData = featureCollection(jamFeatures);
      if (!map.getSource("jam-points")) {
        map.addSource("jam-points", { type: "geojson", data: jamData });
        map.addLayer({
          id: "jam-layer",
          type: "circle",
          source: "jam-points",
          paint: {
            "circle-radius": 14,
            "circle-color": "#dc2626",
            "circle-opacity": 0.85,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else {
        map.getSource("jam-points").setData(jamData);
      }

      // Congestion as a highlighted ROAD SEGMENT (LineString), not just a pin.
      const segFeatures = (astarData?.jam_active && astarData.congestion_segments || []).map((seg, i) => ({
        type: "Feature",
        id: "jamseg-" + i,
        properties: { name: seg.name, source: seg.source, multiplier: seg.traffic_multiplier },
        geometry: { type: "LineString", coordinates: (seg.coordinates || []).map((c) => [c.lng, c.lat]) },
      }));
      const segData = featureCollection(segFeatures);
      if (!map.getSource("jam-segments")) {
        map.addSource("jam-segments", { type: "geojson", data: segData });
        map.addLayer({
          id: "jam-segments-line",
          type: "line",
          source: "jam-segments",
          paint: {
            "line-color": "#dc2626",
            "line-width": 7,
            "line-opacity": 0.7,
          },
        });
      } else {
        map.getSource("jam-segments").setData(segData);
      }
    }

    let cancelled = false;
    function renderWhenReady() {
      if (cancelled) return;
      const map = mapInstance;
      if (!map) {
        window.setTimeout(renderWhenReady, 150);
        return;
      }
      if (!map.isStyleLoaded()) {
        window.setTimeout(renderWhenReady, 150);
        return;
      }
      renderFleet();
    }
    renderWhenReady();
    return () => {
      cancelled = true;
    };

  }, [trucks, astarData, eventPermits, mapInstance]);

  useEffect(() => {
    async function renderHeatmap() {
      const map = mapInstance;
      if (!map) return;
      try {
        const response = await fetch(`${API_URL}/geo/kelurahan-heatmap`);
        if (!response.ok) throw new Error("heatmap unavailable");
        const data = await response.json();

        if (!map.getSource("kelurahan-heatmap")) {
          map.addSource("kelurahan-heatmap", { type: "geojson", data });
          map.addLayer(
            {
              id: "kelurahan-heatmap-fill",
              type: "fill",
              source: "kelurahan-heatmap",
              paint: {
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "predicted_tons"], -1],
                  -1,
                  "#c6d2dc",
                  0,
                  "#e7f2ee",
                  60,
                  "#9ed3bb",
                  140,
                  "#3f9d7c",
                  260,
                  "#0f4d3b",
                ],
                "fill-opacity": [
                  "case",
                  ["==", ["coalesce", ["get", "predicted_tons"], -1], -1],
                  0.18,
                  0.4,
                ],
              },
            },
            "assigned-routes-line",
          );
          map.addLayer({
            id: "kelurahan-heatmap-outline",
            type: "line",
            source: "kelurahan-heatmap",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1,
              "line-opacity": 0.72,
            },
          });
        } else {
          map.getSource("kelurahan-heatmap").setData(data);
        }
      } catch {
        // Heatmap is non-critical
      }
    }

    async function renderOsrm() {
      const map = mapInstance;
      if (!map) return;
      try {
        const response = await fetch(`${API_URL}/routes/osrm`);
        if (!response.ok) throw new Error("osrm unavailable");
        const route = await response.json();
        const coords = (route.path || []).map((p) => [p.lng, p.lat]);
        if (coords.length < 2) return;
        const data = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: { source: route.source }, geometry: { type: "LineString", coordinates: coords } }],
        };
        if (!map.getSource("osrm-route")) {
          map.addSource("osrm-route", { type: "geojson", data });
          map.addLayer({
            id: "osrm-route-line",
            type: "line",
            source: "osrm-route",
            paint: {
              "line-color": "#0891b2",
              "line-width": 4,
              "line-opacity": 0.85,
            },
          });
        } else {
          map.getSource("osrm-route").setData(data);
        }
      } catch {
        // OSRM layer is non-critical
      }
    }

    async function renderTpa() {
      const map = mapInstance;
      if (!map) return;
      try {
        const response = await fetch(`${API_URL}/tpa/queue-status`);
        if (!response.ok) throw new Error("tpa unavailable");
        const q = await response.json();
        if (q.lat == null || q.lng == null) return;
        if (tpaMarkerRef.current) {
          tpaMarkerRef.current.remove();
        }
        const el = document.createElement("div");
        el.className = "tpa-marker";
        el.title = q.facility_name || "TPA";
        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
          `<div class="map-popup"><h4>${q.facility_name || "TPA Bantargebang"}</h4>` +
          `<p><b>${q.trucks_in_queue}</b> trucks queued</p>` +
          `<p>Wait: <b>${q.avg_wait_minutes} min</b> (P95 ${q.p95_wait_minutes})</p>` +
          `<p>${q.weighbridge_status}</p>` +
          `<p class="popup-src">MODEL OUTPUT · queue simulation</p></div>`
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([q.lng, q.lat])
          .setPopup(popup)
          .addTo(map);
        tpaMarkerRef.current = marker;
      } catch {
        // TPA marker is non-critical
      }
    }

    let cancelled = false;
    function renderWhenReady() {
      if (cancelled) return;
      const map = mapInstance;
      if (!map) {
        window.setTimeout(renderWhenReady, 150);
        return;
      }
      if (!map.isStyleLoaded()) {
        window.setTimeout(renderWhenReady, 150);
        return;
      }
      renderHeatmap();
      renderOsrm();
      renderTpa();
    }
    renderWhenReady();
    return () => {
      cancelled = true;
    };
  }, [mapInstance]);

  return (
    <div className="maplibre-shell">
      <div ref={containerRef} className="maplibre-container" />
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-heatmap" /> District waste risk <em className="legend-tag">MODEL</em></span>
        <span><i className="legend-assigned" /> Assigned corridor <em className="legend-tag">SIM</em></span>
        <span><i className="legend-actual" /> Actual (clean) <em className="legend-tag">SIM</em></span>
        <span><i className="legend-critical" /> Violation segment <em className="legend-tag">SIM</em></span>
        <span><i className="legend-osrm" /> OSRM route <em className="legend-tag">LIVE</em></span>
      </div>
    </div>
  );
}
