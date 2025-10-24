loadLaunchDominance();


function loadLaunchDominance() {
  d3.json("data/launch_dominance.json").then(jsonObj => {
    
    // convert {"Falcon 9":4731,...} -> [{name:"Falcon 9", satellites:4731}, ...]
    const dataArr = Object.entries(jsonObj).map(([name, satellites]) => ({
      name,
      satellites: +satellites
    }));

    const viz = new LaunchDominance("launch-dominance", dataArr, {
        
      radius: 550,
      bandDeg: 90,
      capReveal: 180,
      gapPx: 28
    });

    viz.setTransform(500, -100, 1.0);



  });
}

