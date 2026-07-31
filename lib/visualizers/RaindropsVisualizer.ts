/**
 * Raindrops Visualizer
 *
 * A water ripple effect visualizer where audio creates expanding rings on a pond surface.
 * Bass creates large, slow ripples while high frequencies create small, fast ripples.
 *
 * Key Features:
 * - Each frequency band drops different sized ripples
 * - Ripples spawn randomly, expand outward, and fade away
 * - Bass: Large, slow expanding rings
 * - Mid: Medium rings
 * - High: Small, fast ripples (like drizzle)
 * - Multiple overlapping ripples rendered using instanced geometry
 * - Surface modes: Plane (flat), Cube (6 faces), Sphere
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

interface Ripple {
  position: THREE.Vector3;
  surfaceNormal: THREE.Vector3;
  startTime: number;
  amplitude: number;
  maxRadius: number;
  lifetime: number; // seconds until fully expanded
  frequencyBand: number; // 0-63 from audioData array
  color: THREE.Color;
}

interface PendingDrop {
  frequencyBand: number;
  amplitude: number;
  triggerAt: number;
}

export class RaindropsVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private ripples: Ripple[] = [];
  private rippleMeshes: THREE.Mesh[] = [];
  private lastDropTimes: number[] = new Array(64).fill(0);
  private pendingDrops: PendingDrop[] = [];
  private isPaused = false;
  private pauseStartTime = 0;
  private layoutMode: number = 0; // 0=rainfall, 1=row, 2=grid, 3=spiral
  private resizeObserver: ResizeObserver | null = null;
  private gridOverlay: THREE.LineSegments | null = null;
  private rowAxisOverlay: THREE.LineSegments | null = null;
  private gridCellOrder: number[] = [];
  private gridCursor = 0;

  // 3D surface mode support
  private cameraRotation = { x: 0.3, y: 0 };
  private zoomPhase = 0;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private surfaceMesh: THREE.LineSegments | null = null;
  private boundOnMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundOnMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundOnMouseUp: ((e: MouseEvent) => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Raindrops';
  }

  getControls(): VisualizerControl[] {
    const surfaceMode = this.config.surfaceMode ?? 2;

    const controls: VisualizerControl[] = [
      {
        name: 'Surface',
        key: 'surfaceMode',
        min: 0,
        max: 2,
        step: 1,
        default: 2,
        value: surfaceMode,
        labels: ['Plane', 'Cube', 'Sphere']
      },
      {
        name: 'Max Ripples',
        key: 'maxRipples',
        min: 32,
        max: 256,
        step: 16,
        default: 64,
        value: this.config.maxRipples ?? 64
      },
      {
        // Higher threshold = fewer drops, so name it for what it is
        name: 'Drop Threshold',
        key: 'bassThreshold',
        min: 0.02,
        max: 0.4,
        step: 0.02,
        default: 0.08,
        value: this.config.bassThreshold ?? 0.08
      },
      {
        name: 'Brightness',
        key: 'intensity',
        min: 0.3,
        max: 5,
        step: 0.1,
        default: 1.0,
        value: this.config.intensity ?? 1.0
      },
      {
        name: 'Glow',
        key: 'glow',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        value: this.config.glow ?? 0
      },
      {
        name: 'Ring Thickness',
        key: 'ringThickness',
        min: 0.1,
        max: 1,
        step: 0.05,
        default: 0.1,
        value: this.config.ringThickness ?? 0.1
      },
    ];


    if (surfaceMode > 0) {
      controls.push(
        {
          name: 'Auto Rotation',
          key: 'autoRotation',
          min: 0,
          max: 0.01,
          step: 0.0005,
          default: 0.003,
          value: this.config.autoRotation ?? 0.003
        },
        {
          name: 'Zoom Speed',
          key: 'zoomSpeed',
          min: 0,
          max: 0.02,
          step: 0.001,
          default: 0,
          value: this.config.zoomSpeed ?? 0
        }
      );
    }

    controls.push(
      {
        name: 'Color Mode',
        key: 'colorMode',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        value: this.config.colorMode ?? 0,
        labels: ['Album', 'Rainbow']
      },
      {
        name: 'Hue',
        key: 'hue',
        min: 0,
        max: 360,
        step: 1,
        default: 0,
        value: this.config.hue ?? 0
      }
    );

    // Harmony only shapes the Album palette; Rainbow ignores it
    if ((this.config.colorMode ?? 0) === 0) {
      controls.push({
        name: 'Harmony',
        key: 'harmonyMode',
        min: 0,
        max: 2,
        step: 1,
        default: 0,
        value: this.config.harmonyMode ?? 0,
        labels: ['Mono', 'Analog', 'Comp']
      });
    }

    return controls;
  }

  getPresets(): VisualizerPreset[] {
    return [
      {
        name: '1',
        config: {
          surfaceMode: 2, maxRipples: 48, bassThreshold: 0.18,
          intensity: 1.0, ringThickness: 0.1, autoRotation: 0.003,
          colorMode: 0, hue: 0
        }
      },
      {
        name: '2',
        config: {
          surfaceMode: 2, maxRipples: 96, bassThreshold: 0.3,
          intensity: 1.8, ringThickness: 0.35, autoRotation: 0.005,
          colorMode: 1, hue: 0
        }
      },
      {
        name: '3',
        config: {
          surfaceMode: 0, maxRipples: 80, bassThreshold: 0.22,
          intensity: 1.2, ringThickness: 0.12, layoutMode: 0,
          showGridOverlay: 0, colorMode: 0, hue: 0
        }
      },
      {
        name: '4',
        config: {
          surfaceMode: 1, maxRipples: 64, bassThreshold: 0.14,
          intensity: 1.3, ringThickness: 0.2, autoRotation: 0.004,
          colorMode: 0, hue: 0
        }
      }
    ];
  }

  protected initScene(): void {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);

    const glow = this.config.glow ?? 0;
    if (glow > 0) {
      this.renderer.domElement.style.filter = `blur(${glow * 4}px)`;
    }

    this.observeResize();
    this.setupMouseDrag();
    this.updateCameraPosition();
    this.updateSurfaceMesh();
    this.updateGridOverlay();
  }

  private observeResize(): void {
    if (this.resizeObserver) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(this.container);
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.updateGridOverlay();
  }

  private setupMouseDrag(): void {
    this.boundOnMouseDown = (e: MouseEvent) => {
      const surfaceMode = this.config.surfaceMode ?? 2;
      if (surfaceMode === 0) return;
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    };

    this.boundOnMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.cameraRotation.y += dx * 0.005;
      this.cameraRotation.x += dy * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraRotation.x));
      this.lastMouse = { x: e.clientX, y: e.clientY };
    };

    this.boundOnMouseUp = () => {
      this.isDragging = false;
    };

    this.container.addEventListener('mousedown', this.boundOnMouseDown);
    window.addEventListener('mousemove', this.boundOnMouseMove);
    window.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;

    const surfaceMode = this.config.surfaceMode ?? 2;

    if (surfaceMode === 0) {
      this.camera.position.set(0, 20, 0);
      this.camera.lookAt(0, 0, 0);
    } else {
      const zoomSpeed = this.config.zoomSpeed ?? 0;
      if (zoomSpeed > 0) this.zoomPhase += zoomSpeed;
      const distance = 12 + (zoomSpeed > 0 ? 5 * Math.sin(this.zoomPhase) : 0);
      this.camera.position.x = distance * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
      this.camera.position.y = distance * Math.sin(this.cameraRotation.x);
      this.camera.position.z = distance * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
      this.camera.lookAt(0, 0, 0);
    }
  }

  private updateSurfaceMesh(): void {
    if (!this.scene) return;

    if (this.surfaceMesh) {
      this.scene.remove(this.surfaceMesh);
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
      this.surfaceMesh = null;
    }

    const surfaceMode = this.config.surfaceMode ?? 2;
    if (surfaceMode === 0) return;

    let sourceGeometry: THREE.BufferGeometry;
    if (surfaceMode === 1) {
      sourceGeometry = new THREE.BoxGeometry(6, 6, 6);
    } else {
      sourceGeometry = new THREE.SphereGeometry(4, 24, 16);
    }

    const edges = new THREE.EdgesGeometry(sourceGeometry);
    sourceGeometry.dispose();

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: 0.08
    });

    this.surfaceMesh = new THREE.LineSegments(edges, material);
    this.scene.add(this.surfaceMesh);
  }

  private getLayoutBounds(): { halfWidth: number; halfHeight: number } {
    if (!this.camera) {
      const planeSize = this.config.planeSize || 20;
      const half = (planeSize * 0.9) / 2;
      return { halfWidth: half, halfHeight: half };
    }

    const distance = Math.abs(this.camera.position.y);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const halfHeight = Math.tan(vFov / 2) * distance;
    const halfWidth = halfHeight * this.camera.aspect;

    const planeSize = this.config.planeSize || 20;
    const halfFromPlaneSize = planeSize / 2;

    return {
      halfWidth: Math.min(halfWidth, halfFromPlaneSize),
      halfHeight: Math.min(halfHeight, halfFromPlaneSize)
    };
  }

  private updateGridOverlay(): void {
    if (!this.scene) return;

    if (this.gridOverlay) {
      this.scene.remove(this.gridOverlay);
      this.gridOverlay.geometry.dispose();
      (this.gridOverlay.material as THREE.Material).dispose();
      this.gridOverlay = null;
    }

    if (this.rowAxisOverlay) {
      this.scene.remove(this.rowAxisOverlay);
      this.rowAxisOverlay.geometry.dispose();
      (this.rowAxisOverlay.material as THREE.Material).dispose();
      this.rowAxisOverlay = null;
    }

    const surfaceMode = this.config.surfaceMode ?? 2;
    if (surfaceMode !== 0) return;

    const layoutMode = this.config.layoutMode || 0;
    const showOverlay = (this.config.showGridOverlay ?? 1) > 0;
    if (!showOverlay) return;

    if (layoutMode === 2) {
      const { halfWidth, halfHeight } = this.getLayoutBounds();
      const insetX = halfWidth * 0.9;
      const insetY = halfHeight * 0.9;
      const divisions = 8;

      const positions: number[] = [];
      for (let i = 0; i <= divisions; i++) {
        const t = i / divisions;
        const x = (t - 0.5) * insetX * 2;
        const y = (t - 0.5) * insetY * 2;

        positions.push(x, 0.01, -insetY, x, 0.01, insetY);
        positions.push(-insetX, 0.01, y, insetX, 0.01, y);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(1, 1, 1),
        transparent: true,
        opacity: 0.08
      });

      this.gridOverlay = new THREE.LineSegments(geometry, material);
      this.scene.add(this.gridOverlay);
      return;
    }

    if (layoutMode === 1) {
      const { halfWidth } = this.getLayoutBounds();
      const insetX = halfWidth * 0.9;

      const positions = [-insetX, 0.01, 0, insetX, 0.01, 0];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(1, 1, 1),
        transparent: true,
        opacity: 0.12
      });

      this.rowAxisOverlay = new THREE.LineSegments(geometry, material);
      this.scene.add(this.rowAxisOverlay);
    }
  }

  private getGridCellIndex(frequencyBand: number): number {
    const cells = 64;

    if (this.gridCellOrder.length !== cells) {
      this.gridCellOrder = Array.from({ length: cells }, (_, i) => i);
      for (let i = this.gridCellOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.gridCellOrder[i], this.gridCellOrder[j]] = [this.gridCellOrder[j], this.gridCellOrder[i]];
      }
      this.gridCursor = 0;
    }

    const layoutMode = this.config.layoutMode || 0;
    const maxRipples = this.config.maxRipples || 128;
    const shouldDistribute = layoutMode === 2 && maxRipples >= 32;

    if (!shouldDistribute) {
      return frequencyBand % cells;
    }

    const idx = this.gridCellOrder[this.gridCursor % cells];
    this.gridCursor++;
    return idx;
  }

  private getSurfacePosition(frequencyBand: number): { position: THREE.Vector3; normal: THREE.Vector3 } {
    const surfaceMode = this.config.surfaceMode ?? 2;

    if (surfaceMode === 1) {
      // Cube: pick a random face, random position on that face
      const half = 3; // cube side = 6, half = 3
      const face = Math.floor(Math.random() * 6);
      const u = (Math.random() - 0.5) * half * 2;
      const v = (Math.random() - 0.5) * half * 2;

      let position: THREE.Vector3;
      let normal: THREE.Vector3;

      switch (face) {
        case 0: position = new THREE.Vector3( half, u, v); normal = new THREE.Vector3( 1, 0, 0); break;
        case 1: position = new THREE.Vector3(-half, u, v); normal = new THREE.Vector3(-1, 0, 0); break;
        case 2: position = new THREE.Vector3(u,  half, v); normal = new THREE.Vector3(0,  1, 0); break;
        case 3: position = new THREE.Vector3(u, -half, v); normal = new THREE.Vector3(0, -1, 0); break;
        case 4: position = new THREE.Vector3(u, v,  half); normal = new THREE.Vector3(0, 0,  1); break;
        default: position = new THREE.Vector3(u, v, -half); normal = new THREE.Vector3(0, 0, -1); break;
      }

      return { position, normal };
    }

    if (surfaceMode === 2) {
      // Sphere: uniform random point on sphere surface
      const radius = 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const position = new THREE.Vector3(x, y, z);
      const normal = position.clone().normalize();

      return { position, normal };
    }

    // Plane mode — should not reach here, handled by addRipple directly
    return {
      position: new THREE.Vector3(0, 0, 0),
      normal: new THREE.Vector3(0, 1, 0)
    };
  }

  private addRipple(frequencyBand: number, amplitude: number): void {
    if (this.ripples.length >= (this.config.maxRipples || 128)) {
      return;
    }

    const surfaceMode = this.config.surfaceMode ?? 2;
    const normalizedBand = frequencyBand / 63;

    let position: THREE.Vector3;
    let surfaceNormal: THREE.Vector3;

    if (surfaceMode === 0) {
      // Plane mode — use layout modes
      const layoutMode = this.config.layoutMode || 0;
      const { halfWidth, halfHeight } = this.getLayoutBounds();
      const insetX = halfWidth * 0.9;
      const insetY = halfHeight * 0.9;
      let x = 0, z = 0;

      switch (layoutMode) {
        case 1: {
          x = -insetX + (normalizedBand * insetX * 2);
          z = 0;
          break;
        }
        case 2: {
          const cell = this.getGridCellIndex(frequencyBand);
          const row = Math.floor(cell / 8);
          const col = cell % 8;
          x = (col / 7 - 0.5) * insetX * 2;
          z = (row / 7 - 0.5) * insetY * 2;
          break;
        }
        case 3: {
          const angle = normalizedBand * Math.PI * 8;
          const radius = normalizedBand * Math.min(insetX, insetY) * 0.85;
          x = Math.cos(angle) * radius;
          z = Math.sin(angle) * radius;
          break;
        }
        case 0:
        default:
          x = (Math.random() - 0.5) * insetX * 2;
          z = (Math.random() - 0.5) * insetY * 2;
          break;
      }

      position = new THREE.Vector3(x, 0, z);
      surfaceNormal = new THREE.Vector3(0, 1, 0);
    } else {
      // Cube or Sphere — random surface placement
      const result = this.getSurfacePosition(frequencyBand);
      position = result.position;
      surfaceNormal = result.normal;
    }

    // Ripple characteristics scaled by surface mode
    const sizeScale = surfaceMode === 0 ? 1.0 : 0.3;
    const maxRadius = (8 - (normalizedBand * 6)) * sizeScale;
    // Lifetime in seconds: bass ripples live longer, treble shorter
    const lifetime = 1.8 + (1.0 - normalizedBand) * 1.4;

    const hueOffset = (this.config.hue ?? 0) / 360;
    const colorMode = this.config.colorMode ?? 0;

    let color: THREE.Color;
    if (colorMode === 1) {
      // Rainbow mode: HSL spectrum across frequency bands
      const hue = (normalizedBand * 0.7 + hueOffset) % 1;
      const saturation = 0.7 + normalizedBand * 0.2;
      const lightness = 0.5 + amplitude * 0.25;
      color = new THREE.Color().setHSL(hue, saturation, lightness);
    } else {
      // Album mode: blend dominant (bass) → accent (treble) using harmony + hue
      const { dominant: domStr, accent: accStr } = this.harmonyColorScheme(this.config.harmonyMode ?? 0, this.config.hue ?? 0);
      const domParsed = this.parseRGB(domStr);
      const accParsed = this.parseRGB(accStr);
      const domColor = new THREE.Color(domParsed.r, domParsed.g, domParsed.b);
      const accColor = new THREE.Color(accParsed.r, accParsed.g, accParsed.b);
      color = domColor.clone().lerp(accColor, normalizedBand);
      // Boost lightness based on amplitude so louder hits are brighter
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      color.setHSL(hsl.h, Math.min(1, hsl.s + 0.2), Math.min(0.9, hsl.l + amplitude * 0.3));
    }

    const ripple: Ripple = {
      position,
      surfaceNormal,
      startTime: performance.now(),
      amplitude: amplitude * (this.config.intensity || 1.5),
      maxRadius,
      lifetime,
      frequencyBand,
      color,
    };

    this.ripples.push(ripple);
    this.createRippleMesh(ripple);
  }

  private createRippleMesh(ripple: Ripple): void {
    if (!this.scene) return;

    const segments = 64;
    const geometry = new THREE.RingGeometry(0.01, 0.02, segments);

    const material = new THREE.MeshBasicMaterial({
      color: ripple.color,
      transparent: true,
      opacity: ripple.amplitude,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    const surfaceMode = this.config.surfaceMode ?? 2;

    if (surfaceMode === 0) {
      mesh.position.set(ripple.position.x, 0, ripple.position.z);
      mesh.rotation.x = -Math.PI / 2;
    } else {
      // Offset slightly along normal to prevent z-fighting with wireframe
      const offset = ripple.surfaceNormal.clone().multiplyScalar(0.02);
      mesh.position.copy(ripple.position).add(offset);

      // Orient ring so its face aligns with the surface normal
      const target = ripple.position.clone().add(ripple.surfaceNormal);
      mesh.lookAt(target);
    }

    mesh.userData.ripple = ripple;

    this.scene.add(mesh);
    this.rippleMeshes.push(mesh);
  }

  public init(): void {
    this.initScene();
  }

  public update(audioAnalysis: AudioAnalysis): void {
    if (!this.scene) return;

    // --- Ripple spawning (audio-reactive) ---
    const totalLevel = (audioAnalysis.bassAvg + audioAnalysis.midAvg + audioAnalysis.highAvg) / 3;

    const shouldPause = totalLevel < 0.02 || !audioAnalysis.isPlaying;
    if (shouldPause) {
      if (!this.isPaused) {
        this.isPaused = true;
        this.pauseStartTime = performance.now();
      }
    } else {
      if (this.isPaused) {
        this.isPaused = false;
        this.pauseStartTime = 0;
      }
    }

    if (!this.isPaused) {
      const now = performance.now();
      // Drop Rate is now intuitive: higher = more drops (inverted from raw threshold)
      const dropRate = this.config.bassThreshold ?? 0.08;
      const baseThreshold = (1 - dropRate) * 0.55 * 255;
      const layoutMode = this.config.layoutMode || 0;

      // Queue new drops with random stagger so they don't all land at once
      for (let i = 0; i < audioAnalysis.audioData.length; i++) {
        const level = audioAnalysis.audioData[i];
        const normalizedBand = i / 63;
        const bandScale = 0.5 + (normalizedBand * 0.5);
        let threshold = baseThreshold * bandScale;

        if (layoutMode === 1) {
          const tilt = 0.35;
          threshold *= 1 + tilt * (0.5 - normalizedBand);
        }

        let minInterval = 320 - (normalizedBand * 260); // bass: 320ms, treble: 60ms
        if (layoutMode === 1) {
          minInterval = 280 - (normalizedBand * 220);
        }

        if (level > threshold && now - this.lastDropTimes[i] > minInterval) {
          const amplitudeBoost = 1.0 + (1.0 - normalizedBand) * 0.5;
          const amplitude = Math.min((level / 255) * amplitudeBoost, 1.0);
          const staggerMs = Math.random() * 150;
          this.pendingDrops.push({ frequencyBand: i, amplitude, triggerAt: now + staggerMs });
          this.lastDropTimes[i] = now;
        }
      }

      // Drain the queue — max 3 new ripples per frame for a gentle, staggered feel
      const maxNewPerFrame = 3;
      let spawned = 0;
      for (let i = this.pendingDrops.length - 1; i >= 0 && spawned < maxNewPerFrame; i--) {
        if (now >= this.pendingDrops[i].triggerAt) {
          this.addRipple(this.pendingDrops[i].frequencyBand, this.pendingDrops[i].amplitude);
          this.pendingDrops.splice(i, 1);
          spawned++;
        }
      }
    }

    // --- Update existing ripples ---
    const now = performance.now();
    const thickness = this.config.ringThickness || 0.3;

    for (let i = this.rippleMeshes.length - 1; i >= 0; i--) {
      const mesh = this.rippleMeshes[i];
      const ripple = mesh.userData.ripple as Ripple;

      if (!ripple) continue;

      const age = (now - ripple.startTime) / 1000;
      const timeProgress = Math.min(age / ripple.lifetime, 1);

      if (timeProgress >= 1) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.rippleMeshes.splice(i, 1);

        const rippleIndex = this.ripples.indexOf(ripple);
        if (rippleIndex > -1) {
          this.ripples.splice(rippleIndex, 1);
        }
        continue;
      }

      // Ease-out: ring expands quickly then decelerates like real water
      const eased = 1 - Math.pow(1 - timeProgress, 2.2);
      const currentRadius = ripple.maxRadius * eased;

      const innerRadius = Math.max(0.01, currentRadius - thickness / 2);
      const outerRadius = currentRadius + thickness / 2;

      // Soft opacity: brief fade-in → hold → gradual fade-out from 40%
      let opacity = ripple.amplitude;
      const fadeInEnd = 0.06;
      const fadeOutStart = 0.40;
      if (timeProgress < fadeInEnd) {
        opacity *= timeProgress / fadeInEnd;
      } else if (timeProgress > fadeOutStart) {
        const t = (timeProgress - fadeOutStart) / (1 - fadeOutStart);
        opacity *= 1 - (t * t); // ease-in fade out (lingers then drops)
      }

      if (this.isPaused && this.pauseStartTime > 0) {
        const pauseDuration = (now - this.pauseStartTime) / 1000;
        const pauseFade = Math.max(0, 1 - (pauseDuration / 2));
        opacity *= pauseFade;
      }

      mesh.geometry.dispose();
      mesh.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }

    // --- Camera auto-rotation for 3D modes ---
    const surfaceMode = this.config.surfaceMode ?? 2;
    if (surfaceMode > 0 && !this.isDragging) {
      const speed = this.config.autoRotation ?? 0.003;
      this.cameraRotation.y += speed;
    }
    this.updateCameraPosition();
  }

  public render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private clearAllRipples(): void {
    if (!this.scene) return;

    for (const mesh of this.rippleMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.rippleMeshes = [];
    this.ripples = [];
    this.pendingDrops = [];
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
  }

  public destroy(): void {
    this.stopAnimationLoop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove mouse event listeners
    if (this.boundOnMouseDown) {
      this.container.removeEventListener('mousedown', this.boundOnMouseDown);
      this.boundOnMouseDown = null;
    }
    if (this.boundOnMouseMove) {
      window.removeEventListener('mousemove', this.boundOnMouseMove);
      this.boundOnMouseMove = null;
    }
    if (this.boundOnMouseUp) {
      window.removeEventListener('mouseup', this.boundOnMouseUp);
      this.boundOnMouseUp = null;
    }

    if (this.gridOverlay && this.scene) {
      this.scene.remove(this.gridOverlay);
      this.gridOverlay.geometry.dispose();
      (this.gridOverlay.material as THREE.Material).dispose();
      this.gridOverlay = null;
    }

    if (this.rowAxisOverlay && this.scene) {
      this.scene.remove(this.rowAxisOverlay);
      this.rowAxisOverlay.geometry.dispose();
      (this.rowAxisOverlay.material as THREE.Material).dispose();
      this.rowAxisOverlay = null;
    }

    if (this.surfaceMesh && this.scene) {
      this.scene.remove(this.surfaceMesh);
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
      this.surfaceMesh = null;
    }

    this.clearAllRipples();

    if (this.renderer) {
      this.renderer.domElement.style.filter = 'none';
      this.renderer.dispose();
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }

  public updateConfig(key: string, value: number): void {
    this.config[key] = value;

    if (key === 'layoutMode') {
      this.layoutMode = value;
      this.updateGridOverlay();

      if (value !== 2) {
        this.gridCellOrder = [];
        this.gridCursor = 0;
      }
    }

    if (key === 'showGridOverlay') {
      this.updateGridOverlay();
    }

    if (key === 'surfaceMode') {
      this.clearAllRipples();
      this.updateSurfaceMesh();
      this.updateGridOverlay();
      this.cameraRotation = { x: 0.3, y: 0 };
      this.updateCameraPosition();
    }

    if (key === 'glow' && this.renderer) {
      this.renderer.domElement.style.filter = value > 0 ? `blur(${value * 4}px)` : 'none';
    }
  }
}
