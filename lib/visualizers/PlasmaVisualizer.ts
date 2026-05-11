/**
 * Plasma Visualizer
 * A translucent orb with a glowing core that pulses on bass.
 * Surface is displaced by mid/high frequencies with a Fresnel rim glow.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

// ── Shaders ────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */`
  uniform float time;
  uniform float midLevel;
  uniform float highLevel;
  uniform float bassLevel;
  uniform float noiseScale;
  uniform float displacementScale;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vDisplacement;

  float noise3(vec3 p) {
    return sin(p.x * 2.1 + time * 0.7) * cos(p.y * 2.3 + time * 0.5) * 0.50
         + sin(p.y * 3.2 + time * 1.0) * cos(p.z * 3.0 + time * 0.4) * 0.35
         + sin(p.z * 3.8 + time * 0.8) * cos(p.x * 2.4 + time * 1.1) * 0.30
         + sin((p.x + p.y + p.z) * 1.7 + time * 0.6) * 0.25;
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);

    float n      = noise3(position * noiseScale);
    float audio  = midLevel * 0.60 + highLevel * 0.40;
    float disp   = n * audio * displacementScale;
    // Subtle bass ripple layered on top
    disp += bassLevel * 0.07 * sin(length(position) * 3.5 + time * 2.2);
    vDisplacement = disp;

    vec3  displaced = position + normal * disp;
    vec4  worldPos  = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition  = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3  innerColor;
  uniform vec3  outerColor;
  uniform float bassLevel;
  uniform float glowIntensity;
  uniform vec3  cameraPos;

  varying vec3  vNormal;
  varying vec3  vWorldPosition;
  varying float vDisplacement;

  void main() {
    vec3  viewDir = normalize(cameraPos - vWorldPosition);
    float vDotN   = max(0.0, dot(normalize(vNormal), viewDir));

    // Fresnel — strong at silhouette, zero face-on
    float fresnel   = pow(1.0 - vDotN, 2.8);
    // Inner warmth — peaks facing the camera (the lit hemisphere effect)
    float innerFace = pow(vDotN, 2.5);
    float bassPulse = bassLevel * 0.7;

    // Blend: inner (warm) at centre, outer (cool) at rim
    vec3 color = mix(
      innerColor * (1.0 + bassPulse * 1.8 + innerFace * 0.6),
      outerColor * 1.1,
      fresnel
    );

    // Bright wispy patches where displacement is high
    float dispHighlight = max(0.0, vDisplacement) * 3.5;
    color += outerColor * dispHighlight * 0.55;
    color += innerColor * dispHighlight * 0.30;

    // Alpha: translucent base, Fresnel rim brings it up, bass pulses it
    float alpha = 0.20 + fresnel * 0.55 + innerFace * 0.20 + bassPulse * 0.12;
    alpha = clamp(alpha * glowIntensity, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Visualizer ─────────────────────────────────────────────────────────────

export class PlasmaVisualizer extends BaseVisualizer {
  private scene:   THREE.Scene   | null = null;
  private camera:  THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer   | null = null;

  // Surface
  private surfaceMesh:     THREE.Mesh            | null = null;
  private surfaceMaterial: THREE.ShaderMaterial  | null = null;

  // Mid-halo (between core and surface)
  private haloMesh:     THREE.Mesh           | null = null;
  private haloMaterial: THREE.ShaderMaterial | null = null;

  // Inner core
  private coreMesh:     THREE.Mesh               | null = null;
  private coreMaterial: THREE.MeshBasicMaterial  | null = null;

  // Light from inside
  private innerLight: THREE.PointLight | null = null;

  private time      = 0;
  private smoothBass = 0;
  private smoothMid  = 0;
  private smoothHigh = 0;

  private cameraRotation = { x: 0.2, y: 0 };
  private isDragging    = false;
  private lastMousePos  = { x: 0, y: 0 };

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string { return 'Plasma'; }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Bass Pulse',
        key: 'bassPulse',
        min: 0, max: 2.5, step: 0.05,
        default: 1.2,
        value: this.config.bassPulse ?? 1.2,
      },
      {
        name: 'Surface Detail',
        key: 'surfaceDetail',
        min: 0.1, max: 2.0, step: 0.05,
        default: 0.7,
        value: this.config.surfaceDetail ?? 0.7,
      },
      {
        name: 'Glow Intensity',
        key: 'glowIntensity',
        min: 0.3, max: 2.5, step: 0.05,
        default: 1.1,
        value: this.config.glowIntensity ?? 1.1,
      },
      {
        name: 'Rotation Speed',
        key: 'rotationSpeed',
        min: 0, max: 0.01, step: 0.0005,
        default: 0.002,
        value: this.config.rotationSpeed ?? 0.002,
      },
      {
        name: 'Radius',
        key: 'radius',
        min: 1.0, max: 4.0, step: 0.1,
        default: 2.5,
        value: this.config.radius ?? 2.5,
      },
      {
        name: 'Mesh Detail',
        key: 'meshDetail',
        min: 2, max: 8, step: 1,
        default: 6,
        value: this.config.meshDetail ?? 6,
      },
      {
        name: 'Hue',
        key: 'hue',
        min: 0, max: 360, step: 1,
        default: 0,
        value: this.config.hue ?? 0,
      },
      {
        name: 'Harmony',
        key: 'harmonyMode',
        min: 0, max: 2, step: 1,
        default: 0,
        value: this.config.harmonyMode ?? 0,
        labels: ['Mono', 'Analogous', 'Complement'],
      },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      {
        name: '1',
        config: { bassPulse: 1.8, surfaceDetail: 0.5, glowIntensity: 1.3, rotationSpeed: 0.002, radius: 2.5, meshDetail: 6 },
      },
      {
        name: '2',
        config: { bassPulse: 0.8, surfaceDetail: 1.4, glowIntensity: 0.9, rotationSpeed: 0.001, radius: 3.0, meshDetail: 7 },
      },
      {
        name: '3',
        config: { bassPulse: 2.2, surfaceDetail: 0.3, glowIntensity: 1.8, rotationSpeed: 0.005, radius: 2.0, meshDetail: 5 },
      },
    ];
  }

  // ── Build ────────────────────────────────────────────────────────────────

  private getColors(): { inner: THREE.Color; outer: THREE.Color } {
    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 0,
      this.config.hue ?? 0,
    );
    const d = this.parseRGB(dominant);
    const a = this.parseRGB(accent);
    return {
      inner: new THREE.Color(a.r, a.g, a.b),
      outer: new THREE.Color(d.r, d.g, d.b),
    };
  }

  private makeSurfaceShader(
    radius: number,
    detail: number,
    scale: number,
    inner: THREE.Color,
    outer: THREE.Color,
  ): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time:              { value: 0 },
        midLevel:          { value: 0 },
        highLevel:         { value: 0 },
        bassLevel:         { value: 0 },
        noiseScale:        { value: 0.75 * scale },
        displacementScale: { value: this.config.surfaceDetail ?? 0.7 },
        innerColor:        { value: inner.clone() },
        outerColor:        { value: outer.clone() },
        glowIntensity:     { value: this.config.glowIntensity ?? 1.1 },
        cameraPos:         { value: new THREE.Vector3(0, 0, 6) },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
  }

  private buildScene(): void {
    if (!this.scene) return;

    // Remove old objects
    [this.surfaceMesh, this.haloMesh, this.coreMesh].forEach((m) => {
      if (m) {
        this.scene!.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    if (this.innerLight) { this.scene.remove(this.innerLight); this.innerLight.dispose(); }

    const radius = this.config.radius ?? 2.5;
    const detail = Math.min(Math.round(this.config.meshDetail ?? 6), 8);
    const { inner, outer } = this.getColors();

    // Outer translucent surface — reacts to mids/highs
    this.surfaceMesh = this.makeSurfaceShader(radius, detail, 1.0, inner, outer);
    this.surfaceMaterial = this.surfaceMesh.material as THREE.ShaderMaterial;
    this.scene.add(this.surfaceMesh);

    // Mid halo — slightly smaller, coarser, offset noise phase
    this.haloMesh = this.makeSurfaceShader(radius * 0.82, Math.max(2, detail - 1), 1.4, inner, outer);
    this.haloMaterial = this.haloMesh.material as THREE.ShaderMaterial;
    this.haloMaterial.uniforms.glowIntensity.value = (this.config.glowIntensity ?? 1.1) * 0.65;
    this.scene.add(this.haloMesh);

    // Inner core — solid warm sphere that blooms with bass
    const coreGeo = new THREE.IcosahedronGeometry(radius * 0.30, 4);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color:       inner,
      transparent: true,
      opacity:     0.9,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.scene.add(this.coreMesh);

    // Point light sourced at the core, illuminates translucent surface
    this.innerLight = new THREE.PointLight(inner.getHex(), 2.5, radius * 5);
    this.scene.add(this.innerLight);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  init(): void {
    const width  = this.container.clientWidth  || 800;
    const height = this.container.clientHeight || 600;

    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor     = 'grab';
    this.container.style.touchAction = 'none';

    window.addEventListener('resize', this.handleResize);
    this.buildScene();
    this.setupMouseControls();
  }

  private handleResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private setupMouseControls(): void {
    const el = this.container;
    const onDown = (e: MouseEvent | TouchEvent) => {
      this.isDragging  = true;
      const p = 'touches' in e ? e.touches[0] : e;
      this.lastMousePos = { x: p.clientX, y: p.clientY };
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const p = 'touches' in e ? e.touches[0] : e;
      this.cameraRotation.y += (p.clientX - this.lastMousePos.x) * 0.005;
      this.cameraRotation.x += (p.clientY - this.lastMousePos.y) * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: p.clientX, y: p.clientY };
    };
    const onUp = () => { this.isDragging = false; };

    el.addEventListener('mousedown',  onDown);
    el.addEventListener('mousemove',  onMove);
    el.addEventListener('mouseup',    onUp);
    el.addEventListener('mouseleave', onUp);
    el.addEventListener('touchstart', onDown);
    el.addEventListener('touchmove',  onMove);
    el.addEventListener('touchend',   onUp);
  }

  // ── Update ───────────────────────────────────────────────────────────────

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.camera) return;

    const { bassAvg, midAvg, highAvg } = audioAnalysis;
    const bassPulse  = this.config.bassPulse   ?? 1.2;
    const rotSpeed   = this.config.rotationSpeed ?? 0.002;

    // Smoothed bands — fast attack, slow decay for organic feel
    const attack = 0.18;
    const decay  = 0.08;
    const bTarget = bassAvg  * bassPulse;
    this.smoothBass  += (bTarget    > this.smoothBass  ? attack : decay) * (bTarget    - this.smoothBass);
    this.smoothMid   += (midAvg     > this.smoothMid   ? attack : decay) * (midAvg     - this.smoothMid);
    this.smoothHigh  += (highAvg    > this.smoothHigh  ? attack : decay) * (highAvg    - this.smoothHigh);

    this.time += 0.016 * 1.1;

    // Camera orbit
    if (!this.isDragging) this.cameraRotation.y += rotSpeed;
    const r = 6;
    const cx = this.cameraRotation.x;
    const cy = this.cameraRotation.y;
    this.camera.position.set(
      r * Math.sin(cy) * Math.cos(cx),
      r * Math.sin(cx),
      r * Math.cos(cy) * Math.cos(cx),
    );
    this.camera.lookAt(0, 0, 0);

    const { inner, outer } = this.getColors();
    const glow = this.config.glowIntensity ?? 1.1;

    // Update both surface shader layers
    const applyUniforms = (mat: THREE.ShaderMaterial | null, glowMult = 1.0) => {
      if (!mat) return;
      const u = mat.uniforms;
      u.time.value              = this.time;
      u.bassLevel.value         = this.smoothBass;
      u.midLevel.value          = this.smoothMid;
      u.highLevel.value         = this.smoothHigh;
      u.displacementScale.value = this.config.surfaceDetail ?? 0.7;
      u.glowIntensity.value     = glow * glowMult;
      u.innerColor.value.copy(inner);
      u.outerColor.value.copy(outer);
      u.cameraPos.value.copy(this.camera!.position);
    };

    applyUniforms(this.surfaceMaterial, 1.0);
    applyUniforms(this.haloMaterial,    0.65);

    // Core blooms with bass
    if (this.coreMesh && this.coreMaterial) {
      const coreScale = 1.0 + this.smoothBass * 1.4;
      this.coreMesh.scale.setScalar(coreScale);
      this.coreMaterial.color.copy(inner);
      this.coreMaterial.opacity = Math.min(1, 0.75 + this.smoothBass * 0.6);
    }

    // Inner light pulses with bass
    if (this.innerLight) {
      this.innerLight.color.copy(inner);
      this.innerLight.intensity = 2.0 + this.smoothBass * bassPulse * 3.5;
    }
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // ── Config / color hooks ─────────────────────────────────────────────────

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    // Colors are derived per-frame from harmonyColorScheme — no extra action needed
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) this.renderer.setClearColor(isDark ? 0x000000 : 0x050508, 1);
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
    if ((key === 'radius' || key === 'meshDetail') && this.scene) {
      this.buildScene();
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;
    window.removeEventListener('resize', this.handleResize);

    [this.surfaceMesh, this.haloMesh, this.coreMesh].forEach((m) => {
      if (m) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    });
    this.innerLight?.dispose();
    this.renderer?.dispose();

    this.scene       = null;
    this.camera      = null;
    this.renderer    = null;
    this.surfaceMesh = null;
    this.haloMesh    = null;
    this.coreMesh    = null;
    this.innerLight  = null;

    this.container.innerHTML = '';
  }
}
