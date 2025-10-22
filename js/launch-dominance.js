/**
 * LaunchDominance Visualization
 * -----------------------------
 * Displays rockets around an Earth sphere using D3 + Three.js.
 * Each rocket’s size is proportional to satellites launched.
 * When the user scrolls into view, the rockets lift off.
 */

class LaunchDominance {
  /**
   * Create a LaunchDominance visualization.
   * @param {string} hostId - The ID of the container element.
   * @param {Array<{name:string, satellites:number}>} data - Rocket data with name & satellite count.
   * @param {Object} opts - Optional layout settings.
   * @param {number} [opts.width] - Canvas width.
   * @param {number} [opts.height] - Canvas height.
   * @param {number} [opts.radius] - Earth radius.
   * @param {number} [opts.bandDeg] - Angular spread of rockets.
   * @param {number} [opts.capReveal] - Vertical offset controlling how much of Earth is visible.
   * @param {number} [opts.gapPx] - Rocket spacing along the arc.
   */
  constructor(hostId, data, opts = {}) {
    this.host = d3.select('#' + hostId);
    this.node = this.host.node();
    this.data = data;

    // Visualization parameters
    this.w = opts.width ?? this.node.clientWidth ?? 1100;
    this.h = opts.height ?? this.node.clientHeight ?? 720;
    this.radius = opts.radius ?? 430;
    this.bandDeg = opts.bandDeg ?? 170;
    this.capReveal = opts.capReveal ?? 70;
    this.gapPx = opts.gapPx ?? 28;

    // Build DOM layers
    this._buildScaffold();

    // Compute layout and render
    this._computeLayout();
    this._initThree();
    this._drawRockets();
    this._spinEarth();

    // Scroll-triggered animation
    this.lifted = false;
    this._setupObserver();
  }

