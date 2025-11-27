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
            .range(['#00d4ff', '#5fa8d3', '#7b2cbf', '#ff006e']);

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
            .scale(vis.height/5)
            .translate([vis.width / 2, vis.height / 2])
            .clipAngle(90);

        vis.path = d3.geoPath(vis.projection);


        // Background Sphere
        vis.svg.append("circle")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", vis.projection.scale())
            .attr("fill", "#1b4965");

        // Load World Map 
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
            const countries = topojson.feature(worldData, worldData.objects.countries);

            vis.land = vis.svg.append("g").selectAll("path")
                .data(countries.features)
                .enter().append("path")
                .attr("fill", "#2a9d8f")
                .attr("stroke", "#264653")
                .attr("stroke-width", 0.3);

            //  Rotation Animation 
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

        // Satellite Layer (for moving satellites)
        vis.satelliteLayer = vis.svg.append('g')
            .attr('class', 'satellites');

        // Add defs for satellite image
        vis.defs = vis.svg.append("defs");
        
        vis.defs.append("pattern")
            .attr("id", "satellite-icon")
            .attr("width", 1)
            .attr("height", 1)
            .attr("patternContentUnits", "objectBoundingBox")
            .append("image")
            .attr("xlink:href", "images/satellite.png")
            .attr("width", 1)
            .attr("height", 1)
            .attr("preserveAspectRatio", "xMidYMid slice");

        // Initialize satellite animation data
        vis.satelliteData = [];
        vis.satelliteAnimationTimer = null;

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

        vis.legend.append("text")
                    .attr("x", 0)
                    .attr("y", 10)
                    .attr("class", "legend_title")
                    .text("Orbit Class")
                    .style("fill", "white");
        
        vis.legend.selectAll("rect")
                    .data(vis.colorScale.domain())
                    .enter()
                    .append("rect")
                    .attr("x",0)
                    .attr("y", (d,i)=> i*25 + 30)
                    .attr("width", 20)
                    .attr("height", 20)
                    .style("fill", d=> this.colorScale(d));

        vis.legend.selectAll("legend_text")
                    .data(vis.colorScale.domain())
                    .enter()
                    .append("text")
                    .attr("class", "legend_text")
                    .attr("x", 30)
                    .attr("y", (d,i) => i*25 + 45)
                    .text(d=>d);

        // Add tooltips
        vis.tooltip = d3.select("body").append("div")
                            .style("opacity", 0)
                            .attr("class", "tooltip");        
        // Add annotation
        vis.annotation = vis.svg.append("g")
                                .attr("class", "annotation")
                                .attr("transform", `translate(${150}, 0)`);
        
        vis.annotation.append("rect")
                        .attr("class", "label_box")
                        .attr("x",0)
                        .attr("y",0)
                        .attr("width", 950) 
                        .attr("height",40);
        
        vis.annotation.append("text")
                        .attr("class", "annotation")
                        .text("Each orbital layer's thickness indicates the density of satellites within that orbital region.")
                        .style("fill", "white")
                        .attr("x", 30)
                        .attr("y", 25);
        
        vis.annotation.style("opacity", 0);
        

        
        // Add a button to change states
        vis.button = vis.svg.append("g")
                            .attr("class", "svg-button")
                            .attr("transform", `translate(${vis.width-200}, ${vis.height/2-80})`)
                            .style("cursor", "pointer")
                             .on("click",function(){
                                // Get the text of the button
                                let txt = d3.select(this).select(".buttonText").text();
                                
                                // Depending on current text, change state
                                if (txt === "Full View"){
                                    d3.select(this).select(".buttonText").text("Simplify");
                                    vis.state = 0;
                                    vis.annotation.transition()
                                                .duration(500) 
                                                .delay(500)
                                                .style("opacity", 0);
                                }
                                else{
                                     d3.select(this).select(".buttonText").text("Full View");
                                    vis.annotation.transition()
                                                .duration(500) 
                                                .delay(500)
                                                .style("opacity", 1);

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
                            .data(vis.dataCondensed, d=> d.orbit_class);
            
            // Enter and merge
            orbits.enter().append('circle')
                            .merge(orbits)
                            .attr('cx', (d)=>{
                                console.log(vis.width)
                                return vis.width/2;
                            })
                            .attr('cy', (d) =>{
                                console.log(vis.height)
                                return vis.height/2;

                            })
                            .attr('r',(d,i)=>{
                                return vis.orbitScale(d.orbit_class);
                            })
                            .attr('class', 'orbit')
                            .attr('fill', 'none')
                            .attr('stroke', d => vis.colorScale(d.orbit_class))
                            .attr('stroke-width', d=>{
                                return vis.cScale(d.count);
                            })
                            .on("mouseover", (event, d) =>{
                                    vis.tooltip
                                                .style("opacity", 1)
                                                .text(`Satellites in Orbit Layer ${d.orbit_class}: ${d.count}`)
                                                .style("left", (event.pageX ) + "px")
                                                .style("top", (event.pageY) + "px");
                            })
                            .on("mouseleave", ()=>{
                                vis.tooltip.style("opacity",0)
                                    .text("")
                            }) 
                            ;
            
            orbits.order();
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
                const ap = vis.scale(+d['apogee_(km)'] || 0) + 15;
                const pe = vis.scale(+d['perigee_(km)'] || 0) + 15;
                return (ap + pe) / 2 + vis.projection.scale(); // semi-major axis
            })
            .attr('ry', d => {
                const ap = vis.scale(+d['apogee_(km)'] || 0) + 15;
                const pe = vis.scale(+d['perigee_(km)'] || 0) + 15;
                const a = (ap + pe) / 2;
                const c = (ap - pe) / 2;
                return Math.sqrt(Math.max(1, a * a - c * c)) + vis.projection.scale(); // semi-minor axis
            })
            .attr('transform', d => `rotate(${+d['inclination_(degrees)'] || 0}, ${vis.width / 2}, ${vis.height / 2})`)
            .attr('stroke', d => vis.colorScale(d.class_of_orbit))
            .on("mouseover", (event, d) =>{
                vis.tooltip
                            .style("opacity", 1)
                            .text(`${d.current_official_name_of_satellite}`)
                            .style("left", (event.pageX ) + "px")
                            .style("top", (event.pageY) + "px");
            })
            .on("mouseleave", ()=>{
                vis.tooltip.style("opacity",0)
                    .text("")
            }) 
            ;

        // EXIT
        orbits.exit().remove();

        }

        // Start satellite animation if in full view mode
        if (vis.state === 0) {
            vis.animateSatellites();
        } else {
            vis.stopSatelliteAnimation();
        }

    }

    animateSatellites() {
        const vis = this;
        
        // Stop existing animation if any
        if (vis.satelliteAnimationTimer) {
            vis.satelliteAnimationTimer.stop();
        }

        // Sample satellites from the data (limit to ~100 for performance, prioritize elliptical)
        const sampleSize = Math.min(60, vis.data.length);
        const sampledData = [];
        
        // First, get all elliptical orbit satellites
        const ellipticalSats = vis.data.filter(d => d.class_of_orbit === "Elliptical");
        const otherSats = vis.data.filter(d => d.class_of_orbit !== "Elliptical");
        
        // Take more elliptical satellites to make them visible
        const ellipticalSampleSize = Math.min(ellipticalSats.length);
        const otherSampleSize = sampleSize - ellipticalSampleSize;
        
        const ellipticalStep = Math.max(1, Math.floor(ellipticalSats.length / ellipticalSampleSize));
        const otherStep = Math.max(1, Math.floor(otherSats.length / otherSampleSize));
        
        // Add elliptical satellites
        for (let i = 0; i < ellipticalSats.length && sampledData.length < ellipticalSampleSize; i += ellipticalStep) {
                const sat = ellipticalSats[i];
                // Calculate ellipse parameters
                const ap = vis.scale(+sat['apogee_(km)'] || 0) + 15;
                const pe = vis.scale(+sat['perigee_(km)'] || 0) + 15;
                const a = (ap + pe) / 2; // semi-major axis
                const c = (ap - pe) / 2; // distance from center to focus
                const b = Math.sqrt(Math.max(1, a * a - c * c)); // semi-minor axis
                
                // Speed based on power - normalize to reasonable rotation speed
                const power = +sat['power_(watts)'] || 100;
                const speed = (power / 1000) * 0.01; // Adjust multiplier for visible movement
                
                sampledData.push({
                    ...sat,
                    rx: a + vis.projection.scale(), // semi-major axis with earth radius
                    ry: b + vis.projection.scale(), // semi-minor axis with earth radius
                    angle: Math.random() * Math.PI * 2, // Random starting position
                    speed: speed,
                    inclination: +sat['inclination_(degrees)'] || 0
                });
        }
        
        // Add other satellites
        for (let i = 0; i < otherSats.length && sampledData.length < sampleSize; i += otherStep) {
                const sat = otherSats[i];
                // Calculate ellipse parameters
                const ap = vis.scale(+sat['apogee_(km)'] || 0) + 15;
                const pe = vis.scale(+sat['perigee_(km)'] || 0) + 15;
                const a = (ap + pe) / 2; // semi-major axis
                const c = (ap - pe) / 2; // distance from center to focus
                const b = Math.sqrt(Math.max(1, a * a - c * c)); // semi-minor axis
                
                // Speed based on power - normalize to reasonable rotation speed
                const power = +sat['power_(watts)'] || 100;
                const speed = (power / 1000) * 0.01; // Adjust multiplier for visible movement
                
                sampledData.push({
                    ...sat,
                    rx: a + vis.projection.scale(), // semi-major axis with earth radius
                    ry: b + vis.projection.scale(), // semi-minor axis with earth radius
                    angle: Math.random() * Math.PI * 2, // Random starting position
                    speed: speed,
                    inclination: +sat['inclination_(degrees)'] || 0
                });
        }
        
        vis.satelliteData = sampledData;
        
        console.log(`Creating ${sampledData.length} satellites in animation`);
        
        // Create satellite elements - using images
        const satellites = vis.satelliteLayer.selectAll('.satellite')
            .data(vis.satelliteData);
        
        satellites.enter()
            .append('image')
            .attr('class', 'satellite')
            .attr('xlink:href', 'images/satellite.png')
            .attr('width', d => d.class_of_orbit === 'Elliptical' ? 16 : 12)
            .attr('height', d => d.class_of_orbit === 'Elliptical' ? 16 : 12)
            .merge(satellites)
            .attr('x', d => vis.width / 2 + d.rx * Math.cos(d.angle) - (d.class_of_orbit === 'Elliptical' ? 8 : 6))
            .attr('y', d => vis.height / 2 + d.ry * Math.sin(d.angle) - (d.class_of_orbit === 'Elliptical' ? 8 : 6))
            .attr('transform', d => {
                // Calculate current position
                const x = vis.width / 2 + d.rx * Math.cos(d.angle);
                const y = vis.height / 2 + d.ry * Math.sin(d.angle);
                // Rotate around the center of the visualization
                return `rotate(${d.inclination}, ${vis.width / 2}, ${vis.height / 2})`;
            })
            .style('opacity', d => d.class_of_orbit === 'Elliptical' ? 1.0 : 0.9)
            .on("mouseover", (event, d) =>{
                vis.tooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.current_official_name_of_satellite}</strong><br/>Power: ${d['power_(watts)']}W<br/>Orbit: ${d.class_of_orbit}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseleave", ()=>{
                vis.tooltip.style("opacity",0)
                    .html("")
            });
        
        satellites.exit().remove();
        
        // Animate satellites
        vis.satelliteAnimationTimer = d3.timer(() => {
            vis.satelliteData.forEach(d => {
                d.angle += d.speed;
                if (d.angle > Math.PI * 2) d.angle -= Math.PI * 2;
            });
            
            vis.satelliteLayer.selectAll('.satellite')
                .attr('x', d => vis.width / 2 + d.rx * Math.cos(d.angle) - (d.class_of_orbit === 'Elliptical' ? 8 : 6))
                .attr('y', d => vis.height / 2 + d.ry * Math.sin(d.angle) - (d.class_of_orbit === 'Elliptical' ? 8 : 6));
        });
    }

    stopSatelliteAnimation() {
        const vis = this;
        if (vis.satelliteAnimationTimer) {
            vis.satelliteAnimationTimer.stop();
            vis.satelliteAnimationTimer = null;
        }
        vis.satelliteLayer.selectAll('.satellite').remove();
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

        // Reposition the globe
        vis.projection
            .translate([vis.width / 2, vis.height / 2])
            .scale(vis.height/5);
        
        // Reposition the background Earth
        vis.svg.selectAll("circle")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", vis.projection.scale());
        
        // Make annotation box responsive
        vis.annotation.attr("transform", `translate(${vis.width * 0.15}, ${vis.height * 0.05})`);
        vis.annotation.select("rect")
            .attr("width", vis.width * 0.8)
            .attr("height", 40);

        vis.annotation.select("text")
            .attr("x", 30)
            .attr("y", 25)
            .style("font-size", `${Math.max(7, vis.width / 80)}px`);

        // Move and resize the button dynamically
        const buttonWidth = vis.width * 0.15;   // 15% of width
        const buttonHeight = Math.max(30, vis.height * 0.06); // scale with height
        const buttonX = vis.width - buttonWidth - 40; // 40px padding from right
        const buttonY = vis.height / 2 - buttonHeight / 2;

        vis.button.select("rect.buttonBox")
                    .attr("width", buttonWidth)
                    .attr("height", buttonHeight);

        vis.button.select("text.buttonText")
                    .attr("x", buttonWidth / 2)
                    .attr("y", buttonHeight / 2 + 5)
                    .attr("text-anchor", "middle")
                    .style("font-size", `${Math.max(7, vis.width / 55)}px`)

        vis.button.attr("transform", `translate(${buttonX}, ${buttonY})`);
        vis.updateVis();



    
    }
}