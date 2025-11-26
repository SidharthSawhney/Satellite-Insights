/* =====================================================
   launch-metrics.js
   Scatter plot for Launch Metrics Visualization
   Consistent styling with other visualizations
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
            margin: { top: 60, right: 40, bottom: 120, left: 80 },
            tooltipPadding: 15,
            minRadius: 2,
            maxRadius: 50, 
            legendRectSize: 18,
            legendSpacing: 15
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
        
        // Ensure container is relative for absolute positioning
        vis.container.style('position', 'relative');

        // Create custom HTML title
        vis.htmlTitle = vis.container.append('div')
            .attr('class', 'custom-chart-title');

        // Calculate dimensions
        vis.width = vis.container.node().getBoundingClientRect().width - vis.config.margin.left - vis.config.margin.right;
        vis.height = 700 - vis.config.margin.top - vis.config.margin.bottom;

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

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.rScale = d3.scaleLinear()
            .range([vis.config.minRadius, vis.config.maxRadius]);

        vis.colorScale = d3.scaleQuantile();

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format("d")); 
            
        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(10, "~s"); 

        // Append axis groups
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // X-Axis Label
        vis.xAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', (vis.width / 2) + vis.config.margin.left) 
            .attr('y', vis.height + vis.config.margin.top + 50) 
            .attr('text-anchor', 'middle');

        // Y-Axis Label
        vis.yAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(vis.height / 2) - vis.config.margin.top)
            .attr('y', vis.config.margin.left / 3)
            .attr('text-anchor', 'middle')
            .text('Average Power (Watts)');

        // Legend Group - positioned at bottom horizontally
        vis.legend = vis.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${vis.config.margin.left}, ${vis.height + vis.config.margin.top + 60})`);

        // Toggle button container - positioned at bottom right
        vis.buttonContainer = vis.container.append('div')
            .style('position', 'absolute')
            .style('bottom', '30px')
            .style('right', `${vis.config.margin.right}px`)
            .style('z-index', '10');

        vis.toggleButton = vis.buttonContainer.append('button')
            .attr('class', 'switch-view-button')
            .text('Switch View')
            .on('click', () => {
                vis.toggleView();
            });

        // Tooltip - append to container for relative positioning
        vis.tooltip = vis.container.append('div')
            .attr('class', 'launch-metrics-tooltip')
            .style('visibility', 'hidden');

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
        
        // Update color scale - purple hues to match theme
        const customColors = [
            "#b19cd9",  // Light purple
            "#7856bcff",  // Medium purple
            "#473a90ff",  // Royal purple
            "#241c55ff"   // Slate blue purple
        ];
        
        vis.colorScale
            .domain(vis.displayData.map(d => d.avg_launch_mass_kg))
            .range(customColors);

        // Update legend
        vis.legend.selectAll('*').remove();

        vis.legend.append('text')
            .attr('class', 'legend-title')
            .attr('x', 0)
            .attr('y', -10)
            .text('Mass Category');

        const quantiles = vis.colorScale.quantiles();
        const rangeValues = [0, ...quantiles];

        // Create horizontal legend items
        const legendItems = vis.legend.selectAll('.legend-item')
            .data(rangeValues)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => {
                const itemWidth = 120; // Approximate width per legend item
                return `translate(${i * itemWidth}, 10)`;
            })
            .on('click', function(event, d) {
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
            .style('stroke-width', 1)
            .style('stroke', (d, i) => customColors[i]); 

        legendItems.append('text')
            .attr('x', vis.config.legendRectSize + 5)
            .attr('y', vis.config.legendRectSize - 4)
            .text((d, i) => {
                let start = d3.format(".2s")(d);
                let end = (i < quantiles.length) ? d3.format(".2s")(quantiles[i]) : 'Max';
                return i === rangeValues.length - 1 ? `> ${start}` : `${start} - ${end}`;
            })
            .style('font-size', '11px')
            .style('opacity', (d, i) => {
                if (vis.selectedFilter && vis.selectedFilter !== customColors[i]) {
                    return 0.3;
                }
                return 1;
            });

        // Update view-specific elements
        if (vis.viewState === 'mass-power') {
            vis.xScale.domain([0, maxMass * 1.1]); 
            vis.xAxis.tickFormat(d3.format("~s")); 
            
            vis.htmlTitle.html('Launch Mass vs. Power');
            vis.xAxisLabel.text('Launch Mass (kg)');
        } else {
            const yearPadding = 1;
            vis.xScale.domain([
                d3.min(vis.displayData, d => d.year) - yearPadding, 
                d3.max(vis.displayData, d => d.year) + yearPadding
            ]);
            vis.xAxis.tickFormat(d3.format("d")); 
            
            vis.htmlTitle.html('Power over Time');
            vis.xAxisLabel.text('Year');
        }

        // Shared scales
        vis.yScale.domain([0, maxPower * 1.05]); 
        vis.rScale.domain([0, maxMass]);
        
        // Filter data for display
        let dataToRender = vis.displayData;
        if (vis.selectedFilter) {
            dataToRender = vis.displayData.filter(d => vis.colorScale(d.avg_launch_mass_kg) === vis.selectedFilter);
        }

        // Data join
        const circles = vis.chart.selectAll('circle')
            .data(dataToRender, d => d.launch_vehicle + d.year);

        // ENTER — start at r = 0
        const circlesEnter = circles.enter().append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => vis.viewState === 'mass-power'
                ? vis.xScale(d.avg_launch_mass_kg)
                : vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avg_power_watts))
            .attr('r', 0)
            .style('fill', d => vis.colorScale(d.avg_launch_mass_kg))
            .style('opacity', 1);

        // EXIT — shrink to 0 radius, then remove
        circles.exit()
            .transition()
            .duration(500)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();

        // MERGE
        const circlesUpdate = circlesEnter.merge(circles);

        // UPDATE — transition to full radius
        circlesUpdate
            .transition()
            .duration(500)
            .attr('cx', d => vis.viewState === 'mass-power'
                ? vis.xScale(d.avg_launch_mass_kg)
                : vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avg_power_watts))
            .attr('r', d => vis.rScale(d.avg_launch_mass_kg))
            .style('fill', d => vis.colorScale(d.avg_launch_mass_kg))
            .style('opacity', 1);

        // Hover events
        circlesUpdate
            .on('mouseover', function(event, d) { 
                d3.select(this).raise();
                
                // Get mouse position relative to the container
                const [x, y] = d3.pointer(event, vis.container.node());

                vis.tooltip
                    .style('visibility', 'visible')
                    .html(`<p>
                        <strong>${d.launch_vehicle}</strong>
                        Year: ${d.year}
                        <br>Power: ${d3.format(',.0f')(d.avg_power_watts)} Watts
                        <br>Mass: ${d3.format(',.0f')(d.avg_launch_mass_kg)} kg</p>
                    `)
                    .style('left', (x + 12) + 'px')
                    .style('top', (y - 12) + 'px');
            })
            .on('mousemove', (event) => {
                const [x, y] = d3.pointer(event, vis.container.node());
                vis.tooltip
                    .style('left', (x + 12) + 'px')
                    .style('top', (y - 12) + 'px');
            })
            .on('mouseleave', function() {
                vis.tooltip.style('visibility', 'hidden');
            });

        // Reorder circles so larger ones are behind
        vis.chart.selectAll('circle')
            .sort((a, b) => vis.rScale(b.avg_launch_mass_kg) - vis.rScale(a.avg_launch_mass_kg));

        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        
        // Update axes
        vis.xAxisG.transition().duration(1000).call(vis.xAxis);
        vis.yAxisG.transition().duration(1000).call(vis.yAxis);
    }

    resize() {
        let vis = this;
        vis.width = vis.container.node().getBoundingClientRect().width - vis.config.margin.left - vis.config.margin.right;
        vis.svg.attr('width', vis.width + vis.config.margin.left + vis.config.margin.right);
        vis.xScale.range([0, vis.width]);
        vis.xAxisLabel.attr('x', (vis.width / 2) + vis.config.margin.left);
        vis.legend.attr('transform', `translate(${vis.config.margin.left}, ${vis.height + vis.config.margin.top + 60})`);
        vis.updateVis();
    }
}