/**
 * Sacred Geometry Visualizer
 * Glowing, audio-reactive sacred geometry mandala with
 * multiple rotating layers, additive-blend glow, and dynamic colors
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

interface GlowMaterialRef {
  material: THREE.LineBasicMaterial;
  baseOpacity: number;
}

export class SacredGeometryVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  private layers: THREE.Group[] = [];
  private glowLayers: THREE.Group[] = [];
  private glowMaterials: GlowMaterialRef[][] = []; // per-layer glow material refs
  private mainMaterials: THREE.LineBasicMaterial[][] = []; // per-layer main materials

  // Audio smoothing
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedHigh = 0;
  private smoothedNorm = 0;
  private time = 0;

  // Zoom
  private cameraZoom = 1;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Sacred Geometry';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Rotation Speed', key: 'rotationSpeed', min: 0, max: 0.02, step: 0.001, default: 0.003, value: this.config.rotationSpeed ?? 0.003 },
      { name: 'Glow Intensity', key: 'glowIntensity', min: 0, max: 1, step: 0.05, default: 0.6, value: this.config.glowIntensity ?? 0.6 },
      { name: 'Pulse Strength', key: 'pulseStrength', min: 0, max: 1, step: 0.05, default: 0.4, value: this.config.pulseStrength ?? 0.4 },
      { name: 'Layer Count', key: 'layerCount', min: 3, max: 8, step: 1, default: 6, value: this.config.layerCount ?? 6 },
      { name: 'Complexity', key: 'complexity', min: 1, max: 3, step: 1, default: 2, value: this.config.complexity ?? 2, labels: ['Simple', 'Medium', 'Complex'] },
      { name: 'Color Shift', key: 'colorShift', min: 0, max: 1, step: 0.05, default: 0.4, value: this.config.colorShift ?? 0.4 },
      { name: 'Symmetry', key: 'symmetry', min: 3, max: 12, step: 1, default: 6, value: this.config.symmetry ?? 6 },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      { name: 'Flower of Life', config: { rotationSpeed: 0.002, glowIntensity: 0.6, pulseStrength: 0.3, layerCount: 6, complexity: 2, colorShift: 0.2, symmetry: 6 } },
      { name: 'Metatron', config: { rotationSpeed: 0.004, glowIntensity: 0.8, pulseStrength: 0.5, layerCount: 8, complexity: 3, colorShift: 0.5, symmetry: 6 } },
      { name: 'Minimal', config: { rotationSpeed: 0.001, glowIntensity: 0.3, pulseStrength: 0.15, layerCount: 3, complexity: 1, colorShift: 0.1, symmetry: 4 } },
      { name: 'Hypnotic', config: { rotationSpeed: 0.008, glowIntensity: 0.9, pulseStrength: 0.8, layerCount: 7, complexity: 3, colorShift: 0.8, symmetry: 8 } },
    ];
  }

  init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    const aspect = width / height;
    const frustumSize = 7;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2, frustumSize * aspect / 2,
      frustumSize / 2, -frustumSize / 2,
      0.1, 100
    );
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);

    this.buildGeometry();

    window.addEventListener('resize', this.handleResize);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  private handleResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;
    const frustumSize = 7 / this.cameraZoom;
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cameraZoom = Math.max(0.3, Math.min(4, this.cameraZoom - e.deltaY * 0.001));
  };

  // ── Geometry builders ──────────────────────────────────────────────

  private buildGeometry(): void {
    if (!this.scene) return;

    // Tear down previous
    for (const l of this.layers) this.scene.remove(l);
    for (const l of this.glowLayers) this.scene.remove(l);
    this.layers = [];
    this.glowLayers = [];
    this.glowMaterials = [];
    this.mainMaterials = [];

    const symmetry = Math.round(this.config.symmetry ?? 6);
    const complexity = Math.round(this.config.complexity ?? 2);
    const layerCount = Math.round(this.config.layerCount ?? 6);

    for (let i = 0; i < layerCount; i++) {
      const radius = 0.4 + i * 0.5;
      const group = new THREE.Group();
      const glowGroup = new THREE.Group();
      const layerGlowRefs: GlowMaterialRef[] = [];
      const layerMainRefs: THREE.LineBasicMaterial[] = [];

      const layerKind = i === 0 ? 0 : ((i - 1) % 4);

      switch (layerKind) {
        case 0: // Seed of life / flower pattern
          this.addSeedOfLife(group, glowGroup, radius, symmetry, layerMainRefs, layerGlowRefs);
          break;
        case 1: // Concentric polygons with spokes
          this.addPolygonRing(group, glowGroup, radius, symmetry, complexity, layerMainRefs, layerGlowRefs);
          break;
        case 2: // Star / stellated pattern
          this.addStarPattern(group, glowGroup, radius, symmetry, complexity, layerMainRefs, layerGlowRefs);
          break;
        case 3: // Circle ring with connecting arcs
          this.addCircleRing(group, glowGroup, radius, symmetry, layerMainRefs, layerGlowRefs);
          break;
      }

      this.scene.add(group);
      this.scene.add(glowGroup);
      this.layers.push(group);
      this.glowLayers.push(glowGroup);
      this.glowMaterials.push(layerGlowRefs);
      this.mainMaterials.push(layerMainRefs);
    }
  }

  /** Create a circle (closed ring) geometry */
  private makeCircle(radius: number, segments = 64): THREE.BufferGeometry {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  /** Create a regular polygon geometry */
  private makePolygon(radius: number, sides: number): THREE.BufferGeometry {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= sides; i++) {
      const t = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  /** Add a line to main group + additive-blend glow copies to glow group */
  private addWithGlow(
    main: THREE.Group,
    glow: THREE.Group,
    geometry: THREE.BufferGeometry,
    color: THREE.Color,
    opacity: number,
    mainRefs: THREE.LineBasicMaterial[],
    glowRefs: GlowMaterialRef[],
    position?: THREE.Vector3
  ): void {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(geometry, mat);
    if (position) line.position.copy(position);
    main.add(line);
    mainRefs.push(mat);

    // 4-pass additive glow halo
    const passes = 4;
    for (let g = 1; g <= passes; g++) {
      const baseOp = opacity * 0.18 / g;
      const glowMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: baseOp,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowLine = new THREE.Line(geometry.clone(), glowMat);
      if (position) glowLine.position.copy(position);
      glowLine.scale.setScalar(1 + g * 0.015);
      glow.add(glowLine);
      glowRefs.push({ material: glowMat, baseOpacity: baseOp });
    }
  }

  /** Add a line-segments version (for disconnected pairs) */
  private addSegmentsWithGlow(
    main: THREE.Group,
    glow: THREE.Group,
    geometry: THREE.BufferGeometry,
    color: THREE.Color,
    opacity: number,
    mainRefs: THREE.LineBasicMaterial[],
    glowRefs: GlowMaterialRef[]
  ): void {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    main.add(new THREE.LineSegments(geometry, mat));
    mainRefs.push(mat);

    for (let g = 1; g <= 3; g++) {
      const baseOp = opacity * 0.15 / g;
      const glowMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: baseOp,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const gl = new THREE.LineSegments(geometry.clone(), glowMat);
      gl.scale.setScalar(1 + g * 0.012);
      glow.add(gl);
      glowRefs.push({ material: glowMat, baseOpacity: baseOp });
    }
  }

  // ── Layer patterns ─────────────────────────────────────────────────

  private addSeedOfLife(
    main: THREE.Group, glow: THREE.Group, radius: number, symmetry: number,
    mainRefs: THREE.LineBasicMaterial[], glowRefs: GlowMaterialRef[]
  ): void {
    const color = this.getDominant();

    // Center circle
    this.addWithGlow(main, glow, this.makeCircle(radius), color, 0.9, mainRefs, glowRefs);

    // Ring of overlapping circles (flower-of-life first ring)
    for (let i = 0; i < symmetry; i++) {
      const a = (i / symmetry) * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      this.addWithGlow(main, glow, this.makeCircle(radius), color, 0.8, mainRefs, glowRefs, pos);
    }

    // Second ring of circles (outer flower petals) for more density
    const outerR = radius * 1.73; // √3 ≈ distance for second ring
    for (let i = 0; i < symmetry; i++) {
      const a = (i / symmetry) * Math.PI * 2 + Math.PI / symmetry;
      const pos = new THREE.Vector3(Math.cos(a) * outerR, Math.sin(a) * outerR, 0);
      this.addWithGlow(main, glow, this.makeCircle(radius), color, 0.5, mainRefs, glowRefs, pos);
    }
  }

  private addPolygonRing(
    main: THREE.Group, glow: THREE.Group, radius: number, symmetry: number, complexity: number,
    mainRefs: THREE.LineBasicMaterial[], glowRefs: GlowMaterialRef[]
  ): void {
    const color = this.getAccent();

    // Concentric polygons
    for (let c = 0; c < complexity; c++) {
      const r = radius * (0.75 + c * 0.35);
      const sides = symmetry + c * 2;
      this.addWithGlow(main, glow, this.makePolygon(r, sides), color, 0.85 - c * 0.1, mainRefs, glowRefs);
    }

    // Radiating spokes from center to polygon vertices
    const spokePts: THREE.Vector3[] = [];
    for (let i = 0; i < symmetry; i++) {
      const t = (i / symmetry) * Math.PI * 2 - Math.PI / 2;
      const outerR = radius * (0.75 + (complexity - 1) * 0.35);
      spokePts.push(new THREE.Vector3(0, 0, 0));
      spokePts.push(new THREE.Vector3(Math.cos(t) * outerR, Math.sin(t) * outerR, 0));
    }
    this.addSegmentsWithGlow(main, glow, new THREE.BufferGeometry().setFromPoints(spokePts), color, 0.35, mainRefs, glowRefs);

    // Inner circle inscribed in polygon
    this.addWithGlow(main, glow, this.makeCircle(radius * 0.65), color, 0.4, mainRefs, glowRefs);
  }

  private addStarPattern(
    main: THREE.Group, glow: THREE.Group, radius: number, symmetry: number, complexity: number,
    mainRefs: THREE.LineBasicMaterial[], glowRefs: GlowMaterialRef[]
  ): void {
    const color = this.getMixed(0.5);

    // Stellated polygons: connect every Nth vertex
    for (let skip = 2; skip <= Math.min(complexity + 1, Math.floor(symmetry / 2)); skip++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= symmetry; i++) {
        const t = ((i * skip) / symmetry) * Math.PI * 2 - Math.PI / 2;
        pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
      }
      this.addWithGlow(main, glow, new THREE.BufferGeometry().setFromPoints(pts), color, 0.75, mainRefs, glowRefs);
    }

    // Bounding circle
    this.addWithGlow(main, glow, this.makeCircle(radius * 1.08), color, 0.45, mainRefs, glowRefs);

    // Inner star: half-radius stellated
    const innerPts: THREE.Vector3[] = [];
    const halfR = radius * 0.5;
    for (let i = 0; i <= symmetry * 2; i++) {
      const r = i % 2 === 0 ? halfR : halfR * 0.4;
      const t = (i / (symmetry * 2)) * Math.PI * 2 - Math.PI / 2;
      innerPts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
    }
    this.addWithGlow(main, glow, new THREE.BufferGeometry().setFromPoints(innerPts), color, 0.55, mainRefs, glowRefs);
  }

  private addCircleRing(
    main: THREE.Group, glow: THREE.Group, radius: number, symmetry: number,
    mainRefs: THREE.LineBasicMaterial[], glowRefs: GlowMaterialRef[]
  ): void {
    const color = this.getDominant();
    const smallR = radius * 0.3;

    // Small circles placed at vertices of the ring
    for (let i = 0; i < symmetry; i++) {
      const a = (i / symmetry) * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      this.addWithGlow(main, glow, this.makeCircle(smallR), color, 0.7, mainRefs, glowRefs, pos);
    }

    // Connect adjacent circle centers (polygon)
    this.addWithGlow(main, glow, this.makePolygon(radius, symmetry), color, 0.5, mainRefs, glowRefs);

    // Cross-connect: each vertex to one opposite
    if (symmetry >= 4) {
      const crossPts: THREE.Vector3[] = [];
      for (let i = 0; i < symmetry; i++) {
        const a1 = (i / symmetry) * Math.PI * 2;
        const a2 = ((i + Math.floor(symmetry / 2)) / symmetry) * Math.PI * 2;
        crossPts.push(new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0));
        crossPts.push(new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, 0));
      }
      this.addSegmentsWithGlow(main, glow, new THREE.BufferGeometry().setFromPoints(crossPts), color, 0.3, mainRefs, glowRefs);
    }

    // Outer bounding circle
    this.addWithGlow(main, glow, this.makeCircle(radius + smallR), color, 0.35, mainRefs, glowRefs);
  }

  // ── Color helpers ──────────────────────────────────────────────────

  private getDominant(): THREE.Color {
    return this.parseColor(this.colors.dominant);
  }

  private getAccent(): THREE.Color {
    return this.parseColor(this.colors.accent);
  }

  private getMixed(t: number): THREE.Color {
    return new THREE.Color().lerpColors(this.getDominant(), this.getAccent(), t);
  }

  private parseColor(color: string): THREE.Color {
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return new THREE.Color(parseInt(m[1]) / 255, parseInt(m[2]) / 255, parseInt(m[3]) / 255);
    return new THREE.Color(color);
  }

  // ── Animation loop hooks ───────────────────────────────────────────

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

    const rotationSpeed = this.config.rotationSpeed ?? 0.003;
    const glowIntensity = this.config.glowIntensity ?? 0.6;
    const pulseStrength = this.config.pulseStrength ?? 0.4;
    const colorShift = this.config.colorShift ?? 0.4;

    // Zoom
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;
    const frustumSize = 7 / this.cameraZoom;
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();

    const dominant = this.getDominant();
    const accent = this.getAccent();

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const glowLayer = this.glowLayers[i];

      // ── Rotation: alternating dirs, audio-boosted ──
      const dir = i % 2 === 0 ? 1 : -1;
      const speedMult = 0.6 + i * 0.25;
      const audioBoost = 1 + this.smoothedMid * 2.5;
      const rotDelta = dir * rotationSpeed * speedMult * audioBoost;
      layer.rotation.z += rotDelta;
      glowLayer.rotation.z += rotDelta;

      // ── Scale pulse: gentle breathing + bass kick ──
      const breath = 1 + Math.sin(this.time * 1.8 + i * 0.9) * 0.015;
      const kick = 1 + this.smoothedBass * pulseStrength * 0.2;
      const s = breath * kick;
      layer.scale.setScalar(s);
      glowLayer.scale.setScalar(s);

      // ── Color: shift between dominant & accent based on audio + time ──
      const wave = Math.sin(this.time * 0.4 + i * 1.1) * 0.5 + 0.5;
      const mix = wave * colorShift + (1 - colorShift) * (i % 2 === 0 ? 0.15 : 0.85);
      const targetColor = new THREE.Color().lerpColors(dominant, accent, mix);

      // Brighten with high frequencies
      const brighten = 1 + this.smoothedHigh * 0.6;
      targetColor.multiplyScalar(brighten);

      // Update main materials
      const mains = this.mainMaterials[i];
      if (mains) {
        for (const mat of mains) {
          mat.color.lerp(targetColor, 0.06);
        }
      }

      // Update glow materials (color + intensity)
      const glows = this.glowMaterials[i];
      if (glows) {
        const glowMult = glowIntensity * (0.4 + this.smoothedNorm * 1.2);
        for (const ref of glows) {
          ref.material.color.lerp(targetColor, 0.06);
          ref.material.opacity = Math.min(1, ref.baseOpacity * glowMult);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) {
      this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    }
  }

  destroy(): void {
    this.stopAnimationLoop();

    window.removeEventListener('resize', this.handleResize);
    this.container.removeEventListener('wheel', this.handleWheel);

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }

    if (this.scene) {
      this.scene.traverse((child) => {
        if ((child as THREE.Line).isLine) {
          const line = child as THREE.Line;
          line.geometry?.dispose();
          (line.material as THREE.Material)?.dispose();
        }
      });
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.layers = [];
    this.glowLayers = [];
    this.glowMaterials = [];
    this.mainMaterials = [];
  }
}
