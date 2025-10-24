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

        //Scales
        // Get the max apogee since it's the furthest point from Earth
        let maxApogee = d3.max(vis.data, d=> d.apogee_(km))
        vis.scale = d3.scaleLinear()
                        .domain([0, maxApogee])
                        .range([0, Math.min(vis.width, vis.height)/2]) // Range is due to rotation
        
        //Color Scale
        let colors = ['#a6cee3','#e31a1c','#f6ff00ff','#cab2d6'];
            // Set ordinal color scale
        vis.colorScale = d3.scaleOrdinal()
        .domain(["LEO", "GEO", "MEO", "Elliptical"])
        .range(colorArray);


        vis.updateVis();
    }

    updateVis(){
        vis = this;

        let orbits = vis.svg.selectAll("orbit")
                        .data(vis.data);
        
        orbits.enter().append("ellipse")
            .attr("class", "orbit")
            .merge(orbits)
            .attr("cx", d=>{
                // Convert to pixel values
                const apogee_px = vis.scale(d.apogee_(km));
                const perigee_px = vis.scale(d.perigee(km));

                //Find the focal point (i.e. center of the orbit)
                const c = (apogee_px - perigee_px) / 2;

                // Find the difference between the center of the orbit and center of Earth
                return Math.abs(vis.width/2 - c)

            })
            .attr("cy", vis.height/2)
            .attr("rx",d=>{
                // Need the semi major axis
                const apogee_px = vis.scale(d.apogee_(km));
                const perigee_px = vis.scale(d.perigee(km));
                return (apogee_px + perigee_px) / 2;

            })
            .attr("ry", d=>{
                // Need semi minor axis
                const apogee_px = vis.scale(d.apogee_(km));
                const perigee_px = vis.scale(d.perigee(km));
                const a_px = (apogee_px + perigee_px) / 2;
                const c_px = (apogee_px - perigee_px) / 2;

                const b_px_squared = Math.pow(a_px, 2) - Math.pow(c_px, 2);
                return Math.sqrt(Math.max(0, b_px_squared));

            })
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("transform", d =>{
                return `rotate(${d.inclination_(degrees)}, ${vis.width/2}, ${vis.height/2})`;
            })
            .attr("stroke", d=>{
                return vis.colorScale(d.class_of_orbit)
            });

            orbits.exit().remove();


    }
}
