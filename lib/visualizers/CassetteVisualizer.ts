/**
 * Cassette Visualizer
 * 3D cassette tape model with audio-reactive spinning reels,
 * dynamic lighting, and camera orbit
 */

import * as THREE from 'three';
// @ts-ignore — three.js addons have no type declarations in this version
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class CassetteVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private cassetteModel: THREE.Group | null = null;
  private modelPivot: THREE.Group | null = null;
  private reelMeshes: THREE.Object3D[] = [];
  private reelAxis: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private lights: THREE.Light[] = [];
  private orbitLight: THREE.PointLight | null = null;
  private baseScale: number = 1;

  // Camera drag
  private cameraAngle = { theta: 0.3, phi: 1.2 };
  private cameraDistance = 5;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  // Audio smoothing
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedHigh = 0;
  private smoothedNorm = 0;
  private time = 0;
  private reelAngle = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Cassette';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Reel Speed',
        key: 'reelSpeed',
        min: 0.1,
        max: 5,
        step: 0.1,
        default: 1.0,
        value: this.config.reelSpeed ?? 1.0,
      },
      {
        name: 'Bass Wobble',
        key: 'bassWobble',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        value: this.config.bassWobble ?? 0.3,
      },
      {
        name: 'Light Orbit',
        key: 'lightOrbit',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.5,
        value: this.config.lightOrbit ?? 0.5,
      },
      {
        name: 'Light Intensity',
        key: 'lightIntensity',
        min: 0.5,
        max: 8,
        step: 0.1,
        default: 3,
        value: this.config.lightIntensity ?? 3,
      },
      {
        name: 'Bounce',
        key: 'bounce',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.2,
        value: this.config.bounce ?? 0.2,
      },
      {
        name: 'Auto Rotate',
        key: 'autoRotate',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0.003,
        value: this.config.autoRotate ?? 0.003,
      },
      {
        name: 'Tilt React',
        key: 'tiltReact',
        min: 0,
        max: 0.5,
        step: 0.01,
        default: 0.1,
        value: this.config.tiltReact ?? 0.1,
      },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      {
        name: 'Chill',
        config: { reelSpeed: 0.8, bassWobble: 0.15, lightOrbit: 0.3, lightIntensity: 2.5, bounce: 0.1, autoRotate: 0.002, tiltReact: 0.05 },
      },
      {
        name: 'Energetic',
        config: { reelSpeed: 3.0, bassWobble: 0.7, lightOrbit: 1.5, lightIntensity: 5, bounce: 0.6, autoRotate: 0.008, tiltReact: 0.3 },
      },
      {
        name: 'Minimal',
        config: { reelSpeed: 0.5, bassWobble: 0, lightOrbit: 0, lightIntensity: 2, bounce: 0, autoRotate: 0.001, tiltReact: 0 },
      },
    ];
  }

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    this.lights.push(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    this.lights.push(key);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);
    this.lights.push(fill);

    // Orbiting colored point light (audio-reactive)
    this.orbitLight = new THREE.PointLight(0xff6633, 3, 15);
    this.orbitLight.position.set(3, 2, 0);
    this.scene.add(this.orbitLight);
    this.lights.push(this.orbitLight);

    // Camera position
    this.updateCameraPosition();

    // Load model
    this.loadModel();

    // Mouse/touch controls
    this.setupMouseControls();

    // Resize
    const handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    // Detect basePath: check Next.js runtime data, then infer from URL path
    let basePath = '';
    if (typeof window !== 'undefined') {
      basePath = (window as any).__NEXT_DATA__?.basePath
        ?? (window.location.pathname.startsWith('/ptc-player') ? '/ptc-player' : '');
    }
    const modelPath = `${basePath}/models/cassette_tape.glb`;
    console.log('[Cassette] Loading model from:', modelPath);

    loader.load(
      modelPath,
      (gltf: any) => {
        console.log('[Cassette] Model loaded successfully');
        const model = gltf.scene as THREE.Group;

        // Log all mesh/object names for debugging
        model.traverse((child) => {
          console.log('[Cassette] Node:', child.name, child.type);
        });

        // Calculate bounding box BEFORE any transforms
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        this.baseScale = 3 / maxDim;

        // Create a pivot group: center the model, then scale the pivot
        this.modelPivot = new THREE.Group();
        model.position.set(-center.x, -center.y, -center.z);
        this.modelPivot.add(model);
        this.modelPivot.scale.setScalar(this.baseScale);

        this.cassetteModel = model;

        // Find reel meshes
        this.findReels(model);

        this.scene!.add(this.modelPivot);
      },
      (progress: any) => {
        console.log('[Cassette] Loading progress:', progress?.loaded, '/', progress?.total);
      },
      (error: unknown) => {
        console.error('[Cassette] Failed to load model:', error);
      }
    );
  }

  private findReels(model: THREE.Group): void {
    // Look for objects that are likely reels by name
    const reelKeywords = ['reel', 'spool', 'hub', 'wheel', 'roller', 'spindle', 'cylinder', 'gear', 'sprocket'];
    model.traverse((child) => {
      const name = child.name.toLowerCase();
      if (reelKeywords.some((kw) => name.includes(kw))) {
        this.reelMeshes.push(child);
        console.log('[Cassette] Found reel by name:', child.name);
      }
    });

    // If no named reels found, don't guess — just skip reel spinning
    if (this.reelMeshes.length > 0) {
      // Detect the rotation axis from the first reel's local orientation
      // For a cassette viewed from front, reels typically spin around Z or Y
      console.log('[Cassette] Found', this.reelMeshes.length, 'reel meshes');
    } else {
      console.log('[Cassette] No reel meshes found by name — reel spinning disabled');
    }
  }

  private setupMouseControls(): void {
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.container.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.cameraAngle.theta -= dx * 0.005;
      this.cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraAngle.phi - dy * 0.005));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.updateCameraPosition();
    };

    const onPointerUp = () => {
      this.isDragging = false;
      this.container.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(2, Math.min(12, this.cameraDistance + e.deltaY * 0.01));
      this.updateCameraPosition();
    };

    this.container.addEventListener('pointerdown', onPointerDown);
    this.container.addEventListener('pointermove', onPointerMove);
    this.container.addEventListener('pointerup', onPointerUp);
    this.container.addEventListener('pointerleave', onPointerUp);
    this.container.addEventListener('wheel', onWheel, { passive: false });
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const { theta, phi } = this.cameraAngle;
    const d = this.cameraDistance;
    this.camera.position.set(
      d * Math.sin(phi) * Math.sin(theta),
      d * Math.cos(phi),
      d * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(0, 0, 0);
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    const { bassAvg, midAvg, highAvg, normalizedFrequency, isPlaying } = audioAnalysis;
    const lerp = 0.08;

    if (isPlaying) {
      this.smoothedBass += ((bassAvg / 255) - this.smoothedBass) * lerp;
      this.smoothedMid += ((midAvg / 255) - this.smoothedMid) * lerp;
      this.smoothedHigh += ((highAvg / 255) - this.smoothedHigh) * lerp;
      this.smoothedNorm += (normalizedFrequency - this.smoothedNorm) * lerp;
    } else {
      this.smoothedBass *= 0.95;
      this.smoothedMid *= 0.95;
      this.smoothedHigh *= 0.95;
      this.smoothedNorm *= 0.95;
    }

    this.time += 0.016;
  }

  render(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    const reelSpeed = this.config.reelSpeed ?? 1.0;
    const bassWobble = this.config.bassWobble ?? 0.3;
    const lightOrbit = this.config.lightOrbit ?? 0.5;
    const lightIntensity = this.config.lightIntensity ?? 3;
    const bounce = this.config.bounce ?? 0.2;
    const autoRotate = this.config.autoRotate ?? 0.003;
    const tiltReact = this.config.tiltReact ?? 0.1;

    // Auto-rotate camera
    if (!this.isDragging && autoRotate > 0) {
      this.cameraAngle.theta += autoRotate;
      this.updateCameraPosition();
    }

    // Spin reels — faster with bass (rotate around local Y axis)
    const spinSpeed = reelSpeed * (0.5 + this.smoothedBass * 2);
    this.reelAngle += spinSpeed * 0.05;
    for (const reel of this.reelMeshes) {
      reel.rotation.y = this.reelAngle;
    }

    // Apply effects to the pivot group (not the model itself)
    if (this.modelPivot) {
      // Bass wobble: slight scale pulse
      const wobbleScale = 1 + this.smoothedBass * bassWobble * 0.15;
      this.modelPivot.scale.setScalar(this.baseScale * wobbleScale);

      // Bounce: vertical displacement
      const bounceY = Math.sin(this.time * 3) * this.smoothedBass * bounce * 0.3;
      this.modelPivot.position.y = bounceY;

      // Tilt react: model tilts based on mid frequencies
      this.modelPivot.rotation.x = this.smoothedMid * tiltReact * 0.5;
      this.modelPivot.rotation.z = Math.sin(this.time * 2) * this.smoothedHigh * tiltReact * 0.3;
    }

    // Orbit light — moves around the cassette, color shifts with audio
    if (this.orbitLight) {
      const orbitRadius = 3 + this.smoothedBass * 2;
      const orbitSpeed = lightOrbit * (0.5 + this.smoothedMid);
      this.orbitLight.position.x = Math.cos(this.time * orbitSpeed) * orbitRadius;
      this.orbitLight.position.z = Math.sin(this.time * orbitSpeed) * orbitRadius;
      this.orbitLight.position.y = 2 + Math.sin(this.time * 1.5) * 1;
      this.orbitLight.intensity = lightIntensity * (0.6 + this.smoothedNorm * 0.8);

      // Color shifts: dominant → accent based on audio energy
      const dominantRGB = this.parseHexOrRGBToColor(this.colors.dominant);
      const accentRGB = this.parseHexOrRGBToColor(this.colors.accent);
      const mix = this.smoothedNorm;
      this.orbitLight.color.setRGB(
        dominantRGB.r + (accentRGB.r - dominantRGB.r) * mix,
        dominantRGB.g + (accentRGB.g - dominantRGB.g) * mix,
        dominantRGB.b + (accentRGB.b - dominantRGB.b) * mix
      );
    }

    this.renderer.render(this.scene, this.camera);
  }

  private parseHexOrRGBToColor(color: string): { r: number; g: number; b: number } {
    // Handle rgb(r, g, b) format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]) / 255,
        g: parseInt(rgbMatch[2]) / 255,
        b: parseInt(rgbMatch[3]) / 255,
      };
    }
    // Handle hex
    const c = new THREE.Color(color);
    return { r: c.r, g: c.g, b: c.b };
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
  }

  destroy(): void {
    this.stopAnimationLoop();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }

    if (this.scene) {
      this.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cassetteModel = null;
    this.modelPivot = null;
    this.reelMeshes = [];
    this.lights = [];
    this.orbitLight = null;
  }
}
