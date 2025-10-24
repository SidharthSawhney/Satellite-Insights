/**
 * Launch Sites Map Visualization
 * - Each launch site is a donut whose radius grows with cumulative launches.
 * - Donut segments show % mix of Government / Military / Commercial / Civilian.
 * - Center label shows a 2-letter site acronym that scales with the donut..
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

        this.categories = ['Government', 'Military', 'Commercial', 'Civilian'];

        // Colors by category
        this.colorFor = d3.scaleOrdinal()
            .domain(this.categories)
            .range(['#4e79a7', '#e15759', '#59a14f', '#f28e2b']);

        // Playback
        this.intervalMs = opts.intervalMs ?? 100; // one event per tick
        this.loop = opts.loop ?? false;

        // Build DOM, projection, map
        this._build();
        this._layout();
        this._drawBaseMap();

        this._installSiteDictionary();

        // Prepare events (also sets title years)
        this._prepLaunchEvents();

        // Start autoplay and handle resize
        this._play();
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
        this.gSites = this.g.append('g'); // donut groups

        // Title
        this.title = d3.select(this.node).append('div')
            .attr('class', 'map-title')
            .text('Satellite launches'); // actual years set after data parse

        // Legend (rectangle swatches)
        this.legend = d3.select(this.node).append('div').attr('class', 'map-legend');
        this.categories.forEach(k => {
            const row = this.legend.append('div').attr('class', 'row');
            row.append('span').attr('class', 'swatch').style('background', this.colorFor(k));
            row.append('span').text(k);
        });

        // Caption / timeline label
        this.caption = d3.select(this.node).append('div')
            .attr('class', 'map-caption')
            .text('Playing…');

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

    _normalizeCategory(raw) {
        if (!raw) return 'Civilian';
        const v = String(raw).toLowerCase();
        if (v.includes('milit')) return 'Military';
        if (v.includes('gov'))   return 'Government';
        if (v.includes('com'))   return 'Commercial';
        if (v.includes('civil')) return 'Civilian';
        if (v.includes('research') || v.includes('university')) return 'Civilian';
        return 'Civilian';
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
            const users    = this._pick(r, ['users','Users','User','Owner Type','Category']);
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

            const category = this._normalizeCategory(users);
            const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
            events.push({ key, lon, lat, dt, category, siteName: siteName || 'Unknown site' });
        }

        // Sort by time (and store years for title)
        events.sort((a,b) => a.dt - b.dt);
        this.events = events;
        this.i = 0;

        if (events.length) {
            const y1 = events[0].dt.getFullYear();
            const yN = events[events.length - 1].dt.getFullYear();
            this.title.text(`Satellite launches from ${y1} to ${yN}`);
        }

        // Per-site state
        this.sites = new Map();
        this.R = c => 4 + Math.sqrt(c) * 3.0; // outer radius of donut
        this.arcInner = R => R * 0.55;        // inner radius
        this.pie = d3.pie().sort(null).value(d => d.value);

        // initial render (empty)
        this._renderSites();
    }

    /* ---------- Rendering donuts ---------- */

    _siteDataForPie(site) {
        return this.categories.map(cat => ({
            category: cat,
            value: site.byCat[cat] || 0,
            site
        }));
    }

    _renderSites() {
        const arr = Array.from(this.sites.values());

        // One <g> per site
        const siteG = this.gSites.selectAll('g.site')
            .data(arr, d => d.key);

        const siteGEnter = siteG.enter()
            .append('g')
            .attr('class', 'site')
            .attr('transform', d => {
                const [x,y] = this.projection([d.lon, d.lat]);
                // enter at a slightly smaller scale, then pop to 1.0
                return `translate(${x},${y}) scale(0.75)`;
            })
            .style('opacity', 0);

        // center label (acronym)
        siteGEnter.append('text')
            .attr('class', 'site-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('fill', '#ffffff')
            .style('pointer-events', 'none')
            .style('font-weight', 700)
            .text(d => d.acronym || this._acronym(d.siteName));

        // donut paths group
        siteGEnter.append('g').attr('class', 'donut');

        // gentle scale-in for the whole site group (no slice sweep)
        siteGEnter.transition().duration(220)
            .style('opacity', 1)
            .attr('transform', d => {
                const [x,y] = this.projection([d.lon, d.lat]);
                return `translate(${x},${y}) scale(1)`;
            });

        // Merge for update
        const siteGAll = siteGEnter.merge(siteG);

        // Keep groups positioned (and scaled at 1) on resize/updates
        siteGAll.attr('transform', d => {
            const [x,y] = this.projection([d.lon, d.lat]);
            return `translate(${x},${y}) scale(1)`;
        });

        siteGAll.each((site, i, nodes) => {
            const R = this.R(site.count);
            const inner = this.arcInner(R);
            const arc = d3.arc().innerRadius(inner).outerRadius(R);

            // keep a stable category order so the ring always “looks whole”
            const pieces = this.pie(this._siteDataForPie(site));

            // update donut segments
            const g = d3.select(nodes[i]).select('g.donut');
            const seg = g.selectAll('path.seg')
                .data(pieces, d => d.data.category);

            seg.enter().append('path')
                .attr('class', 'seg')
                .attr('fill', d => this.colorFor(d.data.category))
                .attr('stroke', '#0b0c10')
                .attr('stroke-width', 0.6)
                .attr('d', arc)                         // draw at final angles immediately
                .on('mouseover', (e, d) => this._showTip(e, d))
                .on('mousemove', (e, d) => this._moveTip(e, d))
                .on('mouseout', () => this._hideTip());

            seg
                .attr('fill', d => this.colorFor(d.data.category))
                .attr('d', arc);                         // update without animation

            seg.exit().remove();

            // center label size tracks donut radius
            d3.select(nodes[i]).select('text.site-label')
                .text(site.acronym || (site.acronym = this._acronym(site.siteName)))
                .style('font-size', Math.max(8, R * 0.55) + 'px');
        });

        siteG.exit().remove();
    }

    _showTip(e, d) {
        const site = d.data.site;
        const total = Math.max(1, site.count);
        const count = d.data.value;
        const pct = (count / total) * 100;
        this.tooltip
            .style('visibility', 'visible')
            .html(
                `<strong>${site.siteName}</strong><br/>` +
                `${d.data.category}: ${count} (${pct.toFixed(1)}%)<br/>` +
                `Total: ${total}`
            );
        this._moveTip(e);
    }
    _moveTip(e) {
        this.tooltip
            .style('left', (e.offsetX + 12) + 'px')
            .style('top',  (e.offsetY - 12) + 'px');
    }
    _hideTip() { this.tooltip.style('visibility', 'hidden'); }

    /* ---------- Playback ---------- */

    _tick() {
        if (this.i >= this.events.length) {
            if (this.loop) this._restart();
            return;
        }

        const ev = this.events[this.i++];
        const key = ev.key;

        if (!this.sites.has(key)) {
            this.sites.set(key, {
                key, lon: ev.lon, lat: ev.lat, siteName: ev.siteName,
                count: 0,
                byCat: { Government:0, Military:0, Commercial:0, Civilian:0 },
                acronym: this._acronym(ev.siteName)
            });
        }
        const s = this.sites.get(key);
        s.count += 1;
        s.byCat[ev.category] = (s.byCat[ev.category] || 0) + 1;

        // update caption
        const d = ev.dt;
        this.caption.text(
            `Launching…  ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        );

        this._renderSites();
    }

    _play() {
        this._stop();
        this.timer = setInterval(() => this._tick(), this.intervalMs);
    }
    _stop() { if (this.timer) clearInterval(this.timer); }
    _restart() {
        this._stop();
        this.i = 0;
        this.sites.clear();
        this._renderSites();
        this._play();
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

            // Reposition site groups and recompute arcs to the same counts
            this._renderSites();
        };

        if (window.ResizeObserver) {
            this._ro = new ResizeObserver(onResize);
            this._ro.observe(this.node);
        }
        window.addEventListener('resize', onResize);
        onResize();
    }
}
