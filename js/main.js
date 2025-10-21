let SatelliteExplosion, GovVsCom, LaunchDominance, CongestionRisk;

loadData();

function loadData() {

    d3.json("data/consumer_internal_external.json").then(jsonData => {
        const externalData = jsonData.external;
        const internalData = jsonData.internal;

        satelliteExplosion = new SatelliteExplosion("satellite-explosion", externalData);
        govVsCom = new GovVsCom("gov-vs-com", internalData, externalData);
        // window.countryPanel = countryPanel;
        lauchDominance = new LaunchDominance("launch-dominance");
        congestionRisk = new CongestionRisk("congestion-risk", externalData);


        satelliteExplosion.initVis();
        govVsCom.initVis();
        lauchDominance.initVis();
        congestionRisk.initVis();

    });
}

// function yearUpdate(year) {
//     d3.select('#main-title').text("World Gold Consumer Demand in " + year);
    
//     if (worldMap) {
//         worldMap.updateYear(year);
//     }
    
//     if (countryPanel && countryPanel.selectedCountry) {
//         countryPanel.updateCountry(countryPanel.selectedCountry, year);
//     }
// }