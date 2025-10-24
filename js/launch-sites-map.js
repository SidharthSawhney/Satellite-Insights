/**
 * Launch Sites Map Visualization
 * - Each launch site is a circle whose radius grows with cumulative launches.
 * - YouTube-style controls: play/pause, backward, forward, year slider
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

        this.w = opts.width  ?? this.node.clientWidth  ?? 1100;
        this.h = opts.height ?? this.node.clientHeight ?? 720;

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
        // SVG root
        this.svg = d3.select(this.node)
            .append('svg')
            .attr('viewBox', `0 0 ${this.w} ${this.h}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        this.g = this.svg.append('g');
        this.gLand = this.g.append('g');
        this.gSites = this.g.append('g'); // circles

        // Title
        this.title = d3.select(this.node).append('div')
            .attr('class', 'map-title')
            .text('Satellite Launches by Location');

        // Year display
        this.yearDisplay = d3.select(this.node).append('div')
            .attr('class', 'map-year-display')
            .text('');

        // Tooltip
        this.tooltip = d3.select(this.node).append('div').attr('class', 'map-tooltip');
    }

    _layout() {
        this.projection = d3.geoNaturalEarth1()
            .translate([this.w / 2, this.h / 2])
            .scale(Math.min(this.w, this.h) * 0.32);

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

    _installSiteDictionary() {
        this.siteDict = [
            { test:/\b(kourou|guiana)\b/i,                 lon:-52.768, lat: 5.239,   name:'Guiana Space Center' },
            { test:/\bcape\s*canaveral|kennedy\b/i,        lon:-80.605, lat:28.396,   name:'Cape Canaveral / KSC' },
            { test:/\bvandenberg\b/i,                      lon:-120.611,lat:34.632,   name:'Vandenberg' },
            { test:/\bbaikonur\b/i,                        lon: 63.305, lat:45.964,   name:'Baikonur Cosmodrome' },
            { test:/\bplesetsk\b/i,                        lon: 40.577, lat:62.925,   name:'Plesetsk Cosmodrome' },
            { test:/\bjiuquan\b/i,                         lon:100.298, lat:40.960,   name:'Jiuquan SLC' },
            { test:/\bxichang\b/i,                         lon:102.026, lat:28.246,   name:'Xichang SLC' },
            { test:/\btaiyuan\b/i,                         lon:111.608, lat:38.846,   name:'Taiyuan SLC' },
            { test:/\bwenchang\b/i,                        lon:110.951, lat:19.614,   name:'Wenchang SLS' },
            { test:/\btanegashima\b/i,                     lon:130.957, lat:30.375,   name:'Tanegashima' },
            { test:/\buchinoura|kagoshima\b/i,             lon:131.081, lat:31.251,   name:'Uchinoura' },
            { test:/\bsvobodny|vostochny\b/i,              lon:128.12,  lat:51.42,    name:'Svobodny/Vostochny' },
            { test:/\bsatish|sriharikota|shar\b/i,         lon: 80.235, lat:13.733,   name:'Satish Dhawan (Sriharikota)' },
            { test:/\bnaro\b/i,                            lon:127.535, lat:34.431,   name:'Naro' },
            { test:/\bwallops\b/i,                         lon:-75.466, lat:37.940,   name:'Wallops' },
            { test:/\bkodiak|psca\b/i,                     lon:-152.339,lat:57.435,   name:'Kodiak (PSCA)' },
            { test:/\bmah[ií]a|rocket\s*lab|lc-1\b/i,      lon:177.865, lat:-39.262,  name:'LC-1 Mahia' },
            { test:/\bdombarov|yasny\b/i,                  lon: 59.533, lat:50.803,   name:'Dombarovsky (Yasny)' },
            { test:/\bsea\s*launch|odyssey\b/i,            lon:-154.0,  lat: 0.000,   name:'Sea Launch (equator)' }
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
        if (m) return new Date(+m[1], (m[2]? +m[2]-1:0), (m[3]? +m[3]:1));
        return null;
    }

    _siteFromName(name) {
        if (!name) return null;
        for (const rule of this.siteDict) {
            if (rule.test.test(name)) return { lon: rule.lon, lat: rule.lat, canonical: rule.name };
        }
        return null;
    }

    _acronym(siteName) {
        if (!siteName) return '??';
        const words = String(siteName).trim().toUpperCase().split(/\s+/);
        if (words.length === 1) return words[0].slice(0,2);
        return (words[0][0] || '') + (words[1][0] || '');
    }

    _prepLaunchEvents() {
        const rows = this.launchesRaw;
        const events = [];

        for (const r of rows) {
            const siteName = this._pick(r, ['launch_site','Launch Site','Launch_Site','Site']) || '';
            const dateRaw  = this._pick(r, ['date_of_launch','Date of Launch','Launch_Date','Launch Date','Date']);
            const dt = this._parseDate(dateRaw);
            if (!dt) continue;

            // lat/lon, or fuzzy map
            let lat = +this._pick(r, [
                'Launch_Site_Lat','Launch Site Lat','Launch Site Latitude','site_lat','lat','Latitude'
            ]);
            let lon = +this._pick(r, [
                'Launch_Site_Lon','Launch Site Lon','Launch Site Longitude','site_lon','lon','Longitude'
            ]);
            if (isNaN(lat) || isNaN(lon)) {
                const guess = this._siteFromName(siteName);
                if (!guess) continue;
                lat = guess.lat; lon = guess.lon;
            }

            const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
            const year = dt.getFullYear();
            events.push({ key, lon, lat, year, siteName: siteName || 'Unknown site' });
        }

        // Sort by year
        events.sort((a,b) => a.year - b.year);
        
        // Get unique years
        const yearsSet = new Set(events.map(e => e.year));
        this.years = Array.from(yearsSet).sort((a,b) => a - b);
        
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
                    cumulative.set(ev.key, {
                        key: ev.key,
                        lon: ev.lon,
                        lat: ev.lat,
                        siteName: ev.siteName,
                        count: 0
                    });
                }
                cumulative.get(ev.key).count += 1;
            });
            
            // Store snapshot for this year
            this.cumulativeByYear[year] = new Map(
                Array.from(cumulative.entries()).map(([k, v]) => [k, {...v}])
            );
        });

        // Radius scale
        const maxCount = Math.max(...Array.from(cumulative.values()).map(s => s.count), 1);
        this.radiusScale = d3.scaleSqrt()
            .domain([0, maxCount])
            .range([0, 35]);
    }

    /* ---------- Controls ---------- */

    _buildControls() {
        // Controls container
        this.controls = d3.select(this.node).append('div')
            .attr('class', 'map-controls');

        // Play/Pause button
        this.playButton = this.controls.append('button')
            .attr('class', 'control-btn play-btn')
            .html('▶')
            .on('click', () => this._togglePlay());

        // Backward button
        this.controls.append('button')
            .attr('class', 'control-btn')
            .html('⏮')
            .on('click', () => this._stepBackward());

        // Forward button
        this.controls.append('button')
            .attr('class', 'control-btn')
            .html('⏭')
            .on('click', () => this._stepForward());

        // Year slider
        this.yearSlider = this.controls.append('input')
            .attr('type', 'range')
            .attr('class', 'year-slider')
            .attr('min', 0)
            .attr('max', this.years.length - 1)
            .attr('value', 0)
            .on('input', (event) => {
                this.currentYearIndex = +event.target.value;
                this._updateVisualization();
            });

        // Year label
        this.yearLabel = this.controls.append('span')
            .attr('class', 'year-label')
            .text(this.years[0] || '');
    }

    _togglePlay() {
        if (this.isPlaying) {
            this._pause();
        } else {
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
            .attr('fill', '#4a90e2')
            .attr('fill-opacity', 0.7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .on('mouseover', (e, d) => this._showTip(e, d))
            .on('mousemove', (e, d) => this._moveTip(e, d))
            .on('mouseout', () => this._hideTip());

        circlesEnter.append('text')
            .attr('class', 'site-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('fill', '#ffffff')
            .style('pointer-events', 'none')
            .style('font-weight', 700)
            .style('font-size', '10px')
            .text(d => this._acronym(d.siteName));

        // Update
        const circlesAll = circlesEnter.merge(circles);

        circlesAll.select('circle')
            .transition()
            .duration(300)
            .attr('r', d => this.radiusScale(d.count));

        circlesAll.select('text')
            .text(d => this._acronym(d.siteName))
            .style('font-size', d => Math.max(8, this.radiusScale(d.count) * 0.4) + 'px');

        // Exit
        circles.exit()
            .transition()
            .duration(200)
            .style('opacity', 0)
            .remove();
    }

    _showTip(e, d) {
        this.tooltip
            .style('visibility', 'visible')
            .html(
                `<strong>${d.siteName}</strong><br/>` +
                `Satellites: ${d.count}`
            );
        this._moveTip(e);
    }

    _moveTip(e) {
        this.tooltip
            .style('left', (e.pageX + 12) + 'px')
            .style('top',  (e.pageY - 12) + 'px');
    }

    _hideTip() { 
        this.tooltip.style('visibility', 'hidden'); 
    }

    /* ---------- Resize ---------- */

    _attachResize() {
        const onResize = () => {
            const bbox = this.node.getBoundingClientRect();
            this.w = Math.max(320, Math.floor(bbox.width));
            this.h = Math.max(240, Math.floor(bbox.height));
            d3.select(this.node).select('svg').attr('viewBox', `0 0 ${this.w} ${this.h}`);

            this._layout();
            this.gLand.selectAll('path').attr('d', this.geoPath);

            // Reposition circles
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
        onResize();
    }
}