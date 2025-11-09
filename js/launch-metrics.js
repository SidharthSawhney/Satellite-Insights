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
            tooltipPadding: 15
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
        
        // For now, just pass through the data
        vis.displayData = vis.data;

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
            .style('fill', '#778da9');

        vis.yAxisG.call(vis.yAxis)
            .selectAll('text')
            .style('fill', '#778da9');

        // Style axis lines and ticks
        vis.svg.selectAll('.axis path, .axis line')
            .style('stroke', '#5fa8d3')
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