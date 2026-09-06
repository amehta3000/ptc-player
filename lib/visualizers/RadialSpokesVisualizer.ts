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
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';
import { DragInertia } from './dragInertia';

export class RadialSpokesVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private spokesObject: THREE.LineSegments | THREE.Mesh | null = null;
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
  private dragInertia = new DragInertia();
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
        name: 'Spoke Width',
        key: 'spokeWidth',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        value: this.config.spokeWidth ?? 0
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
        labels: ['Mono', 'Analog', 'Comp']
      }
    ];
  }

  private isRibbon(): boolean {
    return (this.config.spokeWidth ?? 0) > 0.001;
  }

  getPresets(): VisualizerPreset[] {
    return [
      { name: '1', config: { spokeWidth: 0, amplitude: 2.8, speed: 14, decay: 1.0, innerRadius: 1.3, autoRotation: 0.0008, zoomSpeed: 0, hue: 0, harmonyMode: 0 } },
      { name: '2', config: { spokeWidth: 0.35, amplitude: 3.5, speed: 14, decay: 0.98, innerRadius: 1.0, autoRotation: 0.002, zoomSpeed: 0, hue: 0, harmonyMode: 1 } },
      { name: '3', config: { spokeWidth: 1.0, amplitude: 2.2, speed: 20, decay: 0.99, innerRadius: 0.6, autoRotation: 0.001, zoomSpeed: 0, hue: 0, harmonyMode: 2 } },
      { name: '4', config: { spokeWidth: 0.15, amplitude: 4.0, speed: 30, decay: 0.95, innerRadius: 0.2, autoRotation: 0.003, zoomSpeed: 0.004, hue: 0, harmonyMode: 0 } },
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
   * Rebuild the spoke geometry for the current width.
   *
   * Width 0: one indexed line-segment buffer, spokeCount crisp polylines
   * from the center hole to the outer edge.
   *
   * Width > 0: each spoke becomes a flat wedge, two edges offset along the
   * tangent by an angular fraction of the spoke pitch, so wedges widen with
   * radius and at 1.0 neighboring spokes touch into a full disc.
   */
  private buildGeometry(): void {
    if (!this.scene) return;

    if (this.spokesObject) {
      this.scene.remove(this.spokesObject);
      (this.spokesObject.material as THREE.Material).dispose();
      this.spokesObject = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    const innerRadius = this.config.innerRadius ?? 1.3;
    const outerRadius = 9;
    const N = this.spokeCount;
    const S = this.samplesPerSpoke;
    const dominantRGB = this.parseRGB(this.colors.dominant);
    const geometry = new THREE.BufferGeometry();

    if (this.isRibbon()) {
      // Half of the angular pitch each side, scaled by the width fraction
      const halfAngle = (Math.PI / N) * (this.config.spokeWidth ?? 0);
      const vertexCount = N * S * 2;
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);

      for (let n = 0; n < N; n++) {
        const theta = (n / N) * Math.PI * 2;
        for (let k = 0; k < S; k++) {
          const radius = innerRadius + (k / (S - 1)) * (outerRadius - innerRadius);
          const base = (n * S + k) * 2;
          const left = theta - halfAngle;
          const right = theta + halfAngle;
          positions[base * 3] = Math.cos(left) * radius;
          positions[base * 3 + 1] = 0;
          positions[base * 3 + 2] = Math.sin(left) * radius;
          positions[(base + 1) * 3] = Math.cos(right) * radius;
          positions[(base + 1) * 3 + 1] = 0;
          positions[(base + 1) * 3 + 2] = Math.sin(right) * radius;
          for (const index of [base, base + 1]) {
            colors[index * 3] = dominantRGB.r;
            colors[index * 3 + 1] = dominantRGB.g;
            colors[index * 3 + 2] = dominantRGB.b;
          }
        }
      }

      const indices: number[] = [];
      for (let n = 0; n < N; n++) {
        for (let k = 0; k < S - 1; k++) {
          const a = (n * S + k) * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, c, b, b, c, d);
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      this.spokesObject = new THREE.Mesh(geometry, material);
    } else {
      const vertexCount = N * S;
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);

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

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9
      });
      this.spokesObject = new THREE.LineSegments(geometry, material);
    }

    this.geometry = geometry;
    this.scene.add(this.spokesObject);
  }

  private setupCameraControls(element: HTMLDivElement): void {
    element.style.cursor = 'grab';

    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.dragInertia.grab();
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.dragInertia.record(dx, dy);
      this.cameraRotation.y += dx * 0.005;
      this.cameraRotation.x += dy * 0.005;
      this.cameraRotation.x = Math.max(0.1, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { this.isDragging = false; this.dragInertia.release(); };

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
        this.dragInertia.grab();
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
        const dx = pos.clientX - this.lastMousePos.x;
        const dy = pos.clientY - this.lastMousePos.y;
        this.dragInertia.record(dx, dy);
        this.cameraRotation.y += dx * 0.005;
        this.cameraRotation.x += dy * 0.005;
        this.cameraRotation.x = Math.max(0.1, Math.min(Math.PI / 2, this.cameraRotation.x));
        this.lastMousePos = { x: pos.clientX, y: pos.clientY };
      }
    };
    const onTouchEnd = () => { this.isDragging = false; pinchDist = 0; this.dragInertia.release(); };

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
      this.dragInertia.glideOrbit(this.cameraRotation, 0.005, 0.1, Math.PI / 2);
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

    const ribbon = this.isRibbon();

    for (let n = 0; n < N; n++) {
      const spoke = this.spokes[n];
      for (let k = 0; k < S; k++) {
        const height = (spoke?.[k] || 0) * amplitude;
        const heightIntensity = Math.min(1, height / amplitude);
        const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity;
        const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity;
        const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity;

        if (ribbon) {
          const base = (n * S + k) * 2;
          positions.setY(base, height);
          positions.setY(base + 1, height);
          colorAttr.setXYZ(base, r, g, b);
          colorAttr.setXYZ(base + 1, r, g, b);
        } else {
          const index = n * S + k;
          positions.setY(index, height);
          colorAttr.setXYZ(index, r, g, b);
        }
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

    if (key === 'innerRadius' || key === 'spokeWidth') {
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
    if (this.spokesObject && this.spokesObject.material) {
      (this.spokesObject.material as THREE.Material).dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.spokesObject = null;
    this.spokes = [];

    this.container.innerHTML = '';
  }
}
