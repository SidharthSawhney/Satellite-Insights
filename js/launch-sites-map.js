/**
 * Launch Sites Map Visualization
 * - Each launch site is a circle whose radius grows with cumulative launches.
 * - Timeline controls: play/pause, backward, forward, year slider
 * - Tooltip shows satellite count per site
 */

class LaunchSitesMap {
    constructor(hostId, worldGeo, launches, opts = {}) {
        this.host = d3.select('#' + hostId).classed('map-root', true);
        this.node = this.host.node();

        // Ensure visible height even if page CSS fails
        if (!this.node.clientHeight || this.node.clientHeight < 80) {
            this.host.style('height', '70vh');
        }

        this.w = opts.width ?? this.node.clientWidth ?? 1100;
        this.h = opts.height ?? this.node.clientHeight ?? 720;

        // Lock aspect ratio so resize is width-driven, not feedback from height
        this.aspectRatio = this.h / this.w;
        if (!isFinite(this.aspectRatio) || this.aspectRatio <= 0) {
            this.aspectRatio = 0.65; // default if something gEts weird
        }

        this.world = worldGeo;
        this.launchesRaw = launches;

        // Playback state
        this.isPlaying = false;
        this.currentYearIndex = 0;
        this.playSpeed = opts.playSpeed ?? 500; // ms per year

        // Build DOM, projection, map
        this._build();
        this._layout();
        this._drawBaseMap();

        this._installSiteDictionary();

        // Prepare events by year
        this._prepLaunchEvents();

        // Build controls
        this._buildControls();

        // Initial render
        this._updateVisualization();

        // Handle resize
        this._attachResize();
    }

    /* ---------- DOM / layout ---------- */

