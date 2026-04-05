/**
 * Joy Division Visualizer
 * Horizontal lines on a rotatable 3D plane, displaced by audio frequency data.
 * Bass frequencies drive the top rows, highs drive the bottom — like Unknown Pleasures.
 * Uses Three.js with perspective camera for 3D rotation.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class JoyDivisionVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  private lines: THREE.Line[] = [];
  private lineGeometries: THREE.BufferGeometry[] = [];
  private basePositions: Float32Array[] = []; // original flat Y positions per line

  // Audio smoothing — one row of smoothed heights per line
  private smoothedHeights: Float32Array[] = [];
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedHigh = 0;
  private smoothedNorm = 0;

  // Camera orbit
  private cameraAngle = 0;

  // History buffer for scrolling waveform mode
  private history: Float32Array[] = [];
  private historyIndex = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Joy Division';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Line Count', key: 'lineCount', min: 20, max: 80, step: 1, default: 40, value: this.config.lineCount ?? 40 },
      { name: 'Points Per Line', key: 'pointsPerLine', min: 64, max: 256, step: 16, default: 128, value: this.config.pointsPerLine ?? 128 },
      { name: 'Amplitude', key: 'amplitude', min: 0.5, max: 5, step: 0.1, default: 2.0, value: this.config.amplitude ?? 2.0 },
      { name: 'Line Spacing', key: 'lineSpacing', min: 0.05, max: 0.3, step: 0.01, default: 0.12, value: this.config.lineSpacing ?? 0.12 },
      { name: 'Camera Tilt', key: 'cameraTilt', min: 0, max: 80, step: 1, default: 45, value: this.config.cameraTilt ?? 45 },
      { name: 'Rotation Speed', key: 'rotationSpeed', min: 0, max: 0.01, step: 0.001, default: 0, value: this.config.rotationSpeed ?? 0 },
      { name: 'Smoothing', key: 'smoothing', min: 0.01, max: 0.5, step: 0.01, default: 0.15, value: this.config.smoothing ?? 0.15 },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      { name: '1', config: { lineCount: 40, pointsPerLine: 128, amplitude: 2.0, lineSpacing: 0.12, cameraTilt: 45, rotationSpeed: 0, smoothing: 0.15 } },
      { name: '2', config: { lineCount: 60, pointsPerLine: 192, amplitude: 3.0, lineSpacing: 0.08, cameraTilt: 55, rotationSpeed: 0.002, smoothing: 0.1 } },
      { name: '3', config: { lineCount: 30, pointsPerLine: 128, amplitude: 1.5, lineSpacing: 0.18, cameraTilt: 30, rotationSpeed: 0, smoothing: 0.25 } },
      { name: '4', config: { lineCount: 80, pointsPerLine: 256, amplitude: 4.0, lineSpacing: 0.06, cameraTilt: 60, rotationSpeed: 0.003, smoothing: 0.08 } },
    ];
  }

  // Structural keys that require full geometry rebuild
  private static STRUCTURAL_KEYS = new Set(['lineCount', 'pointsPerLine']);

  updateConfig(key: string, value: number): void {
    this.config[key] = value;
    if (JoyDivisionVisualizer.STRUCTURAL_KEYS.has(key) && this.scene) {
      this.rebuildLines();
    }
  }

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);

    this.buildLines();

    window.addEventListener('resize', this.handleResize);
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const tiltDeg = this.config.cameraTilt ?? 45;
    const tiltRad = (tiltDeg * Math.PI) / 180;
    const dist = 8;
    this.camera.position.set(
      Math.sin(this.cameraAngle) * Math.cos(tiltRad) * dist,
      Math.sin(tiltRad) * dist,
      Math.cos(this.cameraAngle) * Math.cos(tiltRad) * dist
    );
    this.camera.lookAt(0, 0, 0);
  }

  private buildLines(): void {
    if (!this.scene) return;
    const lineCount = Math.round(this.config.lineCount ?? 40);
    const pointsPerLine = Math.round(this.config.pointsPerLine ?? 128);
    const lineSpacing = this.config.lineSpacing ?? 0.12;

    this.lines = [];
    this.lineGeometries = [];
    this.basePositions = [];
    this.smoothedHeights = [];
    this.history = [];

    const totalDepth = (lineCount - 1) * lineSpacing;
    const halfDepth = totalDepth / 2;
    const halfWidth = 4; // line extends from -4 to +4 in X

    const lineColor = this.darkMode ? 0xffffff : 0x000000;

    for (let row = 0; row < lineCount; row++) {
      const positions = new Float32Array(pointsPerLine * 3);
      const z = -halfDepth + row * lineSpacing; // front to back

      for (let p = 0; p < pointsPerLine; p++) {
        const x = -halfWidth + (p / (pointsPerLine - 1)) * halfWidth * 2;
        positions[p * 3] = x;
        positions[p * 3 + 1] = 0; // Y = flat initially
        positions[p * 3 + 2] = z;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.85,
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      this.lines.push(line);
      this.lineGeometries.push(geometry);
      this.basePositions.push(new Float32Array(positions));
      this.smoothedHeights.push(new Float32Array(pointsPerLine));
      this.history.push(new Float32Array(pointsPerLine));
    }
  }

  private rebuildLines(): void {
    if (!this.scene) return;
    // Clear existing
    for (const line of this.lines) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.buildLines();
  }

  private handleResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  update(audio: AudioAnalysis): void {
    // Always read raw data for responsiveness
    const rawBass = audio.bassAvg ?? 0;
    const rawMid = audio.midAvg ?? 0;
    const rawHigh = audio.highAvg ?? 0;
    const rawNorm = audio.normalizedFrequency ?? 0;

    const attack = 0.4;
    const release = 0.06;

    this.smoothedBass += ((rawBass - this.smoothedBass) * (rawBass > this.smoothedBass ? attack : release));
    this.smoothedMid += ((rawMid - this.smoothedMid) * (rawMid > this.smoothedMid ? attack : release));
    this.smoothedHigh += ((rawHigh - this.smoothedHigh) * (rawHigh > this.smoothedHigh ? attack : release));
    this.smoothedNorm += ((rawNorm - this.smoothedNorm) * (rawNorm > this.smoothedNorm ? attack : release));
  }

  render(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    const amplitude = this.config.amplitude ?? 2.0;
    const smoothing = this.config.smoothing ?? 0.15;
    const rotationSpeed = this.config.rotationSpeed ?? 0;
    const lineCount = this.lines.length;
    const pointsPerLine = Math.round(this.config.pointsPerLine ?? 128);

    // Camera orbit
    if (rotationSpeed > 0) {
      this.cameraAngle += rotationSpeed;
    }
    this.updateCameraPosition();

    // Get frequency data
    const freqData = this.currentAudioAnalysis?.frequencyData;
    const freqLen = freqData ? freqData.length : 0;

    for (let row = 0; row < lineCount; row++) {
      const geometry = this.lineGeometries[row];
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const smoothed = this.smoothedHeights[row];

      // Map row to frequency band: row 0 (front/top) = bass, last row (back/bottom) = highs
      const rowT = lineCount > 1 ? row / (lineCount - 1) : 0.5;

      for (let p = 0; p < pointsPerLine; p++) {
        // Map point index to a frequency bin
        const pointT = p / (pointsPerLine - 1);

        // Combine row's frequency band position with point position across spectrum
        // Each row focuses on a narrow frequency band, points spread within it
        const bandCenter = rowT; // 0=bass, 1=highs
        const bandWidth = 1.0 / lineCount;
        const freqT = Math.max(0, Math.min(1, bandCenter + (pointT - 0.5) * bandWidth * 4));

        let value = 0;
        if (freqData && freqLen > 0) {
          const binIndex = Math.floor(freqT * (freqLen - 1));
          value = freqData[binIndex] / 255;
        }

        // Shape: bell curve envelope so edges are quiet
        const edgeFade = Math.sin(pointT * Math.PI);
        const targetHeight = value * amplitude * edgeFade;

        // Smooth toward target
        smoothed[p] += (targetHeight - smoothed[p]) * smoothing;

        positions[p * 3 + 1] = smoothed[p];
      }

      posAttr.needsUpdate = true;

      // Opacity: front rows (bass) brighter, back rows dimmer
      const mat = this.lines[row].material as THREE.LineBasicMaterial;
      const rowAudio = rowT < 0.33 ? this.smoothedBass
        : rowT < 0.66 ? this.smoothedMid
        : this.smoothedHigh;
      mat.opacity = 0.3 + rowAudio * 0.7 + (1 - rowT) * 0.2;
    }

    this.renderer.render(this.scene, this.camera);
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
    const lineColor = isDark ? 0xffffff : 0x000000;
    for (const line of this.lines) {
      (line.material as THREE.LineBasicMaterial).color.set(lineColor);
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    for (const line of this.lines) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.lines = [];
    this.lineGeometries = [];
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.isInitialized = false;
  }
}
