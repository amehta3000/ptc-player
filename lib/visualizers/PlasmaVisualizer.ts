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
  uniform float displacementScale;

  varying vec3  vNormal;
  varying vec3  vWorldPosition;
  varying float vDisplacement;

  // Turbulent noise — abs() creates sharp plasma ridges
  float turbulence(vec3 p) {
    float v = 0.0;
    v += abs(sin(p.x * 1.8 + time * 0.6) * cos(p.y * 2.1 + time * 0.4)) * 0.50;
    v += abs(sin(p.y * 3.4 + time * 0.9) * cos(p.z * 3.0 + time * 0.5)) * 0.30;
    v += abs(sin(p.z * 5.1 + time * 1.1) * cos(p.x * 4.7 + time * 0.7)) * 0.15;
    v += abs(sin((p.x + p.y + p.z) * 2.3 + time * 0.8))                  * 0.12;
    return v;
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);

    float t     = turbulence(position * 0.9);
    float audio = midLevel * 0.55 + highLevel * 0.45;
    float disp  = t * audio * displacementScale;
    // Bass adds a low-frequency radial pulse
    disp += bassLevel * 0.06 * sin(length(position) * 2.8 + time * 2.5);
    vDisplacement = disp;

    vec3 displaced  = position + normal * disp;
    vec4 worldPos   = modelMatrix * vec4(displaced, 1.0);
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
    vec3  N    = normalize(vNormal);
    vec3  V    = normalize(cameraPos - vWorldPosition);
    float NdotV = dot(N, V);

    // Fresnel rim — glows at silhouette edges (uses abs so back faces also rim-glow)
    float fresnel   = pow(1.0 - abs(NdotV), 3.2);

    // Front hemisphere warmth — peaks when face points at camera
    float frontFace = pow(max(0.0, NdotV), 1.6);

    // Back hemisphere — visible through translucency, tint darker/cooler for depth
    float backFace  = max(0.0, -NdotV);

    float bassBright = bassLevel * 0.55;

    // Warm inner, cool outer rim
    vec3 frontColor = innerColor * (0.85 + frontFace * 0.5 + bassBright * 1.0);
    vec3 rimColor   = outerColor * 1.4;
    vec3 backColor  = innerColor * 0.25;  // dim back hemisphere for 3D depth

    vec3 color = mix(frontColor, rimColor, fresnel);
    // Subtle back-face darkening to reinforce sphere depth
    color      = mix(color, backColor, backFace * 0.35);

    // Wispy bright patches at displacement peaks
    float disp = max(0.0, vDisplacement);
    color += outerColor * disp * 1.2;
    color += innerColor * disp * 0.5;

    // Alpha — NormalBlending, so this is real transparency
    // Rim opaque, face translucent, bass slightly lifts all
    float alpha = 0.18 + fresnel * 0.52 + frontFace * 0.18 + bassBright * 0.10;
    alpha = clamp(alpha * glowIntensity, 0.0, 0.88);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Visualizer ─────────────────────────────────────────────────────────────

export class PlasmaVisualizer extends BaseVisualizer {
  private scene:    THREE.Scene            | null = null;
  private camera:   THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer    | null = null;

  // Outer surface
  private surfaceMesh:     THREE.Mesh           | null = null;
  private surfaceMaterial: THREE.ShaderMaterial | null = null;

  // Inner halo (same shader, slightly smaller, different noise phase)
  private haloMesh:     THREE.Mesh           | null = null;
  private haloMaterial: THREE.ShaderMaterial | null = null;

  // Tiny core glow (additive only for the very centre spark)
  private coreMesh:     THREE.Mesh              | null = null;
  private coreMaterial: THREE.MeshBasicMaterial | null = null;

  // Interior point light
  private innerLight: THREE.PointLight | null = null;

  private time       = 0;
  private smoothBass = 0;
  private smoothMid  = 0;
  private smoothHigh = 0;

