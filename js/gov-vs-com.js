// ---- gov-vs-com.js ----
class governmentVsCommercial {
  constructor(hostId, rawData) {
    this.host = d3.select('#' + hostId);
    this.node = this.host.node();
    this.rawData = rawData;

    this.updateDimensions();
    
    this.svg = this.host.append('svg')
      .attr('class', 'gov-vs-com-svg');

    this.chart = this.svg.append('g')
      .attr('class', 'chart-group');

    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip govcom-tip')
      .style('opacity', 0);

    this.data = this._processData();

    this.render();
    
    // Add resize listener
    window.addEventListener('resize', () => this.handleResize());
  }

  updateDimensions() {
    const box = this.node.getBoundingClientRect();
    this.w = Math.max(300, box.width || 700);
    this.h = Math.max(300, Math.min(600, box.height || 500));
    
    // Responsive margins
    const marginScale = Math.min(this.w / 700, 1);
    this.margin = { 
      top: 80 * marginScale, 
      right: 60 * marginScale, 
      bottom: 50 * marginScale, 
      left: 80 * marginScale 
    };
    
    this.chartW = this.w - this.margin.left - this.margin.right;
    this.chartH = this.h - this.margin.top - this.margin.bottom;
  }

  handleResize() {
    this.updateDimensions();
    this.render();
  }

  render() {
    this.svg
      .attr('width', this.w)
      .attr('height', this.h);

    this.chart
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    this._initScales();
    this._drawAxes();
    this._drawBars();
    this._addLabels();
    this._addLegend();
    this._updateTitle();
  }

  _processData() {
    const parseDate = str => {
      if (!str) return null;
      const yearMatch = String(str).match(/(\d{4})/);
      return yearMatch ? +yearMatch[1] : null;
    };

    const classify = ownerField => {
      if (!ownerField) return 'Other';
      const vals = Array.isArray(ownerField) ? ownerField : [ownerField];
      const normalized = vals.map(v => String(v).toLowerCase());
      if (normalized.includes('commercial')) return 'Commercial';
      if (normalized.includes('government')) return 'Government'; 
      return 'Other';
    };

    const yearly = {};

    this.rawData.forEach(d => {
      const year = parseDate(
        d.date_of_launch ||
        d['Date of Launch'] ||
        d['Launch Date'] ||
        d['Launch_Date'] ||
        d['Launch Date (UTC)'] ||
        d['Date']
      );

      const owner =
        d.owner ||
        d.ownership ||
        d['users'] ||
        d['operator/owner'] ||
        d['Operator/Owner'] ||
        d['Users'];

      if (!year) return;

      let owners = Array.isArray(owner)
        ? owner.map(o => String(o))
        : String(owner).split(/[;,/]+/).map(o => o.trim()).filter(Boolean);
      if (owners.length === 0) return;

      let govAdd = 0, comAdd = 0;
      if (
        owners.length > 1 &&
        owners.some(o => /gov/i.test(o)) &&
        owners.some(o => /com/i.test(o))
      ) {
        govAdd = 1;
        comAdd = 1;
      } else {
        const cat = classify(owners);
        if (cat === 'Government') govAdd = 1;
        else if (cat === 'Commercial') comAdd = 1;
      }

      if (!yearly[year]) yearly[year] = { year, government: 0, commercial: 0 };
      yearly[year].government += govAdd;
      yearly[year].commercial += comAdd;
    });

    return Object.values(yearly)
      .map(d => ({
        ...d,
        difference: d.commercial - d.government
      }))
      .sort((a, b) => a.year - b.year);
  }

  _initScales() {
    const maxVal = d3.max(this.data, d => Math.max(d.government, d.commercial));

    this.xScale = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([0, this.chartW / 2]);

    this.yScale = d3.scaleBand()
      .domain(this.data.map(d => d.year))
      .range([0, this.chartH])
      .padding(0.25);
  }

