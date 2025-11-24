/* =====================================================
   launch-metrics.js
   Scatter plot for Launch Metrics Visualization
   ===================================================== */

class LaunchMetrics {
    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data;
        this.displayData = [];
        
        // State to track current view: 'mass-power' or 'time-power'
        this.viewState = 'mass-power'; 
        
        // State to track selected legend category (color string)
        this.selectedFilter = null;

        // Configuration and dimensions
        this.config = {
            margin: { top: 80, right: 150, bottom: 100, left: 80 }, // Increased bottom margin for annotation
            tooltipPadding: 15,
            minRadius: 2,
            maxRadius: 50, 
            legendRectSize: 18,
            legendSpacing: 4
        };
        
        this.initVis();
    }

    /**
     * Initialize visualization (static elements)
     */
    initVis() {
        let vis = this;

        // Get the container element
        vis.container = d3.select('#' + vis.parentElement);
        
        // Ensure container is relative for absolute positioning of the title
        vis.container.style('position', 'relative');

        // --- 1. CREATE CUSTOM HTML TITLE ---
        vis.htmlTitle = vis.container.append('div')
            .attr('class', 'custom-chart-title')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '50%')
            .style('transform', 'translateX(-50%)')
            .style('color', '#5fa8d3')
            .style('text-align', 'center') 
            .style('font-family', "'Courier New', monospace")
            .style('font-size', '23px')
            .style('font-weight', 'bold')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.05em')
            .style('text-shadow', '0 0 10px rgba(0, 102, 166, 0.5)')
            .style('width', '350px')
            .style('pointer-events', 'none'); 

        // Calculate dimensions
        vis.width = vis.container.node().getBoundingClientRect().width - vis.config.margin.left - vis.config.margin.right;
        vis.height = 600 - vis.config.margin.top - vis.config.margin.bottom; 

        // Create SVG element
        vis.svg = vis.container.append('svg')
            .attr('width', vis.width + vis.config.margin.left + vis.config.margin.right)
            .attr('height', vis.height + vis.config.margin.top + vis.config.margin.bottom);

        // Create chart group
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Initialize scales
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        // Y-Axis: Linear scale
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Radius Scale
        vis.rScale = d3.scaleLinear()
            .range([vis.config.minRadius, vis.config.maxRadius]);

        // Color Scale
        vis.colorScale = d3.scaleQuantile();

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format("d")); 
            
        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(10, "~s"); 

        // Append axis groups
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`)
            .style('font-family', "'Courier New', monospace"); 

        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis')
            .style('font-family', "'Courier New', monospace"); 

        // X-Axis Label
        vis.xAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', (vis.width / 2) + vis.config.margin.left) 
            .attr('y', vis.height + vis.config.margin.top + 50) 
            .attr('text-anchor', 'middle')
            .style('font-family', "'Courier New', monospace") 
            .style('fill', '#5fa8d3'); 

        // Y-Axis Label
        vis.yAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(vis.height / 2) - vis.config.margin.top)
            .attr('y', vis.config.margin.left / 3)
            .attr('text-anchor', 'middle')
            .style('font-family', "'Courier New', monospace") 
            .style('fill', '#5fa8d3') 
            .text('Average Power (Watts)');

        // Legend Group
        vis.legend = vis.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${vis.width + 20}, 20)`)
            .style('font-family', "'Courier New', monospace");

        // --- 2. REPOSITION TOGGLE BUTTON (BELOW LEGEND) ---
        // We position this absolutely relative to the container.
        // Since the legend is on the right, we'll position the button on the right too.
        // An approximate 'top' value creates space below the legend.
        vis.buttonContainer = vis.container.append('div')
            .style('position', 'absolute')
            .style('top', '180px') // Adjusted to be below the legend
            .style('right', '40px') // Aligned to the right side
            .style('z-index', '10');

        vis.toggleButton = vis.buttonContainer.append('button')
            .attr('id', 'view-toggle-btn')
            .text('Switch View') 
            .style('fill', 'rgba(10, 13, 14, 0.8)') 
            .style('background-color', 'rgba(10, 13, 14, 0.8)') 
            .style('color', '#fff') 
            .style('border', '2px solid #0066a6') 
            .style('filter', 'drop-shadow(0 0 5px rgba(0, 102, 166, 0.4))')
            .style('transition', 'all 0.3s ease')
            .style('font-family', "'Courier New', monospace") 
            .style('padding', '8px 16px')
            .style('cursor', 'pointer')
            .style('border-radius', '4px')
            .on('mouseover', function() {
                d3.select(this).style('background-color', 'rgba(20, 26, 28, 0.9)');
            })
            .on('mouseout', function() {
                d3.select(this).style('background-color', 'rgba(10, 13, 14, 0.8)');
            })
            .on('click', () => {
                vis.toggleView();
            });

        // --- 3. ADD ANNOTATION LINE BELOW X-AXIS LABEL ---
        // Using SVG text for precise positioning relative to the chart
        vis.annotation = vis.svg.append('text')
            .attr('class', 'chart-annotation')
            .attr('x', (vis.width / 2) + vis.config.margin.left)
            .attr('y', vis.height + vis.config.margin.top + 80) // Positioned below x-axis label
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', '#e0f0ff')
            .style('font-family', "'Courier New', monospace")
            .style('font-size', '16px')
            .style('font-weight', '500')
            .style('opacity', '0.7')
            .text('Source: Launch Dominance Data'); // Example text, as user didn't specify content

        // Tooltip: use the same class/style as launch dominance tooltip
        vis.tooltip = d3.select('body').append('div')
            .attr('class', 'launch-dom-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('pointer-events', 'none')
            .style('z-index', 2000);

        vis.wrangleData();
    }

    /**
     * Process Data
     */
    wrangleData() {
        let vis = this;

        // Filter data
        let filtered = vis.data.filter(d => 
            d.year && isFinite(d.year) &&
            d.avg_power_watts && isFinite(d.avg_power_watts) && d.avg_power_watts > 0 &&
            d.avg_launch_mass_kg && isFinite(d.avg_launch_mass_kg) && d.avg_launch_mass_kg > 0
        );
        
        // Create deep copy
        vis.displayData = filtered.map(d => ({
            ...d,
            year: +d.year,
            avg_power_watts: +d.avg_power_watts,
            avg_launch_mass_kg: +d.avg_launch_mass_kg
        }));

        // Sort by Mass DESCENDING
        vis.displayData.sort((a, b) => b.avg_launch_mass_kg - a.avg_launch_mass_kg);

        vis.updateVis();
    }

    /**
     * Switch the view state and update
     */
    toggleView() {
        let vis = this;
        vis.viewState = vis.viewState === 'mass-power' ? 'time-power' : 'mass-power';
        vis.updateVis();
    }

    /**
     * Update Visualization
     */
    updateVis() {
        let vis = this;
        const maxMass = d3.max(vis.displayData, d => d.avg_launch_mass_kg);
        const maxPower = d3.max(vis.displayData, d => d.avg_power_watts);
        
        // --- UPDATE COLOR SCALE ---
        const customColors = [
            "rgb(130, 230, 255)", 
            "rgb(119, 173, 255)", 
            "rgb(113, 116, 255)", 
            "rgb(157, 105, 255)"
        ];
        
        vis.colorScale
            .domain(vis.displayData.map(d => d.avg_launch_mass_kg))
            .range(customColors);

        // --- UPDATE LEGEND ---
        vis.legend.selectAll('*').remove();

        vis.legend.append('text')
            .attr('x', 0)
            .attr('y', -10)
            .style('font-weight', 'bold')
            .style('font-size', '12px')
            .style('font-family', "'Courier New', monospace")
            .style('fill', '#0066a6') 
            .text('Mass Category (Click to Filter)');

        const quantiles = vis.colorScale.quantiles();
        const rangeValues = [0, ...quantiles];

        const legendItems = vis.legend.selectAll('.legend-item')
            .data(rangeValues)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * (vis.config.legendRectSize + vis.config.legendSpacing)})`)
            .style('cursor', 'pointer')
            .on('click', function(event, d, i) {
                const index = rangeValues.indexOf(d);
                const clickedColor = customColors[index];

                if (vis.selectedFilter === clickedColor) {
                    vis.selectedFilter = null;
                } else {
                    vis.selectedFilter = clickedColor;
                }
                
                vis.updateVis();
            });

        legendItems.append('rect')
            .attr('width', vis.config.legendRectSize)
            .attr('height', vis.config.legendRectSize)
            .style('fill', (d, i) => customColors[i])
            .style('stroke', '#ccc')
            .style('stroke-width', (d, i) => {
                return vis.selectedFilter === customColors[i] ? 2 : 1;
            })
            .style('stroke', (d, i) => {
                return vis.selectedFilter === customColors[i] ? '#000' : '#ccc';
            })
            .style('opacity', (d, i) => {
                if (vis.selectedFilter && vis.selectedFilter !== customColors[i]) {
                    return 0.3;
                }
                return 1;
            });

        legendItems.append('text')
            .attr('x', vis.config.legendRectSize + 5)
            .attr('y', vis.config.legendRectSize - 4)
            .text((d, i) => {
                let start = d3.format(".2s")(d);
                let end = (i < quantiles.length) ? d3.format(".2s")(quantiles[i]) : 'Max';
                return i === rangeValues.length - 1 ? `> ${start}` : `${start} - ${end}`;
            })
            .style('font-size', '11px')
            .style('font-family', "'Courier New', monospace")
            .style('fill', '#e0f0ff') 
             .style('opacity', (d, i) => {
                if (vis.selectedFilter && vis.selectedFilter !== customColors[i]) {
                    return 0.3;
                }
                return 1;
            });


        if (vis.viewState === 'mass-power') {
            vis.xScale.domain([0, maxMass * 1.1]); 
            vis.xAxis.tickFormat(d3.format("~s")); 
            
            vis.htmlTitle.html('Launch Mass vs. Power');
            
            vis.xAxisLabel.text('Launch Mass (kg)');
            vis.toggleButton.text('Switch View'); 
            
            vis.annotation.text("The circle's radius corresponds to the rocket's launch mass.");
        } else {
            const yearPadding = 1;
            vis.xScale.domain([
                d3.min(vis.displayData, d => d.year) - yearPadding, 
                d3.max(vis.displayData, d => d.year) + yearPadding
            ]);
            vis.xAxis.tickFormat(d3.format("d")); 
            
            vis.htmlTitle.html('Power over Time View');
            
            vis.xAxisLabel.text('Time (Year)');
            vis.toggleButton.text('Switch View');
            
            vis.annotation.text("The circle's radius corresponds to the rocket's launch mass.");
        }

        // Shared Scales
        vis.yScale.domain([0, maxPower * 1.05]); 
        vis.rScale.domain([0, maxMass]);
        
        // --- FILTER DATA FOR DISPLAY ---
        let dataToRender = vis.displayData;
        if (vis.selectedFilter) {
            dataToRender = vis.displayData.filter(d => vis.colorScale(d.avg_launch_mass_kg) === vis.selectedFilter);
        }

        // 2. DATA JOIN
        const circles = vis.chart.selectAll('circle')
            .data(dataToRender, d => d.launch_vehicle + d.year);

        // Enter
        const circlesEnter = circles.enter().append('circle')
            .attr('class', 'data-point')
            .attr('r', 0) 
            .style('fill-opacity', 0.9)
            .style('stroke', '#03045e') 
            .style('stroke-width', 0.6) 
            .style('cursor', 'pointer');

        // Exit
        circles.exit()
            .transition().duration(500)
            .attr('r', 0)
            .remove();

        // Merge
        const circlesUpdate = circlesEnter.merge(circles);

        // RE-ORDER: Smallest on top
        circlesUpdate.order();

        // 3. UPDATE POSITIONS & STYLES
        circlesUpdate
            .transition().duration(1000)
            .attr('cx', d => {
                if (vis.viewState === 'mass-power') {
                    return vis.xScale(d.avg_launch_mass_kg);
                } else {
                    return vis.xScale(d.year);
                }
            })
            .attr('cy', d => vis.yScale(d.avg_power_watts))
            .attr('r', d => vis.rScale(d.avg_launch_mass_kg))
            .style('fill', d => vis.colorScale(d.avg_launch_mass_kg));

        // 4. EVENTS (Hover effects)
        circlesUpdate
            .on('mouseover', function(event, d) { 
                d3.select(this).raise(); // Bring to front
                
                d3.select(this)
                    .interrupt()
                    .transition().duration(150)
                    .style('stroke', '#000') 
                    .style('stroke-width', 1.5); 

                vis.tooltip.style('visibility', 'visible')
                    .html(`
                        <div style="margin-bottom: 5px;"><strong style="color: ${vis.colorScale(d.avg_launch_mass_kg)};">${d.launch_vehicle}</strong></div>
                        <div style="margin-bottom: 3px;"><span style="color: #778da9;">Time:</span> ${d.year}</div>
                        <div style="margin-bottom: 3px;"><span style="color: #778da9;">Power:</span> ${d3.format(',.0f')(d.avg_power_watts)} Watts</div>
                        <div><span style="color: #778da9;">Mass:</span> ${d3.format(',.0f')(d.avg_launch_mass_kg)} kg</div>
                    `);
            })
            .on('mousemove', (event) => {
                vis.tooltip
                    .style('top', (event.pageY - vis.config.tooltipPadding - 10) + 'px') 
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px');
            })
            .on('mouseleave', function(event, d) {
                d3.select(this)
                    .interrupt()
                    .transition().duration(150)
                    .style('stroke', '#03045e') 
                    .style('stroke-width', 0.6); 

                vis.tooltip.style('visibility', 'hidden');

                // Restore Z-index order
                vis.chart.selectAll('.data-point')
                   .sort((a, b) => b.avg_launch_mass_kg - a.avg_launch_mass_kg);
            });

        // Reorder circles in the DOM so that larger circles are drawn first
        vis.chart.selectAll('circle')
            .sort((a, b) => vis.rScale(b.avg_launch_mass_kg) - vis.rScale(a.avg_launch_mass_kg));

        // 5. RENDER AXES
        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        
        // Update Scale Text Color (#8fa9b9)
        vis.xAxisG.transition().duration(1000).call(vis.xAxis)
            .selectAll('text')
            .style('fill', '#8fa9b9')
            .style('font-family', "'Courier New', monospace");

        vis.yAxisG.transition().duration(1000).call(vis.yAxis)
            .selectAll('text')
            .style('fill', '#8fa9b9')
            .style('font-family', "'Courier New', monospace");

        vis.svg.selectAll('.axis path, .axis line').style('stroke', '#ccc').style('stroke-width', '1px');
    }

    resize() {
        let vis = this;
        vis.width = vis.container.node().getBoundingClientRect().width - vis.config.margin.left - vis.config.margin.right;
        vis.svg.attr('width', vis.width + vis.config.margin.left + vis.config.margin.right);
        vis.xScale.range([0, vis.width]);
        vis.xAxisLabel.attr('x', vis.width / 2);
        vis.legend.attr('transform', `translate(${vis.width + 20}, 20)`);
        vis.updateVis();
    }
}