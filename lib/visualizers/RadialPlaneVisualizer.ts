/**
 * Radial Visualizer
 * Polar wireframe disc with a center hole. The frequency spectrum wraps
 * around the hole (mirrored so the seam is invisible) and each new frame
 * ripples outward through rings of history, decaying as it travels.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class RadialPlaneVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private lines: THREE.LineSegments | null = null;
  private history: number[][] = [];
  private lastUpdateTime: number = 0;
  private rings: number = 44;
  private angularSegments: number = 128;
  private cameraRotation = { x: 0.6, y: 0 };
  private cameraDistance = 13;
  private zoomPhase = 0;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private frameCount: number = 0;
  private handleResize: (() => void) | null = null;
  private removeCameraControls: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Radial';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Wave Amplitude',
        key: 'amplitude',
        min: 0.5,
        max: 6,
        step: 0.1,
        default: 3.0,
        value: this.config.amplitude || 3.0
      },
      {
        name: 'Wave Speed',
        key: 'speed',
        min: 1,
        max: 30,
        step: 0.5,
        default: 14,
        value: this.config.speed || 14
      },
      {
        name: 'Wave Decay',
        key: 'decay',
        min: 0.85,
        max: 0.99,
        step: 0.01,
        default: 0.92,
        value: this.config.decay || 0.92
      },
      {
        name: 'Center Hole',
        key: 'innerRadius',
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 1.2,
        value: this.config.innerRadius ?? 1.2
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
        default: 0,
        value: this.config.harmonyMode ?? 0,
        labels: ['Mono', 'Analogous', 'Complement']
      }
    ];
  }

  init(): void {
    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    this.renderer.setSize(containerWidth, containerHeight);
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    this.rings = this.config.rings ?? 44;
    this.angularSegments = this.config.angularSegments ?? 128;

    this.cameraDistance = this.config.cameraDistance || 13;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
    this.updateCameraPosition();

    for (let i = 0; i < this.rings; i++) {
      this.history.push(new Array(this.angularSegments).fill(0));
    }

    this.buildGeometry();

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });

    this.lines = new THREE.LineSegments(this.geometry!, material);
    this.scene.add(this.lines);

    this.lastUpdateTime = Date.now();

    this.setupCameraControls(this.container);

    this.handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Build the polar grid: `rings` concentric ring outlines from innerRadius
   * to outerRadius, each with angularSegments + 1 vertices (the extra vertex
   * duplicates angle 0 to close the seam). Only circumferential line
   * segments are drawn — clean concentric circles, no radial lines.
   */
  private buildGeometry(): void {
    const innerRadius = this.config.innerRadius ?? 1.2;
    const outerRadius = 9;
    const A = this.angularSegments;
    const R = this.rings;
    const vertsPerRing = A + 1;
    const vertexCount = R * vertsPerRing;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);

    for (let j = 0; j < R; j++) {
      const radius = innerRadius + (j / (R - 1)) * (outerRadius - innerRadius);
      for (let i = 0; i <= A; i++) {
        const theta = ((i % A) / A) * Math.PI * 2;
        const index = j * vertsPerRing + i;
        positions[index * 3] = Math.cos(theta) * radius;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = Math.sin(theta) * radius;
        colors[index * 3] = dominantRGB.r;
        colors[index * 3 + 1] = dominantRGB.g;
        colors[index * 3 + 2] = dominantRGB.b;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < A; i++) {
        const a = j * vertsPerRing + i;
        indices.push(a, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    if (this.geometry) this.geometry.dispose();
    this.geometry = geometry;
    if (this.lines) this.lines.geometry = geometry;
  }

  private setupCameraControls(element: HTMLDivElement): void {
    element.style.cursor = 'grab';

    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.cameraRotation.y += (e.clientX - this.lastMousePos.x) * 0.005;
      this.cameraRotation.x += (e.clientY - this.lastMousePos.y) * 0.005;
      this.cameraRotation.x = Math.max(0.1, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { this.isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(5, Math.min(18, this.cameraDistance + e.deltaY * 0.01));
      this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
    };

    let pinchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else {
        this.isDragging = true;
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinchDist > 0) {
          this.cameraDistance = Math.max(5, Math.min(18, this.cameraDistance + (pinchDist - dist) * 0.05));
          this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
        }
        pinchDist = dist;
      } else if (this.isDragging) {
        const pos = e.touches[0];
        this.cameraRotation.y += (pos.clientX - this.lastMousePos.x) * 0.005;
        this.cameraRotation.x += (pos.clientY - this.lastMousePos.y) * 0.005;
        this.cameraRotation.x = Math.max(0.1, Math.min(Math.PI / 2, this.cameraRotation.x));
        this.lastMousePos = { x: pos.clientX, y: pos.clientY };
      }
    };
    const onTouchEnd = () => { this.isDragging = false; pinchDist = 0; };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mouseleave', onMouseUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);

    this.removeCameraControls = () => {
      element.removeEventListener('mousedown', onMouseDown);
      element.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('mouseleave', onMouseUp);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;

    const zoomSpeed = this.config.zoomSpeed ?? 0;
    if (zoomSpeed > 0) {
      this.zoomPhase += zoomSpeed;
      this.cameraDistance = 10 + 5 * Math.sin(this.zoomPhase);
    }

    if (!this.isDragging) {
      this.cameraRotation.y += this.config.autoRotation ?? 0.001;
    }

    const d = this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x);
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Map the 64-bin spectrum around the circle, mirrored: bass meets bass at
   * angle 0 and highs meet highs at angle π, so the wrap seam is seamless.
   */
  private resampleMirrored(data: number[], targetLength: number): number[] {
    const result = new Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const t = i / targetLength;
      const folded = t < 0.5 ? t * 2 : (1 - t) * 2;
      const srcIndex = folded * (data.length - 1);
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, data.length - 1);
      const frac = srcIndex - low;
      result[i] = data[low] * (1 - frac) + data[high] * frac;
    }
    return result;
  }

  private smoothWrap(data: number[], passes: number): number[] {
    const n = data.length;
    let result = data;
    for (let p = 0; p < passes; p++) {
      const smoothed = new Array(n);
      for (let i = 0; i < n; i++) {
        const prev = result[(i - 1 + n) % n];
        const next = result[(i + 1) % n];
        smoothed[i] = prev * 0.25 + result[i] * 0.5 + next * 0.25;
      }
      result = smoothed;
    }
    return result;
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.geometry || !this.camera) return;

    const { audioData } = audioAnalysis;
    const amplitude = this.config.amplitude || 3.0;
    const speed = this.config.speed || 14;
    const decay = this.config.decay || 0.92;

    const currentTime = Date.now();
    const updateInterval = 1000 / speed;

    this.updateCameraPosition();

    // Push a new ring of audio into the center; older rings travel outward
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      this.history.pop();
      const resampled = this.resampleMirrored(audioData, this.angularSegments);
      const wave = this.smoothWrap(resampled.map(v => (v / 255) * amplitude), 2);
      this.history.unshift(wave);
      this.lastUpdateTime = currentTime;
    }

    // Update geometry every other frame for performance
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;

    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const hue = this.config.hue ?? 0;
    const { dominant: domStr, accent: accStr } = this.harmonyColorScheme(this.config.harmonyMode ?? 0, hue);
    const dominantRGB = this.parseRGB(domStr);
    const accentRGB = this.parseRGB(accStr);

    const A = this.angularSegments;
    const R = this.rings;
    const vertsPerRing = A + 1;

    const decayFactors: number[] = [];
    for (let j = 0; j < R; j++) {
      decayFactors[j] = Math.pow(decay, j);
    }

    for (let j = 0; j < R; j++) {
      const ring = this.history[j];
      const decayFactor = decayFactors[j];
      for (let i = 0; i <= A; i++) {
        const index = j * vertsPerRing + i;
        const waveHeight = (ring?.[i % A] || 0) * decayFactor;
        positions.setY(index, waveHeight);

        const heightIntensity = Math.min(1, Math.abs(waveHeight) / amplitude);
        const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity;
        const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity;
        const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity;
        colorAttr.setXYZ(index, r, g, b);
      }
    }

    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    if (this.geometry) {
      const colorAttr = this.geometry.attributes.color;
      if (colorAttr) {
        const { r, g, b } = this.parseRGB(colors.dominant);
        for (let i = 0; i < colorAttr.count; i++) {
          colorAttr.setXYZ(i, r, g, b);
        }
        colorAttr.needsUpdate = true;
      }
    }
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    if (key === 'innerRadius') {
      this.buildGeometry();
    }
    if (key === 'cameraDistance') {
      this.cameraDistance = value;
      this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (value - 10) / 5)));
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
    if (this.removeCameraControls) {
      this.removeCameraControls();
      this.removeCameraControls = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.lines && this.lines.material) {
      (this.lines.material as THREE.Material).dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.lines = null;
    this.history = [];

    this.container.innerHTML = '';
  }
}