  _drawAxes() {
    this.chart.selectAll(".x-axis-left, .x-axis-right, .divider-line, .axis-title").remove();

    const tickCount = this.w < 500 ? 3 : 5;
    const xAxisLeft = d3.axisBottom(this.xScale.copy().range([this.chartW / 2, 0])).ticks(tickCount);
    const xAxisRight = d3.axisBottom(this.xScale).ticks(tickCount);

    this.chart.append('g')
      .attr('class', 'x-axis-left')
      .attr('transform', `translate(0, ${this.chartH})`)
      .call(xAxisLeft)
      .selectAll('text')
      .style('fill', '#6B9BD1')
      .style('font-size', this.w < 500 ? '10px' : '12px');

    this.chart.append('g')
      .attr('class', 'x-axis-right')
      .attr('transform', `translate(${this.chartW / 2}, ${this.chartH})`)
      .call(xAxisRight)
      .selectAll('text')
      .style('fill', '#6B9BD1')
      .style('font-size', this.w < 500 ? '10px' : '12px');

    this.chart.append('line')
      .attr('class', 'divider-line')
      .attr('x1', this.chartW / 2)
      .attr('x2', this.chartW / 2)
      .attr('y1', 0)
      .attr('y2', this.chartH)
      .attr('stroke', '#444')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');

    const fontSize = this.w < 500 ? '11px' : '13px';
    this.chart.append("text")
      .attr("class", "axis-title")
      .attr("x", this.chartW / 2)
      .attr("y", this.chartH + (this.w < 500 ? 35 : 40))
      .attr("text-anchor", "middle")
      .attr("fill", "#999")
      .attr("font-size", fontSize)
      .text("Number of Satellites Launched");
  }

  _drawBars() {
    const vis = this;
    const gap = this.w < 500 ? 20 : 35;

    this.chart.selectAll(".gov-bar, .com-bar").remove();

    this.chart.selectAll('.gov-bar')
      .data(this.data)
      .enter()
      .append('rect')
      .attr('class', 'gov-bar')
      .attr('x', d => vis.chartW / 2 - vis.xScale(d.government) - gap / 2)
      .attr('y', d => vis.yScale(d.year))
      .attr('width', d => vis.xScale(d.government))
      .attr('height', vis.yScale.bandwidth())
      .attr('fill', '#6B9BD1')
      .attr('rx', 2)
      .style('opacity', 0.9)
      .style('transition', 'opacity 0.2s, fill 0.2s')
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 1).attr('fill', '#8AB5E1');
        vis._showTip(event, d, 'Government');
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.9).attr('fill', '#6B9BD1');
        vis._hideTip();
      });

    this.chart.selectAll('.com-bar')
      .data(this.data)
      .enter()
      .append('rect')
      .attr('class', 'com-bar')
      .attr('x', vis.chartW / 2 + gap / 2)
      .attr('y', d => vis.yScale(d.year))
      .attr('width', d => vis.xScale(d.commercial))
      .attr('height', vis.yScale.bandwidth())
      .attr('fill', '#00D9FF')
      .attr('rx', 2)
      .style('opacity', 0.9)
      .style('transition', 'opacity 0.2s, fill 0.2s')
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 1).attr('fill', '#33E5FF');
        vis._showTip(event, d, 'Commercial');
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.9).attr('fill', '#00D9FF');
        vis._hideTip();
      });
  }

  _addLabels() {
    const vis = this;
    this.chart.selectAll('.year-label').remove();

    const fontSize = this.w < 500 ? '9px' : '11px';
    
    this.chart.selectAll('.year-label')
      .data(this.data)
      .enter()
      .append('text')
      .attr('class', 'year-label')
      .attr('x', this.chartW / 2)
      .attr('y', d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#E8E8E8')
      .attr('font-weight', 'bold')
      .style('font-size', fontSize)
      .text(d => d.year);
  }

  _addLegend() {
    const vis = this;
    this.chart.selectAll(".legend").remove();

    const legend = this.chart.append("g").attr("class", "legend");
    const categories = [
      { name: "Government", color: "#6B9BD1" },
      { name: "Commercial", color: "#00D9FF" }
    ];

    const spacing = this.w < 500 ? 110 : 150;
    const yOffset = this.w < 500 ? -30 : -60;
    const fontSize = this.w < 500 ? '11px' : '13px';
    const rectSize = this.w < 500 ? 16 : 18;

    legend.selectAll("rect")
      .data(categories)
      .enter()
      .append("rect")
      .attr("x", (d, i) => i * spacing)
      .attr("y", yOffset)
      .attr("width", rectSize)
      .attr("height", rectSize)
      .attr("rx", 3)
      .attr("fill", d => d.color)
      .style("opacity", 0.9)
      .style("cursor", "pointer")
      .on("click", function(e, d) {
        const cls = d.name === "Government" ? ".gov-bar" : ".com-bar";
        const bars = vis.chart.selectAll(cls);
        const currentOpacity = bars.style("opacity");
        const isVisible = parseFloat(currentOpacity) > 0.5;
        
        bars.transition()
          .duration(300)
          .style("opacity", isVisible ? 0.2 : 0.9);
        
        d3.select(this)
          .transition()
          .duration(300)
          .style("opacity", isVisible ? 0.3 : 0.9);
      });

    legend.selectAll("text")
      .data(categories)
      .enter()
      .append("text")
      .attr("x", (d, i) => i * spacing + rectSize + 8)
      .attr("y", yOffset + rectSize - 4)
      .attr("fill", "#E8E8E8")
      .attr("font-size", fontSize)
      .style("cursor", "pointer")
      .text(d => d.name)
      .on("click", function(e, d) {
        const cls = d.name === "Government" ? ".gov-bar" : ".com-bar";
        const bars = vis.chart.selectAll(cls);
        const currentOpacity = bars.style("opacity");
        const isVisible = parseFloat(currentOpacity) > 0.5;
        
        bars.transition()
          .duration(300)
          .style("opacity", isVisible ? 0.2 : 0.9);
        
        legend.selectAll("rect")
          .filter(cat => cat.name === d.name)
          .transition()
          .duration(300)
          .style("opacity", isVisible ? 0.3 : 0.9);
      });
  }

  _updateTitle() {
    this.chart.selectAll(".chart-title").remove();

    const fontSize = this.w < 500 ? '13px' : this.w < 700 ? '16px' : '18px';
    const yOffset = this.w < 500 ? -10 : -45;
    const titleText = this.w < 500 
      ? "Gov vs Commercial Launches"
      : "Government vs Commercial Satellite Launches";

    this.chart
      .append("text")
      .attr("class", "chart-title")
      .attr("x", this.chartW / 2)
      .attr("y", yOffset)
      .attr("text-anchor", "middle")
      .attr("fill", "#FFFFFF")
      .attr("font-weight", "bold")
      .style("font-size", fontSize)
      .text(titleText);
  }

  _showTip(event, d, side) {
    const val = side === 'Government' ? d.government : d.commercial;
    const html = `<strong>${side}</strong><br>Year: ${d.year}<br>Satellites: ${val}`;

    this.tooltip
      .style('opacity', 1)
      .html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  }

  _hideTip() {
    this.tooltip.style('opacity', 0);
  }
}
// // ---- gov-vs-com.js ----
// class governmentVsCommercial {
//   constructor(hostId, rawData) {
//     this.host = d3.select('#' + hostId);
//     this.node = this.host.node();
//     this.rawData = rawData;
//     this.mode = "split"; 

