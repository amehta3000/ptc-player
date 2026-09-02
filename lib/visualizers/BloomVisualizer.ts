/**
 * Bloom Visualizer
 *
 * Particles hold the form of a layered flower: each one is bound to a home
 * position on a petal surface, so at rest the shape reads as a solid bloom.
 * The 64-bin spectrum is mapped along petal length, so bass swells the core
 * while treble sprays the tips, and louder frequencies push particles off
 * their home positions into a burst that settles back as the sound decays.
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

const VERT = `
uniform sampler2D uSpectrum;
uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uBloom;
uniform float uScatter;
uniform float uTurbulence;
uniform float uSize;
uniform float uReact;

attribute vec3 aHome;
attribute vec3 aDir;
attribute float aU;
attribute float aSeed;

varying float vU;
varying float vEnergy;

void main() {
  // Spectrum along the petal: base of the petal reads bass, tip reads treble.
  // The seed offsets each particle slightly so petals shimmer independently.
  float sx = clamp(aU * 0.85 + aSeed * 0.15, 0.0, 1.0);
  float freq = texture2D(uSpectrum, vec2(sx, 0.5)).r;
  float energy = freq * uReact;

  vec3 pos = aHome;

  // Outward bloom along the petal's own direction
  pos += aDir * (uBloom * energy);

  // Disruption: a seeded scatter that grows with the square of energy, so
  // quiet passages stay composed and loud hits burst the flower apart
  vec3 rnd = normalize(vec3(
    sin(aSeed * 91.7) + 0.001,
    cos(aSeed * 47.3),
    sin(aSeed * 13.1)
  ));
  pos += rnd * (uScatter * energy * energy);

  // Constant drift so the particle cloud never looks frozen
  pos += vec3(
    sin(uTime * 1.7 + aSeed * 20.0),
    cos(uTime * 1.3 + aSeed * 15.0),
    sin(uTime * 2.1 + aSeed * 9.0)
  ) * (uTurbulence * (0.25 + uHigh));

  // Whole-flower breathing on the low end
  pos *= 1.0 + uBass * 0.18;

  vU = aU;
  vEnergy = energy;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  // Centre particles are drawn smaller so the dense stamen does not clip
  float coreTaper = mix(0.62, 1.0, smoothstep(0.0, 0.3, aU));
  gl_PointSize = uSize * coreTaper * (1.0 + energy * 1.6) * (320.0 / max(0.1, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = `
uniform vec3 uColorCore;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;

varying float vU;
varying float vEnergy;

void main() {
  // Soft round sprite with a brighter centre
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d);
  alpha = pow(alpha, 2.4);

  vec3 col = mix(uColorCore, uColorA, smoothstep(0.0, 0.16, vU));
  col = mix(col, uColorB, smoothstep(0.5, 1.0, vU));
  col += uColorB * vEnergy * 0.35;

  gl_FragColor = vec4(col, alpha * uOpacity);
}
`;

export class BloomVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private points: THREE.Points | null = null;
  private spectrumTexture: THREE.DataTexture | null = null;
  private spectrumData: Float32Array = new Float32Array(64);
  private smoothed: Float32Array = new Float32Array(64);

  private cameraRotation = { x: 0.62, y: 0 };
  private cameraDistance = 11;
  private zoomPhase = 0;
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private startTime = Date.now();
  private handleResize: (() => void) | null = null;
  private removeCameraControls: (() => void) | null = null;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Bloom';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Petals', key: 'petals', min: 4, max: 16, step: 1, default: 12, value: this.config.petals ?? 12 },
      { name: 'Layers', key: 'layers', min: 1, max: 5, step: 1, default: 3, value: this.config.layers ?? 3 },
      { name: 'Particles', key: 'particleCount', min: 3000, max: 40000, step: 1000, default: 18000, value: this.config.particleCount ?? 18000 },
      { name: 'Petal Length', key: 'petalLength', min: 1.5, max: 6, step: 0.1, default: 3.4, value: this.config.petalLength ?? 3.4 },
      { name: 'Petal Curl', key: 'curl', min: 0, max: 2.5, step: 0.1, default: 1.1, value: this.config.curl ?? 1.1 },
      { name: 'Bloom', key: 'bloomAmount', min: 0, max: 4, step: 0.1, default: 1.4, value: this.config.bloomAmount ?? 1.4 },
      { name: 'Scatter', key: 'scatter', min: 0, max: 6, step: 0.1, default: 1.8, value: this.config.scatter ?? 1.8 },
      { name: 'Turbulence', key: 'turbulence', min: 0, max: 0.5, step: 0.01, default: 0.08, value: this.config.turbulence ?? 0.08 },
      { name: 'Reactivity', key: 'react', min: 0.2, max: 3, step: 0.1, default: 1.3, value: this.config.react ?? 1.3 },
      { name: 'Particle Size', key: 'particleSize', min: 0.2, max: 4, step: 0.1, default: 0.9, value: this.config.particleSize ?? 0.9 },
      { name: 'Auto Rotation', key: 'autoRotation', min: 0, max: 0.01, step: 0.0005, default: 0.0015, value: this.config.autoRotation ?? 0.0015 },
      { name: 'Zoom Speed', key: 'zoomSpeed', min: 0, max: 0.02, step: 0.001, default: 0, value: this.config.zoomSpeed ?? 0 },
      { name: 'Hue', key: 'hue', min: 0, max: 360, step: 1, default: 0, value: this.config.hue ?? 0 },
      {
        name: 'Harmony', key: 'harmonyMode', min: 0, max: 2, step: 1, default: 1,
        value: this.config.harmonyMode ?? 1, labels: ['Mono', 'Analog', 'Comp']
      },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      // Composed bloom that breathes
      { name: '1', config: { petals: 12, layers: 3, particleCount: 18000, petalLength: 3.4, curl: 1.1, bloomAmount: 1.4, scatter: 1.8, turbulence: 0.08, react: 1.3, particleSize: 0.9, autoRotation: 0.0015, zoomSpeed: 0, hue: 0, harmonyMode: 1 } },
      // Dense dahlia, tight and layered
      { name: '2', config: { petals: 14, layers: 5, particleCount: 22000, petalLength: 2.6, curl: 1.8, bloomAmount: 0.8, scatter: 0.9, turbulence: 0.04, react: 1.0, particleSize: 0.9, autoRotation: 0.003, zoomSpeed: 0, hue: 0, harmonyMode: 2 } },
      // Explosive: every hit blows the petals apart
      { name: '3', config: { petals: 6, layers: 2, particleCount: 22000, petalLength: 4.6, curl: 0.5, bloomAmount: 3.0, scatter: 5.0, turbulence: 0.16, react: 2.2, particleSize: 1.6, autoRotation: 0.001, zoomSpeed: 0.004, hue: 0, harmonyMode: 1 } },
      // Sparse drifting pollen
      { name: '4', config: { petals: 10, layers: 4, particleCount: 9000, petalLength: 3.8, curl: 1.4, bloomAmount: 1.0, scatter: 1.2, turbulence: 0.3, react: 1.1, particleSize: 2.2, autoRotation: 0.004, zoomSpeed: 0.003, hue: 0, harmonyMode: 0 } },
    ];
  }

  /**
   * Additive brightness rises with the number of overlapping particles, so
   * per-particle alpha is scaled against the reference density. Without this
   * a high Particles count clips the whole bloom to white.
   */
  private densityOpacity(): number {
    const base = this.darkMode ? 0.09 : 0.35;
    const count = this.config.particleCount ?? 18000;
    return base * Math.max(0.45, Math.min(1.7, Math.sqrt(18000 / count)));
  }

  init(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(this.darkMode ? 0x000000 : 0xe8ebed, 1);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    this.cameraDistance = this.config.cameraDistance || 12;
    this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));

    this.spectrumTexture = new THREE.DataTexture(
      this.spectrumData, 64, 1, THREE.RedFormat, THREE.FloatType
    );
    this.spectrumTexture.minFilter = THREE.LinearFilter;
    this.spectrumTexture.magFilter = THREE.LinearFilter;
    this.spectrumTexture.needsUpdate = true;

    const { dominant, accent } = this.harmonyColorScheme(this.config.harmonyMode ?? 1, this.config.hue ?? 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSpectrum: { value: this.spectrumTexture },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uBloom: { value: this.config.bloomAmount ?? 1.4 },
        uScatter: { value: this.config.scatter ?? 1.8 },
        uTurbulence: { value: this.config.turbulence ?? 0.08 },
        uSize: { value: this.config.particleSize ?? 0.9 },
        uReact: { value: this.config.react ?? 1.3 },
        uColorCore: { value: new THREE.Color(0xffffff) },
        uColorA: { value: new THREE.Color(dominant) },
        uColorB: { value: new THREE.Color(accent) },
        uOpacity: { value: this.densityOpacity() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: this.darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.buildFlower();

    this.points = new THREE.Points(this.geometry!, this.material);
    this.scene.add(this.points);

    this.updateCameraPosition();
    this.setupCameraControls(this.container);

    this.handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const cw = this.container.clientWidth || 800;
      const ch = this.container.clientHeight || 600;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Distribute particles across a layered flower. Each layer is a whorl of
   * petals: inner whorls are smaller, more upright and more curled, outer
   * ones broader and flatter. A share of the particles forms a dense stamen
   * core so the centre stays solid when the petals blow outward.
   */
  private buildFlower(): void {
    const count = Math.round(this.config.particleCount ?? 18000);
    const petals = Math.round(this.config.petals ?? 8);
    const layers = Math.round(this.config.layers ?? 3);
    const petalLength = this.config.petalLength ?? 3.4;
    const curl = this.config.curl ?? 1.1;

    const home = new Float32Array(count * 3);
    const dir = new Float32Array(count * 3);
    const uArr = new Float32Array(count);
    const seed = new Float32Array(count);

    const coreCount = Math.floor(count * 0.13);

    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number, u: number;
      let dx: number, dy: number, dz: number;

      if (i < coreCount) {
        // Stamen core: a shallow dome of dense particles at the centre
        const a = Math.random() * Math.PI * 2;
        const rr = Math.pow(Math.random(), 0.55) * 0.95;
        x = Math.cos(a) * rr;
        z = Math.sin(a) * rr;
        y = 0.18 + Math.cos(rr * 1.6) * 0.20 + Math.random() * 0.07;
        u = rr * 0.12; // core reads the low end of the spectrum
        dx = Math.cos(a) * 0.35; dy = 1.0; dz = Math.sin(a) * 0.35;
      } else {
        const layer = Math.floor(Math.random() * layers);
        const layerT = layers > 1 ? layer / (layers - 1) : 0;
        const petalsHere = petals + layer * 2;
        const layerScale = 1 - layerT * 0.42;
        const layerCurl = curl * (0.45 + (1 - layerT) * 0.35);
        const layerLift = 0.05 + (1 - layerT) * 0.35;

        const k = Math.floor(Math.random() * petalsHere);
        const baseAngle = (k / petalsHere) * Math.PI * 2 + layer * 0.55;

        // Along the petal, biased slightly toward the tip for a fuller edge
        u = Math.pow(Math.random(), 0.85);
        // Petal width profile: narrow at base and tip, widest mid-petal
        const halfWidth = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.5)
          * (Math.PI / petalsHere) * 0.78;
        const v = (Math.random() * 2 - 1) * halfWidth;
        // Feather the very edge so petals dissolve into particles
        const edge = 1 - Math.abs(v) / Math.max(1e-4, halfWidth);
        if (Math.random() > 0.25 + edge * 0.75) u = Math.min(1, u + Math.random() * 0.15);

        const angle = baseAngle + v;
        const r = (0.95 + u * petalLength) * layerScale;

        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        // Petals rise from the core then fall away at the tips
        y = layerLift + Math.sin(u * Math.PI * 0.7) * layerCurl * layerScale - u * u * layerCurl * 0.5;

        // Outward direction along the petal, tilted with its curl
        const slope = Math.cos(u * Math.PI * 0.7) * layerCurl - 2 * u * layerCurl * 0.5;
        const len = Math.hypot(1, slope) || 1;
        dx = Math.cos(angle) / len;
        dz = Math.sin(angle) / len;
        dy = slope / len;
      }

      home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = z;
      dir[i * 3] = dx; dir[i * 3 + 1] = dy; dir[i * 3 + 2] = dz;
      uArr[i] = u;
      seed[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    // position is required by three; the shader drives placement from aHome
    geometry.setAttribute('position', new THREE.BufferAttribute(home.slice(), 3));
    geometry.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    geometry.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geometry.setAttribute('aU', new THREE.BufferAttribute(uArr, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), petalLength + 8);

    if (this.geometry) this.geometry.dispose();
    this.geometry = geometry;
    if (this.points) this.points.geometry = geometry;
  }

  private setupCameraControls(element: HTMLDivElement): void {
    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.cameraRotation.y += (e.clientX - this.lastMousePos.x) * 0.005;
      this.cameraRotation.x += (e.clientY - this.lastMousePos.y) * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.cameraRotation.x));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { this.isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(4, Math.min(22, this.cameraDistance + e.deltaY * 0.01));
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
          this.cameraDistance = Math.max(4, Math.min(22, this.cameraDistance + (pinchDist - dist) * 0.05));
          this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 10) / 5)));
        }
        pinchDist = dist;
      } else if (this.isDragging) {
        const p = e.touches[0];
        this.cameraRotation.y += (p.clientX - this.lastMousePos.x) * 0.005;
        this.cameraRotation.x += (p.clientY - this.lastMousePos.y) * 0.005;
        this.cameraRotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.cameraRotation.x));
        this.lastMousePos = { x: p.clientX, y: p.clientY };
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
      this.cameraRotation.y += this.config.autoRotation ?? 0.0015;
    }

    const d = this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x) + 1.0;
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0.8, 0);
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.material) return;

    this.updateCameraPosition();

    // Smooth the spectrum so petals swell and settle instead of flickering
    const data = audioAnalysis.audioData;
    for (let i = 0; i < 64; i++) {
      const target = (data[i] || 0) / 255;
      const prev = this.smoothed[i];
      // Fast attack on transients, slow release for a settling bloom
      this.smoothed[i] = target > prev ? prev + (target - prev) * 0.5 : prev + (target - prev) * 0.08;
      this.spectrumData[i] = this.smoothed[i];
    }
    if (this.spectrumTexture) this.spectrumTexture.needsUpdate = true;

    const u = this.material.uniforms;
    u.uTime.value = (Date.now() - this.startTime) / 1000;
    u.uBass.value = (audioAnalysis.bassAvg || 0) / 255;
    u.uHigh.value = (audioAnalysis.highAvg || 0) / 255;
    u.uBloom.value = this.config.bloomAmount ?? 1.4;
    u.uScatter.value = this.config.scatter ?? 1.8;
    u.uTurbulence.value = this.config.turbulence ?? 0.08;
    u.uSize.value = this.config.particleSize ?? 0.9;
    u.uReact.value = this.config.react ?? 1.3;

    const { dominant, accent } = this.harmonyColorScheme(this.config.harmonyMode ?? 1, this.config.hue ?? 0);
    (u.uColorA.value as THREE.Color).set(dominant);
    (u.uColorB.value as THREE.Color).set(accent);
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    if (this.material) {
      (this.material.uniforms.uColorA.value as THREE.Color).set(colors.dominant);
      (this.material.uniforms.uColorB.value as THREE.Color).set(colors.accent);
    }
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    if (key === 'particleCount' || key === 'petals' || key === 'layers' || key === 'petalLength' || key === 'curl') {
      this.buildFlower();
    }
    if (key === 'particleCount' && this.material) {
      this.material.uniforms.uOpacity.value = this.densityOpacity();
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
    if (this.material) {
      // Additive glow reads as light; on a light background it washes out
      this.material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      this.material.uniforms.uOpacity.value = this.densityOpacity();
      (this.material.uniforms.uColorCore.value as THREE.Color).set(isDark ? 0xffffff : 0x2a2a30);
      this.material.needsUpdate = true;
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

    this.geometry?.dispose();
    this.material?.dispose();
    this.spectrumTexture?.dispose();
    this.renderer?.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.spectrumTexture = null;

    this.container.innerHTML = '';
  }
}
