// ---- congestion-risk.js ----
// Minimal orbit visualizer that draws satellite orbits as ellipses
// using perigee/apogee (km) and rotates by inclination (degrees).

class Congestion {
    /**
     * @param {string} hostId            Container element id
     * @param {Array<Object>} data       Rows with keys: 'perigee_(km)', 'apogee_(km)', 'inclination_(degrees)', 'class_of_orbit'
     */
    constructor(hostId, data) {
        this.host = d3.select('#' + hostId);
        this.node = this.host.node();
        this.data = data || [];

        // dimensions
        const box = this.node.getBoundingClientRect();
        this.width = Math.max(320, Math.floor(box.width || 900));
        this.height = Math.max(320, Math.floor(box.height || 600));

        // color scale for orbit classes
        this.colorScale = d3.scaleOrdinal()
            .domain(["LEO", "MEO", "GEO", "Elliptical"])
            .range(['#a6cee3', '#cab2d6', '#f6ff00', '#e31a1c']);

        // responsive
        if (window.ResizeObserver) {
            this._ro = new ResizeObserver(() => this.resize());
            this._ro.observe(this.node);
        }
        window.addEventListener('resize', () => this.resize());
    }

    initVis() {
        const vis = this;

        // === Create the main SVG ===
        vis.svg = vis.host.append('svg')
            .attr('class', 'congestion-svg')
            .attr('width', vis.width)
            .attr('height', vis.height);



        // === Globe Projection ===
        vis.projection = d3.geoOrthographic()
            .scale(vis.height / 7)
            .translate([vis.width / 2, vis.height / 2])
            .clipAngle(90);

        vis.path = d3.geoPath(vis.projection);


        // === Background Sphere ===
        vis.svg.append("circle")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", vis.projection.scale())
            .attr("fill", "#003366");

        // === Load World Map ===
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
            const countries = topojson.feature(worldData, worldData.objects.countries);

            vis.land = vis.svg.append("g").selectAll("path")
                .data(countries.features)
                .enter().append("path")
                .attr("fill", "#1E90FF")
                .attr("stroke", "#000")
                .attr("stroke-width", 0.3);

            // === Rotation Animation ===
            vis.rotation = [0, -10]; // initial [lambda, phi]
            vis.velocity = 0.35; // degrees per frame

            d3.timer(function() {
                vis.rotation[0] += vis.velocity;
                vis.projection.rotate(vis.rotation);
                vis.land.attr("d", vis.path);
            });
        });
        // === Orbit Layer (empty for now) ===
        vis.orbitLayer = vis.svg.append('g')
            .attr('class', 'orbits');


        // === Call updateVis to draw orbits ===
        vis.updateVis();
    }

    updateVis() {
        const vis = this;

        // scale distances to pixels based on max apogee
        const maxApogee = d3.max(vis.data, d => +d['apogee_(km)'] || 0) || 1;
        const maxRadius = Math.min(vis.width, vis.height) / 2 * 0.95;

        vis.scale = d3.scaleLinear()
            .domain([0, maxApogee])
            .range([0, maxRadius]);

        // DATA JOIN
        const orbits = vis.orbitLayer.selectAll('.orbit')
            .data(vis.data, d => d.norad_number || d['current_official_name_of_satellite'] || Math.random());

        // ENTER
        const orbitsEnter = orbits.enter().append('ellipse')
            .attr('class', 'orbit')
            .attr('fill', 'none')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.9);

        // ENTER + UPDATE
        orbitsEnter.merge(orbits)
            .attr('cx', vis.width / 2)
            .attr('cy', vis.height / 2)
            .attr('rx', d => {
                const ap = vis.scale(+d['apogee_(km)'] || 0);
                const pe = vis.scale(+d['perigee_(km)'] || 0);
                return (ap + pe) / 2; // semi-major axis
            })
            .attr('ry', d => {
                const ap = vis.scale(+d['apogee_(km)'] || 0);
                const pe = vis.scale(+d['perigee_(km)'] || 0);
                const a = (ap + pe) / 2;
                const c = (ap - pe) / 2;
                return Math.sqrt(Math.max(0, a * a - c * c)); // semi-minor axis
            })
            .attr('transform', d => `rotate(${+d['inclination_(degrees)'] || 0}, ${vis.width / 2}, ${vis.height / 2})`)
            .attr('stroke', d => vis.colorScale(d.class_of_orbit));

        // EXIT
        orbits.exit().remove();
    }

    resize() {
        const vis = this;
        const box = vis.node.getBoundingClientRect();
        vis.width = Math.max(320, Math.floor(box.width));
        vis.height = Math.max(320, Math.floor(box.height));

        if (vis.svg) {
            vis.svg.attr('width', vis.width).attr('height', vis.height);
        }

        if (vis.earth) {
            vis.earth.attr('cx', vis.width / 2).attr('cy', vis.height / 2);
        }

        vis.updateVis();



        
        vis.updateVis();

    }
}
