// ---- congestion-risk.js ----
// Minimal orbit visualizer that draws satellite orbits as ellipses
// using perigee/apogee (km) and rotates by inclination (degrees).

class Congestion {
    /**
     * @param {string} hostId                   Container element id
     * @param {Array<Object>} data              Rows with keys: 'perigee_(km)', 'apogee_(km)', 'inclination_(degrees)', 'class_of_orbit'
     * @param {Array<Object>} dataCondensed     Data condensed into 4 categories
     * @param {integer>} state                  State of the visualization

     */
    constructor(hostId, data, condensed) {
        this.host = d3.select('#' + hostId);
        this.node = this.host.node();
        this.data = data || [];
        this.dataCondensed = condensed;

        // dimensions
        const box = this.node.getBoundingClientRect();
        this.width = Math.max(320, Math.floor(box.width || 900));
        this.height = Math.max(320, Math.floor(box.height || 600));

        // color scale for orbit classes
        this.colorScale = d3.scaleOrdinal()
            .domain(["LEO", "MEO", "GEO", "Elliptical"])
            .range(['#22ff00ff', '#05d4fdff', '#f80cccff', '#fbff2cff']);

        //sets current state to 0
        this.state = 0;

        // responsive
        if (window.ResizeObserver) {
            this._ro = new ResizeObserver(() => this.resize());
            this._ro.observe(this.node);
        }
        window.addEventListener('resize', () => this.resize());
    }

    initVis() {
        const vis = this;

        // Create the main SVG
        vis.svg = vis.host.append('svg')
            .attr('class', 'congestion-svg')
            .attr('width', vis.width)
            .attr('height', vis.height);



        // Globe Projection
        vis.projection = d3.geoOrthographic()
            .scale(vis.height / 7)
            .translate([vis.width / 2, vis.height / 2])
            .clipAngle(90);

        vis.path = d3.geoPath(vis.projection);


        // Background Sphere
        vis.svg.append("circle")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", vis.projection.scale())
            .attr("fill", "#1a69b9ff");

        // Load World Map 
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
            const countries = topojson.feature(worldData, worldData.objects.countries);

            vis.land = vis.svg.append("g").selectAll("path")
                .data(countries.features)
                .enter().append("path")
                .attr("fill", "#38ad30ff")
                .attr("stroke", "#38ad30ff")
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
        // Orbit Layer (empty for now) 
        vis.orbitLayer = vis.svg.append('g')
            .attr('class', 'orbits');

        // scale distances to pixels based on max apogee
        const maxApogee = d3.max(vis.data, d => +d['apogee_(km)'] || 0) || 1;
        const maxRadius = Math.min(vis.width, vis.height) / 2 * 0.95;

        vis.scale = d3.scaleLinear()
            .domain([0, maxApogee])
            .range([0, maxRadius]);
        
        
        // Create scales for condensed view - where stroke width indicates satellite value
        vis.cScale = d3.scaleLinear()
                        .domain(d3.extent(vis.dataCondensed, d => d.count))
                        .range([4,10]);
        
        const earthRadius = vis.projection.scale();
        vis.orbitScale = d3.scaleOrdinal()
                            .domain(["LEO", "MEO", "GEO", "Elliptical"])
                            .range([earthRadius*1.2,earthRadius*1.4,earthRadius*1.6,earthRadius*1.8]);
        
        // Sort the data
        vis.dataCondensed = vis.dataCondensed.sort((a, b) => {
                // Sort by orbitScale value, descending (largest radius first)
                return vis.orbitScale(b.orbit_class) - vis.orbitScale(a.orbit_class);
            });

        
        // Show the color legend
        vis.legend = vis.svg.append("g")
                        .attr("class", "legend");
        vis.legend.selectAll("rect")
                    .data(vis.colorScale.domain())
                    .enter()
                    .append("rect")
                    .attr("x",0)
                    .attr("y", (d,i)=> i*25)
                    .attr("width", 20)
                    .attr("height", 20)
                    .style("fill", d=> this.colorScale(d));

        vis.legend.selectAll("text")
                    .data(vis.colorScale.domain())
                    .enter()
                    .append("text")
                    .attr("class", "legend_text")
                    .attr("x", 30)
                    .attr("y", (d,i) => i*25 + 15)
                    .text(d=>d);
        
        // Add a button to change states
        vis.button = vis.svg.append("g")
                            .attr("class", "svg-button")
                            .attr("transform", `translate(${vis.width/2-80}, 0)`)
                            .style("cursor", "pointer")
                             .on("click",function(){
                                // Get the text of the button
                                let txt = d3.select(this).select(".buttonText").text();
                                
                                // Depending on current text, change state
                                if (txt === "Full View"){
                                    d3.select(this).select(".buttonText").text("Simplify");
                                    vis.state = 0;
                                }
                                else{
                                     d3.select(this).select(".buttonText").text("Full View");
                                     vis.state = 1;
                                }

                                vis.removeOrbits();
                            

                             });
        vis.button.append("rect")
                .attr("class", "buttonBox")
                .attr("width", 140)
                .attr("height", 40)
                ;

        vis.button.append("text")
                .attr("class", "buttonText")
                .attr("x", 20)
                .attr("y", 25)
                .text("Simplify Me");

        

        // Call updateVis to draw orbits
        vis.updateVis();
    }

