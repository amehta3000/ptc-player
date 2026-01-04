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
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

interface Ripple {
  position: THREE.Vector2;
  startTime: number;
  amplitude: number;
  maxRadius: number;
  speed: number;
  frequencyBand: number; // 0-63 from audioData array
  color: THREE.Color;
}

export class RaindropsVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private ripples: Ripple[] = [];
  private rippleMeshes: THREE.Mesh[] = [];
  private lastDropTimes: number[] = new Array(64).fill(0); // Track last drop time per frequency band
  private isPaused = false;
  private pauseStartTime = 0;
  private layoutMode: number = 0; // 0=rainfall, 1=row, 2=grid, 3=spiral
  private resizeObserver: ResizeObserver | null = null;
  private gridOverlay: THREE.LineSegments | null = null;
  private rowAxisOverlay: THREE.LineSegments | null = null;
  private gridCellOrder: number[] = [];
  private gridCursor = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Raindrops';
  }

  getControls(): VisualizerControl[] {
    return [
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
        name: 'Bass Threshold',
        key: 'bassThreshold',
        min: 0.1,
        max: 0.8,
        step: 0.05,
        default: 0.1,
        value: this.config.bassThreshold ?? 0.1
      },
      {
        name: 'Drizzle Rate',
        key: 'drizzleRate',
        min: 0.05,
        max: 0.5,
        step: 0.05,
        default: 0.05,
        value: this.config.drizzleRate ?? 0.05
      },
      {
        name: 'Plane Size',
        key: 'planeSize',
        min: 10,
        max: 40,
        step: 2,
        default: 40,
        value: this.config.planeSize ?? 40
      },
      {
        name: 'Intensity',
        key: 'intensity',
        min: 0.5,
        max: 3,
        step: 0.1,
        default: 0.8,
        value: this.config.intensity ?? 0.8
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
      {
        name: 'Layout Mode',
        key: 'layoutMode',
        min: 0,
        max: 3,
        step: 1,
        default: 0,
        value: this.config.layoutMode ?? 0
      },
      {
        name: 'Show Grid Overlay',
        key: 'showGridOverlay',
        min: 0,
        max: 1,
        step: 1,
        default: 1,
        value: this.config.showGridOverlay ?? 1
      }
    ];
  }

  protected initScene(): void {
    // Scene
    this.scene = new THREE.Scene();

    // Camera - looking straight down at the water
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 20, 0);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.observeResize();
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

    const layoutMode = this.config.layoutMode || 0;
    const showOverlay = (this.config.showGridOverlay ?? 1) > 0;
    if (!showOverlay) return;

    // Grid overlay (only in grid mode)
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

        // vertical lines (x constant)
        positions.push(x, 0.01, -insetY, x, 0.01, insetY);
        // horizontal lines (y constant)
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

    // Row axis overlay (only in row mode)
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
      // Original behavior: stable mapping band -> cell
      return frequencyBand % cells;
    }

    const idx = this.gridCellOrder[this.gridCursor % cells];
    this.gridCursor++;
    return idx;
  }

  private addRipple(frequencyBand: number, amplitude: number): void {
    if (this.ripples.length >= (this.config.maxRipples || 128)) {
      return;
    }

    const layoutMode = this.config.layoutMode || 0;
    const { halfWidth, halfHeight } = this.getLayoutBounds();
    const insetX = halfWidth * 0.9;
    const insetY = halfHeight * 0.9;
    let position: THREE.Vector2;

    // Layout modes: 0=rainfall, 1=row, 2=grid, 3=spiral
    switch (layoutMode) {
      case 1: // Single row - low to high frequencies left to right
        {
          const normalizedBand = frequencyBand / 63;
          const x = -insetX + (normalizedBand * insetX * 2);
          const y = 0;
          position = new THREE.Vector2(x, y);
        }
        break;
      
      case 2: // Grid view - 8x8 grid
        {
          const cell = this.getGridCellIndex(frequencyBand);
          const row = Math.floor(cell / 8);
          const col = cell % 8;
          const x = (col / 7 - 0.5) * insetX * 2;
          const y = (row / 7 - 0.5) * insetY * 2;
          position = new THREE.Vector2(x, y);
        }
        break;
      
      case 3: // Spiral - frequencies spiral outward from center
        {
          const normalizedBand = frequencyBand / 63;
          const angle = normalizedBand * Math.PI * 8; // 4 full rotations
          const radius = normalizedBand * Math.min(insetX, insetY) * 0.85;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          position = new THREE.Vector2(x, y);
        }
        break;
      
      case 0: // Rainfall (random)
      default:
        position = new THREE.Vector2(
          (Math.random() - 0.5) * insetX * 2,
          (Math.random() - 0.5) * insetY * 2
        );
        break;
    }

    // Map frequency band (0-63) to ripple characteristics
    // Low frequencies (0-15): Large, slow ripples
    // Mid frequencies (16-47): Medium ripples
    // High frequencies (48-63): Small, fast ripples
    const normalizedBand = frequencyBand / 63;
    
    const maxRadius = 8 - (normalizedBand * 6); // 8 for bass, 2 for treble
    const speed = 1.5 + (normalizedBand * 2); // 1.5 for bass, 3.5 for treble
    
    // Create color based on frequency with varying saturation
    // Hue: Blue (bass) -> Cyan -> Green -> Yellow -> Red (treble)
    const hue = normalizedBand * 0.7; // 0 (blue) to 0.7 (red)
    const saturation = 0.8 + (normalizedBand * 0.2); // More saturated for higher frequencies
    const lightness = 0.5 + (amplitude * 0.3); // Brighter for louder sounds
    
    const color = new THREE.Color().setHSL(hue, saturation, lightness);

    const ripple: Ripple = {
      position,
      startTime: performance.now(),
      amplitude: amplitude * (this.config.intensity || 1.5),
      maxRadius,
      speed,
      frequencyBand,
      color,
    };

    this.ripples.push(ripple);
    this.createRippleMesh(ripple);
  }

  private createRippleMesh(ripple: Ripple): void {
    if (!this.scene) return;

    // Create a ring geometry
    const segments = 64;
    const geometry = new THREE.RingGeometry(0.01, 0.02, segments);

    const material = new THREE.MeshBasicMaterial({
      color: ripple.color,
      transparent: true,
      opacity: ripple.amplitude,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(ripple.position.x, 0, ripple.position.y);
    mesh.rotation.x = -Math.PI / 2;
    
    // Store reference to ripple in userData
    mesh.userData.ripple = ripple;
    
    this.scene.add(mesh);
    this.rippleMeshes.push(mesh);
  }

  public init(): void {
    this.initScene();
  }

  public setAudioData(audioData: AudioAnalysis): void {
    this.currentAudioAnalysis = audioData;

    // Check if music is playing based on audio activity
    const totalLevel = (audioData.bassAvg + audioData.midAvg + audioData.highAvg) / 3;

    const shouldPause = totalLevel < 5 || !audioData.isPlaying;
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

    // While paused, keep updating existing ripples (fade-out happens in update()).
    // Just stop spawning new ripples.
    if (this.isPaused) {
      return;
    }

    const now = performance.now();
    const baseThreshold = (this.config.bassThreshold || 0.3) * 255;
    const layoutMode = this.config.layoutMode || 0;
    
    // Check each frequency band and create ripple if threshold exceeded
    for (let i = 0; i < audioData.audioData.length; i++) {
      const level = audioData.audioData[i];
      
      // Dynamic threshold based on frequency band
      // Lower frequencies need lower threshold (kicks/bass are important)
      // Higher frequencies need higher threshold (to avoid noise)
      const normalizedBand = i / 63;
      let threshold = baseThreshold + (normalizedBand * baseThreshold * 0.5);

      // Row layout should show more detail in mid/highs:
      // nudge lows to require a bit more energy and let highs trigger a bit easier.
      if (layoutMode === 1) {
        const tilt = 0.35; // how much we bias towards highs (0..~0.6)
        threshold *= 1 + tilt * (0.5 - normalizedBand);
      }
      
      // Only create ripple if:
      // 1. This specific band's level is above its threshold
      // 2. Enough time has passed since last drop for this band (debounce)
      let minInterval = 100 + (i * 3); // default behavior

      // In row layout, allow highs to drop faster and tame the bass.
      if (layoutMode === 1) {
        const lowSlow = 260;
        const highFast = 60;
        minInterval = lowSlow - (normalizedBand * (lowSlow - highFast));
      }
      
      if (level > threshold && now - this.lastDropTimes[i] > minInterval) {
        const amplitude = Math.min(level / 255, 1.0);
        this.addRipple(i, amplitude);
        this.lastDropTimes[i] = now;
      }
    }
  }

  public update(audioAnalysis: AudioAnalysis): void {
    if (!this.scene) return;

    const now = performance.now();
    const thickness = this.config.ringThickness || 0.3;

    // Update all ripples (continue even when paused to allow fade out)
    for (let i = this.rippleMeshes.length - 1; i >= 0; i--) {
      const mesh = this.rippleMeshes[i];
      const ripple = mesh.userData.ripple as Ripple;
      
      if (!ripple) continue;

      const age = (now - ripple.startTime) / 1000;
      const currentRadius = age * ripple.speed;
      const progress = currentRadius / ripple.maxRadius;

      if (progress >= 1) {
        // Remove expired ripple
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

      // Update ring size
      const innerRadius = Math.max(0.01, currentRadius - thickness / 2);
      const outerRadius = currentRadius + thickness / 2;
      
      // Fade out as it expands
      const fadeStart = 0.6;
      let opacity = ripple.amplitude;
      if (progress > fadeStart) {
        opacity *= 1 - ((progress - fadeStart) / (1 - fadeStart));
      }
      
      // If paused, gradually fade out all ripples over 2 seconds
      if (this.isPaused && this.pauseStartTime > 0) {
        const pauseDuration = (now - this.pauseStartTime) / 1000;
        const pauseFade = Math.max(0, 1 - (pauseDuration / 2)); // Fade over 2 seconds
        opacity *= pauseFade;
      }
      
      // Recreate geometry with new size
      mesh.geometry.dispose();
      mesh.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
      
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  public render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public destroy(): void {
    this.stopAnimationLoop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
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

    // Clean up ripple meshes
    for (const mesh of this.rippleMeshes) {
      if (this.scene) {
        this.scene.remove(mesh);
      }
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.rippleMeshes = [];
    this.ripples = [];

    if (this.renderer) {
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
    
    // Update layout mode immediately
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
    // Config changes will apply to new ripples automatically
  }
}