//     const box = this.node.getBoundingClientRect();
//     this.w = Math.max(700, box.width || 1000);
//     this.h = Math.max(400, box.height || 600);
//     this.margin = { top: 100, right: 100, bottom: 60, left: 100 };
//     this.chartW = this.w - this.margin.left - this.margin.right;
//     this.chartH = this.h - this.margin.top - this.margin.bottom;

//     this.svg = this.host.append('svg')
//       .attr('width', this.w)
//       .attr('height', this.h)
//       .attr('class', 'gov-vs-com-svg');

//     this.chart = this.svg.append('g')
//       .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

//     this.tooltip = d3.select('body')
//       .append('div')
//       .attr('class', 'tooltip govcom-tip')
//       .style('opacity', 0);

//     this.data = this._processData();

//     this._initScales();
//     this._drawAxes();
//     this._drawBars();
//     this._addLabels();
//     this._addLegend();
//     this._updateTitle();
//     this._addToggleButton();
//   }

//   _processData() {
//     const parseDate = str => {
//       if (!str) return null;
//       const yearMatch = String(str).match(/(\d{4})/);
//       return yearMatch ? +yearMatch[1] : null;
//     };

//     const classify = ownerField => {
//       if (!ownerField) return 'Other';
//       const vals = Array.isArray(ownerField) ? ownerField : [ownerField];
//       const normalized = vals.map(v => String(v).toLowerCase());
//       if (normalized.includes('commercial')) return 'Commercial';
//       if (normalized.includes('government')) return 'Government'; 
//       return 'Other';
//     };