  /**
   * Builds the HTML structure:
   * - A <canvas> for Three.js (Earth)
   * - An <svg> for D3 rockets
   * - A tooltip element
   */
  _buildScaffold() {
    this.canvas = this.host.append('canvas')
      .attr('class', 'earth-canvas')
      .node();

    this.svg = this.host.append('svg')
      .attr('class', 'rockets-layer')
      .attr('width', this.w)
      .attr('height', this.h);

    this.g = this.svg.append('g');

    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'rocket-tooltip');
  }

  /**
   * Computes rocket positions, sizes, and arc layout.
   * Uses a log scale so very large values don’t dominate.
   */
  _computeLayout() {
    const MIN_H = 90, MAX_H = 230;
    this.size = d3.scaleLog()
      .domain(d3.extent(this.data, d => Math.max(1, d.satellites)))
      .range([MIN_H, MAX_H])
      .clamp(true);

    this.data.forEach(d => {
      d._H = this.size(d.satellites);
      d._W = d._H * 0.30;
    });

    this.center = { x: this.w / 2, y: this.h + this.radius - this.capReveal };
    const n = this.data.length;
    this.minAngleDeg = 90 - this.bandDeg / 2;
    this.maxAngleDeg = 90 + this.bandDeg / 2;
    this.angles = d3.range(n).map(i =>
      this.minAngleDeg + i * (this.maxAngleDeg - this.minAngleDeg) / Math.max(1, n - 1)
    );

    this.toRad = a => a * Math.PI / 180;
    this.rotFor = a => 90 - a;
    this.polar = (a, r) => [
      this.center.x + r * Math.cos(this.toRad(a)),
      this.center.y - r * Math.sin(this.toRad(a))
    ];
    this.clearance = d => Math.max(36, this.size(d.satellites) * 0.2);
  }

  /**
   * Initializes the 3D Earth using Three.js.
   * Adds ambient and directional lighting.
   */
  _initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.w / this.h, 0.1, 2000);
    this.camera.position.set(0, 0, 820);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(this.w, this.h);
    this.renderer.setClearColor(0x000000, 0);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(5, 3, 5);
    this.scene.add(dir);

    // Earth
    const geo = new THREE.SphereGeometry(this.radius, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2.25);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x1e3a8a,
      emissive: 0x0a1e4a,
      specular: 0x444444,
      shininess: 30
    });
    this.earth = new THREE.Mesh(geo, mat);

    // Align Earth with SVG coordinate center
    this.earthGroup = new THREE.Object3D();
    this.earthGroup.add(this.earth);
    this.scene.add(this.earthGroup);
    const nx = (this.center.x - this.w / 2);
    const ny = -(this.center.y - this.h / 2);
    this.earthGroup.position.set(nx, ny, 0);
  }

  /**
   * Continuously rotates the Earth sphere.
   */
  _spinEarth() {
    const tick = () => {
      this.earth.rotation.y += 0.0011;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  /**
   * Draws each rocket (body, nose, fins, window, label).
   * Rockets are aligned perpendicularly to Earth’s surface.
   */
  _drawRockets() {
    const groups = this.g.selectAll('.rocket')
      .data(this.data, d => d.name)
      .join(enter => {
        const g = enter.append('g').attr('class', 'rocket');

        // Place each rocket along the arc
        g.attr('transform', (_, i) => {
          const a = this.angles[i], [x, y] = this.polar(a, this.radius);
          return `translate(${x},${y}) rotate(${this.rotFor(a)})`;
        });

        // Draw rocket parts
        g.each((d, i, nodes) => {
          const sel = d3.select(nodes[i]);
          const H = d._H, W = d._W, finW = W * 0.4;

          sel.append('rect').attr('class', 'rocket-body')
            .attr('x', -W / 2).attr('y', -H)
            .attr('width', W).attr('height', H * 0.7).attr('rx', W * 0.12);

          sel.append('path').attr('class', 'rocket-nose')
            .attr('d', `M ${-W / 2},${-H} L 0,${-H - W * 0.6} L ${W / 2},${-H} Z`);

          sel.append('path').attr('class', 'rocket-fin')
            .attr('d', `M ${-W / 2},${-H * 0.3} L ${-W / 2 - finW},${-H * 0.1} L ${-W / 2},${-H * 0.1} Z`);

          sel.append('path').attr('class', 'rocket-fin')
            .attr('d', `M ${W / 2},${-H * 0.3} L ${W / 2 + finW},${-H * 0.1} L ${W / 2},${-H * 0.1} Z`);

          sel.append('circle').attr('class', 'rocket-window')
            .attr('cx', 0).attr('cy', -H * 0.75).attr('r', W * 0.16);

          sel.append('text').attr('class', 'rocket-name')
            .attr('x', 0).attr('y', 20).text(d.name);
        });

        return g;
      });

    // Tooltip behavior
    groups
      .on('mouseover', (e, d) => {
        this.tooltip.style('visibility', 'visible')
          .html(`<strong>${d.name}</strong><br/>Satellites: ${d.satellites}`);
        d3.select(e.currentTarget)
          .style('cursor', 'pointer')
          .selectAll('.rocket-body,.rocket-nose,.rocket-fin')
          .transition().duration(120).attr('opacity', 0.85);
      })
      .on('mousemove', e => {
        this.tooltip.style('left', (e.pageX + 10) + 'px')
                    .style('top', (e.pageY - 10) + 'px');
      })
      .on('mouseout', e => {
        this.tooltip.style('visibility', 'hidden');
        d3.select(e.currentTarget)
          .selectAll('.rocket-body,.rocket-nose,.rocket-fin')
          .transition().duration(120).attr('opacity', 1);
      });

    this.rocketSel = groups;
  }

  /**
   * Watches the section element and triggers rocket lift-off when visible.
   */
  _setupObserver() {
    const section = document.getElementById('liftOffSection');
    new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.lifted) {
          this.lifted = true;
          this._animateLiftOff();
        }
      });
    }, { threshold: 0.35 }).observe(section);
  }

  /**
   * Handles the rocket lift-off animation sequence.
   * Rockets rise, bounce slightly, and settle in position.
   */
  _animateLiftOff() {
    const r0 = this.radius;
    const r1 = d => this.radius + this.clearance(d);

    const tweenTo = (from, to, a, rot) => t => {
      const r = d3.interpolateNumber(from, to)(t);
      const [x, y] = this.polar(a, r);
      return `translate(${x},${y}) rotate(${rot})`;
    };

    // Main lift animation
    this.rocketSel.transition()
      .duration(1600)
      .delay((_, i) => i * 120)
      .ease(d3.easeCubicOut)
      .attrTween('transform', (d, i) => {
        const a = this.angles[i], rot = this.rotFor(a);
        return tweenTo(r0, r1(d), a, rot);
      })
      // Bounce settle
      .transition().duration(250).ease(d3.easeQuadInOut)
      .attrTween('transform', (d, i) => {
        const a = this.angles[i], rot = this.rotFor(a);
        return tweenTo(r1(d), r1(d) - 8, a, rot);
      })
      .transition().duration(180)
      .attrTween('transform', (d, i) => {
        const a = this.angles[i], rot = this.rotFor(a);
        return tweenTo(r1(d) - 8, r1(d), a, rot);
      });
  }

  /**
   * Applies translation and scaling to reposition the entire widget.
   * @param {number} [x=0] - X translation.
   * @param {number} [y=0] - Y translation.
   * @param {number} [scale=1] - Overall scale.
   */
  setTransform(x = 0, y = 0, scale = 1) {
    this.host.style('transform', `translate(${x}px,${y}px) scale(${scale})`);
  }
}
