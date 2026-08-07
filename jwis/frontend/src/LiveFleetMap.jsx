import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const JAKARTA_CENTER = [106.8456, -6.2088];
const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

function toLngLat(point) {
  return [point.lng, point.lat];
}

function buildActualPath(truck, trail) {
  // Prefer the live GPS breadcrumb trail (timestamped actual movement).
  if (trail?.length > 1) return trail.map((b) => [b.lng, b.lat]);
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

// Shortest metres from point p to segment a-b (project p onto the segment).
// Matches the backend point-to-segment algorithm so a point mid-corridor
// reads ~0m, not the distance to the nearest vertex.
function pointToSegment(p, a, b) {
  const R = 6371000;
  const lat0 = (a[1] * Math.PI) / 180;
  const toXY = (q) => [
    ((q[0] - a[0]) * Math.PI / 180) * Math.cos(lat0) * R,
    ((q[1] - a[1]) * Math.PI / 180) * R,
  ];
  const [px, py] = toXY(p);
  const [bx, by] = toXY(b);
  const segLenSq = bx * bx + by * by;
  if (segLenSq === 0) return Math.sqrt(px * px + py * py);
  let t = (px * bx + py * by) / segLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = t * bx;
  const cy = t * by;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// Shortest metres from point p to a polyline (nearest SEGMENT, not vertex).
function distToPolyline(p, line) {
  if (line.length === 1) return metersBetween(p, line[0]);
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, pointToSegment(p, line[i], line[i + 1]));
  }
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

function normalizeLngLat(lngLat) {
  if (!lngLat) return null;
  if (Array.isArray(lngLat)) return lngLat;
  return [lngLat.lng, lngLat.lat];
}

function focusMapPin(map, lngLat, popup, options = {}) {
  const coordinates = normalizeLngLat(lngLat);
  if (!map || !coordinates) return;
  const currentZoom = typeof map.getZoom === "function" ? map.getZoom() : 10;
  const zoom = Math.max(currentZoom, options.zoom ?? 15);

  map.flyTo({
    center: coordinates,
    zoom,
    duration: options.duration ?? 700,
    essential: true,
    offset: options.offset ?? [0, -80],
  });

  if (popup) {
    popup.setLngLat(coordinates).addTo(map);
  }
}

function attachFocusableMarker(element, map, getLngLat, getPopup, options = {}, afterFocus) {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const lngLat = typeof getLngLat === "function" ? getLngLat() : getLngLat;
    const popup = typeof getPopup === "function" ? getPopup() : getPopup;
    focusMapPin(map, lngLat, popup, options);
    if (typeof afterFocus === "function") afterFocus();
  });
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

