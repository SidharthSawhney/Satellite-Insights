/**
 * LaunchDominance Visualization
 * -----------------------------
 * Displays rockets representing launch vehicles with fixed X-axis.
 * X-axis: Launch vehicle (fixed), Y-axis: Number of launches (changes by year)
 * Size of rocket: Average mass, Click for details in sidebar
 */

class LaunchDominance {
  /**
   * Create a LaunchDominance visualization.
   * @param {string} hostId - The ID of the container element.
   * @param {Array<{launch_vehicle:string, year:number, num_satellites:number, avg_launch_mass_kg:number, avg_dry_mass_kg:number, avg_power_watts:number}>} data - Launch vehicle data.
   * @param {Object} opts - Optional layout settings.
   */
  constructor(hostId, data, opts = {}) {
    this.host = d3.select('#' + hostId);
    this.node = this.host.node();
    this.rawData = data;
    
    // Visualization parameters
    this.w = opts.width ?? this.node.clientWidth ?? 1200;
    this.h = opts.height ?? this.node.clientHeight ?? 700;
    this.margin = { top: 80, right: 250, bottom: 120, left: 80 };
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
    
    // State
    this.selectedYear = 'overall';
    this.selectedRocket = null;
    this.hasAnimated = false;
    
    // Build DOM layers
    this._buildScaffold();
    
    // Process data and render
    this._processData();
    this._initScales();
    this._drawAxes();
    this._drawChart();
    this._drawSlider();
    this._drawSidebar();
    this._setupScrollAnimation();
    
    // Handle responsive resize
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.host.node());
    }
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Builds the HTML structure
   */
  _buildScaffold() {
    // Main container
    this.container = this.host.append('div')
      .attr('class', 'launch-dom-container')
      .style('position', 'relative')
      .style('width', '100%')
      .style('height', '100%');
    
    // SVG for chart
    this.svg = this.container.append('svg')
      .attr('class', 'launch-dom-svg')
      .attr('width', this.w)
      .attr('height', this.h)
      .style('background', 'transparent');
    
    this.chartGroup = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Axes groups
    this.xAxisGroup = this.chartGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.chartH})`);
    
    this.yAxisGroup = this.chartGroup.append('g')
      .attr('class', 'y-axis');
    
    // Chart elements group
    this.rocketsGroup = this.chartGroup.append('g')
      .attr('class', 'rockets');
    
    // Tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'launch-dom-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '8px')
      .style('font-size', '14px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');
    
    // Slider container
    this.sliderContainer = this.container.append('div')
      .attr('class', 'year-slider-container')
      .style('position', 'absolute')
      .style('top', '10px')
      .style('left', '10px')
      .style('background', 'rgba(0, 0, 0, 0.7)')
      .style('padding', '10px 20px')
      .style('border-radius', '8px')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '12px')
      .style('z-index', '10');
    
    // Sidebar
    this.sidebar = this.container.append('div')
      .attr('class', 'launch-dom-sidebar')
      .style('position', 'absolute')
      .style('right', '0')
      .style('top', '0')
      .style('width', '0')
      .style('height', '100%')
      .style('background', 'rgba(0, 0, 0, 0.95)')
      .style('overflow-y', 'auto')
      .style('overflow-x', 'hidden')
      .style('transition', 'width 0.3s ease')
      .style('padding', '0')
      .style('border-left', '2px solid #4a90e2')
      .style('z-index', '100');
  }

  /**
   * Process raw data into aggregated format with fixed vehicle list
   */
  _processData() {
    // Get ALL unique launch vehicles from the entire dataset
    const allVehicles = [...new Set(this.rawData.map(d => d.launch_vehicle))];
    
    // Calculate overall stats to determine top 15 vehicles
    const overallMap = new Map();
    this.rawData.forEach(d => {
      if (!overallMap.has(d.launch_vehicle)) {
        overallMap.set(d.launch_vehicle, {
          launch_vehicle: d.launch_vehicle,
          num_satellites: 0,
          avg_launch_mass_kg: 0,
          avg_dry_mass_kg: 0,
          avg_power_watts: 0,
          count: 0
        });
      }
      const entry = overallMap.get(d.launch_vehicle);
      entry.num_satellites += d.num_satellites;
      entry.avg_launch_mass_kg += d.avg_launch_mass_kg * d.num_satellites;
      entry.avg_dry_mass_kg += d.avg_dry_mass_kg * d.num_satellites;
      entry.avg_power_watts += d.avg_power_watts * d.num_satellites;
      entry.count += d.num_satellites;
    });
    
    // Get top 15 vehicles by total satellites
    const overallData = Array.from(overallMap.values()).map(d => ({
      launch_vehicle: d.launch_vehicle,
      num_satellites: d.num_satellites,
      avg_launch_mass_kg: d.avg_launch_mass_kg / d.count,
      avg_dry_mass_kg: d.avg_dry_mass_kg / d.count,
      avg_power_watts: d.avg_power_watts / d.count
    }));
    
    // Calculate efficiency metric (lower mass and power = more efficient)
    // Normalize and invert so lower values get higher scores
    const masses = overallData.map(d => d.avg_launch_mass_kg).filter(m => m > 0);
    const powers = overallData.map(d => d.avg_power_watts).filter(p => p > 0);
    const minMass = Math.min(...masses);
    const maxMass = Math.max(...masses);
    const minPower = Math.min(...powers);
    const maxPower = Math.max(...powers);
    
    overallData.forEach(d => {
      // Normalize mass and power (0-1), then invert (1 = most efficient)
      const massScore = d.avg_launch_mass_kg > 0 ? 
        1 - ((d.avg_launch_mass_kg - minMass) / (maxMass - minMass)) : 0.5;
      const powerScore = d.avg_power_watts > 0 ? 
        1 - ((d.avg_power_watts - minPower) / (maxPower - minPower)) : 0.5;
      
      // Combine scores (weighted: 60% mass, 40% power) and scale to 1-5
      const efficiency = ((massScore * 0.6 + powerScore * 0.4) * 4) + 1;
      d.efficiency_rating = Math.max(1, Math.min(5, efficiency));
    });
    
    const top15Vehicles = overallData
      .sort((a, b) => b.num_satellites - a.num_satellites)
      .slice(0, 15)
      .map(d => d.launch_vehicle);
    
    // Fix the vehicle list for all years
    this.fixedVehicles = top15Vehicles;
    
    // Get unique years
    const years = [...new Set(this.rawData.map(d => d.year))].sort();
    this.years = ['overall', ...years];
    
    // Create data for each year with fixed vehicle list
    this.dataByYear = {};
    
    // Helper function to calculate efficiency
    const calculateEfficiency = (data) => {
      const masses = data.map(d => d.avg_launch_mass_kg).filter(m => m > 0);
      const powers = data.map(d => d.avg_power_watts).filter(p => p > 0);
      
      if (masses.length === 0 || powers.length === 0) return;
      
      const minMass = Math.min(...masses);
      const maxMass = Math.max(...masses);
      const minPower = Math.min(...powers);
      const maxPower = Math.max(...powers);
      
      data.forEach(d => {
        if (d.num_satellites === 0) {
          d.efficiency_rating = 0;
          return;
        }
        
        const massScore = d.avg_launch_mass_kg > 0 ? 
          1 - ((d.avg_launch_mass_kg - minMass) / (maxMass - minMass || 1)) : 0.5;
        const powerScore = d.avg_power_watts > 0 ? 
          1 - ((d.avg_power_watts - minPower) / (maxPower - minPower || 1)) : 0.5;
        
        // Combine scores (60% mass, 40% power) and scale to 1-5
        const efficiency = ((massScore * 0.6 + powerScore * 0.4) * 4) + 1;
        d.efficiency_rating = Math.max(1, Math.min(5, efficiency));
      });
    };
    
    // Overall data
    this.dataByYear.overall = this.fixedVehicles.map(vehicle => {
      const entry = overallMap.get(vehicle);
      const overallEntry = overallData.find(d => d.launch_vehicle === vehicle);
      return entry ? {
        launch_vehicle: vehicle,
        num_satellites: entry.num_satellites,
        avg_launch_mass_kg: entry.avg_launch_mass_kg / entry.count,
        avg_dry_mass_kg: entry.avg_dry_mass_kg / entry.count,
        avg_power_watts: entry.avg_power_watts / entry.count,
        efficiency_rating: overallEntry ? overallEntry.efficiency_rating : 0
      } : {
        launch_vehicle: vehicle,
        num_satellites: 0,
        avg_launch_mass_kg: 0,
        avg_dry_mass_kg: 0,
        avg_power_watts: 0,
        efficiency_rating: 0
      };
    });
    
    // Year-specific data
    years.forEach(year => {
      const yearMap = new Map();
      this.rawData
        .filter(d => d.year === year)
        .forEach(d => {
          if (!yearMap.has(d.launch_vehicle)) {
            yearMap.set(d.launch_vehicle, {
              launch_vehicle: d.launch_vehicle,
              num_satellites: 0,
              avg_launch_mass_kg: 0,
              avg_dry_mass_kg: 0,
              avg_power_watts: 0,
              count: 0
            });
          }
          const entry = yearMap.get(d.launch_vehicle);
          entry.num_satellites += d.num_satellites;
          entry.avg_launch_mass_kg += d.avg_launch_mass_kg * d.num_satellites;
          entry.avg_dry_mass_kg += d.avg_dry_mass_kg * d.num_satellites;
          entry.avg_power_watts += d.avg_power_watts * d.num_satellites;
          entry.count += d.num_satellites;
        });
      
      // Create data for all fixed vehicles (0 if not present in year)
      this.dataByYear[year] = this.fixedVehicles.map(vehicle => {
        const entry = yearMap.get(vehicle);
        return entry ? {
          launch_vehicle: vehicle,
          num_satellites: entry.num_satellites,
          avg_launch_mass_kg: entry.avg_launch_mass_kg / entry.count,
          avg_dry_mass_kg: entry.avg_dry_mass_kg / entry.count,
          avg_power_watts: entry.avg_power_watts / entry.count
        } : {
          launch_vehicle: vehicle,
          num_satellites: 0,
          avg_launch_mass_kg: 0,
          avg_dry_mass_kg: 0,
          avg_power_watts: 0
        };
      });
      
      // Calculate efficiency for this year
      calculateEfficiency(this.dataByYear[year]);
    });
    
    // Store cumulative launch history by vehicle for timeline graphs
    this.launchHistory = {};
    this.fixedVehicles.forEach(vehicle => {
      const history = [];
      let cumulative = 0;
      years.forEach(year => {
        const yearData = this.dataByYear[year].find(d => d.launch_vehicle === vehicle);
        if (yearData) {
          cumulative += yearData.num_satellites;
        }
        history.push({ year, count: cumulative });
      });
      this.launchHistory[vehicle] = history;
    });
    
    this.currentData = this.dataByYear[this.selectedYear];
  }

  /**
   * Initialize scales
   */
  _initScales() {
    // X scale - categorical for FIXED launch vehicles
    this.xScale = d3.scaleBand()
      .domain(this.fixedVehicles)
      .range([0, this.chartW])
      .padding(0.3);
    
    // Y scale - linear for number of satellites (use max across all data)
    const maxSatellites = d3.max(Object.values(this.dataByYear).flat(), d => d.num_satellites);
    this.yScale = d3.scaleLinear()
      .domain([0, maxSatellites * 1.1])
      .range([this.chartH, 0]);
    
    // Size scale for rocket images based on average mass
    const allMasses = Object.values(this.dataByYear).flat()
      .map(d => d.avg_launch_mass_kg)
      .filter(m => m > 0);
    const massExtent = d3.extent(allMasses);
    this.sizeScale = d3.scaleLinear()
      .domain(massExtent)
      .range([30, 80])
      .clamp(true);
  }

  /**
   * Draw axes
   */
  _drawAxes() {
    // X axis
    const xAxis = d3.axisBottom(this.xScale);
    this.xAxisGroup
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', 'white')
      .style('font-size', '12px');
    
    this.xAxisGroup.selectAll('line, path')
      .style('stroke', 'white')
      .style('stroke-width', '2px');
    
    // Y axis
    const yAxis = d3.axisLeft(this.yScale)
      .ticks(8)
      .tickFormat(d => d3.format('.0f')(d));
    
    this.yAxisGroup
      .call(yAxis)
      .selectAll('text')
      .style('fill', 'white')
      .style('font-size', '12px');
    
    this.yAxisGroup.selectAll('line, path')
      .style('stroke', 'white')
      .style('stroke-width', '2px');
    
    // Y axis label
    this.yAxisGroup.selectAll('.y-axis-label').remove();
    this.yAxisGroup.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -this.chartH / 2)
      .attr('text-anchor', 'middle')
      .style('fill', 'white')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Number of Satellites');
  }

  /**
   * Draw the rockets (no lollipop stems)
   */
  _drawChart() {
    const self = this;
    
    // Bind data
    const rockets = this.rocketsGroup
      .selectAll('.rocket')
      .data(this.currentData, d => d.launch_vehicle);
    
    // Exit
    rockets.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();
    
    // Enter
    const rocketsEnter = rockets.enter()
      .append('g')
      .attr('class', 'rocket')
      .style('opacity', 0);
    
    // Add rocket images
    rocketsEnter.append('image')
      .attr('class', 'rocket-image')
      .attr('href', '../images/rocket.webp');
    
    // Merge enter and update selections
    const rocketsMerged = rocketsEnter.merge(rockets);
    
    // Update rocket positions and sizes
    rocketsMerged.select('.rocket-image')
      .each(function(d) {
        const size = d.avg_launch_mass_kg > 0 ? self.sizeScale(d.avg_launch_mass_kg) : 40;
        d._size = size;
      })
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr('x', d => self.xScale(d.launch_vehicle) + self.xScale.bandwidth() / 2 - d._size / 2)
      .attr('y', d => d.num_satellites > 0 ? self.yScale(d.num_satellites) - d._size / 2 : self.chartH - d._size / 2)
      .attr('width', d => d._size)
      .attr('height', d => d._size)
      .style('opacity', d => d.num_satellites > 0 ? 1 : 0.2);
    
    // Fade in
    rocketsMerged
      .transition()
      .duration(500)
      .style('opacity', 1);
    
    // Interactions
    rocketsMerged
      .on('mouseover', function(event, d) {
        if (d.num_satellites === 0) return;
        
        const size = d._size || 40;
        d3.select(this).select('.rocket-image')
          .transition()
          .duration(200)
          .attr('width', size * 1.2)
          .attr('height', size * 1.2)
          .attr('x', self.xScale(d.launch_vehicle) + self.xScale.bandwidth() / 2 - size * 1.2 / 2)
          .attr('y', self.yScale(d.num_satellites) - size * 1.2 / 2);
        
        self.tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${d.launch_vehicle}</strong><br/>
            Satellites: ${d.num_satellites}<br/>
            Avg Launch Mass: ${d3.format('.1f')(d.avg_launch_mass_kg)} kg<br/>
            Avg Dry Mass: ${d3.format('.1f')(d.avg_dry_mass_kg)} kg<br/>
            Avg Power: ${d3.format('.1f')(d.avg_power_watts)} watts
          `);
      })
      .on('mousemove', function(event) {
        self.tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 15) + 'px');
      })
      .on('mouseout', function(event, d) {
        if (d.num_satellites === 0) return;
        
        const size = d._size || 40;
        d3.select(this).select('.rocket-image')
          .transition()
          .duration(200)
          .attr('width', size)
          .attr('height', size)
          .attr('x', self.xScale(d.launch_vehicle) + self.xScale.bandwidth() / 2 - size / 2)
          .attr('y', self.yScale(d.num_satellites) - size / 2);
        
        self.tooltip.style('visibility', 'hidden');
      })
      .on('click', function(event, d) {
        if (d.num_satellites === 0) return;
        self.selectedRocket = d;
        self._updateSidebar(d);
      });
    
    this.rocketSel = rocketsMerged;
  }

  /**
   * Setup scroll animation for initial appearance
   */
  _setupScrollAnimation() {
    const section = document.getElementById('liftOffSection2');
    if (!section) return;
    
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated) {
          this.hasAnimated = true;
          this._animateRocketsUp();
        }
      });
    }, { threshold: 0.3 });
    
    observer.observe(section);
  }

  /**
   * Animate rockets moving up from bottom
   */
  _animateRocketsUp() {
    const self = this;
    
    this.rocketSel.each(function(d, i) {
      const rocket = d3.select(this).select('.rocket-image');
      const size = d._size || 40;
      const finalY = d.num_satellites > 0 ? self.yScale(d.num_satellites) - size / 2 : self.chartH - size / 2;
      const finalOpacity = d.num_satellites > 0 ? 1 : 0.2;
      
      // Start from the bottom (y = chartH, which is the baseline/0 point)
      rocket
        .attr('y', self.chartH - size / 2)
        .style('opacity', 0.3);
      
      // Animate up with stagger
      rocket
        .transition()
        .delay(i * 100)
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr('y', finalY)
        .style('opacity', finalOpacity);
    });
  }

  /**
   * Draw year slider
   */
  _drawSlider() {
    this.sliderContainer.html('');
    
    this.sliderContainer.append('label')
      .style('color', 'white')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Year:');
    
    // Year label that shows current selection
    this.yearLabel = this.sliderContainer.append('span')
      .attr('class', 'year-label-display')
      .style('color', 'white')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('min-width', '100px')
      .style('text-align', 'center')
      .text(this.selectedYear === 'overall' ? 'Overall' : this.selectedYear);
    
    // Range slider
    const slider = this.sliderContainer.append('input')
      .attr('type', 'range')
      .attr('class', 'year-slider-range')
      .attr('min', 0)
      .attr('max', this.years.length - 1)
      .attr('value', this.years.indexOf(this.selectedYear))
      .style('width', '200px')
      .on('input', (event) => {
        const index = +event.target.value;
        this.selectedYear = this.years[index];
        this.yearLabel.text(this.selectedYear === 'overall' ? 'Overall' : this.selectedYear);
        this._updateChart();
      });
  }

  /**
   * Update chart when year changes (with animation)
   */
  _updateChart() {
    this.currentData = this.dataByYear[this.selectedYear];
    this._drawChart();
  }

  /**
   * Initialize sidebar structure
   */
  _drawSidebar() {
    this.sidebar.html('');
    
    const closeBtn = this.sidebar.append('button')
      .attr('class', 'sidebar-close')
      .style('position', 'absolute')
      .style('top', '10px')
      .style('right', '10px')
      .style('background', 'transparent')
      .style('border', 'none')
      .style('color', 'white')
      .style('font-size', '24px')
      .style('cursor', 'pointer')
      .style('z-index', '1000')
      .text('×')
      .on('click', () => this._closeSidebar());
    
    this.sidebarContent = this.sidebar.append('div')
      .attr('class', 'sidebar-content')
      .style('padding', '50px 20px 20px 20px')
      .style('color', 'white')
      .style('overflow-y', 'auto')
      .style('height', 'calc(100% - 70px)')
      .style('box-sizing', 'border-box');
  }

  /**
   * Update sidebar with rocket details
   */
  _updateSidebar(data) {
    this.sidebar.style('width', '300px').style('padding', '0');
    
    this.sidebarContent.html('');
    
    // Title
    this.sidebarContent.append('h2')
      .style('font-size', '20px')
      .style('margin-bottom', '20px')
      .style('color', '#4a90e2')
      .text(data.launch_vehicle);
    
    // Rocket image
    this.sidebarContent.append('img')
      .attr('src', '../images/rocket.webp')
      .style('width', '100%')
      .style('max-width', '150px')
      .style('display', 'block')
      .style('margin', '0 auto 20px auto');
    
    // Total Satellites (keep this one)
    const totalSatDiv = this.sidebarContent.append('div')
      .style('margin-bottom', '20px')
      .style('padding-bottom', '15px')
      .style('border-bottom', '1px solid #333');
    
    totalSatDiv.append('div')
      .style('font-size', '12px')
      .style('color', '#999')
      .style('margin-bottom', '5px')
      .text('Total Satellites');
    
    totalSatDiv.append('div')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('color', '#4a90e2')
      .text(data.num_satellites);
    
    // Efficiency Rating
    const efficiencyDiv = this.sidebarContent.append('div')
      .style('margin-bottom', '20px')
      .style('padding', '15px')
      .style('background', 'rgba(74, 144, 226, 0.1)')
      .style('border-radius', '8px')
      .style('border-left', '3px solid #4a90e2');
    
    efficiencyDiv.append('div')
      .style('font-size', '12px')
      .style('color', '#999')
      .style('margin-bottom', '8px')
      .text('Efficiency Rating');
    
    const rating = data.efficiency_rating || 0;
    const starsDiv = efficiencyDiv.append('div')
      .style('font-size', '24px')
      .style('margin-bottom', '8px');
    
    // Draw stars
    for (let i = 1; i <= 5; i++) {
      starsDiv.append('span')
        .style('color', i <= Math.round(rating) ? '#FFD700' : '#444')
        .text('★');
    }
    
    efficiencyDiv.append('div')
      .style('font-size', '11px')
      .style('color', '#999')
      .style('margin-top', '5px')
      .html('Based on mass & power efficiency<br/>(Lower mass & power = Higher rating)');
    
    // Launch Timeline Graph
    const timelineDiv = this.sidebarContent.append('div')
      .style('margin-bottom', '20px');
    
    timelineDiv.append('div')
      .style('font-size', '14px')
      .style('color', '#4a90e2')
      .style('margin-bottom', '10px')
      .style('font-weight', 'bold')
      .text('Cumulative Launches Over Time');
    
    // Create mini line graph
    const history = this.launchHistory[data.launch_vehicle] || [];
    if (history.length > 0) {
      const graphWidth = 260;
      const graphHeight = 100;
      const margin = { top: 10, right: 10, bottom: 25, left: 35 };
      const innerWidth = graphWidth - margin.left - margin.right;
      const innerHeight = graphHeight - margin.top - margin.bottom;
      
      const svg = timelineDiv.append('svg')
        .attr('width', graphWidth)
        .attr('height', graphHeight)
        .style('background', 'rgba(0, 0, 0, 0.3)')
        .style('border-radius', '4px');
      
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(history, d => d.year))
        .range([0, innerWidth]);
      
      const yScale = d3.scaleLinear()
        .domain([0, d3.max(history, d => d.count)])
        .range([innerHeight, 0]);
      
      // Line generator
      const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.count))
        .curve(d3.curveMonotoneX);
      
      // Draw line
      g.append('path')
        .datum(history)
        .attr('fill', 'none')
        .attr('stroke', '#4a90e2')
        .attr('stroke-width', 2)
        .attr('d', line);
      
      // Draw dots
      g.selectAll('circle')
        .data(history)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.count))
        .attr('r', 3)
        .attr('fill', '#4a90e2');
      
      // X axis
      const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d3.format('d'));
      
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .style('fill', 'white')
        .style('font-size', '10px');
      
      g.selectAll('.domain, .tick line')
        .style('stroke', '#666');
      
      // Y axis
      const yAxis = d3.axisLeft(yScale)
        .ticks(4);
      
      g.append('g')
        .call(yAxis)
        .selectAll('text')
        .style('fill', 'white')
        .style('font-size', '10px');
      
      g.selectAll('.domain, .tick line')
        .style('stroke', '#666');
    }
    
    // Company info placeholder
    this.sidebarContent.append('div')
      .style('margin-top', '20px')
      .style('padding', '15px')
      .style('background', 'rgba(74, 144, 226, 0.1)')
      .style('border-radius', '8px')
      .style('font-size', '12px')
      .style('line-height', '1.6')
      .html(`
        <strong>About the Launch Vehicle:</strong><br/>
        ${this._getCompanyInfo(data.launch_vehicle)}
      `);
  }

  /**
   * Get company information (placeholder)
   */
  _getCompanyInfo(vehicle) {
    const info = {
      'Falcon 9': 'SpaceX\'s workhorse rocket, featuring reusable first-stage boosters. It has revolutionized the launch industry with cost-effective and reliable access to space.',
      'Ariane 5': 'ESA\'s heavy-lift launch vehicle, known for reliability and used for commercial and scientific missions.',
      'Atlas V': 'United Launch Alliance\'s reliable launcher for government and commercial payloads.',
      'Soyuz': 'Russia\'s proven launch system with decades of operational history.',
      'Long March': 'China\'s family of launch vehicles for various payload capacities.'
    };
    
    return info[vehicle] || 'A launch vehicle designed to deliver payloads to orbit with high reliability and efficiency.';
  }

  /**
   * Close sidebar
   */
  _closeSidebar() {
    this.sidebar.style('width', '0').style('padding', '0');
    this.selectedRocket = null;
  }

  /**
   * Handle window resize
   */
  resize() {
    const bbox = this.host.node().getBoundingClientRect();
    this.w = Math.max(800, Math.floor(bbox.width));
    this.h = Math.max(400, Math.floor(bbox.height));
    
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
    
    this.svg
      .attr('width', this.w)
      .attr('height', this.h);
    
    this.chartGroup
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.xAxisGroup
      .attr('transform', `translate(0,${this.chartH})`);
    
    this._initScales();
    this._drawAxes();
    this._drawChart();
  }
}