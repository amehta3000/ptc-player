/**
 * Radial Visualizer
 * Polar disc of concentric rings. The frequency spectrum wraps around the
 * center (mirrored so the seam is invisible) and each new frame ripples
 * outward through rings of history, decaying as it travels.
 *
 * Two render styles share the same motion: clean ring outlines (Lines), or
 * solid ribbon rings with lighting (Solid, the former Ripples visualizer).
 * The center hole can close completely at innerRadius 0.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, VisualizerPreset, ColorScheme } from './BaseVisualizer';

export class RadialPlaneVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private ringsObject: THREE.LineSegments | THREE.Mesh | null = null;
  private accentLight: THREE.DirectionalLight | null = null;
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

  private isSolid(): boolean {
    return Math.round(this.config.ringStyle ?? 0) === 1;
  }

  getControls(): VisualizerControl[] {
    const controls: VisualizerControl[] = [
      {
        name: 'Style',
        key: 'ringStyle',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        value: this.config.ringStyle ?? 0,
        labels: ['Lines', 'Solid']
      },
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
        min: 0,
        max: 3,
        step: 0.1,
        default: 1.2,
        value: this.config.innerRadius ?? 1.2
      },
      {
        name: 'Ring Spacing',
        key: 'outerRadius',
        min: 3,
        max: 15,
        step: 0.5,
        default: 9,
        value: this.config.outerRadius ?? 9
      },
    ];

    // Ribbon width only matters in Solid style
    if (this.isSolid()) {
      controls.push({
        name: 'Ring Width',
        key: 'ringWidth',
        min: 0.1,
        max: 1.0,
        step: 0.05,
        default: 0.65,
        value: this.config.ringWidth ?? 0.65
      });
    }

    controls.push(
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
        labels: ['Mono', 'Analog', 'Comp']
      }
    );

    return controls;
  }

  getPresets(): VisualizerPreset[] {
    return [
      // 1: "Interference" - fast tight line rings with a mirrored X seam
      { name: '1', config: { ringStyle: 0, amplitude: 4.2, speed: 30, decay: 0.92, innerRadius: 0.3, outerRadius: 15, autoRotation: 0.001, zoomSpeed: 0, hue: 0, harmonyMode: 2, __mirror: 1, __mirrorOffset: 0.1 } },
      // 2: "Dome" - solid rings fused into a closed breathing surface
      { name: '2', config: { ringStyle: 1, ringWidth: 1.0, amplitude: 2.6, speed: 10, decay: 0.95, innerRadius: 0, outerRadius: 9, autoRotation: 0.0015, zoomSpeed: 0, hue: 0, harmonyMode: 1, __mirror: 0 } },
      // 3: "Kaleido" - line rings tiled through a four-way mirror
      { name: '3', config: { ringStyle: 0, amplitude: 3.4, speed: 22, decay: 0.9, innerRadius: 1.6, outerRadius: 11, autoRotation: 0.002, zoomSpeed: 0, hue: 0, harmonyMode: 1, __mirror: 3, __mirrorOffset: 0.32 } },
      // 4: "Vinyl" - slow solid ribbons with a gentle zoom drift
      { name: '4', config: { ringStyle: 1, ringWidth: 0.45, amplitude: 1.8, speed: 14, decay: 0.97, innerRadius: 0.8, outerRadius: 9, autoRotation: 0.003, zoomSpeed: 0.003, hue: 0, harmonyMode: 0, __mirror: 0 } },
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

    // Lights only affect the Solid style; the line material is unlit
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);
    this.accentLight = new THREE.DirectionalLight(new THREE.Color(this.colors.accent), 0.35);
    this.accentLight.position.set(-5, 5, -5);
    this.scene.add(this.accentLight);

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
   * Rebuild the ring geometry for the current style.
   *
   * Lines: `rings` concentric ring outlines, each with angularSegments + 1
   * vertices (the extra vertex duplicates angle 0 to close the seam), drawn
   * as circumferential line segments only.
   *
   * Solid: each ring is a flat annular ribbon (inner + outer edge) whose
   * width is a fraction of the ring spacing, lit and double-sided.
   */
  private buildGeometry(): void {
    if (!this.scene) return;

    // Tear down the previous object
    if (this.ringsObject) {
      this.scene.remove(this.ringsObject);
      (this.ringsObject.material as THREE.Material).dispose();
      this.ringsObject = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    const innerRadius = this.config.innerRadius ?? 1.2;
    const outerRadius = this.config.outerRadius ?? 9;
    const A = this.angularSegments;
    const R = this.rings;
    const dominantRGB = this.parseRGB(this.colors.dominant);
    const geometry = new THREE.BufferGeometry();

    if (this.isSolid()) {
      const step = (outerRadius - innerRadius) / R;
      const width = step * (this.config.ringWidth ?? 0.65);
      const vertsPerEdge = A + 1;
      const vertsPerRing = vertsPerEdge * 2;
      const vertexCount = R * vertsPerRing;

      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);

      for (let r = 0; r < R; r++) {
        const rInner = innerRadius + r * step;
        const rOuter = rInner + width;
        const base = r * vertsPerRing;
        for (let i = 0; i <= A; i++) {
          const theta = ((i % A) / A) * Math.PI * 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);

          const inner = base + i;
          positions[inner * 3] = cos * rInner;
          positions[inner * 3 + 1] = 0;
          positions[inner * 3 + 2] = sin * rInner;

          const outer = base + vertsPerEdge + i;
          positions[outer * 3] = cos * rOuter;
          positions[outer * 3 + 1] = 0;
          positions[outer * 3 + 2] = sin * rOuter;

          for (const index of [inner, outer]) {
            colors[index * 3] = dominantRGB.r;
            colors[index * 3 + 1] = dominantRGB.g;
            colors[index * 3 + 2] = dominantRGB.b;
          }
        }
      }

      const indices: number[] = [];
      for (let r = 0; r < R; r++) {
        const base = r * vertsPerRing;
        for (let i = 0; i < A; i++) {
          const a = base + i;
          const b = a + 1;
          const c = base + vertsPerEdge + i;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 10,
        flatShading: false
      });
      this.ringsObject = new THREE.Mesh(geometry, material);
    } else {
      const vertsPerRing = A + 1;
      const vertexCount = R * vertsPerRing;
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);

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

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9
      });
      this.ringsObject = new THREE.LineSegments(geometry, material);
    }

    this.geometry = geometry;
    this.scene.add(this.ringsObject);
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

    // Push a new ring of audio into the center; older rings travel outward.
    // Solid style gets extra smoothing for the calm water-ring look.
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      this.history.pop();
      const resampled = this.resampleMirrored(audioData, this.angularSegments);
      const wave = this.smoothWrap(
        resampled.map(v => (v / 255) * amplitude),
        this.isSolid() ? 3 : 2
      );
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

    const decayFactors: number[] = [];
    for (let j = 0; j < R; j++) {
      decayFactors[j] = Math.pow(decay, j);
    }

    if (this.isSolid()) {
      const vertsPerEdge = A + 1;
      const vertsPerRing = vertsPerEdge * 2;
      const widthFrac = this.config.ringWidth ?? 0.65;

      for (let r = 0; r < R; r++) {
        const ring = this.history[r];
        const nextRing = this.history[r + 1];
        const decayFactor = decayFactors[r];
        const nextDecay = decayFactors[Math.min(r + 1, R - 1)];
        const base = r * vertsPerRing;

        for (let i = 0; i <= A; i++) {
          const angleIdx = i % A;
          const h = (ring?.[angleIdx] || 0) * decayFactor;
          // Tilt the ribbon toward the next ring's height so the surface
          // reads as a continuous slope under lighting
          const hNext = (nextRing?.[angleIdx] || 0) * nextDecay;
          const hOuter = h + (hNext - h) * widthFrac;

          positions.setY(base + i, h);
          positions.setY(base + vertsPerEdge + i, hOuter);

          const heightIntensity = Math.min(1, Math.abs(h) / amplitude);
          const cr = dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity;
          const cg = dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity;
          const cb = dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity;
          colorAttr.setXYZ(base + i, cr, cg, cb);
          colorAttr.setXYZ(base + vertsPerEdge + i, cr, cg, cb);
        }
      }

      positions.needsUpdate = true;
      colorAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();
    } else {
      const vertsPerRing = A + 1;

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
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    if (this.accentLight) {
      this.accentLight.color.set(new THREE.Color(colors.accent));
    }
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

    if (key === 'innerRadius' || key === 'outerRadius' || key === 'ringWidth' || key === 'ringStyle') {
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
    if (this.ringsObject && this.ringsObject.material) {
      (this.ringsObject.material as THREE.Material).dispose();
    }
    this.accentLight?.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.ringsObject = null;
    this.accentLight = null;
    this.history = [];

    this.container.innerHTML = '';
  }
}