//     const yearly = {};

//     this.rawData.forEach(d => {
//       const year = parseDate(
//         d.date_of_launch ||
//         d['Date of Launch'] ||
//         d['Launch Date'] ||
//         d['Launch_Date'] ||
//         d['Launch Date (UTC)'] ||
//         d['Date']
//       );

//       const owner =
//         d.owner ||
//         d.ownership ||
//         d['users'] ||
//         d['operator/owner'] ||
//         d['Operator/Owner'] ||
//         d['Users'];

//       if (!year) return;

//       let owners = Array.isArray(owner)
//         ? owner.map(o => String(o))
//         : String(owner).split(/[;,/]+/).map(o => o.trim()).filter(Boolean);
//       if (owners.length === 0) return;

//       let govAdd = 0, comAdd = 0;
//       if (
//         owners.length > 1 &&
//         owners.some(o => /gov/i.test(o)) &&
//         owners.some(o => /com/i.test(o))
//       ) {
//         govAdd = 1;
//         comAdd = 1;
//       } else {
//         const cat = classify(owners);
//         if (cat === 'Government') govAdd = 1;
//         else if (cat === 'Commercial') comAdd = 1;
//       }

//       if (!yearly[year]) yearly[year] = { year, government: 0, commercial: 0 };
//       yearly[year].government += govAdd;
//       yearly[year].commercial += comAdd;
//     });

//     return Object.values(yearly)
//       .map(d => ({
//         ...d,
//         difference: d.commercial - d.government
//       }))
//       .sort((a, b) => a.year - b.year);
//   }

//   _initScales() {
//     const maxVal = d3.max(this.data, d => Math.max(d.government, d.commercial, Math.abs(d.difference)));

//     this.xScale = d3.scaleLinear()
//       .domain([0, maxVal * 1.15])
//       .range([0, this.chartW / 2]);

//     this.diffScale = d3.scaleLinear()
//       .domain([-maxVal, maxVal])
//       .range([0, this.chartW]);

//     this.yScale = d3.scaleBand()
//       .domain(this.data.map(d => d.year))
//       .range([0, this.chartH])
//       .padding(0.25);

//     this.xLine = d3.scaleLinear()
//       .domain(d3.extent(this.data, d => d.year))
//       .range([0, this.chartW]);

//     this.yLine = d3.scaleLinear()
//       .domain([
//         d3.min(this.data, d => d.difference),
//         d3.max(this.data, d => d.difference)
//       ])
//       .nice()
//       .range([this.chartH, 0]);
//   }

//   _drawAxes() {
//     this.chart.selectAll(
//       ".x-axis-left, .x-axis-right, .divider-line, .diff-axis, .line-x-axis, .line-y-axis, .zero-line, .axis-title"
//     ).remove();

//     if (this.mode === "split") {
//       const xAxisLeft = d3.axisBottom(this.xScale.copy().range([this.chartW / 2, 0])).ticks(5);
//       const xAxisRight = d3.axisBottom(this.xScale).ticks(5);

//       this.chart.append('g')
//         .attr('class', 'x-axis-left')
//         .attr('transform', `translate(0, ${this.chartH})`)
//         .call(xAxisLeft)
//         .selectAll('text')
//         .style('fill', '#5e8cc7ff');

//       this.chart.append('g')
//         .attr('class', 'x-axis-right')
//         .attr('transform', `translate(${this.chartW / 2}, ${this.chartH})`)
//         .call(xAxisRight)
//         .selectAll('text')
//         .style('fill', '#5e8cc7ff');

//       this.chart.append('line')
//         .attr('class', 'divider-line')
//         .attr('x1', this.chartW / 2)
//         .attr('x2', this.chartW / 2)
//         .attr('y1', 0)
//         .attr('y2', this.chartH)
//         .attr('stroke', '#555')
//         .attr('stroke-width', 1)
//         .attr('stroke-dasharray', '3,3');

