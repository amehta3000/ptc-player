/**
 * Doppler Visualizer
 *
 * A wireframe orb drawn entirely out of expanding rings. Each ring is a
 * circle of latitude on a sphere: it is born as a point at the near pole,
 * sweeps outward across the face of the orb, passes the silhouette at the
 * equator and closes again on the far side. Several in flight at once weave
 * the sphere out of nothing but travelling wavefronts.
 *
 * Every ring is one detected hit. A kick spawns a ring, so the orb ripples
 * outward on the beat the way a doppler diagram draws a moving source: the
 * rings bunch up when hits come fast and spread apart when they do not, and
 * their spacing is a direct picture of the rhythm.
 *
 * The sphere is an impostor — no geometry, just a disc in a fragment shader
 * with the surface solved per pixel. Both hemispheres are drawn, the far one
 * dimmer, which is what makes the orb read as see-through rather than solid.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';
import { attachPointerControls } from './pointerControls';
import { OnsetDetector } from './onsetDetector';

/** Rings in flight at once. A ring's whole life is one sweep pole to pole. */
const MAX_WAVES = 24;
/**
 * Phase marking a spent ring. Well past PI, but a real number: a non-finite
 * uniform can come back NaN in the shader, and one NaN poisons the pixel.
 */
const SPENT = 99;

const vertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  #define MAX_WAVES ${MAX_WAVES}
  #define PI 3.14159265359

  uniform vec2  resolution;
  uniform float time;
  uniform float wavePhase[MAX_WAVES];
  uniform float waveFade[MAX_WAVES];
  uniform vec3  colorA;
  uniform vec3  colorB;
  uniform float orbRadius;
  uniform float thickness;
  uniform float backside;
  uniform float glow;
  uniform float spin;
  uniform float tilt;
  uniform float wobble;
  uniform vec2  shift;
  uniform float zoom;
  uniform float darkMode;

  varying vec2 vUv;

  mat3 rotX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
  }

  mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  }

  /**
   * Sum every live ring passing through this point of the sphere. A ring at
   * phase p is the set of surface points sitting p radians from the pole, so
   * the whole test is one angle against one number.
   */
  vec3 ringsAt(vec3 n) {
    float ang = acos(clamp(n.z, -1.0, 1.0));

    // The angle's gradient blows up at the silhouette, where the surface
    // turns away from the camera; clamping keeps the rim from smearing into
    // a band while still antialiasing the face
    float aa = clamp(fwidth(ang), 0.0015, 0.08);

    vec3 acc = vec3(0.0);
    for (int i = 0; i < MAX_WAVES; i++) {
      float phase = wavePhase[i];
      // A phase past PI has swept off the far pole and is spent
      float alive = step(phase, PI) * step(0.0, phase);
      float d = abs(ang - phase);

      float line = 1.0 - smoothstep(thickness, thickness + aa, d);
      // A little bloom either side so the lines read as light, not ink
      float halo = glow * 0.012 / (d + 0.012);

      // A tinted body under a white-hot core. A tinted line alone cannot
      // blow out — the filmic curve saturates each channel on its own, so a
      // dull palette would cap every line at its own brightness.
      vec3 tint = mix(colorA, colorB, phase / PI);
      vec3 body = tint * (line * 2.2 + halo);
      vec3 core = vec3(line * line * 1.4);
      acc += (body + core) * waveFade[i] * alive;
    }
    return acc;
  }

  void main() {
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 uv = vUv - 0.5;
    uv.x *= aspect;

    vec2 p = (uv - shift) / max(zoom, 0.05);
    // Sizes are set against the viewport height, so scaling to the narrow
    // axis keeps the orb inside a portrait frame
    p /= min(1.0, aspect);

    vec3 color = vec3(0.0);
    float r = length(p) / max(orbRadius, 0.01);

    if (r <= 1.0) {
      float z = sqrt(max(0.0, 1.0 - r * r));
      vec2 q = p / max(orbRadius, 0.01);

      // The ring axis stays pointed near the camera, so a ring is born as a
      // point at the centre of the disc and opens outward — concentric
      // circles emanating out. Spin precesses that axis around a narrow cone
      // instead of spinning the sphere side-on, which would turn the rings
      // into longitudes running pole to pole.
      float precess = time * spin;
      float lean = tilt + wobble * 0.12 * sin(time * 0.31);
      mat3 orient = rotY(lean * cos(precess)) * rotX(lean * sin(precess));

      vec3 front = orient * vec3(q, z);
      vec3 back = orient * vec3(q, -z);

      color += ringsAt(front);
      color += ringsAt(back) * backside;
    }

    // Filmic rolloff so crossing rings read as white rather than clipping
    color = vec3(1.0) - exp(-color);

    if (darkMode < 0.5) {
      color = vec3(1.0) - color;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class DopplerVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private mesh: THREE.Mesh | null = null;

  /** Ring state: sweep angle from the near pole, the hit that made it, and
   *  the brightness sent to the shader. */
  private phases = new Float32Array(MAX_WAVES);
  private strengths = new Float32Array(MAX_WAVES);
  private fades = new Float32Array(MAX_WAVES);

  private onset = new OnsetDetector();
  private lastEmitAt = -Infinity;
  private startTime = 0;
  private lastFrame = 0;

  // Pointer state
  private shift = { x: 0, y: 0 };
  private zoom = 1;
  private detachPointerControls: (() => void) | null = null;
  private handleResize: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
    // A dead ring sits past the end of its sweep
    this.phases.fill(SPENT);
  }

  getName(): string {
    return 'Doppler';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Size', key: 'orbRadius', min: 0.1, max: 0.6, step: 0.01, default: 0.36, value: this.config.orbRadius ?? 0.36 },
      { name: 'Speed', key: 'speed', min: 0.1, max: 2.5, step: 0.05, default: 0.75, value: this.config.speed ?? 0.75 },
      { name: 'Thickness', key: 'thickness', min: 0.002, max: 0.06, step: 0.002, default: 0.01, value: this.config.thickness ?? 0.01 },
      { name: 'Sensitivity', key: 'sensitivity', min: 0, max: 1, step: 0.05, default: 0.65, value: this.config.sensitivity ?? 0.65 },
      { name: 'Pulse', key: 'pulse', min: 0, max: 3, step: 0.1, default: 0.8, value: this.config.pulse ?? 0.8 },
      { name: 'Backside', key: 'backside', min: 0, max: 1, step: 0.05, default: 0.45, value: this.config.backside ?? 0.45 },
      { name: 'Glow', key: 'glow', min: 0, max: 1.5, step: 0.05, default: 0.35, value: this.config.glow ?? 0.35 },
      { name: 'Spin', key: 'spin', min: 0, max: 1, step: 0.02, default: 0.18, value: this.config.spin ?? 0.18 },
      { name: 'Tilt', key: 'tilt', min: -1.2, max: 1.2, step: 0.05, default: 0.5, value: this.config.tilt ?? 0.5 },
      { name: 'Wobble', key: 'wobble', min: 0, max: 1.5, step: 0.05, default: 0.5, value: this.config.wobble ?? 0.5 },
      { name: 'Trail', key: 'trail', min: 0, max: 1, step: 0.05, default: 0.35, value: this.config.trail ?? 0.35 },
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
      // Thin white wireframe, close to the reference
      { name: '1', config: { orbRadius: 0.36, speed: 0.75, thickness: 0.01, sensitivity: 0.65, pulse: 0.8, backside: 0.45, glow: 0.35, spin: 0.18, tilt: 0.5, wobble: 0.5, trail: 0.35, hue: 0, harmonyMode: 0 } },
      // Slow and sparse: a few wide rings drifting across a big orb
      { name: '2', config: { orbRadius: 0.46, speed: 0.3, thickness: 0.016, sensitivity: 0.45, pulse: 0.3, backside: 0.7, glow: 0.6, spin: 0.06, tilt: 0.8, wobble: 0.9, trail: 0.6, hue: 200, harmonyMode: 2 } },
      // Dense and fast — rings stack into a woven ball on a busy beat
      { name: '3', config: { orbRadius: 0.34, speed: 1.6, thickness: 0.005, sensitivity: 0.85, pulse: 1.6, backside: 0.3, glow: 0.2, spin: 0.4, tilt: 0.35, wobble: 0.2, trail: 0.15, hue: 40, harmonyMode: 1 } },
      // Heavy bloom, slow spin — the orb as a lamp
      { name: '4', config: { orbRadius: 0.42, speed: 0.5, thickness: 0.022, sensitivity: 0.6, pulse: 0.5, backside: 0.6, glow: 1.1, spin: 0.1, tilt: 0.65, wobble: 0.7, trail: 0.7, hue: 300, harmonyMode: 2 } }
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
        wavePhase: { value: this.phases },
        waveFade: { value: this.fades },
        colorA: { value: new THREE.Color(r, g, b) },
        colorB: { value: new THREE.Color(r, g, b) },
        orbRadius: { value: this.config.orbRadius ?? 0.36 },
        thickness: { value: this.config.thickness ?? 0.01 },
        backside: { value: this.config.backside ?? 0.45 },
        glow: { value: this.config.glow ?? 0.35 },
        spin: { value: this.config.spin ?? 0.18 },
        tilt: { value: this.config.tilt ?? 0.5 },
        wobble: { value: this.config.wobble ?? 0.5 },
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

    // Seed a few rings spread across the sweep so the orb is already woven on
    // the first frame instead of fading in from an empty screen
    for (let i = 0; i < 5; i++) {
      this.phases[i] = (i / 5) * Math.PI;
      this.strengths[i] = 0.7;
      this.fades[i] = 0.7;
    }

    this.detachPointerControls = attachPointerControls(this.container, {
      cursor: true,
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

  /** Put a new ring at the near pole, reusing the most spent slot. */
  private emit(strength: number): void {
    let slot = -1;
    let furthest = -1;
    for (let i = 0; i < MAX_WAVES; i++) {
      if (this.phases[i] > Math.PI) { slot = i; break; }
      if (this.phases[i] > furthest) { furthest = this.phases[i]; slot = i; }
    }
    if (slot < 0) return;
    this.phases[slot] = 0;
    this.strengths[slot] = Math.max(0.6, Math.min(1, strength));
    this.fades[slot] = this.strengths[slot];
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.material) return;

    const { audioData, isPlaying } = audioAnalysis;
    const uniforms = this.material.uniforms;

    const now = performance.now();
    // Clamped so a backgrounded tab doesn't resume with one enormous step
    const dt = Math.min(0.1, (now - this.lastFrame) * 0.001);
    this.lastFrame = now;
    const nowSec = (now - this.startTime) * 0.001;

    const strength = this.onset.update(
      audioData,
      isPlaying,
      nowSec,
      dt,
      this.config.sensitivity ?? 0.65
    );
    if (strength > 0) {
      this.emit(strength);
      this.lastEmitAt = nowSec;
    }

    // Keep the orb alive when nothing is playing, or through a passage with
    // no percussion: without this it empties out and the screen goes black
    const pulse = this.config.pulse ?? 0.8;
    if (pulse > 0 && nowSec - this.lastEmitAt > 1 / pulse) {
      this.emit(0.75);
      this.lastEmitAt = nowSec;
    }

    // Brightness is a function of how far a ring has swept, not something
    // compounded per frame: compounding dimmed rings to a tenth before they
    // reached the equator, whatever the frame rate. Trail sets how far into
    // the sweep a ring holds full brightness before falling off at the pole.
    const speed = this.config.speed ?? 0.75;
    const trail = this.config.trail ?? 0.35;
    const knee = 0.25 + trail * 0.7;

    for (let i = 0; i < MAX_WAVES; i++) {
      if (this.phases[i] > Math.PI) continue;
      this.phases[i] += dt * speed;
      const travelled = this.phases[i] / Math.PI;
      if (travelled >= 1) {
        this.phases[i] = SPENT;
        this.fades[i] = 0;
        continue;
      }
      const tail = travelled <= knee
        ? 1
        : Math.max(0, 1 - (travelled - knee) / Math.max(1e-3, 1 - knee));
      this.fades[i] = this.strengths[i] * tail * tail;
    }

    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 2,
      this.config.hue ?? 0
    );
    const domRGB = this.parseRGB(dominant);
    const accRGB = this.parseRGB(accent);
    uniforms.colorA.value.setRGB(domRGB.r, domRGB.g, domRGB.b);
    uniforms.colorB.value.setRGB(accRGB.r, accRGB.g, accRGB.b);

    uniforms.time.value = nowSec;
    uniforms.orbRadius.value = this.config.orbRadius ?? 0.36;
    uniforms.thickness.value = this.config.thickness ?? 0.01;
    uniforms.backside.value = this.config.backside ?? 0.45;
    uniforms.glow.value = this.config.glow ?? 0.35;
    uniforms.spin.value = this.config.spin ?? 0.18;
    uniforms.tilt.value = this.config.tilt ?? 0.5;
    uniforms.wobble.value = this.config.wobble ?? 0.5;
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
    this.onset.reset();

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
