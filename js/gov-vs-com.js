// ---- gov-vs-com.js ----
class governmentVsCommercial {
  constructor(hostId, rawData) {
    this.host = d3.select('#' + hostId);
    this.node = this.host.node();
    this.rawData = rawData;

    this.updateDimensions();

    this.svg = this.host.append('svg')
      .attr('class', 'gov-vs-com-svg')
      .on('click', () => {
        // Hide info tooltip when clicking anywhere on the chart
        if (this.infoTooltipVisible) {
          this._hideInfoTip();
        }
      });

    this.chart = this.svg.append('g')
      .attr('class', 'chart-group');

    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip govcom-tip')
      .style('opacity', 0);
    
    this.infoTooltipVisible = false;

    this.data = this._processData();

    this.render();

    // Add resize listener
    window.addEventListener('resize', () => this.handleResize());
  }

  updateDimensions() {
    const box = this.node.getBoundingClientRect();
    this.w = Math.max(300, box.width || 700);
    this.h = Math.max(400, box.height || 700);

    // Responsive margins - reduce right margin to center better
    const marginScale = Math.min(this.w / 700, 1);
    this.margin = {
      top: 100 * marginScale,
      right: 80 * marginScale,
      bottom: 60 * marginScale,
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
    this._drawMovingAverages();
    this._addLabels();  // Draw labels (with background strip) AFTER moving averages
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

    const sorted = Object.values(yearly).sort((a, b) => a.year - b.year);

    // Calculate moving averages (3-year window)
    const window = 3;
    sorted.forEach((d, i) => {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(sorted.length, i + Math.ceil(window / 2));
      const slice = sorted.slice(start, end);

      d.govMA = slice.reduce((sum, x) => sum + x.government, 0) / slice.length;
      d.comMA = slice.reduce((sum, x) => sum + x.commercial, 0) / slice.length;
    });

    return sorted.map(d => ({
      ...d,
      difference: d.commercial - d.government
    }));
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
                this.chart.append('g')
      .attr('class', 'x-axis-right')
      .attr('transform', `translate(${this.chartW / 2}, ${this.chartH})`)
      .call(xAxisRight)
      .selectAll('text')
                this.chart.append('line')
      .attr('class', 'divider-line')
      .attr('x1', this.chartW / 2)
      .attr('x2', this.chartW / 2)
      .attr('y1', 0)
      .attr('y2', this.chartH)
                      const fontSize = this.w < 500 ? '11px' : '13px';
    this.chart.append("text")
      .attr("class", "axis-title")
      .attr("x", this.chartW / 2)
      .attr("y", this.chartH + (this.w < 500 ? 35 : 40))
      .attr("text-anchor", "middle")
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
                              .on('mouseover', function (event, d) {
        d3.select(this).style('opacity', 1).attr('fill', '#00aacc');
        vis._showTip(event, d, 'Government');
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 0.8).attr('fill', '#0e8ebe');
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
                              .on('mouseover', function (event, d) {
        d3.select(this).style('opacity', 1).attr('fill', '#4dffff');
        vis._showTip(event, d, 'Commercial');
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 0.8).attr('fill', '#00d4ff');
        vis._hideTip();
      });
  }

  _showLegendMATip(event) {
    const html = `
                  <strong>3-Year Moving Average</strong>
                  <p>Takes the average of the satellites launched in the current, prior and latter year to smoothen out fluctuations and show trend of satellites launched</p>
                `;

    this.tooltip
      .style('opacity', 1)
      .html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
    
    // Mark that tooltip is showing for info icon
    this.infoTooltipVisible = true;
  }


  _drawMovingAverages() {
    const vis = this;
    this.chart.selectAll(".ma-line-gov, .ma-line-com, .ma-dot-gov, .ma-dot-com").remove();

    // Government MA line (left side)
    const govLine = d3.line()
      .x(d => vis.chartW / 2 - vis.xScale(d.govMA))
      .y(d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2)
      .curve(d3.curveCatmullRom.alpha(0.5));

    this.chart.append("path")
      .datum(this.data)
      .attr("class", "ma-line-gov")
                              .attr("d", govLine)
          // Commercial MA line (right side)
    const comLine = d3.line()
      .x(d => vis.chartW / 2 + vis.xScale(d.comMA))
      .y(d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2)
      .curve(d3.curveCatmullRom.alpha(0.5));

    this.chart.append("path")
      .datum(this.data)
      .attr("class", "ma-line-com")
                              .attr("d", comLine)
          // Add dots at each data point for better visibility
    this.chart.selectAll(".ma-dot-gov")
      .data(this.data)
      .enter()
      .append("circle")
      .attr("class", "ma-dot-gov")
      .attr("cx", d => vis.chartW / 2 - vis.xScale(d.govMA))
      .attr("cy", d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2)
                        .on('mouseover', function (event, d) {
        d3.select(this).attr("r", 5).style("opacity", 1);
        vis._showMATooltip(event, d, 'Government');
      })
      .on('mouseout', function () {
        d3.select(this).attr("r", 3);
        vis._hideTip();
      });

    this.chart.selectAll(".ma-dot-com")
      .data(this.data)
      .enter()
      .append("circle")
      .attr("class", "ma-dot-com")
      .attr("cx", d => vis.chartW / 2 + vis.xScale(d.comMA))
      .attr("cy", d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2)
                        .on('mouseover', function (event, d) {
        d3.select(this).attr("r", 5).style("opacity", 1);
        vis._showMATooltip(event, d, 'Commercial');
      })
      .on('mouseout', function () {
        d3.select(this).attr("r", 3);
        vis._hideTip();
      });
  }

  _addLabels() {
    const vis = this;
    this.chart.selectAll('.year-label, .year-bg-strip, .year-bg-rect').remove();

    const fontSize = this.w < 500 ? '9px' : '11px';
    const stripWidth = this.w < 500 ? 35 : 45;

    // Add a vertical strip behind all year labels
    this.chart.append('rect')
      .attr('class', 'year-bg-strip')
      .attr('x', this.chartW / 2 - stripWidth / 2)
      .attr('y', 0)
      .attr('width', stripWidth)
      .attr('height', this.chartH)
                // Add individual background rectangles for each year label
    this.chart.selectAll('.year-bg-rect')
      .data(this.data)
      .enter()
      .append('rect')
      .attr('class', 'year-bg-rect')
      .attr('x', this.chartW / 2 - stripWidth / 2)
      .attr('y', d => vis.yScale(d.year))
      .attr('width', stripWidth)
      .attr('height', vis.yScale.bandwidth())
                // Add year labels on top of the strip
    this.chart.selectAll('.year-label')
      .data(this.data)
      .enter()
      .append('text')
      .attr('class', 'year-label')
      .attr('x', this.chartW / 2)
      .attr('y', d => vis.yScale(d.year) + vis.yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'middle')
                        .text(d => d.year);
  }

  _addLegend() {
    const vis = this;
    this.chart.selectAll(".legend").remove();

    const legend = this.chart.append("g").attr("class", "legend");
    const categories = [
      { name: "Government", color: "#0e8ebe" },
      { name: "Commercial", color: "#00d4ff" },
      { name: "3-Year Moving Avg", color: "#8c4effff", dashed: true }
    ];

    const verticalSpacing = 25;
    const xOffset = this.chartW + 5;
    const yStart = 0;
    const fontSize = this.w < 500 ? '11px' : '13px';
    const rectSize = this.w < 500 ? 16 : 18;

    const legendItems = legend.selectAll("g.legend-item")
      .data(categories)
      .enter()
      .append("g")
      .attr("class", "legend-item");

    legendItems.each(function (d, i) {
      const item = d3.select(this);
      const baseY = yStart + (i * verticalSpacing);

      if (d.dashed) {
        // dashed line for moving average
        item.append("line")
          .attr("x1", xOffset - rectSize - 8)
          .attr("x2", xOffset - 8)
          .attr("y1", baseY + rectSize / 2)
          .attr("y2", baseY + rectSize / 2)
          .attr("stroke", d.color)
                    .attr("stroke-dasharray", "5,3")
                } else {
        item.append("rect")
          .attr("x", xOffset - rectSize - 8)
          .attr("y", baseY)
          .attr("width", rectSize)
          .attr("height", rectSize)
                    .attr("fill", d.color)
                }

      // main legend label (right-aligned)
      const label = item.append("text")
        .attr("x", xOffset - rectSize - 16)
        .attr("y", baseY + rectSize - 4)
                        .attr("text-anchor", "end")
        .text(d.name);


      if (d.dashed) {
        const labelWidth = label.node().getComputedTextLength();

        // Add info icon circle background
        
        item.append('button')
            .attr('class', "legend-info-icon")
            .attr('type', 'button')
            .attr("x", xOffset - rectSize - labelWidth - 5)
            .attr("y", baseY + rectSize - 4)
            .html('i')
            .on('click', () => this._toggleInfoPopover());
      }
    });
  }

  _updateTitle() {
    this.chart.selectAll(".chart-title").remove();
    this.chart.selectAll(".chart-instruction").remove();

    const fontSize = this.w < 500 ? '16px' : this.w < 700 ? '18px' : '20px';
    const instructionFontSize = this.w < 500 ? '11px' : '12px';

    // Title - top left
    this.chart
      .append("text")
      .attr("class", "chart-title")
      .attr('x', this.chartW / 2)
      .attr('y', -80)
      .text("Government vs Commercial Satellites Launched");

    // Instruction text below title
    this.chart
      .append("text")
      .attr("class", "chart-instruction")
      .attr('x', this.chartW / 2)
      .attr('y', -40)
      .attr("text-anchor", "middle")
                              .text("Hover over bars and moving average dots for details.");
  }

  _showTip(event, d, side) {
    const val = side === 'Government' ? d.government : d.commercial;
    const ma = side === 'Government' ? d.govMA.toFixed(1) : d.comMA.toFixed(1);
    const html = `<strong>${side}</strong><br>Year: ${d.year}<br>Satellites: ${val}<br>3-Year Avg: ${ma}`;

    this.tooltip
      .style('opacity', 1)
      .html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  }

  _showMATooltip(event, d, side) {
    const ma = side === 'Government' ? d.govMA.toFixed(1) : d.comMA.toFixed(1);
    const html = `<strong>${side} Moving Average</strong><br>Year: ${d.year}<br>3-Year Avg: ${ma}`;

    this.tooltip
      .style('opacity', 1)
      .html(html)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  }

  _hideTip() {
    // Only hide if it's not the info icon tooltip
    if (!this.infoTooltipVisible) {
      this.tooltip.style('opacity', 0);
    }
  }

  _hideInfoTip() {
    this.infoTooltipVisible = false;
    this.tooltip.style('opacity', 0);
  }
}