    // Transition out the orbits
    removeOrbits(){
         const vis = this
           const orbits = vis.svg.selectAll(".orbit");
           let remaining = orbits.size();

           if (remaining ===0){
            vis.updateVis();
            return;
           }

           orbits.transition()
           .duration(500)
           .style("opacity", 0)
           .on("end", ()=>{
                remaining--;
                if (remaining ===0 ) {
                    vis.updateVis();}
            })
            .remove();

        

    }

    updateVis() {
        const vis = this;
        if(vis.state === 1){
            const orbits = vis.orbitLayer.selectAll('.orbit')
                            .data(vis.dataCondensed);
            
            // Enter and merge
            orbits.enter().append('circle')
                            .merge(orbits)
                            .attr('cx', vis.width/2)
                            .attr('cy', vis.height/2)
                            .attr('r',(d,i)=>{
                                return vis.orbitScale(d.orbit_class);
                            })
                            .attr('class', 'orbit')
                            .attr('fill', 'none')
                            .attr('stroke', d => vis.colorScale(d.orbit_class))
                            .attr('stroke-width', d=>{
                                return vis.cScale(d.count);
                            });

             //Remove unused orbits   
             orbits.exit().remove();


        }

        if (vis.state === 0){
        // DATA JOIN
        const orbits = vis.orbitLayer.selectAll('.orbit')
            .data(vis.data, d => d.norad_number || d['current_official_name_of_satellite'] || Math.random());

        // ENTER
        const orbitsEnter = orbits.enter().append('ellipse')
            .attr('class', 'orbit')
            .attr('fill', 'none')
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.9);

        // ENTER + UPDATE
        orbitsEnter.merge(orbits)
            .attr('cx', vis.width / 2)
            .attr('cy', vis.height / 2)
            .attr('rx', d => {
                const ap = vis.scale(+d['apogee_(km)'] || 0) + 5;
                const pe = vis.scale(+d['perigee_(km)'] || 0) + 5;
                return (ap + pe) / 2 + vis.projection.scale(); // semi-major axis
            })
            .attr('ry', d => {
                const ap = vis.scale(+d['apogee_(km)'] || 0) + 5;
                const pe = vis.scale(+d['perigee_(km)'] || 0) + 5;
                const a = (ap + pe) / 2;
                const c = (ap - pe) / 2;
                return Math.sqrt(Math.max(1, a * a - c * c)) + vis.projection.scale(); // semi-minor axis
            })
            .attr('transform', d => `rotate(${+d['inclination_(degrees)'] || 0}, ${vis.width / 2}, ${vis.height / 2})`)
            .attr('stroke', d => vis.colorScale(d.class_of_orbit));

        // EXIT
        orbits.exit().remove();

        }
        else{

        }

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



    
    }
}