    _build() {


        this.title = d3.select(this.node).append('div')
            .attr('class', 'map-title');

        this.titleText = this.title.append('span')
            .attr('class', 'map-title-text')
            .text('Satellite Launches by Location');

        // Info button next to the title
        this.infoButton = this.title.append('button')
            .attr('class', 'map-info-btn')
            .attr('type', 'button')
            .html('i');

        // Popover attached near the icon
        this.infoPopover = d3.select(this.node).append('div')
            .attr('class', 'map-info-popover')
            .html(`
                    <p>Each circle is a space centre which are launch sites where rockets were launched carrying satellite to deploy in space.</p>
                `);

        // Show on hover
        this.infoButton.on('mouseenter', (event) => {
            const rect = event.target.getBoundingClientRect();

            // Position next to icon
            this.infoPopover
                .style('left', `${rect.left + rect.width + 10}px`)
                .style('top', `${rect.top - 10}px`)
                .style('display', 'block');
        });

        // Hide when mouse leaves BOTH icon and popover
        this.infoButton.on('mouseleave', () => {
            setTimeout(() => {
                if (!this.isHoveringPopover) {
                    this.infoPopover.style('display', 'none');
                }
            }, 120);
        });

        this.infoPopover
            .on('mouseenter', () => { this.isHoveringPopover = true; })
            .on('mouseleave', () => {
                this.isHoveringPopover = false;
                this.infoPopover.style('display', 'none');
            });


        this.prompt = d3.select(this.node).append('div')
            .attr('class', 'map-prompt')
            .text('Hover over and click a circle to learn more about that launch site.');

        this.svg = d3.select(this.node)
            .append('svg')
            .attr('viewBox', `0 0 ${this.w} ${this.h}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        this.g = this.svg.append('g');
        this.gLand = this.g.append('g');
        this.gSites = this.g.append('g');



        this.yearDisplay = d3.select(this.node).append('div')
            .attr('class', 'map-year-display')
            .text('');




        this.tooltip = d3.select(this.node).append('div')
            .attr('class', 'map-tooltip');




        this.detailPanel = d3.select(this.node).append('div')
            .attr('class', 'site-detail-panel');

        // Create the header structure
        const header = this.detailPanel.append('div')
            .attr('class', 'site-panel-header');

        this.sitePanelTitle = header.append('div')
            .attr('class', 'site-panel-title')
            .text('Launch Site Details');

        this.sitePanelSubtitle = header.append('div')
            .attr('class', 'site-panel-subtitle')
            .text('Click a circle to see yearly launches.');

        this.sitePanelInfo = this.detailPanel.append('div')
            .attr('class', 'site-panel-info')
            .text('No site selected.');

        this.sitePanelSvg = this.detailPanel.append('svg')
            .attr('class', 'site-panel-chart')
            .attr('width', 320)
            .attr('height', 220);



        d3.select('body').on('click', (event) => {
            const target = event.target;
            const insideInfoButton = target.closest('.map-info-btn');
            const insidePopover = target.closest('.map-info-popover');
            if (!insideInfoButton && !insidePopover) {
                this.infoPopover.style('display', 'none');
            }
        });

    }

    _layout() {
        this.projection = d3.geoNaturalEarth1()
            .translate([this.w / 2, this.h / 2 + 30])
            .scale(Math.min(this.w, this.h) * 0.31);

        this.geoPath = d3.geoPath(this.projection);
    }

    _drawBaseMap() {
        let countries = [];
        if (this.world && this.world.type === 'FeatureCollection') {
            countries = this.world.features;
        } else if (this.world && this.world.objects) {
            if (window.topojson) {
                const obj = Object.values(this.world.objects)[0];
                countries = topojson.feature(this.world, obj).features;
            } else {
                console.warn('TopoJSON detected but topojson-client is not loaded.');
            }
        }

        this.gLand.selectAll('path')
            .data(countries)
            .join('path')
            .attr('class', 'land')
            .attr('d', this.geoPath);
    }

    /* ---------- Data helpers ---------- */

    // _toggleInfoPopover method removed - CSS now handles hover automatically

    _installSiteDictionary() {
        this.siteDict = [
            { test: /\b(kourou|guiana)\b/i, lon: -52.768, lat: 5.239, name: 'Guiana Space Center' },
            { test: /\bcape\s*canaveral|kennedy\b/i, lon: -80.605, lat: 28.396, name: 'Cape Canaveral / KSC' },
            { test: /\bvandenberg\b/i, lon: -120.611, lat: 34.632, name: 'Vandenberg' },
            { test: /\bbaikonur\b/i, lon: 63.305, lat: 45.964, name: 'Baikonur Cosmodrome' },
            { test: /\bplesetsk\b/i, lon: 40.577, lat: 62.925, name: 'Plesetsk Cosmodrome' },
            { test: /\bjiuquan\b/i, lon: 100.298, lat: 40.960, name: 'Jiuquan SLC' },
            { test: /\bxichang\b/i, lon: 102.026, lat: 28.246, name: 'Xichang SLC' },
            { test: /\btaiyuan\b/i, lon: 111.608, lat: 38.846, name: 'Taiyuan SLC' },
            { test: /\bwenchang\b/i, lon: 110.951, lat: 19.614, name: 'Wenchang SLS' },
            { test: /\btanegashima\b/i, lon: 130.957, lat: 30.375, name: 'Tanegashima' },
            { test: /\buchinoura|kagoshima\b/i, lon: 131.081, lat: 31.251, name: 'Uchinoura' },
            { test: /\bsvobodny|vostochny\b/i, lon: 128.12, lat: 51.42, name: 'Svobodny/Vostochny' },
            { test: /\bsatish|sriharikota|shar\b/i, lon: 80.235, lat: 13.733, name: 'Satish Dhawan (Sriharikota)' },
            { test: /\bnaro\b/i, lon: 127.535, lat: 34.431, name: 'Naro' },
            { test: /\bwallops\b/i, lon: -75.466, lat: 37.940, name: 'Wallops' },
            { test: /\bkodiak|psca\b/i, lon: -152.339, lat: 57.435, name: 'Kodiak (PSCA)' },
            { test: /\bmah[ií]a|rocket\s*lab|lc-1\b/i, lon: 177.865, lat: -39.262, name: 'LC-1 Mahia' },
            { test: /\bdombarov|yasny\b/i, lon: 59.533, lat: 50.803, name: 'Dombarovsky (Yasny)' },
            { test: /\bsea\s*launch|odyssey\b/i, lon: -154.0, lat: 0.000, name: 'Sea Launch (equator)' }
        ];
    }

    _pick(d, names) {
        for (const n of names) if (d[n] != null && d[n] !== '') return d[n];
        return undefined;
    }

    _parseDate(raw) {
        if (!raw) return null;
        const d = new Date(raw);
        if (!isNaN(+d)) return d;
        const m = String(raw).match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
        if (m) return new Date(+m[1], (m[2] ? +m[2] - 1 : 0), (m[3] ? +m[3] : 1));
        return null;
    }

    _siteFromName(name) {
        if (!name) return null;
        for (const rule of this.siteDict) {
            if (rule.test.test(name)) return { lon: rule.lon, lat: rule.lat, canonical: rule.name };
        }
        return null;
    }

    _classifyOwnership(row) {
        // Look first at commonly used columns
        const primary = this._pick(row, [
            'Ownership',
            'Owner Type',
            'Owner_Type',
            'Operator Type',
            'Operator_Category',
            'User Type',
            'User type',
            'Users',
            'Owner/Operator',
            'Operator/Owner'
        ]);

        // Fallback: scan any ownership / user / operator fields if needed
        let raw = (primary || '').toString().toLowerCase();
        if (!raw) {
            raw = Object.keys(row)
                .filter(k => /owner|user|operat|category|type/i.test(k))
                .map(k => (row[k] || '').toString().toLowerCase())
                .join(' | ');
        }

        if (!raw) return 'unknown';

        if (
            raw.includes('gov') ||
            raw.includes('military') ||
            raw.includes('state') ||
            raw.includes('civil') ||
            raw.includes('government')
        ) {
            return 'government';
        }

        if (
            raw.includes('comm') ||
            raw.includes('commercial') ||
            raw.includes('private')
        ) {
            return 'commercial';
        }

        return 'unknown';
    }

    _acronym(siteName) {
        if (!siteName) return '??';

        // Remove things in parentheses and non-alphanumeric punctuation
        const cleaned = String(siteName)
            .replace(/\(.*?\)/g, ' ')        // drop "(Yasny)" etc.
            .replace(/[^A-Za-z0-9\s]/g, ' '); // remove punctuation like "-" etc.

        // Split into tokens and keep only ones starting with a letter
        const tokens = cleaned
            .trim()
            .toUpperCase()
            .split(/\s+/)
            .filter(t => /^[A-Z]/.test(t));

        if (tokens.length === 0) return '??';
        if (tokens.length === 1) return tokens[0].slice(0, 2);

        // First letter of first two "real" words
        return (tokens[0][0] || '') + (tokens[1][0] || '');
    }

    _prepLaunchEvents() {
        const rows = this.launchesRaw;
        const events = [];

        // All-time stats per site (for tooltip)
        const allTimeStats = new Map();

        // Per-site, per-year breakdown for the right-hand panel
        this.siteYearly = new Map();

        for (const r of rows) {
            const rawSiteName = this._pick(r, ['launch_site', 'Launch Site', 'Launch_Site', 'Site']) || '';
            const dateRaw = this._pick(r, ['date_of_launch', 'Date of Launch', 'Launch_Date', 'Launch Date', 'Date']);
            const dt = this._parseDate(dateRaw);
            if (!dt) continue;

            // lat/lon (prefer data; fall back to fuzzy site dictionary)
            let lat = +this._pick(r, [
                'Launch_Site_Lat', 'Launch Site Lat', 'Launch Site Latitude', 'site_lat', 'lat', 'Latitude'
            ]);
            let lon = +this._pick(r, [
                'Launch_Site_Lon', 'Launch Site Lon', 'Launch Site Longitude', 'site_lon', 'lon', 'Longitude'
            ]);

            const lookup = this._siteFromName(rawSiteName);
            const canonicalName = (lookup?.canonical) || rawSiteName || 'Unknown site';

            if (isNaN(lat) || isNaN(lon)) {
                if (lookup) {
                    lat = lookup.lat;
                    lon = lookup.lon;
                } else {
                    continue;
                }
            }

            const country = this._pick(r, [
                'Launch_Site_Country',
                'Launch Site Country',
                'Country of Launch',
                'Launch Country',
                'Country'
            ]) || 'Unknown';

            const ownerClass = this._classifyOwnership(r);

            const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
            const year = dt.getFullYear();

            // ---- All-time stats (for tooltip) ----
            if (!allTimeStats.has(key)) {
                allTimeStats.set(key, {
                    key,
                    lon,
                    lat,
                    siteName: canonicalName,
                    country,
                    total: 0,
                    govTotal: 0,
                    commTotal: 0
                });
            }
            const stats = allTimeStats.get(key);
            stats.total += 1;
            if (ownerClass === 'government') {
                stats.govTotal += 1;
            } else if (ownerClass === 'commercial') {
                stats.commTotal += 1;
            }

            // ---- Yearly breakdown for stacked bar chart ----
            if (!this.siteYearly.has(key)) {
                this.siteYearly.set(key, {
                    key,
                    lon,
                    lat,
                    siteName: canonicalName,
                    country,
                    byYear: new Map()
                });
            }
            const siteYearData = this.siteYearly.get(key);
            if (!siteYearData.byYear.has(year)) {
                siteYearData.byYear.set(year, {
                    year,
                    gov: 0,
                    comm: 0,
                    total: 0
                });
            }
            const yEntry = siteYearData.byYear.get(year);
            yEntry.total += 1;
            if (ownerClass === 'government') {
                yEntry.gov += 1;
            } else if (ownerClass === 'commercial') {
                yEntry.comm += 1;
            }

            // Event for cumulative timeline
            events.push({
                key,
                lon,
                lat,
                year,
                siteName: canonicalName,
                country
            });
        }

        // Sort by year
        events.sort((a, b) => a.year - b.year);

        // Unique years
        const yearsSet = new Set(events.map(e => e.year));
        this.years = Array.from(yearsSet).sort((a, b) => a - b);

        // Group events by year
        this.eventsByYear = {};
        this.years.forEach(year => {
            this.eventsByYear[year] = events.filter(e => e.year === year);
        });

        // Cumulative data by year
        this.cumulativeByYear = {};
        const cumulative = new Map();

        this.years.forEach(year => {
            this.eventsByYear[year].forEach(ev => {
                if (!cumulative.has(ev.key)) {
                    const allStats = allTimeStats.get(ev.key);
                    cumulative.set(ev.key, {
                        key: ev.key,
                        lon: ev.lon,
                        lat: ev.lat,
                        siteName: allStats?.siteName || ev.siteName,
                        country: allStats?.country || ev.country || 'Unknown',
                        count: 0, // cumulative up to this year
                        totalAllYears: allStats?.total ?? 0,
                        govTotal: allStats?.govTotal ?? 0,
                        commTotal: allStats?.commTotal ?? 0
                    });
                }
                cumulative.get(ev.key).count += 1;
            });

            this.cumulativeByYear[year] = new Map(
                Array.from(cumulative.entries()).map(([k, v]) => [k, { ...v }])
            );
        });

        // Radius scale based on maximum cumulative count
        const maxCount = Math.max(...Array.from(cumulative.values()).map(s => s.count), 1);
        this.radiusScale = d3.scaleSqrt()
            .domain([0, maxCount])
            .range([0, 35]);

        // Default: show cumulative 2023 data (or the last available year if 2023 is missing)
        const defaultYear = 2023;
        const idx = this.years.indexOf(defaultYear);
        this.currentYearIndex = idx >= 0 ? idx : this.years.length - 1;
    }

    /* ---------- Controls ---------- */

    _buildControls() {
        // Controls container (hidden under overlay at first)
        this.controls = d3.select(this.node).append('div')
            .attr('class', 'map-controls timeline-hidden');

        // Play/Pause button
        this.playButton = this.controls.append('button')
            .attr('class', 'control-btn play-btn')
            .html('▶')
            .on('click', () => this._togglePlay());

        // Backward button
        this.controls.append('button')
            .attr('class', 'control-btn')
            .html('<')
            .on('click', () => this._stepBackward());

        // Forward button
        this.controls.append('button')
            .attr('class', 'control-btn')
            .html('>')
            .on('click', () => this._stepForward());

        // Year slider
        this.yearSlider = this.controls.append('input')
            .attr('type', 'range')
            .attr('class', 'year-slider')
            .attr('min', 0)
            .attr('max', this.years.length - 1)
            .attr('value', this.currentYearIndex)
            .on('input', (event) => {
                this.currentYearIndex = +event.target.value;
                this._updateVisualization();
            });

        // Year label
        this.yearLabel = this.controls.append('span')
            .attr('class', 'year-label')
            .text(this.years[this.currentYearIndex] || '');

        
        this.timelineOverlay = d3.select(this.node).append('div')
            .attr('class', 'map-timeline-overlay');

        this.timelineOverlay.append('button')
            .attr('class', 'map-timeline-overlay-btn')
            .text('Play timeline')
            .on('click', () => {
                // Remove overlay, reveal controls, restart from first year and auto-play
                this.timelineOverlay.remove();
                this.controls.classed('timeline-hidden', false);

                this.currentYearIndex = 0;
                this.yearSlider.property('value', this.currentYearIndex);
                this._updateVisualization();
                this._play();
            });
    }

    _togglePlay() {
        if (this.isPlaying) {
            this._pause();
        } else {
            // If we've already reached the last year, restart from the beginning
            if (this.currentYearIndex >= this.years.length - 1) {
                this.currentYearIndex = 0;
                this.yearSlider.property('value', this.currentYearIndex);
                this._updateVisualization();
            }
            this._play();
        }
    }

    _play() {
        this.isPlaying = true;
        this.playButton.html('⏸');
        this._startPlayback();
    }

    _pause() {
        this.isPlaying = false;
        this.playButton.html('▶');
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
        }
    }

    _startPlayback() {
        if (this.playbackTimer) clearInterval(this.playbackTimer);

        this.playbackTimer = setInterval(() => {
            if (this.currentYearIndex < this.years.length - 1) {
                this.currentYearIndex++;
                this.yearSlider.property('value', this.currentYearIndex);
                this._updateVisualization();
            } else {
                this._pause();
            }
        }, this.playSpeed);
    }

    _stepForward() {
        if (this.currentYearIndex < this.years.length - 1) {
            this.currentYearIndex++;
            this.yearSlider.property('value', this.currentYearIndex);
            this._updateVisualization();
        }
    }

    _stepBackward() {
        if (this.currentYearIndex > 0) {
            this.currentYearIndex--;
            this.yearSlider.property('value', this.currentYearIndex);
            this._updateVisualization();
        }
    }

    /* ---------- Rendering ---------- */

    _updateVisualization() {
        const currentYear = this.years[this.currentYearIndex];
        this.yearLabel.text(currentYear);
        this.yearDisplay.text(`Year: ${currentYear}`);

        // Get cumulative data up to current year
        const sites = this.cumulativeByYear[currentYear];
        if (!sites) return;

        const sitesArray = Array.from(sites.values());

        // Bind data
        const circles = this.gSites.selectAll('g.site')
            .data(sitesArray, d => d.key);

        // Enter
        const circlesEnter = circles.enter()
            .append('g')
            .attr('class', 'site')
            .attr('transform', d => {
                const [x, y] = this.projection([d.lon, d.lat]);
                return `translate(${x},${y})`;
            });

        circlesEnter.append('circle')
            .attr('class', 'site-circle')
            .attr('r', 0)
            .style('opacity', 0)
            .on('mouseover', (e, d) => this._showTip(e, d))
            .on('mousemove', (e, d) => this._moveTip(e, d))
            .on('mouseout', () => this._hideTip())
            .on('click', (e, d) => this._updateSitePanel(d));

        circlesEnter.append('text')
            .attr('class', 'site-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('opacity', 0)
            .text(d => this._acronym(d.siteName));

        // Update
        const circlesAll = circlesEnter.merge(circles);

        // Smooth radius transition
        circlesAll.select('circle')
            .transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .attr('r', d => this.radiusScale(d.count))
            .style('opacity', 1);

        circlesAll.select('text')
            .transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .text(d => this._acronym(d.siteName))
            .style('font-size', d => Math.max(10, this.radiusScale(d.count) * 0.5) + 'px')
            .style('opacity', 1);

        // Exit
        circles.exit()
            .transition()
            .duration(400)
            .ease(d3.easeCubicInOut)
            .style('opacity', 0)
            .remove();
    }


    _showTip(event, d) {
        if (!this.tooltip) {
            this.tooltip = d3.select(this.node)
                .append('div')
                .attr('class', 'map-tooltip');
        }

        const siteName = (d && d.siteName) || 'Unknown site';
        const country = (d && d.country) || 'Unknown';

        // Safely fall back if the all-time fields aren’t present
        const total = (d && d.totalAllYears != null)
            ? d.totalAllYears
            : (d && d.count != null ? d.count : 0);

        const gov = (d && d.govTotal != null) ? d.govTotal : 'n/a';
        const comm = (d && d.commTotal != null) ? d.commTotal : 'n/a';

        this.tooltip
            .style('visibility', 'visible')
            .html(
                `<p><strong>${siteName}</strong>` +
                `Total satellites (all years): ${total}` +
                `<br>Government: ${gov}` +
                `<br>Commercial: ${comm}</p>`
            );

        this._moveTip(event);
    }

    _updateSitePanel(d) {
        if (!d || !this.siteYearly) return;

        const site = this.siteYearly.get(d.key);
        if (!site) {
            this.sitePanelTitle.text(d.siteName || 'Launch site');
            this.sitePanelSubtitle.text(d.country || '');
            this.sitePanelInfo.text('No launch data available for this site.');
            this.sitePanelSvg.selectAll('*').remove();
            return;
        }

        // Header text
        this.sitePanelTitle.text(site.siteName);
        this.sitePanelSubtitle.text(this._inferCountry(site.siteName, site.country));

        const desc = this._getSiteDescription(site.siteName, site.country);
        this.sitePanelInfo.text(desc);

        const data = Array.from(site.byYear.values())
            .sort((a, b) => a.year - b.year);

        const svg = this.sitePanelSvg;
        svg.selectAll('*').remove();

        const margin = { top: 16, right: 40, bottom: 16, left: 16 };
        const width = 320 - margin.left - margin.right;
        const height = 180 - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const maxTotal = d3.max(data, d => d.total) || 1;

        // X scale for years
        const x = d3.scaleLinear()
            .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
            .range([0, width]);

        // Y scale for launch count
        const y = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0])
            .nice();

        // X axis
        const years = data.map(d => d.year);
        const step = Math.max(1, Math.ceil(years.length / 6));
        const [minYear, maxYear] = x.domain();
        const nTicks = 6;

        const tickValues = d3.range(nTicks).map(i =>
            Math.round(minYear + (i / (nTicks - 1)) * (maxYear - minYear))
        );

        g.append('g')
            .attr('class', 'site-panel-axis')
            .attr('transform', `translate(0,${height})`)
            .call(
                d3.axisBottom(x)
                    .tickValues(tickValues)
                    .tickFormat(d3.format('d'))
            );

        // Y axis
        g.append('g')
            .attr('class', 'site-panel-axis')
            .call(
                d3.axisLeft(y)
                    .ticks(5)
                    .tickFormat(d3.format('d'))
            );

        // Y axis label
        g.append('text')
            .attr('class', 'site-panel-axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -35);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.total))
            .curve(d3.curveMonotoneX);

        // Draw line
        g.append('path')
            .datum(data)
            .attr('class', 'site-panel-line')
            .attr('d', line);

        // Draw dots
        g.selectAll('.site-panel-dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'site-panel-dot')
            .attr('cx', d => x(d.year))
            .attr('cy', d => y(d.total))
            .attr('r', 3);
    }

    _resetSitePanel() {
        // Reset the side panel back to the default instruction state
        this.sitePanelTitle.text('Launch Site Details');
        this.sitePanelSubtitle.text('Click a circle to see yearly launches.');
        this.sitePanelInfo.text('No site selected yet.');
        this.sitePanelSvg.selectAll('*').remove();
    }

    _inferCountry(name, fallback) {
        const n = (name || '').toLowerCase();

        // Hand-researched major launch sites, yes it was painful but oh well
        if (n.includes('guiana')) return 'French Guiana (France)';
        if (n.includes('cape canaveral') || n.includes('kennedy')) return 'United States';
        if (n.includes('vandenberg')) return 'United States';
        if (n.includes('wallops')) return 'United States';
        if (n.includes('kodiak') || n.includes('psca')) return 'United States';
        if (n.includes('baikonur')) return 'Kazakhstan';
        if (n.includes('plesetsk')) return 'Russia';
        if (n.includes('svobodny') || n.includes('vostochny')) return 'Russia';
        if (n.includes('dombarovsky') || n.includes('yasny')) return 'Russia';
        if (n.includes('jiuquan')) return 'China';
        if (n.includes('xichang')) return 'China';
        if (n.includes('taiyuan')) return 'China';
        if (n.includes('wenchang')) return 'China';
        if (n.includes('tanegashima')) return 'Japan';
        if (n.includes('uchinoura') || n.includes('kagoshima')) return 'Japan';
        if (n.includes('sriharikota') || n.includes('satish dhawan') || n.includes('shar')) return 'India';
        if (n.includes('naro')) return 'South Korea';
        if (n.includes('mahia') || n.includes('rocket lab') || n.includes('lc-1')) return 'New Zealand';
        if (n.includes('sea launch') || n.includes('odyssey')) return 'International waters';

        // Fall back to dataset country if it isn't literally "unknown"
        if (fallback && fallback.toString().toLowerCase() !== 'unknown') {
            return fallback;
        }
        // Final fallback: blank rather than "Unknown"
        return '';
    }

    _getSiteDescription(name, country) {
        const key = (name || '').toLowerCase();

        if (key.includes('guiana')) {
            return 'Europe’s main equatorial launch site, used by Arianespace and ESA for heavy-lift and commercial missions.';
        }
        if (key.includes('cape canaveral') || key.includes('kennedy')) {
            return 'NASA and US commercial providers use Cape Canaveral and Kennedy Space Center for a wide range of civil, military, and commercial launches.';
        }
        if (key.includes('vandenberg')) {
            return 'A US West Coast launch base optimized for polar and sun-synchronous orbits, frequently used for defence and commercial missions.';
        }
        if (key.includes('baikonur')) {
            return 'Historically the Soviet Union’s main spaceport and still one of the busiest launch sites, supporting crewed and uncrewed missions.';
        }
        if (key.includes('plesetsk')) {
            return 'A Russian military spaceport in northern Russia, focused mainly on defence and Earth-observation satellites.';
        }
        if (key.includes('jiuquan')) {
            return 'One of China’s primary inland launch centres, used for both crewed missions and robotic satellites.';
        }
        if (key.includes('xichang')) {
            return 'Chinese launch site in Sichuan that supports many communications and navigation satellite missions.';
        }
        if (key.includes('taiyuan')) {
            return 'A Chinese site specialising in polar-orbit launches, especially for Earth-observation payloads.';
        }
        if (key.includes('wenchang')) {
            return 'China’s newest coastal spaceport on Hainan Island, designed for heavy-lift rockets and deep-space missions.';
        }
        if (key.includes('tanegashima')) {
            return 'Japan’s main space centre operated by JAXA, used for H-II rockets and international missions.';
        }
        if (key.includes('sriharikota') || key.includes('satish dhawan')) {
            return 'India’s Satish Dhawan Space Centre hosts ISRO’s PSLV and GSLV launches for domestic and international satellites.';
        }
        if (key.includes('mahia') || key.includes('rocket lab')) {
            return 'Rocket Lab’s privately operated launch site in New Zealand, focused on small commercial satellites.';
        }
        if (key.includes('kodiak')) {
            return 'First used for the Athena 1 craft, this remote Alaskan spaceport is expected to see increase commercial and government launches.';
        }
        if (key.includes('wallops')) {
            return 'Low-cost launch site originally built for NASA and now focused on commercial use.';
        }
        if (key.includes('sea launch')) {
            return 'Sea launches near the equator have become increasingly popular to take advantage of the point where the rotational force of Earth is at its max.';
        }
        if (key.includes('svobodny')) {
            return 'Currently unused cosmodome.';
        }
        if (key.includes('dombarovsky')) {
            return 'Russian military airbase with a space port component.';
        }

        if (country && country !== 'Unknown') {
            return `Satellite launches from this site in ${country} include a mix of government and commercial missions.`;
        }
        return 'Satellite launches from this site include a mix of government and commercial missions.';
    }

    _moveTip(event) {
        // Get mouse position relative to the map container
        const [x, y] = d3.pointer(event, this.node);

        this.tooltip
            .style('left', (x + 12) + 'px')
            .style('top', (y - 12) + 'px');
    }

    _hideTip() {
        this.tooltip.style('visibility', 'hidden');
    }

    /* ---------- Resize ---------- */

    /* ---------- Resize ---------- */

    _attachResize() {
        const onResize = () => {
            const bbox = this.node.getBoundingClientRect();

            // Width from container; height from fixed aspect ratio
            this.w = Math.max(320, Math.floor(bbox.width));
            this.h = Math.max(240, Math.floor(this.w * this.aspectRatio));

            // Just change the viewBox (don’t mess with DOM height here)
            d3.select(this.node)
                .select('svg')
                .attr('viewBox', `0 0 ${this.w} ${this.h}`);

            // Recompute projection + redraw paths & circle positions
            this._layout();
            this.gLand.selectAll('path').attr('d', this.geoPath);

            this.gSites.selectAll('g.site')
                .attr('transform', d => {
                    const [x, y] = this.projection([d.lon, d.lat]);
                    return `translate(${x},${y})`;
                });
        };

        if (window.ResizeObserver) {
            this._ro = new ResizeObserver(onResize);
            this._ro.observe(this.node);
        }
        window.addEventListener('resize', onResize);

        // Initial layout
        onResize();
    }
}