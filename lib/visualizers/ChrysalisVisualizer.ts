/**
 * Chrysalis Visualizer
 * Spherical frequency contours with vertical slice loops
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class ChrysalisVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private chrysalisGroup: THREE.Group | null = null;
  private loops: Array<{
    loop: THREE.LineLoop;
    baseY: number;
    baseRadius: number;
    freqIndex: number;
    vertices: number;
    seed: number;
  }> = [];
  private userRotation = { x: -0.8, y: 0.3 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Chrysalis';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Contour Loops',
        key: 'slices',
        min: 16,
        max: 64,
        step: 8,
        default: 56,
        value: this.config.slices || 56
      },
      {
        name: 'Noise Scale',
        key: 'waviness',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.05,
        value: this.config.waviness || 0.05
      },
      {
        name: 'Rotation Speed',
        key: 'rotationSpeed',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.003,
        value: this.config.rotationSpeed || 0.003
      },
      {
        name: 'Pulse Intensity',
        key: 'pulseIntensity',
        min: 0,
        max: 1.5,
        step: 0.1,
        default: 0.7,
        value: this.config.pulseIntensity || 0.7
      },
      {
        name: 'Line Thickness',
        key: 'lineThickness',
        min: 0.5,
        max: 5,
        step: 0.5,
        default: 2,
        value: this.config.lineThickness || 2
      }
    ];
  }

  init(): void {
    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x000000, 1);
    this.container.appendChild(this.renderer.domElement);

    // Camera position
    this.camera.position.z = 12;

    // Group to hold all contour loops
    this.chrysalisGroup = new THREE.Group();
    this.scene.add(this.chrysalisGroup);

    // Setup mouse controls
    this.setupMouseControls();

    // Initialize loops
    this.initializeLoops();
  }

  private setupMouseControls(): void {
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      this.container.style.cursor = 'grabbing';
      const pos = 'touches' in e ? e.touches[0] : e;
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };

    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      const deltaX = pos.clientX - this.lastMousePos.x;
      const deltaY = pos.clientY - this.lastMousePos.y;

      this.userRotation.y += deltaX * 0.005;
      this.userRotation.x += deltaY * 0.005;

      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.container.style.cursor = 'grab';
    };

    this.container.addEventListener('mousedown', onMouseDown);
    this.container.addEventListener('mousemove', onMouseMove);
    this.container.addEventListener('mouseup', onMouseUp);
    this.container.addEventListener('mouseleave', onMouseUp);
    this.container.addEventListener('touchstart', onMouseDown);
    this.container.addEventListener('touchmove', onMouseMove);
    this.container.addEventListener('touchend', onMouseUp);
  }

  private noise(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
    return n - Math.floor(n);
  }

  private getColorFromHue(hue: number): THREE.Color {
    return new THREE.Color().setHSL(hue / 360, 0.8, 0.6);
  }

  private createContourLoop(
    sliceAngle: number,
    distanceFromCenter: number,
    loopRadius: number,
    vertices: number,
    color: THREE.Color,
    noiseScale: number,
    seed: number
  ): THREE.LineLoop {
    const points: THREE.Vector3[] = [];

    for (let i = 0; i < vertices; i++) {
      const t = (i / vertices) * Math.PI * 2;

      const localY = loopRadius * Math.sin(t);
      const localZ = loopRadius * Math.cos(t);

      const noiseValue = this.noise(t * 2, sliceAngle * 3, seed);
      const radiusVariation = 1 + (noiseValue - 0.5) * noiseScale;
      const noisyZ = localZ * radiusVariation;

      const x = (distanceFromCenter + noisyZ) * Math.cos(sliceAngle);
      const z = (distanceFromCenter + noisyZ) * Math.sin(sliceAngle);
      const y = localY;

      points.push(new THREE.Vector3(x, y, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      linewidth: this.config.lineThickness || 2
    });

    return new THREE.LineLoop(geometry, material);
  }

  private initializeLoops(): void {
    if (!this.chrysalisGroup) return;

    const numLoops = this.config.slices || 56;
    const loopRadius = 5;
    const maxDistance = 4;
    const verticesPerLoop = 80;

    // Clear existing loops
    this.loops.forEach(loopData => {
      this.chrysalisGroup!.remove(loopData.loop);
      loopData.loop.geometry.dispose();
      (loopData.loop.material as THREE.Material).dispose();
    });
    this.loops.length = 0;

    for (let i = 0; i < numLoops; i++) {
      const sliceAngle = (i / numLoops) * Math.PI * 2;
      const ratio = i / (numLoops - 1);
      const distanceFromCenter = maxDistance * Math.sin(ratio * Math.PI);
      const freqIndex = i;
      const hue = (i / numLoops) * 360;
      const color = this.getColorFromHue(hue);

      const loop = this.createContourLoop(
        sliceAngle,
        distanceFromCenter,
        loopRadius,
        verticesPerLoop,
        color,
        this.config.waviness || 0.05,
        i * 100
      );

      this.chrysalisGroup.add(loop);
      this.loops.push({
        loop,
        baseY: 0,
        baseRadius: loopRadius,
        freqIndex,
        vertices: verticesPerLoop,
        seed: i * 100
      });
    }
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.chrysalisGroup) return;

    const currentSlices = this.config.slices || 56;
    if (this.loops.length !== currentSlices) {
      this.initializeLoops();
    }

    // Apply rotation
    const rotationSpeed = this.config.rotationSpeed || 0.003;
    if (!this.isDragging && rotationSpeed > 0) {
      this.userRotation.y += rotationSpeed;
    }

    this.chrysalisGroup.rotation.x = this.userRotation.x;
    this.chrysalisGroup.rotation.y = this.userRotation.y;

    // Update each loop based on frequency data
    const noiseScale = this.config.waviness || 0.05;
    const pulseIntensity = this.config.pulseIntensity || 0.7;
    const time = Date.now() * 0.001;

    this.loops.forEach((loopData, index) => {
      const freqBandIndex = Math.floor((loopData.freqIndex / this.loops.length) * audioAnalysis.frequencyData.length);
      const freqIndex = Math.min(freqBandIndex, audioAnalysis.frequencyData.length - 1);
      const freqValue = (audioAnalysis.frequencyData[freqIndex] || 0) / 255;

      const sliceAngle = (index / this.loops.length) * Math.PI * 2;
      const ratio = index / (this.loops.length - 1);
      const maxDistance = 4;
      const distanceFromCenter = maxDistance * Math.sin(ratio * Math.PI);
      const animatedRadius = loopData.baseRadius * (1 + freqValue * pulseIntensity);

      const points: THREE.Vector3[] = [];

      for (let i = 0; i < loopData.vertices; i++) {
        const t = (i / loopData.vertices) * Math.PI * 2;

        const localY = animatedRadius * Math.sin(t);
        const localZ = animatedRadius * Math.cos(t);

        const noiseValue = this.noise(t * 2 + time * 0.2, sliceAngle * 3, loopData.seed);
        const radiusVariation = 1 + (noiseValue - 0.5) * noiseScale;
        const noisyZ = localZ * radiusVariation;

        const x = (distanceFromCenter + noisyZ) * Math.cos(sliceAngle);
        const z = (distanceFromCenter + noisyZ) * Math.sin(sliceAngle);
        const y = localY;

        points.push(new THREE.Vector3(x, y, z));
      }

      loopData.loop.geometry.setFromPoints(points);

      const material = loopData.loop.material as THREE.LineBasicMaterial;
      material.opacity = 0.5 + freqValue * 0.4;
      material.linewidth = this.config.lineThickness || 2;
    });
  }

  render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize(width: number, height: number): void {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  updateColors(colors: ColorScheme): void {
    this.colors = colors;
  }

  setCameraView(axis: 'x' | 'y' | 'z'): void {
    switch (axis) {
      case 'x':
        this.userRotation.x = 0;
        this.userRotation.y = Math.PI / 2;
        break;
      case 'y':
        this.userRotation.x = -Math.PI / 2;
        this.userRotation.y = 0;
        break;
      case 'z':
        this.userRotation.x = 0;
        this.userRotation.y = 0;
        break;
    }
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.loops.forEach(loopData => {
      loopData.loop.geometry.dispose();
      (loopData.loop.material as THREE.Material).dispose();
    });

    if (this.renderer) {
      this.renderer.dispose();
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.chrysalisGroup = null;
    this.loops = [];
  }
}
