/**
 * LaunchDominance Visualization - Line Graph Version
 * ---------------------------------------------------
 * Shows accumulated satellites over time with interactive selection.
 * Click on lines/labels to isolate and show details in sidebar.
 */

class LaunchDominance {
  constructor(hostId, data, opts = {}) {
    this.host = d3.select('#' + hostId);
    this.node = this.host.node();
    this.rawData = data;
    
    // Visualization parameters
    this.w = opts.width ?? this.node.clientWidth ?? 1200;
    this.h = opts.height ?? this.node.clientHeight ?? 700;
    this.margin = { top: 80, right: 40, bottom: 100, left: 80 };
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
    
    // State
    this.selectedVehicle = null;
    this.sidebarOpen = false;
    
    // Build DOM
    this._buildScaffold();
    this._processData();
    this._initScales();
    this._drawAxes();
    this._drawChart();
    this._drawLegend();
    this._drawSidebar();
    
    // Responsive
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.host.node());
    }
    window.addEventListener('resize', () => this.resize());
  }

  _buildScaffold() {
    // Main container
    this.container = this.host.append('div')
      .attr('class', 'launch-dom-container')
      .style('position', 'relative')
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'flex');
    
    // Chart container (will resize based on sidebar)
    this.chartContainer = this.container.append('div')
      .attr('class', 'chart-container')
      .style('flex', '1')
      .style('position', 'relative')
      .style('transition', 'flex 0.3s ease');
    
    // SVG for chart
    this.svg = this.chartContainer.append('svg')
      .attr('class', 'launch-dom-svg')
      .attr('width', this.w)
      .attr('height', this.h)
      .style('background', 'transparent')
      .on('click', (event) => {
        // Click on background to deselect
        if (event.target === event.currentTarget) {
          this._deselectVehicle();
        }
      });
    
    // Background rect for click detection
    this.svg.append('rect')
      .attr('class', 'chart-background')
      .attr('width', this.w)
      .attr('height', this.h)
      .style('fill', 'transparent')
      .on('click', () => this._deselectVehicle());
    
    this.chartGroup = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Title
    this.titleGroup = this.chartGroup.append('g')
      .attr('class', 'title-group');
    
    this.titleGroup.append('text')
      .attr('class', 'chart-title')
      .attr('x', this.chartW / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('fill', '#00ff88')
      .style('text-transform', 'uppercase')
      .text('Cumulative Satellites: Falcon 9 vs. The World');
    
    this.titleGroup.append('text')
      .attr('class', 'chart-subtitle')
      .attr('x', this.chartW / 2)
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#8fb98f')
      .style('font-family', 'Courier New, monospace')
      .text('Notice the explosive growth after 2016');
    
    // Axes groups
    this.xAxisGroup = this.chartGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.chartH})`);
    
    this.yAxisGroup = this.chartGroup.append('g')
      .attr('class', 'y-axis');
    
    // Lines group
    this.linesGroup = this.chartGroup.append('g')
      .attr('class', 'lines');
    
    // Legend group
    this.legendGroup = this.chartGroup.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(0, ${this.chartH + 50})`);
    
    // Tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'launch-dom-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.95)')
      .style('color', '#00ff88')
      .style('padding', '12px')
      .style('border-radius', '4px')
      .style('border', '1px solid #00ff88')
      .style('font-family', 'Courier New, monospace')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '2000')
      .style('box-shadow', '0 0 20px rgba(0, 255, 136, 0.3)');
    
    // Sidebar
    this.sidebarContainer = this.container.append('div')
      .attr('class', 'launch-dom-sidebar')
      .style('width', '0')
      .style('background', 'rgba(0, 0, 0, 0.95)')
      .style('border-left', '2px solid #00ff88')
      .style('overflow-y', 'auto')
      .style('overflow-x', 'hidden')
      .style('transition', 'width 0.3s ease')
      .style('box-shadow', '-4px 0 20px rgba(0, 255, 136, 0.2)');
  }

  _processData() {
    // Get all unique years
    const allYears = [...new Set(this.rawData.map(d => d.year))].sort((a, b) => a - b);
    this.years = allYears;
    
    // Group by vehicle and year, collecting mass and power data
    const vehicleYearMap = new Map();
    
    this.rawData.forEach(d => {
      const key = `${d.launch_vehicle}_${d.year}`;
      if (!vehicleYearMap.has(key)) {
        vehicleYearMap.set(key, {
          launch_vehicle: d.launch_vehicle,
          year: d.year,
          launches: 0,
          satellites: 0,
          total_launch_mass: 0,
          total_power: 0,
          count: 0
        });
      }
      const entry = vehicleYearMap.get(key);
      entry.launches += 1;
      entry.satellites += d.num_satellites || 0;
      entry.total_launch_mass += d.avg_launch_mass_kg || 0;
      entry.total_power += d.avg_power_watts || 0;
      entry.count += 1;
    });
    
    // Group by vehicle
    const vehicleMap = new Map();
    vehicleYearMap.forEach(entry => {
      if (!vehicleMap.has(entry.launch_vehicle)) {
        vehicleMap.set(entry.launch_vehicle, []);
      }
      vehicleMap.get(entry.launch_vehicle).push(entry);
    });
    
    // Calculate total satellites and efficiency metrics per vehicle
    const vehicleTotals = [];
    vehicleMap.forEach((yearData, vehicle) => {
      const totalSatellites = d3.sum(yearData, d => d.satellites);
      const totalLaunches = d3.sum(yearData, d => d.launches);
      const totalMass = d3.sum(yearData, d => d.total_launch_mass);
      const totalPower = d3.sum(yearData, d => d.total_power);
      const totalCount = d3.sum(yearData, d => d.count);
      
      vehicleTotals.push({ 
        vehicle, 
        totalSatellites: totalSatellites,
        totalLaunches: totalLaunches,
        avgMass: totalCount > 0 ? totalMass / totalCount : 0,
        avgPower: totalCount > 0 ? totalPower / totalCount : 0
      });
    });
    
    // Get top 8 vehicles by total satellites
    const top8 = vehicleTotals
      .sort((a, b) => b.totalSatellites - a.totalSatellites)
      .slice(0, 8)
      .map(d => d.vehicle);
    
    // Store vehicle stats for efficiency calculations
    this.vehicleStats = new Map();
    vehicleTotals.forEach(v => {
      this.vehicleStats.set(v.vehicle, {
        avgMass: v.avgMass,
        avgPower: v.avgPower
      });
    });
    
    // Prepare data for each vehicle with accumulated satellites
    this.vehicleData = [];
    top8.forEach(vehicle => {
      const yearData = vehicleMap.get(vehicle) || [];
      let accumulatedSatellites = 0;
      
      const fullData = allYears.map(year => {
        const existing = yearData.find(d => d.year === year);
        const yearSatellites = existing ? existing.satellites : 0;
        const yearLaunches = existing ? existing.launches : 0;
        accumulatedSatellites += yearSatellites;
        
        return {
          launch_vehicle: vehicle,
          year: year,
          launches: yearLaunches,
          satellites: yearSatellites,
          accumulated_satellites: accumulatedSatellites
        };
      });
      
      const vehicleInfo = vehicleTotals.find(v => v.vehicle === vehicle);
      
      this.vehicleData.push({
        vehicle: vehicle,
        data: fullData,
        totalSatellites: accumulatedSatellites,
        totalLaunches: vehicleInfo.totalLaunches
      });
    });
    
    // Define colors - Falcon 9 in bright cyan, others muted
    this.colorMap = new Map();
    this.vehicleData.forEach((v, i) => {
      if (v.vehicle === 'Falcon 9') {
        this.colorMap.set(v.vehicle, '#00ffff'); // Bright cyan for Falcon 9
      } else {
        // Muted colors for others
        const mutedColors = ['#5a6b7a', '#6b5a7a', '#7a5a6b', '#5a7a6b', '#6b7a5a', '#7a6b5a', '#5a5a7a'];
        this.colorMap.set(v.vehicle, mutedColors[i % mutedColors.length]);
      }
    });
  }

  _initScales() {
    // X scale: years
    this.xScale = d3.scaleLinear()
      .domain(d3.extent(this.years))
      .range([0, this.chartW]);
    
    // Y scale: accumulated satellites (cumulative over time)
    const maxAccumulated = d3.max(this.vehicleData, v => d3.max(v.data, d => d.accumulated_satellites)) || 100;
    this.yScale = d3.scaleLinear()
      .domain([0, maxAccumulated])
      .range([this.chartH, 0])
      .nice();
  }

  _drawAxes() {
    // X axis
    const xAxis = d3.axisBottom(this.xScale)
      .ticks(10)
      .tickFormat(d3.format('d'));
    
    this.xAxisGroup.call(xAxis);
    
    this.xAxisGroup.selectAll('text')
      .style('fill', '#8fb98f')
      .style('font-family', 'Courier New, monospace')
      .style('font-size', '11px');
    
    this.xAxisGroup.selectAll('.domain, .tick line')
      .style('stroke', '#00ff88')
      .style('stroke-opacity', 0.2);
    
    // Y axis
    const yAxis = d3.axisLeft(this.yScale)
      .ticks(8)
      .tickFormat(d => d3.format('.2s')(d));
    
    this.yAxisGroup.call(yAxis);
    
    this.yAxisGroup.selectAll('text')
      .style('fill', '#8fb98f')
      .style('font-family', 'Courier New, monospace')
      .style('font-size', '11px');
    
    this.yAxisGroup.selectAll('.domain, .tick line')
      .style('stroke', '#00ff88')
      .style('stroke-opacity', 0.2);
    
    // Y axis label
    this.yAxisGroup.selectAll('.y-axis-label').remove();
    this.yAxisGroup.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.chartH / 2)
      .attr('y', -55)
      .attr('text-anchor', 'middle')
      .style('fill', '#00ff88')
      .style('font-family', 'Courier New, monospace')
      .style('font-size', '13px')
      .style('text-transform', 'uppercase')
      .text('Cumulative Satellites');
  }

  _drawChart() {
    const vis = this;
    
    // Filter data based on selection
    const displayData = this.selectedVehicle 
      ? this.vehicleData.filter(v => v.vehicle === this.selectedVehicle)
      : this.vehicleData;
    
    // Line generator
    const line = d3.line()
      .x(d => this.xScale(d.year))
      .y(d => this.yScale(d.accumulated_satellites))
      .curve(d3.curveMonotoneX);
    
    // Data join
    const lines = this.linesGroup.selectAll('.vehicle-line')
      .data(displayData, d => d.vehicle);
    
    // Exit
    lines.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();
    
    // Enter
    const linesEnter = lines.enter()
      .append('g')
      .attr('class', 'vehicle-line')
      .style('opacity', 0);
    
    linesEnter.append('path')
      .attr('class', 'line-path')
      .attr('fill', 'none')
      .attr('stroke-width', d => d.vehicle === 'Falcon 9' ? 3 : 2)
      .attr('stroke-dasharray', d => d.vehicle === 'Falcon 9' ? '0' : '5,5')
      .style('cursor', 'pointer');
    
    // Add dots for interaction
    linesEnter.each(function(vehicleObj) {
      const group = d3.select(this);
      
      group.selectAll('.data-point')
        .data(vehicleObj.data)
        .enter()
        .append('circle')
        .attr('class', 'data-point')
        .attr('cx', d => vis.xScale(d.year))
        .attr('cy', d => vis.yScale(d.accumulated_satellites))
        .attr('r', 4)
        .style('fill', vis.colorMap.get(vehicleObj.vehicle))
        .style('stroke', '#000')
        .style('stroke-width', 1)
        .style('cursor', 'pointer')
        .style('opacity', d => d.accumulated_satellites > 0 ? 1 : 0);
    });
    
    // Update
    const linesUpdate = linesEnter.merge(lines);
    
    linesUpdate
      .transition()
      .duration(500)
      .style('opacity', 1);
    
    linesUpdate.select('.line-path')
      .attr('d', d => line(d.data))
      .attr('stroke', d => vis.colorMap.get(d.vehicle))
      .on('click', function(event, d) {
        event.stopPropagation();
        vis._selectVehicle(d.vehicle);
      })
      .on('mouseover', function(event, d) {
        if (!vis.selectedVehicle) {
          d3.select(this)
            .attr('stroke-width', d.vehicle === 'Falcon 9' ? 5 : 4)
            .style('filter', 'drop-shadow(0 0 8px ' + vis.colorMap.get(d.vehicle) + ')');
        }
      })
      .on('mouseout', function(event, d) {
        if (!vis.selectedVehicle) {
          d3.select(this)
            .attr('stroke-width', d.vehicle === 'Falcon 9' ? 3 : 2)
            .style('filter', 'none');
        }
      });
    
    // Update dots
    linesUpdate.each(function(vehicleObj) {
      const group = d3.select(this);
      
      const dots = group.selectAll('.data-point')
        .data(vehicleObj.data);
      
      dots.enter()
        .append('circle')
        .attr('class', 'data-point')
        .attr('r', 4)
        .style('fill', vis.colorMap.get(vehicleObj.vehicle))
        .style('stroke', '#000')
        .style('stroke-width', 1)
        .style('cursor', 'pointer')
        .merge(dots)
        .attr('cx', d => vis.xScale(d.year))
        .attr('cy', d => vis.yScale(d.accumulated_satellites))
        .style('opacity', d => d.accumulated_satellites > 0 ? 1 : 0)
        .on('click', function(event, d) {
          event.stopPropagation();
          vis._selectVehicle(vehicleObj.vehicle);
        })
        .on('mouseover', function(event, d) {
          if (d.accumulated_satellites > 0) {
            d3.select(this)
              .attr('r', 6)
              .style('filter', 'drop-shadow(0 0 6px ' + vis.colorMap.get(vehicleObj.vehicle) + ')');
            
            vis.tooltip
              .style('visibility', 'visible')
              .html(`
                <div style="margin-bottom: 5px;">
                  <strong style="color: ${vis.colorMap.get(vehicleObj.vehicle)};">${vehicleObj.vehicle}</strong>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="color: #8fb98f;">Year:</span> ${d.year}
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="color: #8fb98f;">Accumulated satellites:</span> ${d.accumulated_satellites.toLocaleString()}
                </div>
                <div>
                  <span style="color: #8fb98f;">Launches this year:</span> ${d.launches}
                </div>
              `);
          }
        })
        .on('mousemove', function(event) {
          vis.tooltip
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('r', 4)
            .style('filter', 'none');
          vis.tooltip.style('visibility', 'hidden');
        });
      
      dots.exit().remove();
    });
  }

  _drawLegend() {
    const vis = this;
    
    this.legendGroup.selectAll('*').remove();
    
    // Legend title
    this.legendGroup.append('text')
      .attr('x', 0)
      .attr('y', -5)
      .style('fill', '#00ff88')
      .style('font-family', 'Courier New, monospace')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('● Falcon 9 in BRIGHT CYAN (thick line) - All competitors in muted colors (dashed)');
    
    // Legend items
    const itemWidth = 150;
    const itemsPerRow = Math.floor(this.chartW / itemWidth);
    
    this.vehicleData.forEach((v, i) => {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const x = col * itemWidth;
      const y = row * 20 + 10;
      
      const item = this.legendGroup.append('g')
        .attr('class', 'legend-item')
        .attr('transform', `translate(${x}, ${y})`)
        .style('cursor', 'pointer')
        .on('click', function() {
          vis._selectVehicle(v.vehicle);
        })
        .on('mouseover', function() {
          d3.select(this).select('text')
            .style('fill', '#39ff14');
        })
        .on('mouseout', function() {
          d3.select(this).select('text')
            .style('fill', vis.colorMap.get(v.vehicle));
        });
      
      // Line sample
      item.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', vis.colorMap.get(v.vehicle))
        .attr('stroke-width', v.vehicle === 'Falcon 9' ? 3 : 2)
        .attr('stroke-dasharray', v.vehicle === 'Falcon 9' ? '0' : '5,5');
      
      // Label
      item.append('text')
        .attr('x', 25)
        .attr('y', 4)
        .style('fill', vis.colorMap.get(v.vehicle))
        .style('font-family', 'Courier New, monospace')
        .style('font-size', '11px')
        .text(v.vehicle);
    });
  }

  _drawSidebar() {
    // Sidebar content will be populated when vehicle is selected
    this.sidebarContent = this.sidebarContainer.append('div')
      .attr('class', 'sidebar-content')
      .style('padding', '20px')
      .style('color', '#e0ffe0');
  }

  _selectVehicle(vehicle) {
    this.selectedVehicle = vehicle;
    this.sidebarOpen = true;
    
    // Resize chart to 80% (4/5 of screen)
    this.chartContainer.style('flex', '0 0 80%');
    this.sidebarContainer.style('width', '20%');
    
    // Update chart
    this._drawChart();
    
    // Update sidebar
    this._updateSidebar();
  }

  _deselectVehicle() {
    if (!this.selectedVehicle) return;
    
    this.selectedVehicle = null;
    this.sidebarOpen = false;
    
    // Reset chart to full width
    this.chartContainer.style('flex', '1');
    this.sidebarContainer.style('width', '0');
    
    // Update chart
    this._drawChart();
  }

  _updateSidebar() {
    const vehicleObj = this.vehicleData.find(v => v.vehicle === this.selectedVehicle);
    if (!vehicleObj) return;
    
    this.sidebarContent.html('');
    
    // Close button
    const closeBtn = this.sidebarContent.append('div')
      .style('text-align', 'right')
      .style('margin-bottom', '15px')
      .append('button')
      .style('background', 'transparent')
      .style('border', '1px solid #00ff88')
      .style('color', '#00ff88')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('font-family', 'Courier New, monospace')
      .style('border-radius', '3px')
      .text('✕ CLOSE')
      .on('click', () => this._deselectVehicle())
      .on('mouseover', function() {
        d3.select(this).style('background', '#00ff88').style('color', '#000');
      })
      .on('mouseout', function() {
        d3.select(this).style('background', 'transparent').style('color', '#00ff88');
      });
    
    // Title
    this.sidebarContent.append('h2')
      .style('font-size', '18px')
      .style('margin-bottom', '20px')
      .style('color', '#00ff88')
      .style('border-bottom', '2px solid #00ff88')
      .style('padding-bottom', '10px')
      .style('text-transform', 'uppercase')
      .style('font-family', 'Courier New, monospace')
      .text(vehicleObj.vehicle);
    
    // Stats
    const statsDiv = this.sidebarContent.append('div')
      .style('margin-bottom', '20px');
    
    this._addStatItem(statsDiv, 'Total Satellites', vehicleObj.totalSatellites);
    this._addStatItem(statsDiv, 'Total Launches', vehicleObj.totalLaunches);
    
    // Efficiency Rating based on mass and power
    const rating = this._calculateRating(vehicleObj);
    const ratingDiv = this.sidebarContent.append('div')
      .style('margin-bottom', '20px')
      .style('padding', '15px')
      .style('background', 'rgba(0, 255, 136, 0.1)')
      .style('border-left', '3px solid #00ff88')
      .style('border-radius', '4px');
    
    ratingDiv.append('div')
      .style('font-size', '12px')
      .style('color', '#8fb98f')
      .style('margin-bottom', '8px')
      .style('font-family', 'Courier New, monospace')
      .text('EFFICIENCY RATING');
    
    const starsDiv = ratingDiv.append('div')
      .style('font-size', '20px')
      .style('margin-bottom', '5px');
    
    for (let i = 1; i <= 5; i++) {
      starsDiv.append('span')
        .style('color', i <= Math.round(rating) ? '#00ff88' : '#2a3a2a')
        .text('★');
    }
    
    // Add explanation
    ratingDiv.append('div')
      .style('font-size', '10px')
      .style('color', '#8fb98f')
      .style('margin-top', '8px')
      .style('line-height', '1.4')
      .style('font-family', 'Courier New, monospace')
      .html('Based on satellite efficiency:<br/><strong style="color: #00ff88;">Lower launch mass + Lower power = Higher rating</strong><br/>Weighted: 60% mass, 40% power');
    
    // Description
    this.sidebarContent.append('div')
      .style('margin-top', '20px')
      .style('padding', '15px')
      .style('background', 'rgba(0, 255, 136, 0.05)')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('line-height', '1.6')
      .style('font-family', 'Courier New, monospace')
      .style('color', '#8fb98f')
      .html(`<strong style="color: #00ff88;">ABOUT:</strong><br/>${this._getVehicleInfo(vehicleObj.vehicle)}`);
  }

  _addStatItem(container, label, value) {
    const item = container.append('div')
      .style('margin-bottom', '15px')
      .style('padding-bottom', '15px')
      .style('border-bottom', '1px solid #2a3a2a');
    
    item.append('div')
      .style('font-size', '11px')
      .style('color', '#8fb98f')
      .style('margin-bottom', '5px')
      .style('font-family', 'Courier New, monospace')
      .style('text-transform', 'uppercase')
      .text(label);
    
    item.append('div')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('color', '#00ff88')
      .style('font-family', 'Courier New, monospace')
      .text(value.toLocaleString());
  }

  _calculateRating(vehicleObj) {
    // Get mass and power data for this vehicle
    const stats = this.vehicleStats.get(vehicleObj.vehicle);
    if (!stats || stats.avgMass === 0 || stats.avgPower === 0) {
      return 3; // Default middle rating if no data
    }
    
    // Calculate efficiency: lower mass and power = better efficiency
    // Get min/max values across all vehicles for normalization
    const allStats = Array.from(this.vehicleStats.values()).filter(s => s.avgMass > 0 && s.avgPower > 0);
    if (allStats.length === 0) return 3;
    
    const masses = allStats.map(s => s.avgMass);
    const powers = allStats.map(s => s.avgPower);
    
    const minMass = Math.min(...masses);
    const maxMass = Math.max(...masses);
    const minPower = Math.min(...powers);
    const maxPower = Math.max(...powers);
    
    // Normalize (0-1) and invert so lower values get higher scores
    const massScore = maxMass > minMass ? 1 - ((stats.avgMass - minMass) / (maxMass - minMass)) : 0.5;
    const powerScore = maxPower > minPower ? 1 - ((stats.avgPower - minPower) / (maxPower - minPower)) : 0.5;
    
    // Combine scores: 60% mass, 40% power, scale to 1-5 stars
    const efficiency = ((massScore * 0.6 + powerScore * 0.4) * 4) + 1;
    return Math.max(1, Math.min(5, efficiency));
  }

  _getVehicleInfo(vehicle) {
    const info = {
      'Falcon 9': 'SpaceX\'s workhorse rocket featuring reusable first-stage boosters. Revolutionary cost-effective and reliable access to space.',
      'Ariane 5': 'ESA\'s heavy-lift launch vehicle, known for reliability in commercial and scientific missions.',
      'Atlas V': 'United Launch Alliance\'s reliable launcher for government and commercial payloads.',
      'Soyuz': 'Russia\'s proven launch system with decades of operational history.',
      'Long March': 'China\'s family of launch vehicles for various payload capacities.',
      'Delta': 'United Launch Alliance\'s medium to heavy-lift expendable launch system.',
      'Proton': 'Russian heavy-lift launch vehicle for commercial and government missions.',
      'H-II': 'Japan\'s liquid-fueled orbital launch system.'
    };
    return info[vehicle] || 'A launch vehicle designed to deliver payloads to orbit with high reliability and efficiency.';
  }

  resize() {
    const bbox = this.host.node().getBoundingClientRect();
    const availableWidth = this.sidebarOpen ? bbox.width * 0.8 : bbox.width;
    
    this.w = Math.max(800, Math.floor(availableWidth));
    this.h = Math.max(500, Math.floor(bbox.height));
    
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
    
    this.svg
      .attr('width', this.w)
      .attr('height', this.h);
    
    this.svg.select('.chart-background')
      .attr('width', this.w)
      .attr('height', this.h);
    
    this.chartGroup
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.xAxisGroup
      .attr('transform', `translate(0,${this.chartH})`);
    
    this.legendGroup
      .attr('transform', `translate(0, ${this.chartH + 50})`);
    
    this._initScales();
    this._drawAxes();
    this._drawChart();
    this._drawLegend();
  }
}