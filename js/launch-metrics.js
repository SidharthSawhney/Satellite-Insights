/* =====================================================
   launch-metrics.js
   Template for Launch Metrics Visualization
   ===================================================== */

class LaunchMetrics {
    constructor(parentElement, data) {
        this.parentElement = parentElement;
        this.data = data;
        this.displayData = [];
        
        // Configuration and dimensions
        this.config = {
            margin: { top: 60, right: 80, bottom: 80, left: 80 },
            tooltipPadding: 15,
            minRadius: 3,
            maxRadius: 50
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

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Continue with your code
        // Scale for circle radius (using sqrt scale for area perception)
        vis.rScale = d3.scaleLinear()
            .range([vis.config.minRadius, vis.config.maxRadius]);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format("d")); // Format year as integer (no comma)
            
        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickFormat(d3.format(".2s")); // Format power with SI prefix (e.g., "10k")

        // Append axis groups
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // Add Chart Title
        vis.chartTitle = vis.svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', (vis.width / 2) + vis.config.margin.left)
            .attr('y', vis.config.margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '24px')
            .style('font-weight', 'bold')
            .style('fill', '#5fa8d3')
            .style('text-transform', 'uppercase')
            .text('Satellite Mass vs Power Consumed Over Time');

        // Add X-Axis Label
        vis.xAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', (vis.width / 2) + vis.config.margin.left)
            .attr('y', vis.height + vis.config.margin.top + vis.config.margin.bottom / 1.5)
            .attr('text-anchor', 'middle')
            .style('fill', '#5fa8d3')
            .text('Year');

        // Add Y-Axis Label
        vis.yAxisLabel = vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(vis.height / 2) - vis.config.margin.top)
            .attr('y', vis.config.margin.left / 3)
            .attr('text-anchor', 'middle')
            .style('fill', '#5fa8d3')
            .text('Average Power (Watts)');

        // Initialize Tooltip
        vis.tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tooltip')
            .style('position', 'absolute')
            .style('z-index', '10')
            .style('visibility', 'hidden')
            .style('background-color', 'rgba(255, 255, 255, 0.95)')
            .style('border', '1px solid #ccc')
            .style('border-radius', '8px')
            .style('padding', '10px')
            .style('font-family', 'Inter, sans-serif')
            .style('font-size', '12px')
            .style('color', '#333')
            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)');


        // Process data and update visualization
        vis.wrangleData();
    }

    /**
     * Process and prepare data for visualization
     */
    wrangleData() {
        let vis = this;

        // TODO: Process your data here
        // Example: Filter, aggregate, or transform data as needed
        
        // Filter data to include only entries with valid numbers for all required fields
        // We also filter out 0-power entries as they can't be shown meaningfully on a linear scale starting from 0
        vis.displayData = vis.data.filter(d => 
            d.year && isFinite(d.year) &&
            d.avg_power_watts && isFinite(d.avg_power_watts) && d.avg_power_watts > 0 &&
            d.avg_launch_mass_kg && isFinite(d.avg_launch_mass_kg) && d.avg_launch_mass_kg > 0
        );
        
        // Convert year to number just in case
        vis.displayData.forEach(d => {
            d.year = +d.year;
            d.avg_power_watts = +d.avg_power_watts;
            d.avg_launch_mass_kg = +d.avg_launch_mass_kg;
        });

        // Update the visualization
        vis.updateVis();
    }

    /**
     * Update visualization with new data
     */
    updateVis() {
        let vis = this;

        // TODO: Update scales based on your data
        // Example:
        // vis.xScale.domain([minYear, maxYear]);
        // vis.yScale.domain([0, maxValue]);

        // TODO: Create your visualization elements here
        // Examples:
        // - Line charts: use d3.line()
        // - Bar charts: use .selectAll('rect').data(...)
        // - Area charts: use d3.area()
        // - Scatter plots: use .selectAll('circle').data(...)

        // Update scale domains
        const yearPadding = 1;
        vis.xScale.domain([
            d3.min(vis.displayData, d => d.year) - yearPadding, 
            d3.max(vis.displayData, d => d.year) + yearPadding
        ]);
        
        vis.yScale.domain([0, d3.max(vis.displayData, d => d.avg_power_watts) * 1.05]); // Add 5% padding
        
        vis.rScale.domain([0, d3.max(vis.displayData, d => d.avg_launch_mass_kg)]);

        // Data join for circles
        const circles = vis.chart.selectAll('circle')
            .data(vis.displayData, d => d.launch_vehicle + d.year); // Use a key for object constancy

        // Enter: Append new circles
        circles.enter().append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avg_power_watts))
            .attr('r', 0) // Start with radius 0 for transition
            .style('fill', '#0077b6')
            .style('fill-opacity', 0.6)
            .style('stroke', '#03045e')
            .style('stroke-width', 1)
            .style('cursor', 'pointer')
            // Add tooltip event listeners
            .on('mouseover', (event, d) => {
                vis.tooltip
                    .style('visibility', 'visible')
                    .html(`
                        <strong>${d.launch_vehicle}</strong><br>
                        <hr style="border:0; border-top: 1px solid #eee; margin: 4px 0;">
                        <strong>Year:</strong> ${d.year}<br>
                        <strong>Power:</strong> ${d3.format(',.0f')(d.avg_power_watts)} Watts<br>
                        <strong>Mass:</strong> ${d3.format(',.0f')(d.avg_launch_mass_kg)} kg
                    `);
            })
            .on('mousemove', (event) => {
                vis.tooltip
                    .style('top', (event.pageY - vis.config.tooltipPadding - 10) + 'px') // Position above cursor
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px');
            })
            .on('mouseleave', () => {
                vis.tooltip.style('visibility', 'hidden');
            })
            // Transition for new circles
            .transition().duration(500)
            .attr('r', d => vis.rScale(d.avg_launch_mass_kg));

        // Update: Update existing circles (for resizing)
        circles
            .transition().duration(500)
            .attr('cx', d => vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avg_power_watts))
            .attr('r', d => vis.rScale(d.avg_launch_mass_kg));

        // Exit: Remove old circles
        circles.exit()
            .transition().duration(500)
            .attr('r', 0)
            .remove();

       

        // Update axes
        vis.renderVis();
    }

    /**
     * Render static elements (axes, legends, etc.)
     */
    renderVis() {
        let vis = this;

        // Update axes
        vis.xAxisG.call(vis.xAxis)
            .selectAll('text')
            .style('fill', '#333');

        vis.yAxisG.call(vis.yAxis)
            .selectAll('text')
            .style('fill', '#333');

        // Style axis lines and ticks
        vis.svg.selectAll('.axis path, .axis line')
            .style('stroke', '#ccc')
            .style('stroke-width', '1px');

        vis.svg.selectAll('.axis .domain')
            .style('stroke-width', '1px');
    }

    /**
     * Handle window resize
     */
    resize() {
        let vis = this;

        // Recalculate dimensions
        vis.width = vis.container.node().getBoundingClientRect().width - vis.config.margin.left - vis.config.margin.right;
        
        // Update SVG size
        vis.svg
            .attr('width', vis.width + vis.config.margin.left + vis.config.margin.right);

        // Update scales
        vis.xScale.range([0, vis.width]);

        // Update axis positions
        vis.xAxisLabel
            .attr('x', vis.config.margin.left + vis.width / 2);

        vis.chartTitle
            .attr('x', vis.config.margin.left + vis.width / 2);

        // Re-render visualization
        vis.updateVis();
    }
}

// TODO: Add helper functions here if needed
// Example:
// function formatMetricValue(value) {
//     return d3.format('.2f')(value);
// }