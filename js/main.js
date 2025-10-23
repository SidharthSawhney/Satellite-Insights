loadLaunchDominance();

function loadLaunchDominance() {
  d3.json("data/launch_dominance.json").then(jsonObj => {
    // convert {"Falcon 9":4731,...} -> [{name:"Falcon 9", satellites:4731}, ...]
    const dataArr = Object.entries(jsonObj).map(([name, satellites]) => ({
      name,
      satellites: +satellites
    }));

const viz = new LaunchDominance("launch-dominance", dataArr, {
  radius: 530,
  bandDeg: 85,
  capReveal: 180,
  gapPx: 28
});

// ensure layout fits under the title on first render
if (typeof setHeroHeightVar === "function") setHeroHeightVar();
if (viz && typeof viz.resize === "function") viz.resize();


   
  });
}
