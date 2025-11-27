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
    
    // Build DOM first so we can measure the chart container
    this._buildScaffold();
    
    // Now measure the actual chart container (80% width)
    const chartBbox = this.chartContainer.node().getBoundingClientRect();
    
    // Visualization parameters
    this.w = opts.width ?? Math.floor(chartBbox.width) ?? 960;
    this.h = opts.height ?? Math.floor(chartBbox.height) ?? 700;
    this.margin = { top: 80, right: 40, bottom: 120, left: 80 };
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
    
    // State
    this.selectedVehicle = null;
    
    // Continue building
    this._buildSVG();
    this._processData();
    this._initScales();
    this._drawAxes();
    this._drawChart();
    this._drawLegend();
    this._drawSidebar();
    
    // Responsive
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.chartContainer.node());
    }
    window.addEventListener('resize', () => this.resize());
  }

  _buildScaffold() {
    // Main container
    this.container = this.host.append('div')
      .attr('class', 'launch-dom-container');
    
    // Chart container (fixed 80% width via CSS)
    this.chartContainer = this.container.append('div')
      .attr('class', 'chart-container');
    
    // Add info button and popover above the chart
    // const infoWrapper = this.chartContainer.append('div')
    //   .style('position', 'absolute')
    //   .style('top', '12px')
    //   .style('left', '50%')
    //   .style('transform', 'translateX(-50%)')
    //   .style('z-index', '10');
    
    // this.infoButton = infoWrapper.append('button')
    //   .attr('class', 'map-info-btn')
    //   .attr('type', 'button')
    //   .attr('aria-label', 'Information about this visualization')
    //   .html('ⓘ');
    
    // this.infoPopover = infoWrapper.append('div')
    //   .attr('class', 'map-info-popover')
    //   .style('left', '30px')
    //   .style('top', '0')
    //   .html(`
    //     <strong>About This Chart</strong>
    //     <p>This chart shows the cumulative number of satellites launched by each major rocket over time.</p>
    //     <p>Click on any line, dot, or legend label to select a rocket and view detailed information in the sidebar.</p>
    //   `);
    
    // Sidebar (Fixed 20% width via CSS)
    this.sidebarContainer = this.container.append('div')
      .attr('class', 'launch-dom-sidebar');
  }

  _buildSVG() {
    // SVG for chart
    this.svg = this.chartContainer.append('svg')
      .attr('class', 'launch-dom-svg')
      .attr('width', this.w)
      .attr('height', this.h)
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
      .text('Cumulative Satellites launched per Major Rocket');
    
    // Instruction text - below title
    this.titleGroup.append('text')
      .attr('class', 'chart-instruction')
      .attr('x', this.chartW / 2)
      .attr('y', -25)
      .text('Falcon 9 in BRIGHT CYAN (thick line) - All competitors in muted colors (dashed)');
    
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
      .attr('transform', `translate(0, ${this.chartH + 68})`)
    
    // Tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'launch-dom-tooltip')
      .style('visibility', 'hidden');
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
        this.colorMap.set(v.vehicle, '#00d4ff'); // Bright cyan for Falcon 9
      } else {
        // Muted colors for others - Blue/Purple Palette
        const mutedColors = ['#5fa8d3', '#7b2cbf', '#778da9', '#415a77', '#9d4edd', '#4a90e2', '#6a4c93'];
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
    
    this.xAxisGroup.selectAll('text');
    
    this.xAxisGroup.selectAll('.domain');
    
    this.xAxisGroup.selectAll('.tick line');
    
    // Y axis
    const yAxis = d3.axisLeft(this.yScale)
      .ticks(8)
      .tickFormat(d => d3.format('.2s')(d));
    
    this.yAxisGroup.call(yAxis);
    
    this.yAxisGroup.selectAll('text');
    
    this.yAxisGroup.selectAll('.domain');
    
    this.yAxisGroup.selectAll('.tick line');
    
    // Y axis label
    // Y axis label
    this.yAxisGroup.selectAll('.y-axis-label').remove();
    this.yAxisGroup.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.chartH / 2)
      .attr('y', -55)
      .text('Cumulative Satellites');
    
    // X axis label
    this.xAxisGroup.selectAll('.x-axis-label').remove();
    this.xAxisGroup.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', this.chartW / 2)
      .attr('y', 40)
      .text('Year');
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
      .attr('stroke-dasharray', d => d.vehicle === 'Falcon 9' ? '0' : '5,5');
    
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
        .style('opacity', d => d.accumulated_satellites > 0 ? 1 : 0)
        .style('fill', vis.colorMap.get(vehicleObj.vehicle))
        .style('stroke', vis.colorMap.get(vehicleObj.vehicle))
        .style('stroke-width', 1)
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
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        event.stopPropagation();
        // If clicking the same vehicle, deselect it, otherwise select new one
        if (vis.selectedVehicle === d.vehicle) {
          vis._deselectVehicle();
        } else {
          vis._selectVehicle(d.vehicle);
        }
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
        .merge(dots)
        .style('fill', vis.colorMap.get(vehicleObj.vehicle))
        .style('cursor', 'pointer')
        .style('stroke', vis.colorMap.get(vehicleObj.vehicle))
        .style('stroke-width', 1)
        .attr('cx', d => vis.xScale(d.year))
        .attr('cy', d => vis.yScale(d.accumulated_satellites))
                .on('click', function(event, d) {
          event.stopPropagation();
          // If clicking the same vehicle, deselect it, otherwise select new one
          if (vis.selectedVehicle === vehicleObj.vehicle) {
            vis._deselectVehicle();
          } else {
            vis._selectVehicle(vehicleObj.vehicle);
          }
        })
        .on('mouseover', function(event, d) {
          if (d.accumulated_satellites > 0) {
            d3.select(this)
              .attr('r', 6)
              .style('filter', 'drop-shadow(0 0 6px ' + vis.colorMap.get(vehicleObj.vehicle) + ')');
            
            vis.tooltip
              .style('visibility', 'visible')
              .html(`<p>
                <strong>${vehicleObj.vehicle}</strong>
                Year: ${d.year}<br>
                Accumulated satellites: ${d.accumulated_satellites.toLocaleString()}<br>
                Launches this year: ${d.launches}</p>
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
    
    // Legend title - styled like launch-metrics
    this.legendGroup.append('text')
      .attr('class', 'legend-title')
      .attr('x', 0)
      .attr('y', -5)
      .style('fill', '#0066a6')
      .style('font-family', "'Courier New', 'Consolas', monospace")
      .style('font-size', '14px')
      .style('letter-spacing', '0.05em')
      .text('Top 8 Most Launched Rockets');
    
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
        .attr('data-vehicle', v.vehicle)
        .attr('transform', `translate(${x}, ${y})`)
        .style('cursor', 'pointer')
        .style('opacity', 1)
        .on('click', function(event) {
          event.stopPropagation();
          // If clicking the same vehicle, deselect it, otherwise select new one
          if (vis.selectedVehicle === v.vehicle) {
            vis._deselectVehicle();
          } else {
            vis._selectVehicle(v.vehicle);
          }
        })
        .on('mouseover', function() {
          if (!vis.selectedVehicle || vis.selectedVehicle === v.vehicle) {
            d3.select(this).select('text')
              .style('filter', 'drop-shadow(0 0 4px ' + vis.colorMap.get(v.vehicle) + ')');
          }
        })
        .on('mouseout', function() {
          if (!vis.selectedVehicle || vis.selectedVehicle === v.vehicle) {
            d3.select(this).select('text')
              .style('filter', 'none');
          }
        });
      
      // Line sample
      item.append('line')
        .attr('class', 'legend-line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', vis.colorMap.get(v.vehicle))
        .attr('stroke-width', v.vehicle === 'Falcon 9' ? 3 : 2)
        .attr('stroke-dasharray', v.vehicle === 'Falcon 9' ? '0' : '5,5');
      
      // Label - set fill to match line color
      item.append('text')
        .attr('class', 'legend-text')
        .attr('x', 25)
        .attr('y', 4)
        .style('fill', vis.colorMap.get(v.vehicle))
        .text(v.vehicle);
    });
    
    // Update legend based on selection state
    this._updateLegendSelection();
  }

  
  _updateLegendSelection() {
    const vis = this;
    
    if (this.selectedVehicle) {
      // Fade out non-selected items
      this.legendGroup.selectAll('.legend-item')
        .style('opacity', function() {
          const vehicleName = d3.select(this).attr('data-vehicle');
          return vehicleName === vis.selectedVehicle ? 1 : 0.3;
        })
        .style('filter', function() {
          const vehicleName = d3.select(this).attr('data-vehicle');
          if (vehicleName === vis.selectedVehicle) {
            // Add glow to selected item
            return 'drop-shadow(0 0 8px ' + vis.colorMap.get(vis.selectedVehicle) + ')';
          }
          return 'none';
        });
    } else {
      // Reset all items to full opacity
      this.legendGroup.selectAll('.legend-item')
        .style('opacity', 1)
        .style('filter', 'none');
    }
  }

  _drawSidebar() {
    // Sidebar content
    this.sidebarContent = this.sidebarContainer.append('div')
      .attr('class', 'sidebar-content');
    
    // Add instruction text - centered in the middle
    this.sidebarInstruction = this.sidebarContent.append('div')
      .attr('class', 'sidebar-instruction')
      .html('Select a rocket line<br/>to view details');
    
    // Details container (initially hidden)
    this.sidebarDetails = this.sidebarContent.append('div')
      .attr('class', 'sidebar-details')
      .style('display', 'none');
  }

  _selectVehicle(vehicle) {
    this.selectedVehicle = vehicle;
    
    // Don't resize - sidebar is fixed
    // Just update chart visual state and sidebar content
    this._drawChart();
    
    // Update legend appearance
    this._updateLegendSelection();
    
    // Update sidebar
    this._updateSidebar();
  }

  _deselectVehicle() {
    if (!this.selectedVehicle) return;

    this.selectedVehicle = null;

    this._drawChart();
    
    // Reset legend appearance
    this._updateLegendSelection();

    // Reset sidebar
    this.sidebarDetails
      .style('display', 'none')
      .html('');

    this.sidebarInstruction
      .style('display', 'flex');
  }

  _updateSidebar() {
    const vehicleObj = this.vehicleData.find(v => v.vehicle === this.selectedVehicle);
    if (!vehicleObj) return;
    
    // Hide instruction, show details
    this.sidebarInstruction.style('display', 'none');
    this.sidebarDetails
      .style('display', 'block')
      .html('');
    
    // Title with bottom border
    this.sidebarDetails.append('h2')
      .text(vehicleObj.vehicle);
    
    // Stats
    const statsDiv = this.sidebarDetails.append('div')
      .style('margin-bottom', '20px');
    
    this._addStatItem(statsDiv, 'Total Satellites', vehicleObj.totalSatellites);
    this._addStatItem(statsDiv, 'Total Launches', vehicleObj.totalLaunches);
    
    // Efficiency Rating based on mass and power
    const rating = this._calculateRating(vehicleObj);
    const ratingDiv = this.sidebarDetails.append('div')
      .style('margin-bottom', '20px');
    
    ratingDiv.append('h5')
              .text('Rating');
    
    const starsDiv = ratingDiv.append('div');
    
    for (let i = 1; i <= 5; i++) {
      starsDiv.append('span')
        .style('color', i <= Math.round(rating) ? '#0066a6' : 'rgba(0, 102, 166, 0.2)')
        .style('font-size', '20px')
        .text('★');
    }
    
    // Add explanation
    ratingDiv.append('div')
      .style('font-size', '11px')
      .style('color', '#8fa9b9')
      .style('line-height', '1.5')
      .html('Based on satellite efficiency:<br/><strong style="color: #0066a6;">Lower launch mass + Lower power = Higher rating</strong><br/>Weighted: 60% mass, 40% power');
    
    // Description
    const aboutDiv = this.sidebarDetails.append('div');
    
    aboutDiv.append('h5')
      .text('ABOUT');
    aboutDiv.append('div')
      .style('font-size', '13px')
      .style('color', '#e0f0ff')
      .style('line-height', '1.6')
      .html(this._getVehicleInfo(vehicleObj.vehicle));
  }


  _addStatItem(container, label, value) {
    const item = container.append('div')
      .style('margin-bottom', '15px');
    
    item.append('h5')
      .text(label);
    
    item.append('div')
      .style('font-size', '20px')
      .style('font-weight', '700')
      .style('color', '#e0f0ff')
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
    // Get the actual chart container dimensions (80% of total)
    const chartBbox = this.chartContainer.node().getBoundingClientRect();
    
    this.w = Math.max(400, Math.floor(chartBbox.width));
    this.h = Math.max(500, Math.floor(chartBbox.height));
    
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
      .attr('transform', `translate(0, ${this.chartH + 68})`);
    
    this._initScales();
    this._drawAxes();
    this._drawChart();
    this._drawLegend();
  }
}