export function LiveFleetMap({ 
  trucks, 
  attendance, 
  rainfall, 
  onSelectTruck, 
  layers = { heatmap: false, osrm: true, unlicensed: true, tps: true, wr: true }, 
  playbackTruck, 
  onBreadcrumbsLoaded 
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  
  // Track active markers and their previous coordinates for interpolation
  const activeMarkersRef = useRef({});
  const tpaMarkerRef = useRef(null);

  // A* dynamic rerouting state
  const [astarData, setAstarData] = useState(null);
  const [eventPermits, setEventPermits] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState({});
  const [mapTruth, setMapTruth] = useState({});
  const [unlicensed, setUnlicensed] = useState([]);
  const unlicensedMarkersRef = useRef([]);
  const playbackMarkerRef = useRef(null);


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
    async function fetchBreadcrumbs() {
      const codes = (trucks || []).map((t) => t.truck_code);
      const out = {};
      await Promise.all(codes.map(async (code) => {
        try {
          const res = await fetch(`${API_URL}/fleet/${code}/breadcrumbs`);
          if (res.ok) {
            const j = await res.json();
            if (j.breadcrumbs?.length > 1) out[code] = j.breadcrumbs;
          }
        } catch {}
      }));
      setBreadcrumbs(out);
      if (typeof onBreadcrumbsLoaded === "function") {
        onBreadcrumbsLoaded(Object.keys(out));
      }
    }
    if (trucks?.length) fetchBreadcrumbs();
  }, [trucks, onBreadcrumbsLoaded]);

  useEffect(() => {
    async function fetchUnlicensed() {
      try {
        const res = await fetch(`${API_URL}/fleet/unlicensed-collectors`);
        if (res.ok) {
          const j = await res.json();
          setUnlicensed(j.alerts || []);
        }
      } catch {}
    }
    fetchUnlicensed();
  }, []);

  useEffect(() => {
    async function fetchMapTruth() {
      try {
        const res = await fetch(`${API_URL}/fleet/map-truth`);
        if (res.ok) {
          const j = await res.json();
          const byCode = {};
          (j.trucks || []).forEach((t) => { byCode[t.truck_code] = t; });
          setMapTruth(byCode);
        }
      } catch {}
    }
    fetchMapTruth();
    const timer = setInterval(fetchMapTruth, 8000);
    return () => clearInterval(timer);
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
      Object.values(activeMarkersRef.current).forEach((m) => {
        m.popup?.remove();
        m.marker.remove();
      });
      activeMarkersRef.current = {};
      if (tpaMarkerRef.current) {
        tpaMarkerRef.current.popup?.remove();
        tpaMarkerRef.current.marker?.remove();
        tpaMarkerRef.current = null;
      }
      unlicensedMarkersRef.current.forEach((m) => {
        m.popup?.remove();
        m.marker?.remove();
      });
      unlicensedMarkersRef.current = [];
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
        const truth = mapTruth[truck.truck_code];
        // Prefer backend map-truth road-following geometry; fall back to raw waypoints.
        const assignedGeom = truth?.assigned_route?.geometry?.length
          ? truth.assigned_route.geometry.map(toLngLat)
          : (truck.assigned_path || []).map(toLngLat);
        if (assignedGeom.length) {
          assignedFeatures.push(
            routeFeature(`${truck.truck_code}-assigned`, assignedGeom, "assigned", truck.truck_code),
          );
        }

        const truthActual = truth?.actual_route?.geometry?.length
          ? truth.actual_route.geometry.map(toLngLat)
          : null;
        const actualPath = truthActual || buildActualPath(truck, breadcrumbs[truck.truck_code]);
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

      if (typeof window !== "undefined") {
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
            .addTo(map);
          attachFocusableMarker(element, map, [ev.lng, ev.lat], popup, { zoom: 15 });

          existing = {
            marker,
            element,
            popup,
            coords: [ev.lng, ev.lat]
          };
        }
        
        nextMarkers[key] = existing;
        delete activeMarkersRef.current[key];
      });


      trucks
        .filter((truck) => truck.latest_position)
        .forEach((truck) => {
          const snapped = mapTruth[truck.truck_code]?.snapped_gps;
          const targetCoords = snapped
            ? [snapped.lng, snapped.lat]
            : [truck.latest_position.lng, truck.latest_position.lat];
          const key = truck.truck_code;
          const isAnomalous = truck.deviation?.violated;
          const statusClass = isAnomalous ? "is-critical" : truck.is_damaged ? "is-warning" : "is-normal";
          
          let existing = activeMarkersRef.current[key];

          const truth047 = mapTruth[truck.truck_code];
          const rawStr = truth047 ? `${truth047.raw_gps.lat.toFixed(5)}, ${truth047.raw_gps.lng.toFixed(5)}` : "n/a";
          const snapStr = truth047 ? `${truth047.snapped_gps.lat.toFixed(5)}, ${truth047.snapped_gps.lng.toFixed(5)}` : "n/a";
          const snapSrc = truth047?.provenance?.snapped_gps || "RAW_GPS_UNSNAPPED";
          const popupHtml = `
              <div class="map-popup">
                <strong>${truck.truck_code}</strong>
                <span>${truck.driver_name} - ${truck.assigned_zone}</span>
                <p>${isAnomalous ? "Route violation" : truck.is_damaged ? "Fleet damage" : "Normal corridor"}</p>
                <small>${Math.round(truth047?.deviation_m ?? truck.deviation?.distance_meters ?? 0)} m from assigned road - ${truck.latest_position.speed_kmh} km/h</small>
                <small>Raw GPS: ${rawStr}</small>
                <small>Snapped: ${snapStr} (${snapSrc})</small>
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

            const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHtml);
            popup.on("open", () => {
              const btn = document.querySelector(`.popup-dispatch[data-truck="${truck.truck_code}"]`);
              if (btn && typeof onSelectTruck === "function") {
                btn.addEventListener("click", () => onSelectTruck(truck.truck_code, true));
              }
            });

            const marker = new maplibregl.Marker({ element, anchor: "bottom", offset: [0, -8] })
              .setLngLat(targetCoords)
              .addTo(map);
            attachFocusableMarker(
              element,
              map,
              () => marker.getLngLat(),
              popup,
              { zoom: 14.5 },
              () => {
                if (typeof onSelectTruck === "function") onSelectTruck(truck.truck_code);
              },
            );

            nextMarkers[key] = { marker, element, popup, coords: targetCoords };
          } else {
            existing.element.className = `truck-marker ${statusClass}`;
            if (existing.popup) {
              existing.popup.setHTML(popupHtml);
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
      Object.values(activeMarkersRef.current).forEach((m) => {
        m.popup?.remove();
        m.marker.remove();
      });
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
        map.on("mouseenter", "jam-layer", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "jam-layer", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "jam-layer", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const coordinates = feature.geometry.coordinates.slice();
          const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
            `<div class="map-popup"><h4>${feature.properties?.label || "Congestion point"}</h4>` +
            `<p>Active A* rerouting hazard.</p>` +
            `<p class="popup-src">SIMULATION · traffic scenario</p></div>`
          );
          focusMapPin(map, coordinates, popup, { zoom: 15.5 });
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

  }, [trucks, astarData, eventPermits, mapInstance, breadcrumbs, mapTruth]);

  useEffect(() => {
    let cancelled = false;
    async function renderHeatmap() {
      const map = mapInstance;
      if (!map) return;
      try {
        const params = new URLSearchParams({
          rainfall_mm: String(rainfall || 0),
          event_attendance: String(attendance || 0),
          is_weekend: "true",
        });
        const response = await fetch(`${API_URL}/geo/kelurahan-heatmap?${params.toString()}`);
        if (!response.ok) throw new Error("heatmap unavailable");
        const data = await response.json();
        if (cancelled) return;

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
    }
    renderWhenReady();

    return () => {
      cancelled = true;
    };
  }, [mapInstance, attendance, rainfall]);

  useEffect(() => {
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
          tpaMarkerRef.current.popup?.remove();
          tpaMarkerRef.current.marker?.remove();
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
          .addTo(map);
        attachFocusableMarker(el, map, [q.lng, q.lat], popup, { zoom: 15 });
        tpaMarkerRef.current = { marker, popup };
      } catch {
        // TPmarker is non-critical
      }
    }

    function renderUnlicensed() {
      const map = mapInstance;
      if (!map) return;
      unlicensedMarkersRef.current.forEach((m) => {
        m.popup?.remove();
        m.marker?.remove();
      });
      unlicensedMarkersRef.current = [];
      (unlicensed || []).forEach((a) => {
        if (a.lat == null || a.lng == null) return;
        const el = document.createElement("div");
        el.className = "unlicensed-marker";
        el.title = a.plate;
        const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
          `<div class="map-popup"><h4>Unlicensed collector</h4>` +
          `<p><b>${a.plate}</b></p><p>${a.message}</p>` +
          `<p class="popup-src">${a.data_class || "SIMULATED"} · registry match</p></div>`
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([a.lng, a.lat]).addTo(map);
        attachFocusableMarker(el, map, [a.lng, a.lat], popup, { zoom: 15.5 });
        unlicensedMarkersRef.current.push({ marker, popup });
      });
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
      renderOsrm();
      renderTpa();
      renderUnlicensed();
    }
    renderWhenReady();
    return () => {
      cancelled = true;
    };
  }, [mapInstance, unlicensed]);

  // Toggle map layer visibility from the layer controls.
  useEffect(() => {
    const map = mapInstance;
    if (!map || !map.isStyleLoaded?.()) return;
    const set = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none"); };
    set("kelurahan-heatmap-fill", layers.heatmap);
    set("kelurahan-heatmap-outline", layers.heatmap);
    set("osrm-route-line", layers.osrm);
  }, [layers, mapInstance]);

  
  // Load & render real TPS and WR locations
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    let cancelled = false;

    async function loadTpsAndWr() {
      try {
        // Fetch TPS
        const tpsRes = await fetch(`${API_URL}/geo/tps-coordinates`);
        if (tpsRes.ok) {
          const tpsData = await tpsRes.json();
          if (cancelled) return;
          if (!map.getSource("tps-points")) {
            map.addSource("tps-points", { type: "geojson", data: tpsData });
            map.addLayer({
              id: "tps-layer",
              type: "circle",
              source: "tps-points",
              paint: {
                "circle-radius": 5,
                "circle-color": "#22c55e",
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.85
              },
              layout: {
                "visibility": layers.tps ? "visible" : "none"
              }
            });
            
            // Popup on hover
            const popup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false
            });
            
            map.on("mouseenter", "tps-layer", (e) => {
              map.getCanvas().style.cursor = "pointer";
              const coordinates = e.features[0].geometry.coordinates.slice();
              const props = e.features[0].properties;
              
              popup.setLngLat(coordinates)
                .setHTML(`
                  <div style="color: #0f172a; padding: 4px; font-size: 11px;">
                    <strong style="display: block; font-weight: bold; margin-bottom: 2px;">TPS: ${props.name}</strong>
                    <span>Kel. ${props.kelurahan}, Kec. ${props.kecamatan}</span>
                  </div>
                `)
                .addTo(map);
            });
            
            map.on("mouseleave", "tps-layer", () => {
              map.getCanvas().style.cursor = "";
              popup.remove();
            });

            map.on("click", "tps-layer", (e) => {
              const feature = e.features?.[0];
              if (!feature) return;
              const coordinates = feature.geometry.coordinates.slice();
              const props = feature.properties || {};
              popup.remove();
              const detailPopup = new maplibregl.Popup({ offset: 18 }).setHTML(`
                <div class="map-popup">
                  <h4>TPS: ${props.name || "Waste collection point"}</h4>
                  <p>${props.kelurahan ? `Kelurahan ${props.kelurahan}` : "TPS location"}</p>
                  <small>${props.kecamatan ? `Kecamatan ${props.kecamatan}` : ""}</small>
                  <p class="popup-src">REAL · TPS coordinates</p>
                </div>
              `);
              focusMapPin(map, coordinates, detailPopup, { zoom: 16 });
            });
          } else {
            map.getSource("tps-points").setData(tpsData);
          }
        }

        // Fetch WR with clustering
        const wrRes = await fetch(`${API_URL}/geo/wr-coordinates`);
        if (wrRes.ok) {
          const wrData = await wrRes.json();
          if (cancelled) return;
          if (!map.getSource("wr-points")) {
            map.addSource("wr-points", {
              type: "geojson",
              data: wrData,
              cluster: true,
              clusterMaxZoom: 14,
              clusterRadius: 50
            });

            // Layer cluster
            map.addLayer({
              id: "wr-clusters",
              type: "circle",
              source: "wr-points",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#fed7aa", // orange muda untuk count kecil
                  100,
                  "#fdba74", // sedang
                  500,
                  "#f97316"  // pekat untuk area sangat padat
                ],
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  15,
                  100,
                  22,
                  500,
                  30
                ],
                "circle-opacity": 0.75,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ea580c"
              },
              layout: {
                "visibility": layers.wr ? "visible" : "none"
              }
            });

            // Text count
            map.addLayer({
              id: "wr-cluster-count",
              type: "symbol",
              source: "wr-points",
              filter: ["has", "point_count"],
              layout: {
                "text-field": "{point_count}",
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 12,
                "visibility": layers.wr ? "visible" : "none"
              },
              paint: {
                "text-color": "#431407"
              }
            });

            // Single unclustered WR point
            map.addLayer({
              id: "wr-unclustered-point",
              type: "circle",
              source: "wr-points",
              filter: ["!", ["has", "point_count"]],
              paint: {
                "circle-color": "#f97316",
                "circle-radius": 4,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.8
              },
              layout: {
                "visibility": layers.wr ? "visible" : "none"
              }
            });

            // Click cluster zoom
            map.on("click", "wr-clusters", (e) => {
              const features = map.queryRenderedFeatures(e.point, { layers: ["wr-clusters"] });
              if (!features.length) return;
              const clusterId = features[0].properties.cluster_id;
              map.getSource("wr-points").getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                focusMapPin(map, features[0].geometry.coordinates, null, { zoom, duration: 650, offset: [0, 0] });
              });
            });

            // Popup on unclustered point hover
            const wrPopup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false
            });

            map.on("mouseenter", "wr-unclustered-point", (e) => {
              map.getCanvas().style.cursor = "pointer";
              const coordinates = e.features[0].geometry.coordinates.slice();
              const props = e.features[0].properties;
              
              wrPopup.setLngLat(coordinates)
                .setHTML(`
                  <div style="color: #0f172a; padding: 4px; font-size: 11px; max-width: 200px;">
                    <strong style="display: block; font-weight: bold; margin-bottom: 2px;">WR: ${props.name}</strong>
                    <span style="display: block; margin-bottom: 2px;">Type: ${props.type}</span>
                    <span style="display: block; color: #64748b; font-size: 10px;">${props.address || ""}</span>
                  </div>
                `)
                .addTo(map);
            });

            map.on("mouseleave", "wr-unclustered-point", () => {
              map.getCanvas().style.cursor = "";
              wrPopup.remove();
            });

            map.on("click", "wr-unclustered-point", (e) => {
              const feature = e.features?.[0];
              if (!feature) return;
              const coordinates = feature.geometry.coordinates.slice();
              const props = feature.properties || {};
              wrPopup.remove();
              const detailPopup = new maplibregl.Popup({ offset: 18 }).setHTML(`
                <div class="map-popup">
                  <h4>Retribution registry</h4>
                  <p><b>${props.name || "Registered point"}</b></p>
                  <small>${props.type || "Registry location"}</small>
                  <small>${props.address || ""}</small>
                  <p class="popup-src">REAL · registry coordinates</p>
                </div>
              `);
              focusMapPin(map, coordinates, detailPopup, { zoom: 16 });
            });
          } else {
            map.getSource("wr-points").setData(wrData);
          }
        }
      } catch (err) {
        console.error("Failed to load real TPS or WR coordinates:", err);
      }
    }

    function renderWhenReady() {
      if (cancelled) return;
      if (!map.isStyleLoaded()) {
        window.setTimeout(renderWhenReady, 150);
        return;
      }
      loadTpsAndWr();
    }
    renderWhenReady();

    return () => {
      cancelled = true;
    };
  }, [mapInstance]);

  // Effect to toggle TPS & WR visibility dynamically
  useEffect(() => {
    const map = mapInstance;
    if (!map || !map.isStyleLoaded()) return;
    
    const setVisibility = (layerId, isVisible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
      }
    };
    
    setVisibility("tps-layer", layers.tps);
    setVisibility("wr-clusters", layers.wr);
    setVisibility("wr-cluster-count", layers.wr);
    setVisibility("wr-unclustered-point", layers.wr);
  }, [layers.tps, layers.wr, mapInstance]);


  // Auto-fit the viewport to active fleet + TPonce positions are known.
  const fittedRef = useRef(false);
  useEffect(() => {
    const map = mapInstance;
    if (!map || fittedRef.current) return;
    const pts = (trucks || []).filter((t) => t.latest_position)
      .map((t) => [t.latest_position.lng, t.latest_position.lat]);
    pts.push([106.9910, -6.3310]); // TPA Bantargebang
    if (pts.length < 2) return;
    const lngs = pts.map((p) => p[0]); const lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, maxZoom: 12, duration: 600 });
    fittedRef.current = true;
  }, [trucks, mapInstance]);

  // Trip playback: animate a marker along the selected truck's breadcrumb trail.
  useEffect(() => {
    const map = mapInstance;
    if (!map || !playbackTruck) return;
    const trail = breadcrumbs[playbackTruck];
    if (!trail || trail.length < 2) return;
    if (playbackMarkerRef.current) playbackMarkerRef.current.remove();
    const el = document.createElement("div");
    el.className = "playback-marker";
    const marker = new maplibregl.Marker({ element: el }).setLngLat([trail[0].lng, trail[0].lat]).addTo(map);
    const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
      `<div class="map-popup"><h4>${playbackTruck} playback</h4>` +
      `<p>Trip movement replay marker.</p>` +
      `<p class="popup-src">SIMULATION · breadcrumb trail</p></div>`
    );
    attachFocusableMarker(el, map, () => marker.getLngLat(), popup, { zoom: 15 });
    playbackMarkerRef.current = marker;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      if (i >= trail.length) { clearInterval(timer); return; }
      marker.setLngLat([trail[i].lng, trail[i].lat]);
    }, 700);
    return () => {
      clearInterval(timer);
      popup.remove();
      marker.remove();
      playbackMarkerRef.current = null;
    };
  }, [playbackTruck, breadcrumbs, mapInstance]);

  const playbackOptions = Object.keys(breadcrumbs);

  return (
    <div className="maplibre-shell">
      <div ref={containerRef} className="maplibre-container" />
    </div>
  );
}

