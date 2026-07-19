/**
 * Spokes Visualizer
 * Radial spokes around a center hole — each spoke is a full frequency
 * spectrum drawn along the radius (bass at the hole, highs at the edge).
 * A rotating sweep writes the newest spectrum into the next spoke, leaving
 * a full revolution of history around the disc. The orthogonal twin of the
 * Radial visualizer, which maps frequency around the circumference instead.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class RadialSpokesVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private lines: THREE.LineSegments | null = null;
  private spokes: number[][] = [];
  private writeIndex: number = 0;
  private lastUpdateTime: number = 0;
  private spokeCount: number = 90;
  private samplesPerSpoke: number = 48;
  private cameraRotation = { x: 0.5, y: 0 };
  private cameraDistance = 14;
  private zoomPhase = 0;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private handleResize: (() => void) | null = null;
  private removeCameraControls: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Spokes';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Amplitude',
        key: 'amplitude',
        min: 0.5,
        max: 6,
        step: 0.1,
        default: 2.8,
        value: this.config.amplitude || 2.8
      },
      {
        name: 'Sweep Speed',
        key: 'speed',
        min: 2,
        max: 40,
        step: 1,
        default: 14,
        value: this.config.speed || 14
      },
      {
        name: 'Trail Decay',
        key: 'decay',
        min: 0.9,
        max: 1,
        step: 0.005,
        default: 1.0,
        value: this.config.decay ?? 1.0
      },
      {
        name: 'Center Hole',
        key: 'innerRadius',
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 1.3,
        value: this.config.innerRadius ?? 1.3
      },
      {
        name: 'Auto Rotation',
        key: 'autoRotation',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.0008,
        value: this.config.autoRotation ?? 0.0008
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
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    this.renderer.setSize(containerWidth, containerHeight);
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    this.spokeCount = this.config.spokeCount ?? 90;
    this.samplesPerSpoke = this.config.samplesPerSpoke ?? 48;

    this.cameraDistance = this.config.cameraDistance || 14;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
    this.updateCameraPosition();

    for (let n = 0; n < this.spokeCount; n++) {
      this.spokes.push(new Array(this.samplesPerSpoke).fill(0));
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
   * One indexed line-segment buffer: spokeCount polylines of samplesPerSpoke
   * points each, running from the center hole to the outer edge.
   */
  private buildGeometry(): void {
    const innerRadius = this.config.innerRadius ?? 1.3;
    const outerRadius = 9;
    const N = this.spokeCount;
    const S = this.samplesPerSpoke;
    const vertexCount = N * S;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);

    for (let n = 0; n < N; n++) {
      const theta = (n / N) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      for (let k = 0; k < S; k++) {
        const radius = innerRadius + (k / (S - 1)) * (outerRadius - innerRadius);
        const index = n * S + k;
        positions[index * 3] = cos * radius;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = sin * radius;
        colors[index * 3] = dominantRGB.r;
        colors[index * 3 + 1] = dominantRGB.g;
        colors[index * 3 + 2] = dominantRGB.b;
      }
    }

    const indices: number[] = [];
    for (let n = 0; n < N; n++) {
      for (let k = 0; k < S - 1; k++) {
        const a = n * S + k;
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
      this.cameraRotation.y += this.config.autoRotation ?? 0.0008;
    }

    const d = this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x);
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, 0);
  }

  private resampleData(data: number[], targetLength: number): number[] {
    const result = new Array(targetLength);
    const ratio = (data.length - 1) / (targetLength - 1);
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, data.length - 1);
      const frac = srcIndex - low;
      result[i] = data[low] * (1 - frac) + data[high] * frac;
    }
    return result;
  }

  private smoothWave(data: number[], passes: number): number[] {
    let result = data;
    for (let p = 0; p < passes; p++) {
      const smoothed = new Array(result.length);
      for (let i = 0; i < result.length; i++) {
        const prev = result[Math.max(0, i - 1)];
        const curr = result[i];
        const next = result[Math.min(result.length - 1, i + 1)];
        smoothed[i] = prev * 0.25 + curr * 0.5 + next * 0.25;
      }
      result = smoothed;
    }
    return result;
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.geometry || !this.camera) return;

    const { audioData } = audioAnalysis;
    const amplitude = this.config.amplitude || 2.8;
    const speed = this.config.speed || 14;
    const decay = this.config.decay ?? 1.0;

    const currentTime = Date.now();
    const updateInterval = 1000 / speed;

    this.updateCameraPosition();

    // Sweep: write the current spectrum into the next spoke around the disc
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      const resampled = this.resampleData(
        audioData.map(v => v / 255),
        this.samplesPerSpoke
      );
      this.spokes[this.writeIndex] = this.smoothWave(resampled, 1);
      this.writeIndex = (this.writeIndex + 1) % this.spokeCount;

      if (decay < 1) {
        for (let n = 0; n < this.spokeCount; n++) {
          if (n === this.writeIndex) continue;
          const spoke = this.spokes[n];
          for (let k = 0; k < spoke.length; k++) spoke[k] *= decay;
        }
      }

      this.lastUpdateTime = currentTime;
    }

    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const hue = this.config.hue ?? 0;
    const { dominant: domStr, accent: accStr } = this.harmonyColorScheme(this.config.harmonyMode ?? 0, hue);
    const dominantRGB = this.parseRGB(domStr);
    const accentRGB = this.parseRGB(accStr);

    const N = this.spokeCount;
    const S = this.samplesPerSpoke;

    for (let n = 0; n < N; n++) {
      const spoke = this.spokes[n];
      for (let k = 0; k < S; k++) {
        const index = n * S + k;
        const height = (spoke?.[k] || 0) * amplitude;
        positions.setY(index, height);

        const heightIntensity = Math.min(1, height / amplitude);
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
    this.spokes = [];

    this.container.innerHTML = '';
  }
}
