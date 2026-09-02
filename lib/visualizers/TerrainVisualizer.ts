/**
 * Terrain Visualizer
 * 3D audio wave terrain with history
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class TerrainVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private accentLight: THREE.DirectionalLight | null = null;
  private waveHistory: number[][] = [];
  private lastUpdateTime: number = 0;
  private segmentsX: number = 64;
  private segmentsZ: number = 40; // Reduced for better performance
  private cameraRotation = { x: 0.7, y: 0 };
  private cameraDistance = 9.5;
  private zoomPhase = Math.asin((9.5 - 10) / 5);
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private frameCount: number = 0;
  // Cube (voxel) mode
  private cubeMesh: THREE.InstancedMesh | null = null;
  private cubeGeometry: THREE.BoxGeometry | null = null;
  private cubeMaterial: THREE.MeshPhongMaterial | null = null;
  private cubeHeights: Float32Array = new Float32Array(0);
  private cubeGrid: number = 32;
  private cubeDummy = new THREE.Object3D();
  private cubeColor = new THREE.Color();
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Terrain';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Render Mode',
        key: 'renderMode',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        value: this.config.renderMode ?? 0,
        labels: ['Mesh', 'Cubes']
      },
      {
        name: 'Wave Amplitude',
        key: 'amplitude',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2.0,
        value: this.config.amplitude || 2.0
      },
      {
        name: 'Wave Speed',
        key: 'speed',
        min: 0.5,
        max: 20,
        step: 0.5,
        default: 17.5,
        value: this.config.speed || 17.5
      },
      {
        name: 'Wave Decay',
        key: 'decay',
        min: 0.85,
        max: 0.99,
        step: 0.01,
        default: 0.95,
        value: this.config.decay || 0.95
      },
      {
        name: 'Auto Rotation',
        key: 'autoRotation',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.002,
        value: this.config.autoRotation ?? 0.002
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
        name: 'Segments',
        key: 'segments',
        min: 32,
        max: 256,
        step: 32,
        default: 64,
        value: this.config.segments ?? 64
      },
      {
        name: 'Sine Base',
        key: 'sineAmplitude',
        min: 0,
        max: 1.5,
        step: 0.05,
        default: 0.3,
        value: this.config.sineAmplitude ?? 0.3
      },
      {
        name: 'Cube Grid',
        key: 'cubeGrid',
        min: 8,
        max: 64,
        step: 4,
        default: 32,
        value: this.config.cubeGrid ?? 32
      },
      {
        name: 'Cube Gap',
        key: 'cubeGap',
        min: 0,
        max: 0.7,
        step: 0.05,
        default: 0.15,
        value: this.config.cubeGap ?? 0.15
      },
      {
        name: 'Cube Steps',
        key: 'cubeSteps',
        min: 0,
        max: 16,
        step: 1,
        default: 0,
        value: this.config.cubeSteps ?? 0
      },
      {
        name: 'Cube Height',
        key: 'cubeHeight',
        min: 0.2,
        max: 4,
        step: 0.1,
        default: 1.5,
        value: this.config.cubeHeight ?? 1.5
      },
      {
        name: 'Cube Rise',
        key: 'cubeRise',
        min: 0.05,
        max: 1,
        step: 0.05,
        default: 0.25,
        value: this.config.cubeRise ?? 0.25
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
  
  getPresets(): VisualizerPreset[] {
    return [
      { name: '1', config: { renderMode: 0, amplitude: 3.9, speed: 17.5, decay: 0.95, autoRotation: 0.0005, zoomSpeed: 0, segments: 64, sineAmplitude: 0.3, hue: 0, harmonyMode: 0 } },
      { name: '2', config: { renderMode: 0, amplitude: 2.4, speed: 6, decay: 0.98, autoRotation: 0.001, zoomSpeed: 0, segments: 96, sineAmplitude: 0.9, hue: 0, harmonyMode: 1 } },
      { name: '3', config: { renderMode: 0, amplitude: 5, speed: 25, decay: 0.88, autoRotation: 0.0005, zoomSpeed: 0, segments: 160, sineAmplitude: 0.1, hue: 0, harmonyMode: 2 } },
      { name: '4', config: { renderMode: 0, amplitude: 3.5, speed: 14, decay: 0.95, autoRotation: 0.004, zoomSpeed: 0.004, segments: 64, sineAmplitude: 0.5, hue: 0, harmonyMode: 1 } },
      { name: '5', config: { renderMode: 1, amplitude: 3.2, speed: 12, decay: 0.96, autoRotation: 0.002, zoomSpeed: 0, segments: 64, sineAmplitude: 0.25, cubeGrid: 32, cubeGap: 0.15, cubeSteps: 0, cubeHeight: 1.5, cubeRise: 0.25, hue: 0, harmonyMode: 1 } },
      { name: '6', config: { renderMode: 1, amplitude: 4.2, speed: 8, decay: 0.97, autoRotation: 0.001, zoomSpeed: 0, segments: 64, sineAmplitude: 0.1, cubeGrid: 16, cubeGap: 0, cubeSteps: 8, cubeHeight: 2.2, cubeRise: 0.35, hue: 0, harmonyMode: 0 } },
    ];
  }

  init(): void {
    // Use container directly - get dimensions
    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 600;
    
    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false, // Disable for performance
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(containerWidth, containerHeight);
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    // Sync live cameraDistance from config
    this.cameraDistance = this.config.cameraDistance || 9.5;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));

    // Initial camera position
    this.updateCameraPosition();

    // Create plane geometry
    this.segmentsX = this.config.segments ?? 64;
    const planeWidth = 10;
    const depth = 20;
    this.geometry = new THREE.PlaneGeometry(
      planeWidth,
      depth,
      this.segmentsX - 1,
      this.segmentsZ - 1
    );
    this.geometry.rotateX(-Math.PI / 2);
    
    // Initialize wave history
    for (let i = 0; i < this.segmentsZ; i++) {
      this.waveHistory.push(new Array(this.segmentsX).fill(0));
    }
    
    // Create vertex colors
    const positions = this.geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);
    
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = dominantRGB.r;
      colors[i * 3 + 1] = dominantRGB.g;
      colors[i * 3 + 2] = dominantRGB.b;
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Add lighting for depth perception
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 5);
    this.scene.add(directionalLight1);
    
    this.accentLight = new THREE.DirectionalLight(new THREE.Color(this.colors.accent), 0.4);
    this.accentLight.position.set(-5, 5, -5);
    this.scene.add(this.accentLight);
    
    // Create material with lighting
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
      shininess: 30,
      flatShading: false
    });
    
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.z = -depth / 2;
    this.scene.add(this.mesh);

    // Cube (voxel) mode geometry — shares the same wave history as the mesh
    this.cubeGrid = this.config.cubeGrid ?? 32;
    this.buildCubes();
    this.applyRenderMode();

    this.lastUpdateTime = Date.now();
    
    // Add mouse/touch controls
    this.setupCameraControls(this.container);

    // Handle resize
    const handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    
    // Animation loop handled by base class start() method
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
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { this.isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(5, Math.min(15, this.cameraDistance + e.deltaY * 0.01));
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
          this.cameraDistance = Math.max(5, Math.min(15, this.cameraDistance + (pinchDist - dist) * 0.05));
          this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
        }
        pinchDist = dist;
      } else if (this.isDragging) {
        const pos = e.touches[0];
        this.cameraRotation.y += (pos.clientX - this.lastMousePos.x) * 0.005;
        this.cameraRotation.x += (pos.clientY - this.lastMousePos.y) * 0.005;
        this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
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
  }
  
  private updateCameraPosition(): void {
    if (!this.camera) return;

    const zoomSpeed = this.config.zoomSpeed ?? 0;
    if (zoomSpeed > 0) {
      this.zoomPhase += zoomSpeed;
      this.cameraDistance = 10 + 5 * Math.sin(this.zoomPhase);
    }

    if (!this.isDragging) {
      this.cameraRotation.y += this.config.autoRotation ?? 0.0005;
    }

    const d = this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x);
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, -5);
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

  private resampleData(data: Uint8Array | number[], targetLength: number): number[] {
    const result = new Array(targetLength);
    const ratio = data.length / targetLength;
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, data.length - 1);
      const frac = srcIndex - low;
      result[i] = data[low] * (1 - frac) + data[high] * frac;
    }
    return result;
  }

  private rebuildGeometry(): void {
    if (!this.scene || !this.mesh) return;

    if (this.geometry) {
      this.geometry.dispose();
    }

    const planeWidth = 10;
    const depth = 20;
    this.geometry = new THREE.PlaneGeometry(
      planeWidth,
      depth,
      this.segmentsX - 1,
      this.segmentsZ - 1
    );
    this.geometry.rotateX(-Math.PI / 2);

    // Reset wave history
    this.waveHistory = [];
    for (let i = 0; i < this.segmentsZ; i++) {
      this.waveHistory.push(new Array(this.segmentsX).fill(0));
    }

    // Recreate vertex colors
    const positions = this.geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = dominantRGB.r;
      colors[i * 3 + 1] = dominantRGB.g;
      colors[i * 3 + 2] = dominantRGB.b;
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.mesh.geometry = this.geometry;
  }

  /**
   * Build (or rebuild) the instanced cube field used by Cubes render mode.
   * The field is a square grid centred on the camera's look-at point; each
   * instance is a unit box anchored at its base so scaling Y grows it upward.
   */
  private buildCubes(): void {
    if (!this.scene) return;

    this.disposeCubes();

    const grid = this.cubeGrid;
    const count = grid * grid;

    this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.cubeGeometry.translate(0, 0.5, 0);

    this.cubeMaterial = new THREE.MeshPhongMaterial({
      shininess: 20,
      flatShading: true
    });

    this.cubeMesh = new THREE.InstancedMesh(this.cubeGeometry, this.cubeMaterial, count);
    this.cubeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cubeMesh.frustumCulled = false;

    // Seed instance colors so nothing renders black before the first update
    const { r, g, b } = this.parseRGB(this.colors.dominant);
    this.cubeColor.setRGB(r, g, b);
    for (let i = 0; i < count; i++) {
      this.cubeMesh.setColorAt(i, this.cubeColor);
    }

    this.cubeHeights = new Float32Array(count);
    this.scene.add(this.cubeMesh);
  }

  private disposeCubes(): void {
    if (this.cubeMesh) {
      this.scene?.remove(this.cubeMesh);
      this.cubeMesh.dispose();
      this.cubeMesh = null;
    }
    if (this.cubeGeometry) {
      this.cubeGeometry.dispose();
      this.cubeGeometry = null;
    }
    if (this.cubeMaterial) {
      this.cubeMaterial.dispose();
      this.cubeMaterial = null;
    }
    this.cubeHeights = new Float32Array(0);
  }

  private isCubeMode(): boolean {
    return Math.round(this.config.renderMode ?? 0) === 1;
  }

  private applyRenderMode(): void {
    const cubes = this.isCubeMode();
    if (this.mesh) this.mesh.visible = !cubes;
    if (this.cubeMesh) this.cubeMesh.visible = cubes;
  }

  /**
   * Animate the cube field: each column eases toward the height sampled from
   * the scrolling wave history, so new audio rises at the front and decays as
   * it travels back through the grid.
   */
  private updateCubes(
    amplitude: number,
    decayFactors: number[],
    sineAmp: number,
    time: number,
    dominantRGB: { r: number; g: number; b: number },
    accentRGB: { r: number; g: number; b: number }
  ): void {
    if (!this.cubeMesh) return;

    const grid = this.cubeGrid;
    const fieldSize = 10;
    const cell = fieldSize / grid;
    const gap = this.config.cubeGap ?? 0.15;
    const footprint = cell * (1 - gap);
    const rise = this.config.cubeRise ?? 0.25;
    const steps = Math.round(this.config.cubeSteps ?? 0);
    const heightScale = this.config.cubeHeight ?? 1.5;
    const stepSize = steps > 0 ? ((amplitude + sineAmp) * heightScale) / steps : 0;
    const minHeight = cell * 0.35;
    const centerZ = -5;

    for (let row = 0; row < grid; row++) {
      // Row 0 is the newest wave and sits at the far end of the field, so
      // waves travel toward the viewer exactly as they do in mesh mode.
      const historyRow = Math.min(
        this.segmentsZ - 1,
        Math.round((row / Math.max(1, grid - 1)) * (this.segmentsZ - 1))
      );
      const decayFactor = decayFactors[historyRow];
      const wave = this.waveHistory[historyRow];
      const zNorm = (row / Math.max(1, grid - 1)) * 2 - 1;
      const z = centerZ - fieldSize / 2 + (row + 0.5) * cell;

      for (let col = 0; col < grid; col++) {
        const index = row * grid + col;
        const xNorm = (col / Math.max(1, grid - 1)) * 2 - 1;
        const x = -fieldSize / 2 + (col + 0.5) * cell;

        const srcX = Math.min(
          this.segmentsX - 1,
          Math.round((col / Math.max(1, grid - 1)) * (this.segmentsX - 1))
        );
        const waveHeight = (wave?.[srcX] || 0) * decayFactor;

        const sineBase = sineAmp * (
          Math.sin(xNorm * Math.PI * 2 + time * 0.5) * 0.6 +
          Math.cos(zNorm * Math.PI * 1.5 + time * 0.3) * 0.4
        );

        // Ease toward the target height so cubes rise and fall smoothly
        const target = Math.max(minHeight, (waveHeight + sineBase) * heightScale + minHeight);
        const current = this.cubeHeights[index] + (target - this.cubeHeights[index]) * rise;
        this.cubeHeights[index] = current;

        const height = steps > 0
          ? Math.max(minHeight, Math.round(current / stepSize) * stepSize)
          : current;

        this.cubeDummy.position.set(x, 0, z);
        this.cubeDummy.scale.set(footprint, height, footprint);
        this.cubeDummy.updateMatrix();
        this.cubeMesh.setMatrixAt(index, this.cubeDummy.matrix);

        const heightIntensity = Math.min(1, Math.abs(waveHeight) / amplitude);
        this.cubeColor.setRGB(
          dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity,
          dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity,
          dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity
        );
        this.cubeMesh.setColorAt(index, this.cubeColor);
      }
    }

    this.cubeMesh.instanceMatrix.needsUpdate = true;
    if (this.cubeMesh.instanceColor) {
      this.cubeMesh.instanceColor.needsUpdate = true;
    }
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.geometry || !this.camera) return;
    
    const { audioData } = audioAnalysis;
    const amplitude = this.config.amplitude || 2.0;
    const speed = this.config.speed || 1.0;
    const decay = this.config.decay || 0.95;
    
    const currentTime = Date.now();
    const updateInterval = 1000 / speed;
    
    // Update camera position
    this.updateCameraPosition();
    
    // Update wave history at specified interval
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      // Shift all waves back
      this.waveHistory.pop();
      
      // Create new wave from audio data, smoothed for a cleaner terrain
      const resampled = this.resampleData(audioData, this.segmentsX);
      const rawWave = resampled.map(value => (value / 255) * amplitude);
      const newWave = this.smoothWave(rawWave, 3);
      this.waveHistory.unshift(newWave);
      
      this.lastUpdateTime = currentTime;
    }
    
    // Skip geometry updates on some frames for performance (update every 2 frames)
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;
    
    // Update geometry vertices
    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const hue = this.config.hue ?? 0;
    const { dominant: domStr, accent: accStr } = this.harmonyColorScheme(this.config.harmonyMode ?? 0, hue);
    const domParsed = this.parseRGB(domStr);
    const accParsed = this.parseRGB(accStr);
    const domColor = new THREE.Color(domParsed.r, domParsed.g, domParsed.b);
    const accColor = new THREE.Color(accParsed.r, accParsed.g, accParsed.b);
    const dominantRGB = { r: domColor.r, g: domColor.g, b: domColor.b };
    const accentRGB = { r: accColor.r, g: accColor.g, b: accColor.b };
    
    // Pre-calculate decay factors
    const decayFactors: number[] = [];
    for (let z = 0; z < this.segmentsZ; z++) {
      decayFactors[z] = Math.pow(decay, z);
    }
    
    // Sine wave base parameters
    const sineAmp = this.config.sineAmplitude ?? 0.3;
    const time = Date.now() * 0.001;

    // Cube mode renders the same wave history as an instanced voxel field
    if (this.isCubeMode()) {
      this.updateCubes(amplitude, decayFactors, sineAmp, time, dominantRGB, accentRGB);
      return;
    }

    // Update vertices
    for (let z = 0; z < this.segmentsZ; z++) {
      const decayFactor = decayFactors[z];
      const zNorm = (z / (this.segmentsZ - 1)) * 2 - 1;

      for (let x = 0; x < this.segmentsX; x++) {
        const index = z * this.segmentsX + x;
        const xNorm = (x / (this.segmentsX - 1)) * 2 - 1;

        // Get wave height from history
        let waveHeight = (this.waveHistory[z]?.[x] || 0) * decayFactor;

        // Ambient sine wave base displacement
        const sineBase = sineAmp * (
          Math.sin(xNorm * Math.PI * 2 + time * 0.5) * 0.6 +
          Math.cos(zNorm * Math.PI * 1.5 + time * 0.3) * 0.4
        );

        // Update Y position
        positions.setY(index, waveHeight + sineBase);

        // Update color based on audio height
        const heightIntensity = Math.min(1, Math.abs(waveHeight) / amplitude);
        const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity;
        const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity;
        const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity;
        colorAttr.setXYZ(index, r, g, b);
      }
    }
    
    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
    this.geometry.computeVertexNormals(); // Compute normals for proper lighting
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
    // Repaint all vertices immediately so rows not covered by the per-frame
    // update don't stay stuck on the default grey from init().
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

    if (key === 'segments') {
      this.segmentsX = value;
      this.rebuildGeometry();
    }
    if (key === 'cameraDistance') {
      this.cameraDistance = value;
      this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (value - 10) / 5)));
    }
    if (key === 'cubeGrid') {
      this.cubeGrid = Math.max(2, Math.round(value));
      this.buildCubes();
      this.applyRenderMode();
    }
    if (key === 'renderMode') {
      this.applyRenderMode();
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
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.mesh && this.mesh.material) {
      (this.mesh.material as THREE.Material).dispose();
    }
    this.disposeCubes();
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.mesh = null;
    this.waveHistory = [];
    
    this.container.innerHTML = '';
  }
}