//       this.chart.append("text")
//         .attr("class", "axis-title")
//         .attr("x", this.chartW / 2)
//         .attr("y", this.chartH + 45)
//         .attr("text-anchor", "middle")
//         .attr("fill", "#ccc")
//         .attr("font-size", "13px")
//         .text("Number of Satellites Launched");
//     } 
//     else {
//       const xAxis = d3.axisBottom(this.xLine).tickFormat(d3.format("d"));
//       const yAxis = d3.axisLeft(this.yLine).ticks(6);

//       this.chart.append("g")
//         .attr("class", "line-x-axis")
//         .attr("transform", `translate(0, ${this.chartH})`)
//         .call(xAxis)
//         .selectAll("text")
//         .style("fill", "#ddd");

//       this.chart.append("g")
//         .attr("class", "line-y-axis")
//         .call(yAxis)
//         .selectAll("text")
//         .style("fill", "#ddd");

//       this.chart.append("line")
//         .attr("class", "zero-line")
//         .attr("x1", 0)
//         .attr("x2", this.chartW)
//         .attr("y1", this.yLine(0))
//         .attr("y2", this.yLine(0))
//         .attr("stroke", "#555")
//         .attr("stroke-width", 1)
//         .attr("stroke-dasharray", "4,3");

//       this.chart.append("text")
//         .attr("class", "axis-title")
//         .attr("x", this.chartW / 2)
//         .attr("y", this.chartH + 45)
//         .attr("text-anchor", "middle")
//         .attr("fill", "#ccc")
//         .attr("font-size", "13px")
//         .text("Year");

//       this.chart.append("text")
//         .attr("class", "axis-title")
//         .attr("transform", "rotate(-90)")
//         .attr("x", -this.chartH / 2)
//         .attr("y", -60)
//         .attr("text-anchor", "middle")
//         .attr("fill", "#ccc")
//         .attr("font-size", "13px")
//         .text("Net Difference in Launches (Commercial – Government)");
//     }
//   }

//   _drawBars() {
//     const vis = this;
//     const gap = 35;

//     this.chart.selectAll(".gov-bar, .com-bar, .diff-bar, .year-label, .trend-line, .trend-dot").remove();

//     if (this.mode === "split") {
//       this.chart.selectAll('.gov-bar')
//         .data(this.data)
//         .enter()
//         .append('rect')
//         .attr('class', 'gov-bar')
//         .attr('x', d => vis.chartW / 2 - vis.xScale(d.government) - gap / 2)
//         .attr('y', d => vis.yScale(d.year))
//         .attr('width', d => vis.xScale(d.government))
//         .attr('height', vis.yScale.bandwidth())
//         .attr('fill', '#5e8cc7ff')
//         .on('mouseover', (event, d) => vis._showTip(event, d, 'Government'))
//         .on('mouseout', () => vis._hideTip());

//       this.chart.selectAll('.com-bar')
//         .data(this.data)
//         .enter()
//         .append('rect')
//         .attr('class', 'com-bar')
//         .attr('x', vis.chartW / 2 + gap / 2)
//         .attr('y', d => vis.yScale(d.year))
//         .attr('width', d => vis.xScale(d.commercial))
//         .attr('height', vis.yScale.bandwidth())
//         .attr('fill', '#00d4ff')
//         .on('mouseover', (event, d) => vis._showTip(event, d, 'Commercial'))
//         .on('mouseout', () => vis._hideTip());

//       this._addLabels();
//     } else {
//       const line = d3.line()
//         .x(d => vis.xLine(d.year))
//         .y(d => vis.yLine(d.difference))
//         .curve(d3.curveMonotoneX);

//       this.chart.append("path")
//         .datum(this.data)
//         .attr("class", "trend-line")
//         .attr("fill", "none")
//         .attr("stroke", "#00d4ff")
//         .attr("stroke-width", 2)
//         .attr("d", line);

//       this.chart.selectAll(".trend-dot")
//         .data(this.data)
//         .enter()
//         .append("circle")
//         .attr("class", "trend-dot")
//         .attr("cx", d => vis.xLine(d.year))
//         .attr("cy", d => vis.yLine(d.difference))
//         .attr("r", 4)
//         .attr("fill", d => d.difference >= 0 ? "#00d4ff" : "#5fa8d3")
//         .on("mouseover", (event, d) => vis._showTip(event, d, "Difference"))
//         .on("mouseout", () => vis._hideTip());
//     }
//   }

