import sys
from pathlib import Path

path = Path(r"D:\ai open presu lomba\jwis system\jwis\frontend\src\LiveFleetMap.jsx")
if not path.exists():
    print("Error: File not found")
    sys.exit(1)

content = path.read_text(encoding="utf-8")

# 1. Update layers state default (tambahkan tps: true, wr: true)
old_layers = "const [layers, setLayers] = useState({ heatmap: false, osrm: true, unlicensed: true });"
new_layers = "const [layers, setLayers] = useState({ heatmap: false, osrm: true, unlicensed: true, tps: true, wr: true });"

if old_layers in content:
    content = content.replace(old_layers, new_layers)
    print("Layers state updated")

# 2. Tambahkan load data TPS & WR GeoJSON and render layers
# Kita taruh render logic di dalam hook useEffect baru setelah mapInstance ter-create.
tps_wr_render_effect = """
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
              const clusterId = features[0].properties.cluster_id;
              map.getSource("wr-points").getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                map.easeTo({
                  center: features[0].geometry.coordinates,
                  zoom: zoom
                });
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
                    <span style="display: block; margin-bottom: 2px;">Tipe: ${props.type}</span>
                    <span style="display: block; color: #64748b; font-size: 10px;">${props.address || ""}</span>
                  </div>
                `)
                .addTo(map);
            });

            map.on("mouseleave", "wr-unclustered-point", () => {
              map.getCanvas().style.cursor = "";
              wrPopup.remove();
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
"""

# Kita akan menyisipkan tps_wr_render_effect sebelum `// Auto-fit the viewport to active fleet + TPA once positions are known.`
target_hook = "// Auto-fit the viewport to active fleet + TPA once positions are known."
if target_hook in content and "tps-layer" not in content:
    content = content.replace(target_hook, tps_wr_render_effect + "\n\n  " + target_hook)
    print("TPS & WR rendering effects added")

# 3. Tambahkan checkbox controls ke JSX return
old_controls = """      <div className="map-controls">
        <label><input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} /> Heatmap</label>
        <label><input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} /> OSRM route</label>"""

new_controls = """      <div className="map-controls">
        <label><input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} /> Heatmap</label>
        <label><input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} /> OSRM route</label>
        <label><input type="checkbox" checked={layers.tps} onChange={(e) => setLayers((s) => ({ ...s, tps: e.target.checked }))} /> TPS</label>
        <label><input type="checkbox" checked={layers.wr} onChange={(e) => setLayers((s) => ({ ...s, wr: e.target.checked }))} /> Wajib Retribusi</label>"""

if old_controls in content:
    content = content.replace(old_controls, new_controls)
    print("JSX checkboxes updated")

# 4. Tambahkan legend entries ke legend
old_legend = """      <details className="map-legend" open aria-label="Map legend">
        <summary>Legend</summary>
        <span><i className="legend-heatmap" /> District waste risk <em className="legend-tag">MODEL</em></span>"""

new_legend = """      <details className="map-legend" open aria-label="Map legend">
        <summary>Legend</summary>
        <span><i className="legend-heatmap" style={{ backgroundColor: "#22c55e" }} /> TPS (Tempat Sampah) <em className="legend-tag">REAL</em></span>
        <span><i className="legend-heatmap" style={{ backgroundColor: "#f97316" }} /> Wajib Retribusi <em className="legend-tag">REAL</em></span>
        <span><i className="legend-heatmap" /> District waste risk <em className="legend-tag">MODEL</em></span>"""

if old_legend in content:
    content = content.replace(old_legend, new_legend)
    print("JSX legend updated")

path.write_text(content, encoding="utf-8")
print("Success patching LiveFleetMap.jsx")
