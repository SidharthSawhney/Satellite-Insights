// ---- main.js ----
let data = [];
let congestion;

// Launch Dominance loader
loadLaunchDominance();

function loadLaunchDominance() {
  d3.json("data/launch_dominance.json")
    .then(jsonObj => {
      const viz = new LaunchDominance("launch-dominance", jsonObj);

      // Fit layout below the header
      if (typeof setHeroHeightVar === "function") setHeroHeightVar();
      if (viz && typeof viz.resize === "function") viz.resize();
    })
    .catch(err => console.error("Launch Dominance load error:", err));
}

// Launch Sites Map loader
loadLaunchSitesMap();

function loadLaunchSitesMap() {
  Promise.all([
    d3.json("data/world_lowres.json"),   // basemap (GeoJSON/TopoJSON)
    d3.csv("data/satellite_clean.csv")   // launch events
  ])
    .then(([world, launches]) => {
      // Clean and coerce numeric fields we need for congestion viz
      data = launches.map(row => coerceRow(row));

      // If you have this map viz, keep it. Otherwise remove the next block.
      if (typeof LaunchSitesMap === "function") {
        new LaunchSitesMap("launch-sites", world, data, {
          intervalMs: 120,
          loop: false
        });
      }

      loadCongestion();
    })
    .catch(err => console.error("Launch Sites Map load error:", err));
}

// Turn CSV strings into numbers and normalize a few keys
function coerceRow(d) {
  // Helper to coerce empty strings to NaN instead of 0
  const toNum = v => (v === "" || v == null ? NaN : +v);

  // Keep originals with bracket-keys (CSV headers) and also create
  // simpler aliases without punctuation for easier downstream access.
  const perigee_km      = toNum(d['perigee_(km)']);
  const apogee_km       = toNum(d['apogee_(km)']);
  const inclination_deg = toNum(d['inclination_(degrees)']);
  const eccentricity    = toNum(d.eccentricity);

  d['perigee_(km)']         = perigee_km;
  d['apogee_(km)']          = apogee_km;
  d['inclination_(degrees)']= inclination_deg;
  d.eccentricity            = eccentricity;

  // Also provide aliases that are JS-identifier-friendly
  d.perigee_km      = perigee_km;
  d.apogee_km       = apogee_km;
  d.inclination_deg = inclination_deg;

  return d;
}

function loadCongestion() {
  if (!Array.isArray(data) || data.length === 0) return;

  // Ensure numeric coercion (safe if already coerced)
  data.forEach(d => {
    d['perigee_(km)']          = +d['perigee_(km)'] || 0;
    d['apogee_(km)']           = +d['apogee_(km)'] || 0;
    d['inclination_(degrees)'] = +d['inclination_(degrees)'] || 0;
    d.eccentricity             = +d.eccentricity || 0;
  });

  congestion = new Congestion("congestion-risk", data);
  if (congestion && typeof congestion.initVis === "function") {
    congestion.initVis();
  }
}