//   _addLabels() {
//     const vis = this;
//     this.chart.selectAll('.year-label')
//       .data(this.data)
//       .enter()
//       .append('text')
//       .attr('class', 'year-label')
//       .attr('x', this.chartW / 2)
//       .attr('y', d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2 + 4)
//       .attr('text-anchor', 'middle')
//       .attr('fill', '#eee')
//       .attr('font-weight', 'bold')
//       .style('font-size', '11px')
//       .text(d => d.year);
//   }

//   _addLegend() {
//     const vis = this;

//     this.chart.selectAll(".legend").remove();

//     const legend = this.chart.append("g").attr("class", "legend");
//     const categories = [
//       { name: "Government", color: "#5fa8d3" },
//       { name: "Commercial", color: "#00d4ff" }
//     ];

//     legend.selectAll("rect")
//       .data(categories)
//       .enter()
//       .append("rect")
//       .attr("x", (d, i) => i * 150)
//       .attr("y", -70)
//       .attr("width", 20)
//       .attr("height", 20)
//       .attr("fill", d => d.color)
//       .style("cursor", "pointer")
//       .style("opacity", this.mode === "split" ? 1 : 0.4)
//       .on("click", (e, d) => {
//         if (vis.mode !== "split") return; 
//         const cls = d.name === "Government" ? ".gov-bar" : ".com-bar";
//         const visible = d3.selectAll(cls).style("opacity") === "1";
//         d3.selectAll(cls)
//           .transition()
//           .duration(300)
//           .style("opacity", visible ? 0 : 1);
//       });

//     legend.selectAll("text")
//       .data(categories)
//       .enter()
//       .append("text")
//       .attr("x", (d, i) => i * 150 + 30)
//       .attr("y", -55)
//       .attr("fill", d => d.color)
//       .attr("font-size", "13px")
//       .text(d => d.name);
//   }

//   _addToggleButton() {
//     const vis = this;

//     const button = this.chart.append("g")
//       .attr("class", "toggle-btn")
//       .attr("transform", `translate(${this.chartW - 250}, -70)`)
//       .style("cursor", "pointer")
//       .on("click", () => {
//         vis.mode = vis.mode === "split" ? "trend" : "split";
//         vis._drawAxes();
//         vis._drawBars();
//         vis._addLegend();
//         vis._updateTitle();
//       });

//     button.append("rect")
//       .attr("width", 150)
//       .attr("height", 25)
//       .attr("rx", 6)
//       .attr("fill", "#222")
//       .attr("stroke", "#5fa8d3")
//       .attr("stroke-width", 1.5);

//     button.append("text")
//       .attr("x", 75)
//       .attr("y", 17)
//       .attr("text-anchor", "middle")
//       .attr("fill", "#5fa8d3")
//       .attr("font-size", "13px")
//       .attr("font-family", "monospace")
//       .text("Switch View");
//   }

//   _updateTitle() {
//     this.chart.selectAll(".chart-title").remove();

//     const titleText =
//       this.mode === "split"
//         ? "Government vs Commercial Satellite Launches by Year"
//         : "Net Advantage of Commercial Satellite Launches Over Time";

//     this.chart
//       .append("text")
//       .attr("class", "chart-title")
//       .attr("x", this.chartW / 2)
//       .attr("y", -90)
//       .attr("text-anchor", "middle")
//       .attr("fill", "#fff")
//       .attr("font-weight", "bold")
//       .style("font-size", "18px")
//       .text(titleText);
//   }

//   _showTip(event, d, side) {
//     let html = "";
//     if (side === "Difference") {
//       html = `<strong>Year:</strong> ${d.year}<br>
//               <strong>Diff:</strong> ${d.difference.toFixed(1)} 
//               (${d.difference > 0 ? "Commercial > Government" : "Government > Commercial"})`;
//     } else {
//       const val = side === 'Government' ? d.government : d.commercial;
//       html = `<strong>${side}</strong><br>Year: ${d.year}<br>Satellites: ${val}`;
//     }

//     this.tooltip
//       .style('opacity', 1)
//       .html(html)
//       .style('left', (event.pageX + 10) + 'px')
//       .style('top', (event.pageY - 20) + 'px');
//   }

//   _hideTip() {
//     this.tooltip.style('opacity', 0);
//   }
// }