  private cameraRotation = { x: 0.15, y: 0 };
  private isDragging    = false;
  private lastMousePos  = { x: 0, y: 0 };

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string { return 'Plasma'; }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Bass Pulse',     key: 'bassPulse',     min: 0,   max: 2.5,  step: 0.05,   default: 1.2,   value: this.config.bassPulse     ?? 1.2   },
      { name: 'Surface Detail', key: 'surfaceDetail', min: 0.1, max: 2.0,  step: 0.05,   default: 0.65,  value: this.config.surfaceDetail  ?? 0.65  },
      { name: 'Glow Intensity', key: 'glowIntensity', min: 0.3, max: 2.5,  step: 0.05,   default: 1.1,   value: this.config.glowIntensity  ?? 1.1   },
      { name: 'Rotation Speed', key: 'rotationSpeed', min: 0,   max: 0.01, step: 0.0005, default: 0.002, value: this.config.rotationSpeed  ?? 0.002 },
      { name: 'Radius',         key: 'radius',        min: 1.0, max: 4.0,  step: 0.1,    default: 2.5,   value: this.config.radius         ?? 2.5   },
      { name: 'Mesh Detail',    key: 'meshDetail',    min: 2,   max: 8,    step: 1,       default: 6,     value: this.config.meshDetail     ?? 6     },
      { name: 'Hue',            key: 'hue',           min: 0,   max: 360,  step: 1,       default: 0,     value: this.config.hue            ?? 0     },
      {
        name: 'Harmony', key: 'harmonyMode', min: 0, max: 2, step: 1, default: 0,
        value: this.config.harmonyMode ?? 0,
        labels: ['Mono', 'Analogous', 'Complement'],
      },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      { name: '1', config: { bassPulse: 1.8, surfaceDetail: 0.5, glowIntensity: 1.2, rotationSpeed: 0.002, radius: 2.5, meshDetail: 6 } },
      { name: '2', config: { bassPulse: 0.7, surfaceDetail: 1.5, glowIntensity: 1.0, rotationSpeed: 0.001, radius: 3.0, meshDetail: 7 } },
      { name: '3', config: { bassPulse: 2.2, surfaceDetail: 0.3, glowIntensity: 1.6, rotationSpeed: 0.005, radius: 2.0, meshDetail: 5 } },
    ];
  }

  // ── Colors ────────────────────────────────────────────────────────────────

  private getColors(): { inner: THREE.Color; outer: THREE.Color } {
    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 0,
      this.config.hue ?? 0,
    );
    const d = this.parseRGB(dominant);
    const a = this.parseRGB(accent);

    const inner = new THREE.Color(a.r, a.g, a.b);
    const outer = new THREE.Color(d.r, d.g, d.b);

    // Enforce minimum saturation so grey album art still produces vivid plasma
    const ih = { h: 0, s: 0, l: 0 };
    const oh = { h: 0, s: 0, l: 0 };
    inner.getHSL(ih);
    outer.getHSL(oh);

    ih.s = Math.max(ih.s, 0.65);
    oh.s = Math.max(oh.s, 0.45);
    ih.l = Math.max(0.45, Math.min(0.72, ih.l));
    oh.l = Math.max(0.30, Math.min(0.58, oh.l));

    inner.setHSL(ih.h, ih.s, ih.l);
    outer.setHSL(oh.h, oh.s, oh.l);

    return { inner, outer };
  }

  // ── Scene ─────────────────────────────────────────────────────────────────

  private makeShaderMesh(radius: number, detail: number, noisePhase: number): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const { inner, outer } = this.getColors();
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time:              { value: noisePhase },
        midLevel:          { value: 0 },
        highLevel:         { value: 0 },
        bassLevel:         { value: 0 },
        displacementScale: { value: this.config.surfaceDetail ?? 0.65 },
        innerColor:        { value: inner },
        outerColor:        { value: outer },
        glowIntensity:     { value: this.config.glowIntensity ?? 1.1 },
        cameraPos:         { value: new THREE.Vector3(0, 0, 6) },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.NormalBlending,   // real translucency, not additive blowout
      side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
  }

  private buildScene(): void {
    if (!this.scene) return;

    [this.surfaceMesh, this.haloMesh, this.coreMesh].forEach((m) => {
      if (!m) return;
      this.scene!.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    if (this.innerLight) { this.scene.remove(this.innerLight); this.innerLight.dispose(); }

    const radius = this.config.radius ?? 2.5;
    const detail = Math.min(Math.round(this.config.meshDetail ?? 6), 8);
    const { inner } = this.getColors();

    // Outer surface — main plasma shell
    this.surfaceMesh = this.makeShaderMesh(radius, detail, 0);
    this.surfaceMaterial = this.surfaceMesh.material as THREE.ShaderMaterial;
    this.scene.add(this.surfaceMesh);

    // Inner halo — slightly smaller with offset noise for layered depth
    this.haloMesh = this.makeShaderMesh(radius * 0.78, Math.max(2, detail - 1), 3.7);
    this.haloMaterial = this.haloMesh.material as THREE.ShaderMaterial;
    this.haloMaterial.uniforms.glowIntensity.value = (this.config.glowIntensity ?? 1.1) * 0.55;
    this.scene.add(this.haloMesh);

    // Tiny core spark — only this uses AdditiveBlending, very small
    const coreGeo = new THREE.IcosahedronGeometry(radius * 0.12, 3);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color:       inner,
      transparent: true,
      opacity:     0.7,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.scene.add(this.coreMesh);

    // Subtle interior light — just enough to warm the inner surface
    this.innerLight = new THREE.PointLight(inner.getHex(), 0.6, radius * 4.5);
    this.scene.add(this.innerLight);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(): void {
    const width  = this.container.clientWidth  || 800;
    const height = this.container.clientHeight || 600;

    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor      = 'grab';
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
      this.cameraRotation.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
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

  // ── Update ────────────────────────────────────────────────────────────────

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.camera) return;

    const { bassAvg, midAvg, highAvg } = audioAnalysis;
    const bassPulse = this.config.bassPulse    ?? 1.2;
    const rotSpeed  = this.config.rotationSpeed ?? 0.002;

    // Asymmetric smoothing: fast attack, slow decay → organic breathing
    const attack = 0.20;
    const decay  = 0.07;
    const bTarget = bassAvg * bassPulse;
    this.smoothBass  += ((bTarget  > this.smoothBass)  ? attack : decay) * (bTarget  - this.smoothBass);
    this.smoothMid   += ((midAvg   > this.smoothMid)   ? attack : decay) * (midAvg   - this.smoothMid);
    this.smoothHigh  += ((highAvg  > this.smoothHigh)  ? attack : decay) * (highAvg  - this.smoothHigh);

    this.time += 0.016 * 1.3;

    // Camera orbit
    if (!this.isDragging) this.cameraRotation.y += rotSpeed;
    const r  = 6;
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

    const applyUniforms = (mat: THREE.ShaderMaterial | null, glowMult = 1.0, timeOffset = 0) => {
      if (!mat) return;
      const u = mat.uniforms;
      u.time.value              = this.time + timeOffset;
      u.bassLevel.value         = this.smoothBass;
      u.midLevel.value          = this.smoothMid;
      u.highLevel.value         = this.smoothHigh;
      u.displacementScale.value = this.config.surfaceDetail ?? 0.65;
      u.glowIntensity.value     = glow * glowMult;
      u.innerColor.value.copy(inner);
      u.outerColor.value.copy(outer);
      u.cameraPos.value.copy(this.camera!.position);
    };

    applyUniforms(this.surfaceMaterial, 1.0, 0);
    applyUniforms(this.haloMaterial,    0.55, 3.7);

    // Core spark — very small, just pulses with bass
    if (this.coreMesh && this.coreMaterial) {
      const coreScale = 1.0 + this.smoothBass * 1.6;
      this.coreMesh.scale.setScalar(coreScale);
      this.coreMaterial.color.copy(inner);
      this.coreMaterial.opacity = Math.min(0.85, 0.55 + this.smoothBass * 0.5);
    }

    // Interior light — warm, subtle, pulses gently with bass
    if (this.innerLight) {
      this.innerLight.color.copy(inner);
      this.innerLight.intensity = 0.5 + this.smoothBass * bassPulse * 1.2;
    }
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // ── Hooks ─────────────────────────────────────────────────────────────────

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
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

  // ── Cleanup ───────────────────────────────────────────────────────────────

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
