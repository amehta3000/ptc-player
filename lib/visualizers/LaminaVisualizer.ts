/**
 * Lamina Visualizer
 *
 * A vertical stack of translucent superellipse cells — squircles ranging from
 * ellipse to rounded rectangle — cascading down the screen like a fanned deck
 * of glass filters. Each cell carries its own tint from a ramp between the two
 * palette colours, and the image is built by what the overlaps do rather than
 * by what any one cell looks like.
 *
 * Two blend modes, chosen by the theme:
 * - Light mode multiplies, so each cell is a filter and the overlaps darken.
 *   Twelve stacked filters drive the middle of the stack to near-black while
 *   the fringes stay pale: ink on paper.
 * - Dark mode adds, so each cell glows and the overlaps blow out to white.
 *
 * The stack is driven by bass kicks rather than by the spectrum as a whole.
 * Splitting 64 bands across the cells spread the energy so thin that nothing
 * read; instead an onset detector watches the bass, and every kick enters the
 * top cell and travels down the stack as a wave, each cell flashing and
 * swelling as the front passes through it. A free-running breath LFO carries
 * the stack between kicks, so quiet passages still drift.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';
import { attachPointerControls } from './pointerControls';

/** Shader loop bound; the Cells control sets how many of these are drawn. */
const MAX_CELLS = 16;

/** Shortest gap between two kicks, in seconds — about 400bpm. */
const KICK_REFRACTORY = 0.12;
/** Rise time of a cell's flash. Short, so the wave front stays legible. */
const FLASH_RISE = 0.045;
/** Kicks still travelling down the stack; older ones are dropped. */
const MAX_KICKS = 12;

const vertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  #define MAX_CELLS ${MAX_CELLS}

  uniform vec2  resolution;
  uniform float time;
  uniform float cellEnergy[MAX_CELLS];
  uniform float cellWave[MAX_CELLS];
  uniform float cellCount;
  uniform vec3  colorA;
  uniform vec3  colorB;
  uniform vec3  paper;
  uniform float spread;
  uniform float cellSize;
  uniform float cellAspect;
  uniform float squircle;
  uniform float softness;
  uniform float density;
  uniform float amp;
  uniform float taper;
  uniform float split;
  uniform float drift;
  uniform float ripple;
  uniform float grain;
  uniform vec2  shift;
  uniform float zoom;
  uniform float darkMode;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1.0e-10)), d / (q.x + 1.0e-10), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  /**
   * Coverage of one superellipse: 1 inside, 0 outside, with a soft shoulder
   * between. The exponent takes the shape from ellipse (2) to rounded
   * rectangle (8+) — the squircles in the reference sit around 4.
   *
   * The shoulder is measured against the implicit function's own gradient
   * (fwidth) rather than the cell size. A superellipse's gradient collapses
   * along its flat runs, which is exactly where the cascade's arcs are, so
   * scaling by size alone smears precisely the edges that have to stay crisp.
   */
  float cellCoverage(vec2 p, vec2 halfSize, float n, float soft) {
    vec2 q = clamp(abs(p / max(halfSize, vec2(1e-4))), 0.0, 8.0);
    float implicitD = pow(pow(q.x, n) + pow(q.y, n), 1.0 / n) - 1.0;

    // Implicit units per pixel, which converts a screen-space softness into
    // this cell's units and antialiases the edge in the same step
    float perPixel = max(fwidth(implicitD), 1.0e-6);
    float shoulder = perPixel * (1.0 + soft * resolution.y);
    return 1.0 - smoothstep(-shoulder, shoulder, implicitD);
  }

  void main() {
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 uv = vUv - 0.5;
    uv.x *= aspect;
    vec2 p = (uv - shift) / max(zoom, 0.05);

    // Cell sizes are expressed against the viewport height, so on a portrait
    // phone the stack would run off both sides. Shrinking to the narrower
    // axis keeps the same composition in any frame.
    p /= min(1.0, aspect);

    bool dark = darkMode > 0.5;
    vec3 color = dark ? vec3(0.0) : paper;

    // The ramp walks hue rather than lerping RGB: a straight RGB lerp between
    // two complements passes through grey, which muddies every cell in the
    // middle of the stack. Saturation has a floor so monochrome album art
    // still gives the stack something to ramp through.
    vec3 hsvA = rgb2hsv(colorA);
    vec3 hsvB = rgb2hsv(colorB);
    float hueDelta = hsvB.x - hsvA.x;
    hueDelta -= floor(hueDelta + 0.5);

    for (int i = 0; i < MAX_CELLS; i++) {
      // Masking beats an early break here: a uniform loop bound keeps the
      // shader portable across the GLSL versions three may compile to
      float on = step(float(i), cellCount - 0.5);
      float t = float(i) / max(cellCount - 1.0, 1.0);
      float e = cellEnergy[i];
      float w = cellWave[i];

      // Cell 0 sits at the top; each one after it steps further down, which
      // is what turns the stack into a cascade of arcs
      // The wave front shoves each cell down a little as it passes, so a kick
      // reads as travel through the stack and not just a flash
      float y = (0.5 - t) * spread - ripple * w * 0.09;
      // A slow lateral sway, detuned per cell so the stack never moves as one
      float sway = drift * 0.05 * sin(time * 0.21 + float(i) * 0.6);

      float size = cellSize * (1.0 + taper * (t - 0.5)) * (1.0 + amp * e);
      vec2 halfSize = vec2(size * cellAspect, size);

      float cover = cellCoverage(p - vec2(sway, y), halfSize, squircle, softness);
      // Energy rides on opacity rather than position: a transient makes a cell
      // bloom where it stands instead of shoving the composition around
      float a = cover * on * density * (0.62 + 0.3 * e);

      // How fast the palette crosses from one end to the other. Swept, the
      // stack reads as a continuous gradient; split, the cool cells meet the
      // warm ones at a hard seam and their filters cancel to near-black —
      // which is how the reference gets its core.
      float k = mix(0.5, 0.03, split);
      float tc = smoothstep(0.5 - k, 0.5 + k, t);

      float hue = fract(hsvA.x + hueDelta * tc);
      float sat = max(mix(hsvA.y, hsvB.y, tc), 0.3);
      float val = mix(hsvA.z, hsvB.z, tc);
      // Cells pale out toward the base of the stack, like the cream ones in
      // the reference, so the bottom lifts instead of stacking to mud
      sat *= 1.0 - 0.5 * t * t;
      val = min(1.0, val + 0.3 * t * t);
      vec3 tint = hsv2rgb(vec3(hue, sat, val));

      if (dark) {
        color += tint * a * 0.75;
      } else {
        // Subtractive: every cell is a filter, so overlaps compound toward black
        color *= mix(vec3(1.0), tint, a);
      }
    }

    if (dark) {
      // Filmic rolloff so the deepest overlaps read as white rather than
      // clipping to whichever channel saturated first
      color = vec3(1.0) - exp(-color);
      color = pow(color, vec3(0.85));
    }

    color += (hash(gl_FragCoord.xy + fract(time)) - 0.5) * grain;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class LaminaVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private mesh: THREE.Mesh | null = null;

  /** Per-cell values sent to the shader: overall energy, and kick wave alone. */
  private energies = new Float32Array(MAX_CELLS);
  private waves = new Float32Array(MAX_CELLS);
  private breathPhase = 0;

  // Onset detection: a fast bass follower against a slow one acting as the
  // running floor, plus the kicks currently travelling down the stack
  private bassFast = 0;
  private bassSlow = 0;
  private lastKickAt = -Infinity;
  private kicks: { at: number; strength: number }[] = [];
  private startTime = 0;
  private lastFrame = 0;

  // Pointer state
  private shift = { x: 0, y: 0 };
  private zoom = 1;
  private detachPointerControls: (() => void) | null = null;
  private handleResize: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Lamina';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Cells', key: 'cells', min: 3, max: MAX_CELLS, step: 1, default: 14, value: this.config.cells ?? 14 },
      { name: 'Spread', key: 'spread', min: 0, max: 1.2, step: 0.02, default: 0.5, value: this.config.spread ?? 0.5 },
      { name: 'Size', key: 'cellSize', min: 0.08, max: 0.6, step: 0.01, default: 0.19, value: this.config.cellSize ?? 0.19 },
      { name: 'Aspect', key: 'cellAspect', min: 0.6, max: 2, step: 0.05, default: 1.25, value: this.config.cellAspect ?? 1.25 },
      { name: 'Squircle', key: 'squircle', min: 2, max: 10, step: 0.5, default: 4, value: this.config.squircle ?? 4 },
      { name: 'Softness', key: 'softness', min: 0.001, max: 0.12, step: 0.001, default: 0.002, value: this.config.softness ?? 0.002 },
      { name: 'Density', key: 'density', min: 0.1, max: 1, step: 0.05, default: 0.6, value: this.config.density ?? 0.6 },
      { name: 'Amplitude', key: 'amp', min: 0, max: 0.8, step: 0.02, default: 0.3, value: this.config.amp ?? 0.3 },
      { name: 'Breath', key: 'breath', min: 0.01, max: 0.4, step: 0.01, default: 0.07, value: this.config.breath ?? 0.07 },
      { name: 'Sensitivity', key: 'sensitivity', min: 0, max: 1, step: 0.05, default: 0.6, value: this.config.sensitivity ?? 0.6 },
      { name: 'Travel', key: 'travel', min: 0, max: 0.3, step: 0.01, default: 0.08, value: this.config.travel ?? 0.08 },
      { name: 'Hold', key: 'hold', min: 0.1, max: 2, step: 0.05, default: 0.35, value: this.config.hold ?? 0.35 },
      { name: 'Ripple', key: 'ripple', min: 0, max: 2, step: 0.05, default: 0.7, value: this.config.ripple ?? 0.7 },
      { name: 'Split', key: 'split', min: 0, max: 1, step: 0.05, default: 0.6, value: this.config.split ?? 0.6 },
      { name: 'Taper', key: 'taper', min: -0.6, max: 0.6, step: 0.05, default: 0.15, value: this.config.taper ?? 0.15 },
      { name: 'Drift', key: 'drift', min: 0, max: 1, step: 0.05, default: 0.25, value: this.config.drift ?? 0.25 },
      { name: 'Grain', key: 'grain', min: 0, max: 0.08, step: 0.005, default: 0.015, value: this.config.grain ?? 0.015 },
      { name: 'View', key: 'resetView', min: 0, max: 0, step: 1, default: 0, value: 0, labels: ['Reset'] },
      { name: 'Hue', key: 'hue', min: 0, max: 360, step: 1, default: 0, value: this.config.hue ?? 0 },
      {
        name: 'Harmony',
        key: 'harmonyMode',
        min: 0,
        max: 2,
        step: 1,
        default: 2,
        value: this.config.harmonyMode ?? 2,
        labels: ['Mono', 'Analog', 'Comp']
      }
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      // The reference poster: a deep stack of squircles on a long cascade,
      // complementary ends so the ramp runs cool at the top to warm at the base
      { name: '1', config: { cells: 14, spread: 0.5, cellSize: 0.19, cellAspect: 1.25, squircle: 4, softness: 0.002, density: 0.6, amp: 0.3, breath: 0.07, sensitivity: 0.6, travel: 0.08, hold: 0.35, ripple: 0.7, split: 0.6, taper: 0.15, drift: 0.25, grain: 0.015, hue: 0, harmonyMode: 2 } },
      // Five big soft lenses, barely moving — the ambient end
      { name: '2', config: { cells: 5, spread: 0.26, cellSize: 0.32, cellAspect: 1.3, squircle: 2, softness: 0.05, density: 0.6, amp: 0.22, breath: 0.03, sensitivity: 0.45, travel: 0.22, hold: 1.8, ripple: 0.45, split: 0.0, taper: 0.3, drift: 0.1, grain: 0.02, hue: 190, harmonyMode: 1 } },
      // A tight deck of rounded rectangles, dense and architectural
      { name: '3', config: { cells: 16, spread: 0.6, cellSize: 0.18, cellAspect: 1.5, squircle: 8, softness: 0.001, density: 0.4, amp: 0.34, breath: 0.1, sensitivity: 0.7, travel: 0.05, hold: 0.55, ripple: 1.0, split: 0.85, taper: -0.2, drift: 0.35, grain: 0.01, hue: 40, harmonyMode: 2 } },
      // Few cells, wide open and highly reactive — the stack pumps visibly
      { name: '4', config: { cells: 7, spread: 0.6, cellSize: 0.24, cellAspect: 0.8, squircle: 3, softness: 0.02, density: 0.55, amp: 0.6, breath: 0.16, sensitivity: 0.85, travel: 0.03, hold: 0.4, ripple: 1.6, split: 0.3, taper: 0.45, drift: 0.6, grain: 0.03, hue: 300, harmonyMode: 2 } }
    ];
  }

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    // Clip-space quad — the vertex shader ignores the camera, but three still
    // needs one to render with.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);

    const { r, g, b } = this.parseRGB(this.colors.dominant);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
        cellEnergy: { value: this.energies },
        cellWave: { value: this.waves },
        cellCount: { value: this.config.cells ?? 14 },
        colorA: { value: new THREE.Color(r, g, b) },
        colorB: { value: new THREE.Color(r, g, b) },
        paper: { value: new THREE.Color(0xe8ebed) },
        spread: { value: this.config.spread ?? 0.5 },
        cellSize: { value: this.config.cellSize ?? 0.19 },
        cellAspect: { value: this.config.cellAspect ?? 1.25 },
        squircle: { value: this.config.squircle ?? 4 },
        softness: { value: this.config.softness ?? 0.002 },
        density: { value: this.config.density ?? 0.6 },
        amp: { value: this.config.amp ?? 0.3 },
        taper: { value: this.config.taper ?? 0.15 },
        split: { value: this.config.split ?? 0.6 },
        drift: { value: this.config.drift ?? 0.25 },
        ripple: { value: this.config.ripple ?? 0.7 },
        grain: { value: this.config.grain ?? 0.015 },
        shift: { value: new THREE.Vector2(0, 0) },
        zoom: { value: 1 },
        darkMode: { value: this.darkMode ? 1 : 0 }
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    });

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.startTime = performance.now();
    this.lastFrame = this.startTime;

    this.detachPointerControls = attachPointerControls(this.container, {
      cursor: true,
      // Drag slides the whole stack; uv.y runs up the screen while pointer y
      // runs down, hence the flipped vertical sign
      onDrag: (dx, dy) => {
        const h = this.container.clientHeight || 600;
        this.shift.x += (dx / h) * this.zoom;
        this.shift.y -= (dy / h) * this.zoom;
      },
      onZoom: (delta) => {
        this.zoom = Math.max(0.2, Math.min(5, this.zoom * Math.exp(-delta * 0.0015)));
      }
    });

    this.handleResize = () => {
      if (!this.renderer || !this.material) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.renderer.setSize(w, h);
      this.material.uniforms.resolution.value.set(w, h);
    };
    window.addEventListener('resize', this.handleResize);
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.material) return;

    const { bassAvg, isPlaying } = audioAnalysis;
    const uniforms = this.material.uniforms;

    const now = performance.now();
    // Clamped so a backgrounded tab doesn't resume with one enormous step
    const dt = Math.min(0.1, (now - this.lastFrame) * 0.001);
    this.lastFrame = now;

    const count = Math.max(3, Math.min(MAX_CELLS, Math.round(this.config.cells ?? 14)));
    const nowSec = (now - this.startTime) * 0.001;

    this.breathPhase += dt * (this.config.breath ?? 0.07) * Math.PI * 2;

    // ── Onset detection ──
    // The fast follower tracks the kick itself; the slow one is the running
    // bass floor it has to beat, which keeps a loud passage from reading as
    // one continuous kick and a quiet one from going dead.
    const bass = isPlaying ? bassAvg : 0;
    this.bassFast += (bass - this.bassFast) * (1 - Math.exp(-dt / 0.035));
    // The floor is deliberately slow: at a shorter time constant it climbs
    // into each kick it is supposed to be measuring against, and a steady
    // four-to-the-floor stops registering after a couple of seconds
    this.bassSlow += (bass - this.bassSlow) * (1 - Math.exp(-dt / 1.4));

    const sensitivity = this.config.sensitivity ?? 0.6;
    const threshold = 0.1 * (1.15 - sensitivity) + 0.012;
    const excess = this.bassFast - this.bassSlow * 1.15;

    if (isPlaying && excess > threshold && nowSec - this.lastKickAt > KICK_REFRACTORY) {
      this.lastKickAt = nowSec;
      this.kicks.push({ at: nowSec, strength: Math.max(0.45, Math.min(1, excess / 0.22)) });
      if (this.kicks.length > MAX_KICKS) this.kicks.shift();
    }

    const travel = this.config.travel ?? 0.08;
    const hold = this.config.hold ?? 0.35;

    // Drop kicks whose wave has left the bottom of the stack
    const lifetime = hold * 4 + travel * count;
    while (this.kicks.length > 0 && nowSec - this.kicks[0].at > lifetime) {
      this.kicks.shift();
    }

    // The flash shape peaks below 1, so normalise by its own peak: a kick's
    // strength then means the same thing at any Hold
    const peakAt = FLASH_RISE * Math.log(1 + hold / FLASH_RISE);
    const peak = (1 - Math.exp(-peakAt / FLASH_RISE)) * Math.exp(-peakAt / hold);

    for (let i = 0; i < MAX_CELLS; i++) {
      if (i >= count) {
        this.energies[i] = 0;
        this.waves[i] = 0;
        continue;
      }

      // Every kick enters at the top and reaches cell i one travel-step later.
      // Taking the strongest rather than the sum keeps each front its own
      // event: four-to-the-floor would otherwise pile up into a constant glow.
      let wave = 0;
      for (let k = 0; k < this.kicks.length; k++) {
        const age = nowSec - this.kicks[k].at - i * travel;
        if (age < 0) continue;
        const shape = (1 - Math.exp(-age / FLASH_RISE)) * Math.exp(-age / hold);
        wave = Math.max(wave, this.kicks[k].strength * (shape / peak));
      }

      // A detuned breath underneath keeps the stack alive between kicks, and
      // the slow bass floor lets sustained low end swell it without an onset
      const lfo = 0.5 + 0.5 * Math.sin(this.breathPhase + i * 0.7);
      const ambient = lfo * 0.25 + this.bassSlow * 0.12;

      this.waves[i] = wave;
      this.energies[i] = Math.min(1.3, ambient + wave);
    }

    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 2,
      this.config.hue ?? 0
    );
    const domRGB = this.parseRGB(dominant);
    const accRGB = this.parseRGB(accent);
    uniforms.colorA.value.setRGB(domRGB.r, domRGB.g, domRGB.b);
    uniforms.colorB.value.setRGB(accRGB.r, accRGB.g, accRGB.b);

    uniforms.time.value = (now - this.startTime) * 0.001;
    uniforms.cellCount.value = count;
    uniforms.spread.value = this.config.spread ?? 0.5;
    uniforms.cellSize.value = this.config.cellSize ?? 0.19;
    uniforms.cellAspect.value = this.config.cellAspect ?? 1.25;
    uniforms.squircle.value = this.config.squircle ?? 4;
    uniforms.softness.value = this.config.softness ?? 0.002;
    uniforms.density.value = this.config.density ?? 0.6;
    uniforms.amp.value = this.config.amp ?? 0.3;
    uniforms.taper.value = this.config.taper ?? 0.15;
    uniforms.split.value = this.config.split ?? 0.6;
    uniforms.drift.value = this.config.drift ?? 0.25;
    uniforms.ripple.value = this.config.ripple ?? 0.7;
    uniforms.grain.value = this.config.grain ?? 0.015;
    uniforms.shift.value.set(this.shift.x, this.shift.y);
    uniforms.zoom.value = this.zoom;
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Put the pointer-driven view back to square one. */
  private resetView(): void {
    this.shift = { x: 0, y: 0 };
    this.zoom = 1;
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
    // The Reset chip fires on every click, including when already selected,
    // so it works as a plain button
    if (key === 'resetView') {
      this.resetView();
    }
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
    if (this.material) {
      this.material.uniforms.darkMode.value = isDark ? 1 : 0;
    }
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize);
      this.handleResize = null;
    }
    this.detachPointerControls?.();
    this.detachPointerControls = null;

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();

    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.container.innerHTML = '';
  }
}
