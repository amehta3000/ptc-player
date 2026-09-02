/**
 * Arcs Visualizer
 * A Brockmann-style stack of concentric arcs viewed flat-on. Rings grow
 * outward: the outer ones are wide and ride the bass, the inner ones are
 * thin and ride the highs. Each ring is an annular sector with an opening
 * that breathes, and every detected beat fires a staggered impulse that
 * travels through the stack — spinning the rings and snapping their
 * openings — so the kick reads as a wave rippling around the circle.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

const SEGMENTS = 96;

interface Ring {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  guide: THREE.Line;
  guideGeometry: THREE.BufferGeometry;
  guideMaterial: THREE.LineBasicMaterial;
  rotation: number;
  angularVelocity: number;
  level: number;
  beatEnv: number;
}

interface PendingBeat {
  time: number;
  strength: number;
  consumed: boolean[];
}

export class ArcsVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private group: THREE.Group | null = null;
  private rings: Ring[] = [];
  private ringCount = 0;
  private lastFrameTime = 0;
  private viewRadius = 10;

  // Beat detection
  private beatThreshold = 0;
  private lastBeatTime = 0;
  private beatCooldown = 220;
  private pendingBeats: PendingBeat[] = [];

  private handleResize: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Arcs';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Ring Count',
        key: 'ringCount',
        min: 3,
        max: 18,
        step: 1,
        default: 9,
        value: this.config.ringCount ?? 9
      },
      {
        name: 'Start Radius',
        key: 'startRadius',
        min: 0.2,
        max: 4,
        step: 0.1,
        default: 0.8,
        value: this.config.startRadius ?? 0.8
      },
      {
        name: 'Min Thickness',
        key: 'minThickness',
        min: 0.05,
        max: 1,
        step: 0.05,
        default: 0.15,
        value: this.config.minThickness ?? 0.15
      },
      {
        name: 'Max Thickness',
        key: 'maxThickness',
        min: 0.3,
        max: 4,
        step: 0.1,
        default: 1.6,
        value: this.config.maxThickness ?? 1.6
      },
      {
        name: 'Growth Exponent',
        key: 'growthExponent',
        min: 0.4,
        max: 4,
        step: 0.1,
        default: 2.0,
        value: this.config.growthExponent ?? 2.0
      },
      {
        name: 'Gap',
        key: 'gap',
        min: 0,
        max: 1.5,
        step: 0.05,
        default: 0.25,
        value: this.config.gap ?? 0.25
      },
      {
        name: 'Arc Opening',
        key: 'baseAngle',
        min: 60,
        max: 350,
        step: 5,
        default: 250,
        value: this.config.baseAngle ?? 250
      },
      {
        name: 'Opening React',
        key: 'openingReact',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.45,
        value: this.config.openingReact ?? 0.45
      },
      {
        name: 'Thickness React',
        key: 'audioReact',
        min: 0,
        max: 1.5,
        step: 0.05,
        default: 0.6,
        value: this.config.audioReact ?? 0.6
      },
      {
        name: 'Spin Speed',
        key: 'spinSpeed',
        min: -1,
        max: 1,
        step: 0.02,
        default: 0.08,
        value: this.config.spinSpeed ?? 0.08
      },
      {
        name: 'Beat Spin',
        key: 'beatSpin',
        min: 0,
        max: 8,
        step: 0.1,
        default: 2.6,
        value: this.config.beatSpin ?? 2.6
      },
      {
        name: 'Beat Ripple',
        key: 'beatStagger',
        min: 0,
        max: 160,
        step: 5,
        default: 55,
        value: this.config.beatStagger ?? 55
      },
      {
        name: 'Ripple Dir',
        key: 'rippleDirection',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        value: this.config.rippleDirection ?? 0,
        labels: ['Outward', 'Inward']
      },
      {
        name: 'Alternate Spin',
        key: 'alternateSpin',
        min: 0,
        max: 1,
        step: 1,
        default: 1,
        value: this.config.alternateSpin ?? 1,
        labels: ['Same', 'Alternate']
      },
      {
        name: 'Beat Sensitivity',
        key: 'beatSensitivity',
        min: 1.1,
        max: 3,
        step: 0.05,
        default: 1.7,
        value: this.config.beatSensitivity ?? 1.7
      },
      {
        name: 'Smoothing',
        key: 'smoothing',
        min: 0.02,
        max: 0.6,
        step: 0.02,
        default: 0.2,
        value: this.config.smoothing ?? 0.2
      },
      {
        name: 'Guide Rings',
        key: 'guideOpacity',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.35,
        value: this.config.guideOpacity ?? 0.35
      },
      {
        name: 'Color Mode',
        key: 'colorMode',
        min: 0,
        max: 2,
        step: 1,
        default: 0,
        value: this.config.colorMode ?? 0,
        labels: ['Gradient', 'Solid', 'Alternate']
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
        default: 1,
        value: this.config.harmonyMode ?? 1,
        labels: ['Mono', 'Analog', 'Comp']
      }
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      // Brockmann poster: few fat outer rings, wide openings, slow drift
      { name: '1', config: { ringCount: 6, startRadius: 1.2, minThickness: 0.2, maxThickness: 2.4, growthExponent: 2.4, gap: 0.3, baseAngle: 260, openingReact: 0.4, audioReact: 0.5, spinSpeed: 0.05, beatSpin: 2.2, beatStagger: 70, rippleDirection: 0, alternateSpin: 1, guideOpacity: 0.4, colorMode: 1, hue: 0, harmonyMode: 0 } },
      // Dense stack, tight ripple
      { name: '2', config: { ringCount: 14, startRadius: 0.6, minThickness: 0.08, maxThickness: 1.2, growthExponent: 2.0, gap: 0.15, baseAngle: 300, openingReact: 0.5, audioReact: 0.7, spinSpeed: 0.12, beatSpin: 3.4, beatStagger: 35, rippleDirection: 0, alternateSpin: 1, guideOpacity: 0.2, colorMode: 0, hue: 0, harmonyMode: 1 } },
      // Inward ripple, high contrast
      { name: '3', config: { ringCount: 10, startRadius: 0.8, minThickness: 0.12, maxThickness: 1.8, growthExponent: 1.6, gap: 0.35, baseAngle: 200, openingReact: 0.7, audioReact: 0.9, spinSpeed: -0.1, beatSpin: 4.5, beatStagger: 60, rippleDirection: 1, alternateSpin: 0, guideOpacity: 0.5, colorMode: 2, hue: 0, harmonyMode: 2 } },
      // Near-closed rings, heavy spin
      { name: '4', config: { ringCount: 8, startRadius: 1.6, minThickness: 0.25, maxThickness: 1.4, growthExponent: 1.0, gap: 0.5, baseAngle: 340, openingReact: 0.25, audioReact: 1.1, spinSpeed: 0.3, beatSpin: 6.0, beatStagger: 20, rippleDirection: 0, alternateSpin: 1, guideOpacity: 0, colorMode: 0, hue: 0, harmonyMode: 1 } },
    ];
  }

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildRings();
    this.updateCamera();

    this.lastFrameTime = performance.now();

    this.handleResize = () => this.updateCamera();
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * (Re)create one mesh + guide circle per ring. Geometry is a fixed-size
   * triangle strip around the annulus; the per-frame update only rewrites
   * vertex positions, so ring shape changes never reallocate buffers.
   */
  private buildRings(): void {
    if (!this.group) return;

    this.disposeRings();

    const count = Math.max(3, Math.round(this.config.ringCount ?? 9));
    this.ringCount = count;

    for (let i = 0; i < count; i++) {
      const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const indices: number[] = [];
      for (let s = 0; s < SEGMENTS; s++) {
        const a = s * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      geometry.setIndex(indices);

      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.group.add(mesh);

      // Thin full circle behind each arc — the Brockmann construction line
      const guidePositions = new Float32Array((SEGMENTS + 1) * 3);
      const guideGeometry = new THREE.BufferGeometry();
      guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
      const guideMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35
      });
      const guide = new THREE.Line(guideGeometry, guideMaterial);
      this.group.add(guide);

      this.rings.push({
        mesh,
        geometry,
        material,
        guide,
        guideGeometry,
        guideMaterial,
        rotation: (i / count) * Math.PI * 2,
        angularVelocity: 0,
        level: 0,
        beatEnv: 0
      });
    }
  }

  private disposeRings(): void {
    for (const ring of this.rings) {
      this.group?.remove(ring.mesh);
      this.group?.remove(ring.guide);
      ring.geometry.dispose();
      ring.material.dispose();
      ring.guideGeometry.dispose();
      ring.guideMaterial.dispose();
    }
    this.rings = [];
  }

  /**
   * Inner radius of every ring plus the outermost edge, so the camera can
   * be fitted to whatever the current thickness/gap settings produce.
   */
  private ringRadii(): { inner: number; thickness: number }[] {
    const count = this.ringCount;
    const start = this.config.startRadius ?? 0.8;
    const minT = this.config.minThickness ?? 0.15;
    const maxT = Math.max(minT, this.config.maxThickness ?? 1.6);
    const growth = this.config.growthExponent ?? 2.0;
    const gap = this.config.gap ?? 0.25;

    const result: { inner: number; thickness: number }[] = [];
    let radius = start;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 1;
      const thickness = minT + (maxT - minT) * Math.pow(t, growth);
      result.push({ inner: radius, thickness });
      radius += thickness + gap;
    }
    return result;
  }

  private updateCamera(): void {
    if (!this.camera || !this.renderer) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.renderer.setSize(width, height);

    const radii = this.ringRadii();
    const last = radii[radii.length - 1];
    const target = (last.inner + last.thickness) * 1.18;
    // Ease toward the target so parameter changes glide instead of jumping
    this.viewRadius += (target - this.viewRadius) * 0.25;

    const aspect = width / height;
    const halfHeight = this.viewRadius;
    const halfWidth = halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Adaptive-threshold beat detection on the low end, same shape as the
   * other visualizers: energy above a decaying running average, gated by a
   * refractory window so a sustained kick fires once.
   */
  private detectBeat(audioAnalysis: AudioAnalysis): void {
    const energy = (audioAnalysis.bassAvg / 255) * 0.75 + (audioAnalysis.midAvg / 255) * 0.25;
    const sensitivity = this.config.beatSensitivity ?? 1.7;
    const now = performance.now();

    if (energy > this.beatThreshold * sensitivity && energy > 0.05) {
      if (now - this.lastBeatTime > this.beatCooldown) {
        this.lastBeatTime = now;
        this.pendingBeats.push({
          time: now,
          strength: Math.min(1.5, energy * 2),
          consumed: new Array(this.ringCount).fill(false)
        });
      }
    }
    this.beatThreshold = this.beatThreshold * 0.92 + energy * 0.08;
  }

  /**
   * Release each queued beat into ring i once its staggered delay elapses,
   * which is what makes the impulse read as a wave crossing the stack.
   */
  private applyBeats(): void {
    if (this.pendingBeats.length === 0) return;

    const now = performance.now();
    const stagger = this.config.beatStagger ?? 55;
    const inward = (this.config.rippleDirection ?? 0) > 0.5;
    const beatSpin = this.config.beatSpin ?? 2.6;
    const alternate = (this.config.alternateSpin ?? 1) > 0.5;

    for (const beat of this.pendingBeats) {
      for (let i = 0; i < this.rings.length; i++) {
        if (beat.consumed[i]) continue;
        const order = inward ? this.rings.length - 1 - i : i;
        if (now - beat.time < order * stagger) continue;

        beat.consumed[i] = true;
        const ring = this.rings[i];
        const direction = alternate && i % 2 === 1 ? -1 : 1;
        ring.angularVelocity += beatSpin * beat.strength * direction;
        ring.beatEnv = Math.min(1.4, ring.beatEnv + beat.strength);
      }
    }

    this.pendingBeats = this.pendingBeats.filter(
      (beat) => now - beat.time < 4000 && beat.consumed.some((c) => !c)
    );
  }

  /**
   * Band energy for ring i: the outermost ring reads the lowest bins, the
   * innermost the highest, so weight sits in the wide outer rings.
   */
  private bandLevel(audioData: number[], index: number): number {
    const count = Math.max(1, this.ringCount);
    // Ring 0 is innermost, so invert to put bass on the outside
    const t = 1 - index / count;
    const from = Math.floor(t * audioData.length);
    const to = Math.max(from + 1, Math.floor((t + 1 / count) * audioData.length));
    let sum = 0;
    let n = 0;
    for (let b = from; b < Math.min(to, audioData.length); b++) {
      sum += audioData[b];
      n++;
    }
    return n > 0 ? sum / n / 255 : 0;
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.group || this.rings.length === 0) return;

    const now = performance.now();
    const deltaTime = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const desiredCount = Math.max(3, Math.round(this.config.ringCount ?? 9));
    if (desiredCount !== this.ringCount) {
      this.buildRings();
    }

    if (audioAnalysis.isPlaying) {
      this.detectBeat(audioAnalysis);
    }
    this.applyBeats();

    const radii = this.ringRadii();
    const baseAngle = ((this.config.baseAngle ?? 250) * Math.PI) / 180;
    const openingReact = this.config.openingReact ?? 0.45;
    const audioReact = this.config.audioReact ?? 0.6;
    const spinSpeed = this.config.spinSpeed ?? 0.08;
    const alternate = (this.config.alternateSpin ?? 1) > 0.5;
    const smoothing = this.config.smoothing ?? 0.2;
    const guideOpacity = this.config.guideOpacity ?? 0.35;
    const colorMode = Math.round(this.config.colorMode ?? 0);

    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 1,
      this.config.hue ?? 0
    );
    const domRGB = this.parseRGB(dominant);
    const accRGB = this.parseRGB(accent);

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const t = this.rings.length > 1 ? i / (this.rings.length - 1) : 0;

      const level = audioAnalysis.isPlaying ? this.bandLevel(audioAnalysis.audioData, i) : 0;
      ring.level += (level - ring.level) * smoothing;
      ring.beatEnv *= Math.pow(0.05, deltaTime); // ~ -95% per second

      const direction = alternate && i % 2 === 1 ? -1 : 1;
      ring.angularVelocity *= Math.pow(0.02, deltaTime);
      ring.rotation += (spinSpeed * direction + ring.angularVelocity) * deltaTime;

      const base = radii[i];
      const swell = 1 + ring.level * audioReact + ring.beatEnv * 0.25;
      const thickness = base.thickness * swell;
      const inner = base.inner + (base.thickness - thickness) * 0.5;
      const outer = inner + thickness;

      // Opening breathes with the band and snaps wider on the beat
      let arc = baseAngle * (1 - openingReact * (ring.level * 0.7 + ring.beatEnv * 0.5));
      arc = Math.max(0.15, Math.min(Math.PI * 2, arc));

      this.writeArc(ring, Math.max(0.01, inner), Math.max(0.02, outer), ring.rotation, arc);
      this.writeGuide(ring, (inner + outer) * 0.5);

      let mix: number;
      if (colorMode === 1) mix = 0;
      else if (colorMode === 2) mix = i % 2 === 0 ? 0 : 1;
      else mix = t;
      const brightness = 0.75 + ring.level * 0.2 + ring.beatEnv * 0.25;
      ring.material.color.setRGB(
        Math.min(1, (domRGB.r + (accRGB.r - domRGB.r) * mix) * brightness),
        Math.min(1, (domRGB.g + (accRGB.g - domRGB.g) * mix) * brightness),
        Math.min(1, (domRGB.b + (accRGB.b - domRGB.b) * mix) * brightness)
      );
      ring.guideMaterial.opacity = guideOpacity * 0.6;
      ring.guide.visible = guideOpacity > 0.01;
      ring.guideMaterial.color.copy(ring.material.color);
    }

    this.updateCamera();
  }

  /** Rewrite one ring's triangle strip as an annular sector. */
  private writeArc(ring: Ring, inner: number, outer: number, start: number, length: number): void {
    const positions = ring.geometry.attributes.position as THREE.BufferAttribute;
    const array = positions.array as Float32Array;

    for (let s = 0; s <= SEGMENTS; s++) {
      const theta = start + (s / SEGMENTS) * length;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const base = s * 2 * 3;
      array[base] = cos * inner;
      array[base + 1] = sin * inner;
      array[base + 2] = 0;
      array[base + 3] = cos * outer;
      array[base + 4] = sin * outer;
      array[base + 5] = 0;
    }
    positions.needsUpdate = true;
    ring.geometry.computeBoundingSphere();
  }

  private writeGuide(ring: Ring, radius: number): void {
    const positions = ring.guideGeometry.attributes.position as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    for (let s = 0; s <= SEGMENTS; s++) {
      const theta = (s / SEGMENTS) * Math.PI * 2;
      array[s * 3] = Math.cos(theta) * radius;
      array[s * 3 + 1] = Math.sin(theta) * radius;
      array[s * 3 + 2] = -0.1;
    }
    positions.needsUpdate = true;
    ring.guideGeometry.computeBoundingSphere();
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
    if (key === 'ringCount') {
      this.buildRings();
      this.updateCamera();
    }
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize);
      this.handleResize = null;
    }

    this.disposeRings();

    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }

    this.pendingBeats = [];
    this.group = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.container.innerHTML = '';
  }
}
