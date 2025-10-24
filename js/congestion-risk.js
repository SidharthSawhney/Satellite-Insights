/*
 * @param  parentElement 	-- the HTML element in which to draw the visualization
 * @param  data             -- the data that's provided initially
 */

class Congestion {

    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data;
        console.log("reached")

    }

    initVis() {
        let vis = this;

        // Margins and dimensions
        vis.margin = { top: 40, right: 40, bottom: 60, left: 40 };

        vis.width =
            document.getElementById(vis.parentElement).getBoundingClientRect().width -
            vis.margin.left - vis.margin.right;
        vis.height =
            document.getElementById(vis.parentElement).getBoundingClientRect().height -
            vis.margin.top - vis.margin.bottom;

        console.log(vis.height);

        // SVG drawing area
        vis.svg = d3.select("#" + vis.parentElement)
            .append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

        // --- Globe Setup ---
        const projection = d3.geoOrthographic()
            .scale(vis.height / 2.5)
            .translate([vis.width / 2, vis.height / 2])
            .clipAngle(90);

        const path = d3.geoPath(projection);

        // Add a background sphere (ocean)
        vis.svg.append("circle")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", projection.scale())
            .attr("fill", "#003366");

        // Load world map data
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
            const countries = topojson.feature(worldData, worldData.objects.countries);

            const globe = vis.svg.append("g");

            // Draw countries
            const land = globe.selectAll("path")
                .data(countries.features)
                .enter()
                .append("path")
                .attr("fill", "#1e8fffb2")
                .attr("stroke", "#000")
                .attr("stroke-width", 0.3);

            // Rotation speed
            const velocity = 0.15; // degrees per frame
            let rotation = [0, -10]; // [longitude, latitude]

            d3.timer(function () {
                rotation[0] += velocity;
                projection.rotate(rotation);
                land.attr("d", path);
            });
        });
    }
}
