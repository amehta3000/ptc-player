/**
 * Particle Field Visualizer
 *
 * A host for pluggable per-particle "fields". This class owns everything a
 * particle visualizer normally has to rebuild from scratch — scene, camera,
 * renderer, points mesh, drag/zoom controls, trail overlay, audio smoothing,
 * beat detection, palette derivation — and delegates the only interesting
 * part, where each particle goes and what colour it is, to a field body in
 * `fields/`.
 *
 * A field body is a pure function of (index, time, audio). It holds no state
 * between frames, allocates nothing, and is called `particleCount` times per
 * frame. See PARTICLE_FIELD_PROMPT.md for the prompt that writes them.
 *
 * Failure mode: a field that throws or emits non-finite values is contained.
 * The offending frame is dropped, the error is logged once, and the rest of
 * the player keeps running.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme, VisualizerPreset } from './BaseVisualizer';
import { PARTICLE_FIELDS, PARTICLE_FIELD_NAMES } from './fields';
import { FieldContext, FieldControlSpec, ParticleField } from './fields/types';
import { DragInertia } from './dragInertia';

/** Hard bound on particle coordinates, so a runaway field cannot lose the camera. */
const COORD_LIMIT = 60;
const SPECTRUM_BINS = 64;
/** Camera pitch in radians for fields that do not ask for their own. */
const DEFAULT_CAMERA_PITCH = 0.25;

