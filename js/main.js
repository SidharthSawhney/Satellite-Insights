// Launch Dominance loader
loadLaunchDominance();

function loadLaunchDominance() {
  d3.json("data/launch_dominance.json").then(data => {
    const viz = new LaunchDominance("launch-dominance", data);
    
    // ensure layout fits
    if (typeof setHeroHeightVar === "function") setHeroHeightVar();
    if (viz && typeof viz.resize === "function") viz.resize();
  }).catch(err => {
    console.error("Launch Dominance load error:", err);
  });
}

// Launch Sites Map loader
loadLaunchSitesMap();

function loadLaunchSitesMap() {
    Promise.all([
        d3.json("data/world_lowres.json"),   // basemap (GeoJSON or TopoJSON)
        d3.csv("data/satellite_clean.csv")   // launch events
    ]).then(([world, launches]) => {
        new LaunchSitesMap("launch-sites", world, launches, {
            intervalMs: 120,
            loop: false
        });
    }).catch(err => {
        console.error("Launch Sites Map load error:", err);
    });
}
