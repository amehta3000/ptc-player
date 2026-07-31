/**
 * Ridge Visualizer
 * A ridgeline waterfall: each audio frame becomes a filled spectrum trace,
 * and traces recede into depth as they age — nearer ridges occlude the ones
 * behind them, Unknown Pleasures style.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class RidgeVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private outlineGeometry: THREE.BufferGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private outline: THREE.LineSegments | null = null;
  private history: number[][] = [];
  private lastUpdateTime: number = 0;
  private rows: number = 28;
  private samples: number = 96;
  private readonly fieldWidth = 14;
  private readonly rowSpacing = 0.55;
  private cameraRotation = { x: 0.45, y: 0 };
  private cameraDistance = 13;
  private zoomPhase = 0;
  private tiltPhase = 0;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private frameCount: number = 0;
  private handleResize: (() => void) | null = null;
  private removeCameraControls: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Ridge';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Amplitude',
        key: 'amplitude',
        min: 0.5,
        max: 6,
        step: 0.1,
        default: 3.2,
        value: this.config.amplitude || 3.2
      },
      {
        name: 'Flow Speed',
        key: 'speed',
        min: 1,
        max: 30,
        step: 0.5,
        default: 12,
        value: this.config.speed || 12
      },
      {
        name: 'Depth Fade',
        key: 'decay',
        min: 0.9,
        max: 1,
        step: 0.005,
        default: 0.98,
        value: this.config.decay ?? 0.98
      },
      {
        name: 'Auto Rotation',
        key: 'autoRotation',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0,
        value: this.config.autoRotation ?? 0
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
        name: 'Auto Tilt',
        key: 'autoTilt',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0,
        value: this.config.autoTilt ?? 0
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
      { name: '1', config: { amplitude: 3.2, speed: 12, decay: 0.98, autoRotation: 0, zoomSpeed: 0, autoTilt: 0, hue: 0, harmonyMode: 2 } },
      { name: '2', config: { amplitude: 2.0, speed: 5, decay: 1.0, autoRotation: 0, zoomSpeed: 0, autoTilt: 0.003, hue: 0, harmonyMode: 1 } },
      { name: '3', config: { amplitude: 5.5, speed: 20, decay: 0.95, autoRotation: 0, zoomSpeed: 0, autoTilt: 0, hue: 0, harmonyMode: 2 } },
      { name: '4', config: { amplitude: 3.5, speed: 12, decay: 0.98, autoRotation: 0.003, zoomSpeed: 0.005, autoTilt: 0, hue: 0, harmonyMode: 1 } },
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

    this.rows = this.config.rows ?? 28;
    this.samples = this.config.samples ?? 96;

    this.cameraDistance = this.config.cameraDistance || 13;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
    this.updateCameraPosition();

    for (let i = 0; i < this.rows; i++) {
      this.history.push(new Array(this.samples).fill(0));
    }

    this.buildGeometry();

    // Opaque unlit fills — depth buffer handles the ridge-behind-ridge occlusion
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(this.geometry!, material);
    this.scene.add(this.mesh);

    // Top-edge outline in the background color separates overlapping ridges
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: this.darkMode ? 0x000000 : 0xe8ebed
    });
    this.outline = new THREE.LineSegments(this.outlineGeometry!, outlineMaterial);
    this.scene.add(this.outline);

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
   * Each row is a vertical "curtain": a top edge tracing the spectrum and a
   * bottom edge at y=0, filled with triangles. Rows are stacked in depth,
   * newest at the front. A parallel line buffer traces the top edges.
   */
  private buildGeometry(): void {
    const R = this.rows;
    const S = this.samples;
    const vertsPerRow = S * 2; // top edge then bottom edge
    const vertexCount = R * vertsPerRow;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const outlinePositions = new Float32Array(R * S * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);

    // Front row sits at z=2 so the camera stays well in front of the field
    const frontZ = 2;

    for (let r = 0; r < R; r++) {
      const z = frontZ - r * this.rowSpacing;
      const base = r * vertsPerRow;
      for (let k = 0; k < S; k++) {
        const x = (k / (S - 1) - 0.5) * this.fieldWidth;

        const top = base + k;
        positions[top * 3] = x;
        positions[top * 3 + 1] = 0;
        positions[top * 3 + 2] = z;

        const bottom = base + S + k;
        positions[bottom * 3] = x;
        positions[bottom * 3 + 1] = 0;
        positions[bottom * 3 + 2] = z;

        for (const index of [top, bottom]) {
          colors[index * 3] = dominantRGB.r;
          colors[index * 3 + 1] = dominantRGB.g;
          colors[index * 3 + 2] = dominantRGB.b;
        }

        const line = r * S + k;
        outlinePositions[line * 3] = x;
        outlinePositions[line * 3 + 1] = 0.02;
        outlinePositions[line * 3 + 2] = z;
      }
    }

    const indices: number[] = [];
    for (let r = 0; r < R; r++) {
      const base = r * vertsPerRow;
      for (let k = 0; k < S - 1; k++) {
        const t0 = base + k;
        const t1 = t0 + 1;
        const b0 = base + S + k;
        const b1 = b0 + 1;
        indices.push(t0, b0, t1, t1, b0, b1);
      }
    }

    const outlineIndices: number[] = [];
    for (let r = 0; r < R; r++) {
      for (let k = 0; k < S - 1; k++) {
        const a = r * S + k;
        outlineIndices.push(a, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    const outlineGeometry = new THREE.BufferGeometry();
    outlineGeometry.setAttribute('position', new THREE.BufferAttribute(outlinePositions, 3));
    outlineGeometry.setIndex(outlineIndices);

    if (this.geometry) this.geometry.dispose();
    if (this.outlineGeometry) this.outlineGeometry.dispose();
    this.geometry = geometry;
    this.outlineGeometry = outlineGeometry;
    if (this.mesh) this.mesh.geometry = geometry;
    if (this.outline) this.outline.geometry = outlineGeometry;
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
      this.cameraRotation.y += this.config.autoRotation ?? 0;
    }

    // Auto tilt: slow pitch oscillation around the current angle
    const autoTilt = this.config.autoTilt ?? 0;
    let pitch = this.cameraRotation.x;
    if (autoTilt > 0) {
      this.tiltPhase += autoTilt;
      pitch = Math.max(0.05, Math.min(Math.PI / 2, pitch + Math.sin(this.tiltPhase) * 0.35));
    }

    const D = this.cameraDistance;
    this.camera.position.x = D * Math.sin(this.cameraRotation.y) * Math.cos(pitch);
    this.camera.position.y = D * Math.sin(pitch);
    this.camera.position.z = D * Math.cos(this.cameraRotation.y) * Math.cos(pitch);
    this.camera.lookAt(0, 0, -5);
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
    if (!this.isInitialized || !this.geometry || !this.outlineGeometry || !this.camera) return;

    const { audioData } = audioAnalysis;
    const amplitude = this.config.amplitude || 3.2;
    const speed = this.config.speed || 12;
    const decay = this.config.decay ?? 0.98;

    const currentTime = Date.now();
    const updateInterval = 1000 / speed;

    this.updateCameraPosition();

    // New trace arrives at the front; older traces recede into depth
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      this.history.pop();
      const resampled = this.resampleData(
        audioData.map(v => v / 255),
        this.samples
      );
      this.history.unshift(this.smoothWave(resampled, 1));
      this.lastUpdateTime = currentTime;
    }

    // Update geometry every other frame for performance
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;

    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const outlinePositions = this.outlineGeometry.attributes.position;
    const hue = this.config.hue ?? 0;
    const { dominant: domStr, accent: accStr } = this.harmonyColorScheme(this.config.harmonyMode ?? 2, hue);
    const dominantRGB = this.parseRGB(domStr);
    const accentRGB = this.parseRGB(accStr);

    const R = this.rows;
    const S = this.samples;
    const vertsPerRow = S * 2;

    const decayFactors: number[] = [];
    for (let r = 0; r < R; r++) {
      decayFactors[r] = Math.pow(decay, r);
    }

    for (let r = 0; r < R; r++) {
      const row = this.history[r];
      const decayFactor = decayFactors[r];
      // Rows dim slightly with depth so the front reads brightest
      const depthDim = 1 - 0.35 * (r / (R - 1));
      const base = r * vertsPerRow;

      for (let k = 0; k < S; k++) {
        const height = (row?.[k] || 0) * decayFactor * amplitude;
        positions.setY(base + k, height);
        outlinePositions.setY(r * S + k, height + 0.02);

        // Gradient runs along the frequency axis: dominant (bass) → accent (highs)
        const t = k / (S - 1);
        const cr = (dominantRGB.r + (accentRGB.r - dominantRGB.r) * t) * depthDim;
        const cg = (dominantRGB.g + (accentRGB.g - dominantRGB.g) * t) * depthDim;
        const cb = (dominantRGB.b + (accentRGB.b - dominantRGB.b) * t) * depthDim;
        colorAttr.setXYZ(base + k, cr, cg, cb);
        colorAttr.setXYZ(base + S + k, cr, cg, cb);
      }
    }

    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
    outlinePositions.needsUpdate = true;
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
    if (this.outline) {
      (this.outline.material as THREE.LineBasicMaterial).color.set(isDark ? 0x000000 : 0xe8ebed);
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
    if (this.outlineGeometry) {
      this.outlineGeometry.dispose();
    }
    if (this.mesh && this.mesh.material) {
      (this.mesh.material as THREE.Material).dispose();
    }
    if (this.outline && this.outline.material) {
      (this.outline.material as THREE.Material).dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.outlineGeometry = null;
    this.mesh = null;
    this.outline = null;
    this.history = [];

    this.container.innerHTML = '';
  }
}