export class ParticleFieldVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;

  // Geometry buffers
  private positions: Float32Array = new Float32Array(0);
  private colorsArray: Float32Array = new Float32Array(0);
  private sizes: Float32Array = new Float32Array(0);
  private alphas: Float32Array = new Float32Array(0);
  private count: number = 0;

  // Trail / fade overlay
  private fadeScene: THREE.Scene | null = null;
  private fadeCamera: THREE.OrthographicCamera | null = null;
  private fadeMaterial: THREE.MeshBasicMaterial | null = null;

  // Clock
  private startTime: number = 0;
  private lastFrameTime: number = 0;

  // Audio state
  private spectrum: Float32Array = new Float32Array(SPECTRUM_BINS);
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  private smoothLevel = 0;
  private beat = 0;
  private beatThreshold = 0;
  private lastBeatTime = 0;
  private readonly beatCooldown = 300;

  // Palette
  private dominantColor = new THREE.Color(0xffffff);
  private accentColor = new THREE.Color(0xffffff);
  private paletteHue = 0;
  private hslScratch = { h: 0, s: 0, l: 0 };

  // Field state
  private fieldSpecs: FieldControlSpec[] = [];
  private fieldValues: Record<string, number> = {};
  private probing = false;
  private fieldError: string | null = null;
  private ctx: FieldContext;

  // Set after a field or particle-count change so the trail buffer does not
  // ghost the previous field into the new one.
  private needsClear = false;

  // Camera controls
  private cameraRotation = { x: DEFAULT_CAMERA_PITCH, y: 0 };
  private cameraDistance = 16;
  private zoomPhase = 0;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private dragInertia = new DragInertia();
  private listenerCleanup: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
    this.ctx = this.createContext();
  }

  getName(): string {
    return 'Particle Field';
  }

  // ---------------------------------------------------------------------
  // Field plumbing
  // ---------------------------------------------------------------------

  private currentField(): ParticleField {
    const idx = Math.round(this.config.field ?? 0);
    return PARTICLE_FIELDS[Math.max(0, Math.min(PARTICLE_FIELDS.length - 1, idx))];
  }

  /** Config key a field control is persisted under, namespaced by field. */
  private fieldConfigKey(fieldKey: string, controlKey: string): string {
    return `f_${fieldKey}_${controlKey}`;
  }

  /**
   * Build the reusable context handed to the field body. Created once and
   * mutated in place — the body runs up to 20k times per frame, so nothing
   * here may allocate.
   */
  private createContext(): FieldContext {
    return {
      i: 0,
      count: 0,
      time: 0,
      dt: 1 / 60,
      bass: 0,
      mid: 0,
      high: 0,
      level: 0,
      beat: 0,
      isPlaying: false,
      target: new THREE.Vector3(),
      color: new THREE.Color(),
      attr: { size: 1, alpha: 1 },
      spectrum: (bin: number) => {
        const b = Math.round(bin);
        if (!(b >= 0)) return this.spectrum[0];
        return this.spectrum[Math.min(SPECTRUM_BINS - 1, b)];
      },
      band: (t: number) => {
        const clamped = t > 0 ? (t < 1 ? t : 1) : 0;
        const pos = clamped * (SPECTRUM_BINS - 1);
        const lo = Math.floor(pos);
        const hi = Math.min(SPECTRUM_BINS - 1, lo + 1);
        const frac = pos - lo;
        return this.spectrum[lo] * (1 - frac) + this.spectrum[hi] * frac;
      },
      hash: (n: number) => {
        const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
        const v = s - Math.floor(s);
        return v >= 0 && v <= 1 ? v : 0.5;
      },
      addControl: (key, label, min, max, step, initial) => {
        if (this.probing) {
          this.fieldSpecs.push({ key, label, min, max, step, initial });
          const stored = this.config[this.fieldConfigKey(this.currentField().key, key)];
          const value = typeof stored === 'number' && Number.isFinite(stored) ? stored : initial;
          this.fieldValues[key] = value;
          return value;
        }
        const live = this.fieldValues[key];
        return typeof live === 'number' ? live : initial;
      },
      dominant: this.dominantColor,
      accent: this.accentColor,
      paletteHue: 0,
      isDark: true,
      THREE,
    };
  }

  /**
   * Run the field body once to discover its controls. Also the first line of
   * defence: a body that throws here is disabled before it can run 20k times.
   */
  private probeField(): void {
    this.fieldSpecs = [];
    this.fieldValues = {};
    this.fieldError = null;

    const field = this.currentField();
    if (!field) {
      this.fieldError = 'No particle fields registered';
      return;
    }

    this.probing = true;
    this.ctx.i = 0;
    this.ctx.count = Math.max(1, this.count || 1);
    this.ctx.attr.size = 1;
    this.ctx.attr.alpha = 1;
    try {
      field.body(this.ctx);
    } catch (err) {
      this.fieldError = `Field "${field.key}" failed to initialize: ${err}`;
      console.error(this.fieldError, err);
    } finally {
      this.probing = false;
    }
  }

  /**
   * Point the camera at whatever angle the current field wants. Disc-shaped
   * fields need a steeper pitch or they are seen edge-on and read as a line;
   * upright fields want the shallow default. Read straight off the field so
   * one field's preference never leaks into the next.
   */
  private applyFieldPitch(): void {
    const wanted = this.currentField()?.defaults?.cameraPitch;
    const pitch = typeof wanted === 'number' && Number.isFinite(wanted) ? wanted : DEFAULT_CAMERA_PITCH;
    this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    this.updateCameraPosition();
  }

  /** Apply a field's preferred host-control defaults (particleSize, trail, etc.). */
  private applyFieldDefaults(): void {
    const defs = this.currentField().defaults;
    if (!defs) return;
    for (const [key, value] of Object.entries(defs)) {
      if (typeof value !== 'number') continue;
      this.config[key] = value;
      this.updateConfig(key, value);
    }
  }

  /** Configure fade material blending for the current dark-mode and trail settings. */
  private applyFadeMode(): void {
    if (!this.fadeMaterial) return;
    const trail = this.config.trail ?? 0;
    if (this.darkMode) {
      // Subtractive: dst = dst - color. Guarantees pixels reach true black.
      const fade = trail > 0 ? 0.012 * (1 - trail) + 0.002 : 1;
      this.fadeMaterial.color.setRGB(fade, fade, fade);
      this.fadeMaterial.transparent = false;
      this.fadeMaterial.opacity = 1;
      this.fadeMaterial.blending = THREE.CustomBlending;
      this.fadeMaterial.blendEquation = THREE.ReverseSubtractEquation;
      this.fadeMaterial.blendSrc = THREE.OneFactor;
      this.fadeMaterial.blendDst = THREE.OneFactor;
      this.fadeMaterial.blendEquationAlpha = THREE.AddEquation;
      this.fadeMaterial.blendSrcAlpha = THREE.ZeroFactor;
      this.fadeMaterial.blendDstAlpha = THREE.OneFactor;
    } else {
      // Multiplicative: dst = dst * (1 - opacity) + lightGray * opacity.
      this.fadeMaterial.color.set(0xe8ebed);
      this.fadeMaterial.transparent = true;
      this.fadeMaterial.opacity = trail > 0 ? 0.08 * (1 - trail) : 1;
      this.fadeMaterial.blending = THREE.NormalBlending;
    }
    this.fadeMaterial.needsUpdate = true;
  }

  // ---------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------

  getControls(): VisualizerControl[] {
    const field = this.currentField();

    const hostControls: VisualizerControl[] = [
      {
        name: 'Field',
        key: 'field',
        min: 0,
        max: Math.max(0, PARTICLE_FIELDS.length - 1),
        step: 1,
        default: 0,
        value: Math.round(this.config.field ?? 0),
        labels: PARTICLE_FIELD_NAMES,
      },
      {
        name: 'Particle Count',
        key: 'particleCount',
        min: 1000,
        max: 30000,
        step: 1000,
        default: 12000,
        value: this.config.particleCount ?? 12000,
      },
      {
        name: 'Particle Size',
        key: 'particleSize',
        min: 0.2,
        max: 2,
        step: 0.1,
        default: 1,
        value: this.config.particleSize ?? 1,
      },
      {
        name: 'Camera Speed',
        key: 'cameraSpeed',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0.001,
        value: this.config.cameraSpeed ?? 0.001,
      },
      {
        name: 'Zoom Speed',
        key: 'zoomSpeed',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0,
        value: this.config.zoomSpeed ?? 0,
      },
      {
        name: 'Trail',
        key: 'trail',
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0,
        value: this.config.trail ?? 0,
      },
      {
        name: 'Hue',
        key: 'hue',
        min: 0,
        max: 360,
        step: 1,
        default: 0,
        value: this.config.hue ?? 0,
      },
      {
        name: 'Harmony',
        key: 'harmonyMode',
        min: 0,
        max: 2,
        step: 1,
        default: 0,
        value: this.config.harmonyMode ?? 0,
        labels: ['Mono', 'Analog', 'Comp'],
      },
    ];

    const fieldControls: VisualizerControl[] = this.fieldSpecs.map((spec) => ({
      name: spec.label,
      key: this.fieldConfigKey(field.key, spec.key),
      min: spec.min,
      max: spec.max,
      step: spec.step,
      default: spec.initial,
      value: this.fieldValues[spec.key] ?? spec.initial,
    }));

    return [...hostControls, ...fieldControls];
  }

  getPresets(): VisualizerPreset[] {
    return [
      {
        name: '1',
        config: { field: 0, particleCount: 12000, particleSize: 1, trail: 0, cameraSpeed: 0.001, zoomSpeed: 0, hue: 0, harmonyMode: 0 },
      },
      {
        name: '2',
        config: { field: 0, particleCount: 24000, particleSize: 0.6, trail: 0.45, cameraSpeed: 0.004, zoomSpeed: 0.002, hue: 200, harmonyMode: 1 },
      },
      {
        name: '3',
        config: { field: 1, particleCount: 16000, particleSize: 1.2, trail: 0.2, cameraSpeed: 0.002, zoomSpeed: 0, hue: 0, harmonyMode: 2 },
      },
      {
        name: '4',
        config: { field: 1, particleCount: 30000, particleSize: 0.4, trail: 0.7, cameraSpeed: 0.008, zoomSpeed: 0.003, hue: 40, harmonyMode: 1 },
      },
    ];
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.renderer.autoClear = false;
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    // Trail overlay: fade previous frames so particles leave trails.
    // Dark mode uses subtractive blending (dst - color) so pixels reach true
    // black; multiplicative fade leaves 8-bit rounding ghosts.
    this.fadeScene = new THREE.Scene();
    this.fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fadeMaterial = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false });
    this.applyFadeMode();
    this.fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMaterial));

    this.refreshPalette();
    this.buildPoints();
    this.probeField();

    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;

    this.cameraDistance = this.config.cameraDistance || 16;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 16) / 8)));
    this.applyFieldPitch();
    this.setupControls();
  }

  private buildPoints(): void {
    if (!this.scene) return;

    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      this.points = null;
    }

    this.count = Math.max(1, Math.round(this.config.particleCount ?? 12000));
    this.positions = new Float32Array(this.count * 3);
    this.colorsArray = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.alphas = new Float32Array(this.count);
    this.sizes.fill(1);
    this.alphas.fill(1);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colorsArray, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    if (!this.material) {
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          baseSize: { value: this.config.particleSize ?? 1 },
          darkMode: { value: this.darkMode ? 1 : 0 },
        },
        vertexShader: `
          attribute vec3 color;
          attribute float size;
          attribute float alpha;
          uniform float baseSize;
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vColor = color;
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * baseSize * (80.0 / max(-mvPosition.z, 0.1));
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float darkMode;
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            float core = 1.0 - smoothstep(0.35, 0.5, dist);
            float glow = exp(-dist * dist * 18.0) * 0.3;
            float a = (core + glow) * vAlpha;
            a = darkMode > 0.5 ? a : clamp(a * 1.8, 0.0, 1.0);
            gl_FragColor = vec4(vColor, a);
          }
        `,
        transparent: true,
        blending: this.darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
    }

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  // ---------------------------------------------------------------------
  // Per-frame
  // ---------------------------------------------------------------------

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    const now = performance.now();
    // Clamp dt so a backgrounded tab does not jump the animation on return
    const dt = Math.min(0.1, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.updateAudio(audioAnalysis, dt);

    // Camera
    if (!this.isDragging) {
      this.dragInertia.glideOrbit(this.cameraRotation);
      this.cameraRotation.y += this.config.cameraSpeed ?? 0.001;
    }
    const zoomSpeed = this.config.zoomSpeed ?? 0;
    if (zoomSpeed > 0) {
      this.zoomPhase += zoomSpeed;
      this.cameraDistance = 16 + 8 * Math.sin(this.zoomPhase);
    }
    this.updateCameraPosition();

    this.runField((now - this.startTime) / 1000, dt, audioAnalysis.isPlaying);
  }

  private updateAudio(audio: AudioAnalysis, dt: number): void {
    for (let i = 0; i < SPECTRUM_BINS; i++) {
      const v = (audio.audioData[i] || 0) / 255;
      this.spectrum[i] = Number.isFinite(v) ? v : 0;
    }

    const smoothing = 0.3;
    this.smoothBass += (audio.bassAvg - this.smoothBass) * smoothing;
    this.smoothMid += (audio.midAvg - this.smoothMid) * smoothing;
    this.smoothHigh += (audio.highAvg - this.smoothHigh) * smoothing;
    this.smoothLevel += (audio.normalizedFrequency - this.smoothLevel) * smoothing;

    // Beat: energy spike above a slow-moving threshold, then exponential decay
    const energy = audio.bassAvg * 0.5 + audio.midAvg * 0.3 + audio.highAvg * 0.2;
    if (audio.isPlaying && energy > this.beatThreshold * 1.9) {
      const now = Date.now();
      if (now - this.lastBeatTime > this.beatCooldown) {
        this.beat = Math.min(1, energy * 2.5);
        this.lastBeatTime = now;
      }
    }
    this.beatThreshold = this.beatThreshold * 0.93 + energy * 0.07;
    this.beat = Math.max(0, this.beat - dt * 3.3);
  }

  private runField(time: number, dt: number, isPlaying: boolean): void {
    if (!this.points || this.fieldError) return;

    const field = this.currentField();
    if (!field) return;

    const ctx = this.ctx;
    ctx.count = this.count;
    ctx.time = time;
    ctx.dt = dt;
    ctx.bass = Math.max(0, Math.min(1, Math.max(this.smoothBass, 0)));
    ctx.mid = Math.max(0, Math.min(1, this.smoothMid));
    ctx.high = Math.max(0, Math.min(1, this.smoothHigh));
    ctx.level = Math.max(0, Math.min(1, this.smoothLevel));
    ctx.beat = this.beat;
    ctx.isPlaying = isPlaying;
    ctx.paletteHue = this.paletteHue;
    ctx.isDark = this.darkMode;

    const pos = this.positions;
    const col = this.colorsArray;
    const siz = this.sizes;
    const alp = this.alphas;
    const count = this.count;

    // One try/catch around the whole loop, not per particle: a throwing field
    // is disabled outright rather than throwing 20k times a frame.
    try {
      for (let i = 0; i < count; i++) {
        ctx.i = i;
        ctx.attr.size = 1;
        ctx.attr.alpha = 1;

        field.body(ctx);

        const p = i * 3;
        let x = ctx.target.x;
        let y = ctx.target.y;
        let z = ctx.target.z;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          x = 0; y = 0; z = 0;
        }
        pos[p] = x < -COORD_LIMIT ? -COORD_LIMIT : x > COORD_LIMIT ? COORD_LIMIT : x;
        pos[p + 1] = y < -COORD_LIMIT ? -COORD_LIMIT : y > COORD_LIMIT ? COORD_LIMIT : y;
        pos[p + 2] = z < -COORD_LIMIT ? -COORD_LIMIT : z > COORD_LIMIT ? COORD_LIMIT : z;

        const r = ctx.color.r;
        const g = ctx.color.g;
        const b = ctx.color.b;
        col[p] = Number.isFinite(r) ? (r < 0 ? 0 : r > 4 ? 4 : r) : 1;
        col[p + 1] = Number.isFinite(g) ? (g < 0 ? 0 : g > 4 ? 4 : g) : 1;
        col[p + 2] = Number.isFinite(b) ? (b < 0 ? 0 : b > 4 ? 4 : b) : 1;

        const s = ctx.attr.size;
        siz[i] = Number.isFinite(s) ? (s < 0 ? 0 : s > 8 ? 8 : s) : 1;
        const a = ctx.attr.alpha;
        alp[i] = Number.isFinite(a) ? (a < 0 ? 0 : a > 1 ? 1 : a) : 1;
      }
    } catch (err) {
      this.fieldError = `Field "${field.key}" threw during update: ${err}`;
      console.error(this.fieldError, err);
      return;
    }

    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;

    const trail = this.config.trail ?? 0;
    if (this.needsClear) {
      this.needsClear = false;
      this.renderer.clear();
    }
    if (trail > 0 && this.fadeScene && this.fadeCamera) {
      this.renderer.render(this.fadeScene, this.fadeCamera);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ---------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const d = this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x);
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, 0);
  }

  private setupControls(): void {
    const element = this.container;

    const onDown = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      this.dragInertia.grab();
      const pos = 'touches' in e ? e.touches[0] : e;
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      const dx = pos.clientX - this.lastMousePos.x;
      const dy = pos.clientY - this.lastMousePos.y;
      this.dragInertia.record(dx, dy);
      this.cameraRotation.y += dx * 0.005;
      this.cameraRotation.x += dy * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };

    const onUp = () => {
      this.isDragging = false;
      this.dragInertia.release();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(3, Math.min(40, this.cameraDistance + e.deltaY * 0.01));
      this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 16) / 8)));
      this.updateCameraPosition();
    };

    const handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const width = this.container.clientWidth || 800;
      const height = this.container.clientHeight || 600;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    element.addEventListener('mousedown', onDown);
    element.addEventListener('mousemove', onMove);
    element.addEventListener('mouseup', onUp);
    element.addEventListener('mouseleave', onUp);
    element.addEventListener('touchstart', onDown);
    element.addEventListener('touchmove', onMove);
    element.addEventListener('touchend', onUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    this.listenerCleanup = () => {
      element.removeEventListener('mousedown', onDown);
      element.removeEventListener('mousemove', onMove);
      element.removeEventListener('mouseup', onUp);
      element.removeEventListener('mouseleave', onUp);
      element.removeEventListener('touchstart', onDown);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onUp);
      element.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
    };
  }

  // ---------------------------------------------------------------------
  // Palette
  // ---------------------------------------------------------------------

  /** Derive the field-facing palette from album art + hue/harmony controls. */
  private refreshPalette(): void {
    const scheme = this.harmonyColorScheme(this.config.harmonyMode ?? 0, this.config.hue ?? 0);
    this.dominantColor.set(scheme.dominant);
    this.accentColor.set(scheme.accent);
    this.dominantColor.getHSL(this.hslScratch);
    this.paletteHue = Number.isFinite(this.hslScratch.h) ? this.hslScratch.h : 0;
  }

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    this.refreshPalette();
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
    this.applyFadeMode();
    if (this.material) {
      this.material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      this.material.uniforms.darkMode.value = isDark ? 1 : 0;
      this.material.needsUpdate = true;
    }
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    // Field control: namespaced key, only applies to the field it belongs to
    if (key.startsWith('f_')) {
      const prefix = `f_${this.currentField().key}_`;
      if (key.startsWith(prefix)) {
        this.fieldValues[key.slice(prefix.length)] = value;
      }
      return;
    }

    if (key === 'field') {
      this.probeField();
      this.applyFieldDefaults();
      this.applyFieldPitch();
      this.needsClear = true;
      return;
    }

    if (key === 'particleCount' && this.scene) {
      this.buildPoints();
      this.needsClear = true;
      return;
    }

    if (key === 'particleSize' && this.material) {
      this.material.uniforms.baseSize.value = value;
      return;
    }

    if (key === 'trail' && this.fadeMaterial) {
      this.applyFadeMode();
      return;
    }

    if (key === 'hue' || key === 'harmonyMode') {
      this.refreshPalette();
      return;
    }

    if (key === 'cameraDistance') {
      this.cameraDistance = value;
      this.updateCameraPosition();
    }
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.listenerCleanup) {
      this.listenerCleanup();
      this.listenerCleanup = null;
    }

    if (this.points) {
      this.points.geometry.dispose();
      this.points = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.fadeMaterial) {
      this.fadeMaterial.dispose();
      this.fadeMaterial = null;
    }
    if (this.fadeScene) {
      this.fadeScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      this.fadeScene = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.fadeCamera = null;
    this.positions = new Float32Array(0);
    this.colorsArray = new Float32Array(0);
    this.sizes = new Float32Array(0);
    this.alphas = new Float32Array(0);
  }
}
