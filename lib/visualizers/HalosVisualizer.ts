/**
 * Halos Visualizer
 * A full-screen fragment shader: a repeating lattice of glowing rings drawn
 * with inverse-distance falloff, folded into a kaleidoscope and sampled three
 * times at slightly different radii so the ring edges split into chromatic
 * fringes while their cores blow out to white.
 *
 * Every cell reads its own bin from the frequency spectrum (uploaded as a
 * 64x1 texture), so individual halos swell with the band they own instead of
 * the whole field pumping together.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

const SPECTRUM_BINS = 64;

const vertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  uniform vec2      resolution;
  uniform float     time;
  uniform float     bassLevel;
  uniform float     midLevel;
  uniform float     highLevel;
  uniform sampler2D spectrum;
  uniform vec3      colorA;
  uniform vec3      colorB;
  uniform float     scale;
  uniform float     ringWidth;
  uniform float     growth;
  uniform float     chroma;
  uniform float     drift;
  uniform float     warp;
  uniform float     brightness;
  uniform float     reactivity;
  uniform float     kaleido;
  uniform vec2      ringShift;
  uniform float     zoom;
  uniform float     rotation;
  uniform float     darkMode;

  varying vec2 vUv;

  const float PI = 3.14159265359;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  /**
   * Inverse-distance glow of the ring lattice at a radius offset. Each cell
   * owns a spectrum bin, so its ring breathes on its own band; rings grow
   * with distance from the origin, which is what opens the lattice out into
   * the big overlapping circles toward the edges.
   */
  float ringField(vec2 p, float sizeRadius, float radiusOffset) {
    vec2  id = floor(p);
    vec2  f  = fract(p) - 0.5;

    float bin   = texture2D(spectrum, vec2(hash(id), 0.5)).r;
    float pulse = bin * reactivity * 0.35 + bassLevel * 0.08;

    // sizeRadius is the distance from screen centre, so halos open out toward
    // the edges while the middle stays small and crisp. The growth term
    // saturates: past a point a ring would outgrow its cell entirely and stop
    // intersecting it, which blanks the field when you zoom out.
    float grown = 0.6 * growth * sizeRadius / (0.6 + growth * sizeRadius);
    float r = 0.2 + grown + pulse + radiusOffset;
    r += 0.03 * sin(sizeRadius * 0.9 - time * 1.7);
    r  = max(r, 0.02);

    float d = abs(length(f) - r);
    // Rings sharpen as the highs come up
    float w = ringWidth * (1.0 - highLevel * 0.35) + 0.001;
    return 0.014 / (d * w + 0.004);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= resolution.x / max(resolution.y, 1.0);

    // Rotate before folding so the whole kaleidoscope turns, mirror axes and
    // all, rather than the lattice spinning inside fixed mirrors.
    float ca = cos(rotation);
    float sa = sin(rotation);
    uv = mat2(ca, -sa, sa, ca) * uv;

    // Zoom divides the scale, so zooming in makes each halo bigger rather
    // than adding more of them.
    vec2 p = uv * (scale / max(zoom, 0.05));

    // Fold in screen space so the mirror axes stay pinned to the centre,
    // then travel — the lattice streams through a fixed kaleidoscope
    if (kaleido > 1.5) {
      float a   = atan(p.y, p.x);
      float rr  = length(p);
      float seg = PI / 3.0;
      a = abs(mod(a + seg * 0.5, seg) - seg * 0.5);
      p = vec2(cos(a), sin(a)) * rr;
    } else if (kaleido > 0.5) {
      p = abs(p);
    }

    // sizeRadius and the fold above are read from screen position, so they
    // stay pinned: shifting the lattice here moves the halo inside its cell —
    // identically in every cell — while the composition around it holds still.
    float sizeRadius = length(p);
    p += ringShift + vec2(time * drift * 0.42, time * drift * 0.27);

    // Domain warp — mids ripple the lattice so it never sits still
    float wobble = warp * (0.35 + midLevel * 0.9);
    p += wobble * vec2(
      sin(p.y * 1.3 + time * 0.7),
      cos(p.x * 1.1 - time * 0.6)
    );

    // Split the sample radius per channel: shared cores read white, the
    // edges fringe into the palette
    float e = chroma * (1.0 + midLevel * 1.5);
    vec3 g = vec3(
      ringField(p, sizeRadius, -e),
      ringField(p, sizeRadius,  0.0),
      ringField(p, sizeRadius,  e)
    );

    // Ring rows walk the palette as they march outward, so the field reads as
    // bands of colour rather than one flat tint
    float band = 0.5 + 0.5 * sin(sizeRadius * 0.85 - time * 0.35);
    vec3  tint = mix(colorA, colorB, band);
    vec3 color = colorA * g.r + tint * g.g + colorB * g.b;

    // Soft bloom around the origin so the middle never reads as a dead hole
    float halo = 0.05 / (length(uv) * 2.2 + 0.35);
    color += tint * halo * (0.4 + bassLevel * 0.8);

    color *= brightness * (0.85 + bassLevel * 0.5);

    // Filmic-ish rolloff keeps the cores white instead of clipping to a hue
    color = vec3(1.0) - exp(-color);
    color = pow(color, vec3(0.85));

    if (darkMode < 0.5) {
      color = vec3(1.0) - color;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class HalosVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private spectrumTexture: THREE.DataTexture | null = null;
  private spectrumData: Uint8Array = new Uint8Array(SPECTRUM_BINS * 4);

  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  private startTime = 0;

  private handleResize: (() => void) | null = null;

  // Pointer state — the halo's offset inside its cell, and the zoom level
  private ringShift = { x: 0, y: 0 };
  private zoom = 1;
  // Auto rotation angle and the phase driving the auto-zoom breath
  private rotation = 0;
  private zoomPhase = 0;
  // Manual zoom times the auto-zoom breath — what the shader is actually
  // showing, so drag deltas convert with the on-screen cell size
  private effectiveZoom = 1;
  private isDragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pinchDistance = 0;
  private detachPointerControls: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Halos';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Scale',
        key: 'scale',
        min: 2,
        max: 20,
        step: 0.5,
        default: 6,
        value: this.config.scale ?? 6
      },
      {
        name: 'Ring Width',
        key: 'ringWidth',
        min: 0.1,
        max: 3,
        step: 0.05,
        default: 0.5,
        value: this.config.ringWidth ?? 0.5
      },
      {
        name: 'Growth',
        key: 'growth',
        min: 0,
        max: 0.3,
        step: 0.01,
        default: 0.18,
        value: this.config.growth ?? 0.18
      },
      {
        name: 'Chromatic',
        key: 'chroma',
        min: 0,
        max: 0.12,
        step: 0.005,
        default: 0.05,
        value: this.config.chroma ?? 0.05
      },
      {
        name: 'Drift',
        key: 'drift',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.2,
        value: this.config.drift ?? 0.2
      },
      {
        name: 'Warp',
        key: 'warp',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.15,
        value: this.config.warp ?? 0.15
      },
      {
        name: 'Auto Rotation',
        key: 'autoRotation',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.001,
        value: this.config.autoRotation ?? 0.001
      },
      {
        name: 'Zoom Speed',
        key: 'zoomSpeed',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0,
        value: this.config.zoomSpeed ?? 0
      },
      {
        name: 'Brightness',
        key: 'brightness',
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 1.3,
        value: this.config.brightness ?? 1.3
      },
      {
        name: 'Reactivity',
        key: 'reactivity',
        min: 0,
        max: 1.5,
        step: 0.05,
        default: 0.7,
        value: this.config.reactivity ?? 0.7
      },
      {
        name: 'Kaleido',
        key: 'kaleido',
        min: 0,
        max: 2,
        step: 1,
        default: 1,
        value: this.config.kaleido ?? 1,
        labels: ['Off', 'Fold', 'Hex']
      },
      {
        name: 'Hue',
        key: 'hue',
        min: 0,
        max: 360,
        step: 1,
        default: 0,
        value: this.config.hue ?? 0
      },
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
      { name: '1', config: { scale: 6, ringWidth: 0.5, growth: 0.18, chroma: 0.05, drift: 0.2, warp: 0.15, autoRotation: 0.001, zoomSpeed: 0, brightness: 1.3, reactivity: 0.7, kaleido: 1, hue: 0, harmonyMode: 2 } },
      { name: '2', config: { scale: 4, ringWidth: 0.35, growth: 0.18, chroma: 0.06, drift: 0.1, warp: 0.05, autoRotation: 0.0005, zoomSpeed: 0.004, brightness: 1.6, reactivity: 0.9, kaleido: 1, hue: 0, harmonyMode: 2 } },
      { name: '3', config: { scale: 12, ringWidth: 1.4, growth: 0.04, chroma: 0.015, drift: 0.45, warp: 0.5, autoRotation: 0.002, zoomSpeed: 0, brightness: 1.0, reactivity: 0.5, kaleido: 2, hue: 0, harmonyMode: 1 } },
      { name: '4', config: { scale: 9, ringWidth: 0.5, growth: 0.14, chroma: 0.08, drift: 0.6, warp: 0.35, autoRotation: 0.004, zoomSpeed: 0.008, brightness: 1.4, reactivity: 1.1, kaleido: 0, hue: 0, harmonyMode: 2 } },
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

    this.spectrumTexture = new THREE.DataTexture(
      this.spectrumData,
      SPECTRUM_BINS,
      1,
      THREE.RGBAFormat
    );
    this.spectrumTexture.minFilter = THREE.LinearFilter;
    this.spectrumTexture.magFilter = THREE.LinearFilter;
    this.spectrumTexture.wrapS = THREE.RepeatWrapping;
    this.spectrumTexture.needsUpdate = true;

    const { r, g, b } = this.parseRGB(this.colors.dominant);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
        bassLevel: { value: 0 },
        midLevel: { value: 0 },
        highLevel: { value: 0 },
        spectrum: { value: this.spectrumTexture },
        colorA: { value: new THREE.Color(r, g, b) },
        colorB: { value: new THREE.Color(r, g, b) },
        scale: { value: this.config.scale ?? 6 },
        ringWidth: { value: this.config.ringWidth ?? 0.5 },
        growth: { value: this.config.growth ?? 0.18 },
        chroma: { value: this.config.chroma ?? 0.05 },
        drift: { value: this.config.drift ?? 0.2 },
        warp: { value: this.config.warp ?? 0.15 },
        brightness: { value: this.config.brightness ?? 1.3 },
        reactivity: { value: this.config.reactivity ?? 0.7 },
        kaleido: { value: this.config.kaleido ?? 1 },
        ringShift: { value: new THREE.Vector2(0, 0) },
        zoom: { value: 1 },
        rotation: { value: 0 },
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

    this.setupPointerControls();

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
    if (!this.isInitialized || !this.material || !this.spectrumTexture) return;

    const { audioData, bassAvg, midAvg, highAvg, isPlaying } = audioAnalysis;
    const uniforms = this.material.uniforms;

    // Fast attack, slow release — rings snap up on a hit and ease back down
    const ease = (current: number, target: number) =>
      current + (target - current) * (target > current ? 0.35 : 0.08);

    this.smoothBass = ease(this.smoothBass, isPlaying ? bassAvg : 0);
    this.smoothMid = ease(this.smoothMid, isPlaying ? midAvg : 0);
    this.smoothHigh = ease(this.smoothHigh, isPlaying ? highAvg : 0);

    uniforms.bassLevel.value = this.smoothBass;
    uniforms.midLevel.value = this.smoothMid;
    uniforms.highLevel.value = this.smoothHigh;
    uniforms.time.value = (performance.now() - this.startTime) * 0.001;

    // Upload the spectrum, easing each bin so cells swell rather than flicker
    for (let i = 0; i < SPECTRUM_BINS; i++) {
      const srcIndex = Math.floor((i / SPECTRUM_BINS) * audioData.length);
      const target = isPlaying ? (audioData[srcIndex] ?? 0) : 0;
      const prev = this.spectrumData[i * 4];
      const next = prev + (target - prev) * (target > prev ? 0.5 : 0.12);
      const value = Math.max(0, Math.min(255, next));
      this.spectrumData[i * 4] = value;
      this.spectrumData[i * 4 + 1] = value;
      this.spectrumData[i * 4 + 2] = value;
      this.spectrumData[i * 4 + 3] = 255;
    }
    this.spectrumTexture.needsUpdate = true;

    // Palette
    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 2,
      this.config.hue ?? 0
    );
    const domRGB = this.parseRGB(dominant);
    const accRGB = this.parseRGB(accent);
    uniforms.colorA.value.setRGB(domRGB.r, domRGB.g, domRGB.b);
    uniforms.colorB.value.setRGB(accRGB.r, accRGB.g, accRGB.b);

    uniforms.scale.value = this.config.scale ?? 6;
    uniforms.ringWidth.value = this.config.ringWidth ?? 0.5;
    uniforms.growth.value = this.config.growth ?? 0.18;
    uniforms.chroma.value = this.config.chroma ?? 0.05;
    uniforms.drift.value = this.config.drift ?? 0.2;
    uniforms.warp.value = this.config.warp ?? 0.15;
    uniforms.brightness.value = this.config.brightness ?? 1.3;
    uniforms.reactivity.value = this.config.reactivity ?? 0.7;
    uniforms.kaleido.value = Math.round(this.config.kaleido ?? 1);
    this.rotation += this.config.autoRotation ?? 0.001;

    // Auto zoom breathes around whatever zoom the pointer left it at
    const zoomSpeed = this.config.zoomSpeed ?? 0;
    if (zoomSpeed > 0) {
      this.zoomPhase += zoomSpeed;
      this.effectiveZoom = this.zoom * (1 + 0.55 * Math.sin(this.zoomPhase));
    } else {
      this.effectiveZoom = this.zoom;
    }

    uniforms.ringShift.value.set(this.ringShift.x, this.ringShift.y);
    uniforms.zoom.value = this.effectiveZoom;
    uniforms.rotation.value = this.rotation;
  }

  /**
   * Drag moves the halo within its cell — and so within every cell — while
   * the kaleidoscope and the size gradient stay put; wheel or pinch zooms.
   * Deltas are converted from pixels to lattice units by the current cell
   * size (viewport height over the effective scale), so a halo tracks the
   * cursor 1:1 at any zoom.
   */
  private setupPointerControls(): void {
    const element = this.container;
    element.style.cursor = 'grab';
    element.style.touchAction = 'none';

    const dragBy = (dx: number, dy: number) => {
      const height = element.clientHeight || 600;
      const effectiveScale = (this.config.scale ?? 6) / Math.max(this.effectiveZoom, 0.05);
      const perPixel = effectiveScale / height;

      // The shader adds ringShift, so the shift runs opposite the drag to keep
      // the halo under the cursor. uv.y runs up the screen while pointer y runs
      // down, hence the flipped vertical sign.
      let sx = -dx * perPixel;
      let sy = dy * perPixel;

      // ringShift lives in the rotated lattice frame, so a screen-space drag
      // has to be rotated into it or the halo slides off at an angle
      const ca = Math.cos(this.rotation);
      const sa = Math.sin(this.rotation);
      this.ringShift.x += ca * sx - sa * sy;
      this.ringShift.y += sa * sx + ca * sy;
    };

    const zoomBy = (factor: number) => {
      this.zoom = Math.max(0.2, Math.min(8, this.zoom * factor));
    };

    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      element.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      dragBy(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      this.isDragging = false;
      element.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    };

    const touchDistance = (e: TouchEvent) => Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        this.isDragging = false;
        this.pinchDistance = touchDistance(e);
      } else {
        this.isDragging = true;
        this.lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const distance = touchDistance(e);
        if (this.pinchDistance > 0) {
          zoomBy(distance / this.pinchDistance);
        }
        this.pinchDistance = distance;
      } else if (this.isDragging) {
        const touch = e.touches[0];
        dragBy(touch.clientX - this.lastPointer.x, touch.clientY - this.lastPointer.y);
        this.lastPointer = { x: touch.clientX, y: touch.clientY };
      }
    };
    const onTouchEnd = () => {
      this.isDragging = false;
      this.pinchDistance = 0;
    };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mouseleave', onMouseUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);

    this.detachPointerControls = () => {
      element.removeEventListener('mousedown', onMouseDown);
      element.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('mouseleave', onMouseUp);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.style.cursor = '';
      element.style.touchAction = '';
    };
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
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

    if (this.detachPointerControls) {
      this.detachPointerControls();
      this.detachPointerControls = null;
    }

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.spectrumTexture) {
      this.spectrumTexture.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }

    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.spectrumTexture = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.container.innerHTML = '';
  }
}
