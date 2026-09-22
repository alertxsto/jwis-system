// CruiseEngine — continuous smooth truck movement along route polylines.
// Pure module: no React, no maplibre. All positions are [lng, lat].

const EARTH_M_PER_DEG_LAT = 111320;

function toLngLat(p) {
  if (Array.isArray(p)) return [p[0], p[1]];
  return [p.lng, p.lat];
}

function segLenMeters(a, b, refLat) {
  const dx = (b[0] - a[0]) * EARTH_M_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180);
  const dy = (b[1] - a[1]) * EARTH_M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

function headingDeg(a, b) {
  const refLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(refLat);
  const dy = b[1] - a[1];
  return (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = north
}

function buildPath(geometry) {
  const pts = geometry.map(toLngLat);
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + segLenMeters(pts[i - 1], pts[i], pts[i][1]));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

// Binary search: segment index for arc distance d.
function segIndex(cum, d) {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

function pointAt(path, d) {
  const { pts, cum, total } = path;
  if (total === 0) return { pos: pts[0], heading: 0 };
  const dd = Math.max(0, Math.min(d, total));
  const i = segIndex(cum, dd);
  const segStart = cum[i];
  const segEnd = cum[i + 1];
  const t = segEnd > segStart ? (dd - segStart) / (segEnd - segStart) : 0;
  const a = pts[i];
  const b = pts[i + 1];
  return {
    pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    heading: headingDeg(a, b),
  };
}

export function createCruiseEngine() {
  const trucks = new Map(); // code -> state
  let lastNow = null;

  return {
    registerTruck(code, geometry, opts = {}) {
      if (!geometry || geometry.length < 2) return false;
      const path = buildPath(geometry);
      if (path.total < 1) return false;
      const existing = trucks.get(code);
      const speedKmh = opts.speedKmh ?? 20 + Math.random() * 20; // 20-40
      const startFraction = opts.startFraction ?? Math.random();
      const dist = existing ? existing.dist : startFraction * path.total;
      const dir = existing ? existing.dir : 1;
      trucks.set(code, {
        path,
        speedMps: (speedKmh * 1000) / 3600,
        dist,
        dir,
        paused: false,
        correction: null, // { pos:[lng,lat] } offset currently applied
      });
      return true;
    },

    has(code) {
      return trucks.has(code);
    },

    pauseTruck(code) {
      const t = trucks.get(code);
      if (t) t.paused = true;
    },

    resumeTruck(code) {
      const t = trucks.get(code);
      if (t) t.paused = false;
    },

    removeTruck(code) {
      trucks.delete(code);
    },

    softCorrect(code, targetLngLat, blend = 0.2) {
      const t = trucks.get(code);
      if (!t) return;
      // Compute where the truck currently *appears* (pos + correction offset),
      // then set correction so the appearance moves `blend` toward target.
      const { pos } = pointAt(t.path, t.dist);
      const cx = t.correction ? t.correction.pos : [0, 0];
      const appear = [pos[0] + cx[0], pos[1] + cx[1]];
      const newAppear = [
        appear[0] + (targetLngLat[0] - appear[0]) * blend,
        appear[1] + (targetLngLat[1] - appear[1]) * blend,
      ];
      t.correction = { pos: [newAppear[0] - pos[0], newAppear[1] - pos[1]] };
    },

    tick(nowMs) {
      if (lastNow == null) lastNow = nowMs;
      const dtSec = Math.min((nowMs - lastNow) / 1000, 0.25); // clamp tab-switch jumps
      lastNow = nowMs;
      const out = [];
      trucks.forEach((t, code) => {
        if (!t.paused && dtSec > 0) {
          t.dist += t.dir * t.speedMps * dtSec;
          if (t.dist >= t.path.total) {
            t.dist = t.path.total;
            t.dir = -1;
          } else if (t.dist <= 0) {
            t.dist = 0;
            t.dir = 1;
          }
          // decay correction gradually as the truck cruises along the real route
          if (t.correction) {
            const decay = Math.max(0, 1 - dtSec / 16); // ~2 poll cycles
            t.correction.pos = [t.correction.pos[0] * decay, t.correction.pos[1] * decay];
          }
        }
        const { pos, heading } = pointAt(t.path, t.dist);
        const c = t.correction ? t.correction.pos : [0, 0];
        out.push([code, [pos[0] + c[0], pos[1] + c[1]], t.dir === 1 ? heading : heading + 180]);
      });
      return out;
    },

    resetClock() {
      lastNow = null;
    },
  };
}
