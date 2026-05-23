/**
 * Constellation Visualizer
 *
 * Forked from Sonic Galaxy — treats particles as nodes in a dynamic graph.
 * When nodes drift close, luminous edges form between them; as they separate,
 * edges stretch thin and snap. The result is an audio-reactive network that
 * constantly assembles and disintegrates — a living constellation.
 *
 * Key additions over Sonic Galaxy:
 * - Spatial-hashed proximity detection (O(n×k) not O(n²))
 * - THREE.LineSegments edge mesh with additive-blend alpha fade
 * - Configurable connection threshold, edge opacity, max connections per node
 * - Bass pulses briefly expand threshold → burst of connections on kicks
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme, VisualizerPreset } from './BaseVisualizer';

interface Attractor {
  position: THREE.Vector3;
  mass: number;
  baseMass: number;
  rotationAxis: THREE.Vector3;
  spinStrength: number;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
}

// Maximum number of edge line segments (each needs 2 vertices × 3 floats)
const MAX_EDGES = 8000;

export class ConstellationVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  private attractors: Attractor[] = [];
  private particles: Particle[] = [];
  private particleMesh: THREE.Points | null = null;
  private particleCount: number = 2000;

  // ── Edge system ──
  private edgeMesh: THREE.LineSegments | null = null;
  private edgePositions: Float32Array | null = null;
  private edgeColors: Float32Array | null = null;
  private edgeCount = 0;
  // Spatial hash for proximity detection
  private spatialHash: Map<string, number[]> = new Map();
  // Threshold expansion from beats
  private thresholdBoost = 0;

  // Trail / fade overlay
  private fadeScene: THREE.Scene | null = null;
  private fadeCamera: THREE.OrthographicCamera | null = null;
  private fadeMaterial: THREE.MeshBasicMaterial | null = null;

  // Physics constants
  private readonly GRAVITY_CONSTANT = 6.67e-10;
  private readonly DELTA_TIME = 1 / 60;

  // Camera controls
  private cameraRotation = { x: 0.35, y: 0 };
  private cameraDistance = 8;
  private zoomPhase = Math.asin((8 - 11) / 9); // phase matched to default distance
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  // Spectrum texture for 64-bin frequency data
  private spectrumTexture: THREE.DataTexture | null = null;
  private spectrumDataArray: Float32Array = new Float32Array(64);

  // Beat detection
  private beatThreshold = 0;
  private lastBeatTime = 0;
  private beatCooldown = 300;
  private beatBoost = 1.0;

  // Smoothed audio values
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Constellation';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Particle Count', key: 'particleCount', min: 400, max: 10000, step: 200, default: 2000, value: this.config.particleCount || 2000 },
      { name: 'Attractor Count', key: 'attractorCount', min: 2, max: 6, step: 1, default: 3, value: this.config.attractorCount || 3 },
      { name: 'Max Speed', key: 'maxSpeed', min: 0, max: 10, step: 0.5, default: 0.5, value: this.config.maxSpeed ?? 0.5 },
      { name: 'Particle Size', key: 'particleSize', min: 0.5, max: 3, step: 0.5, default: 0.5, value: this.config.particleSize || 0.5 },
      { name: 'Camera Speed', key: 'cameraSpeed', min: 0, max: 0.02, step: 0.001, default: 0.001, value: this.config.cameraSpeed ?? 0.001 },
      { name: 'Zoom Speed', key: 'zoomSpeed', min: 0, max: 0.02, step: 0.001, default: 0, value: this.config.zoomSpeed ?? 0 },
      { name: 'Trail', key: 'trail', min: 0, max: 0.95, step: 0.01, default: 0, value: this.config.trail ?? 0 },
      { name: 'Hue', key: 'hue', min: 0, max: 360, step: 1, default: 0, value: this.config.hue ?? 0 },
      { name: 'Harmony', key: 'harmonyMode', min: 0, max: 2, step: 1, default: 0, value: this.config.harmonyMode ?? 0, labels: ['Mono', 'Analogous', 'Complement'] },
      { name: 'Gravity', key: 'gravity', min: 0, max: 10, step: 0.5, default: 7.0, value: this.config.gravity ?? 7.0 },
      { name: 'Connection Dist', key: 'connectionThreshold', min: 0.1, max: 2.0, step: 0.05, default: 0.6, value: this.config.connectionThreshold ?? 0.6 },
      { name: 'Edge Opacity', key: 'edgeOpacity', min: 0, max: 1, step: 0.05, default: 0.5, value: this.config.edgeOpacity ?? 0.5 },
      { name: 'Max Connections', key: 'maxConnections', min: 1, max: 8, step: 1, default: 3, value: this.config.maxConnections ?? 3 },
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      {
        name: '1',
        config: { particleCount: 2000, attractorCount: 3, gravity: 7.0, maxSpeed: 0.5, particleSize: 0.5, cameraSpeed: 0.001, trail: 0, hue: 0, harmonyMode: 0, connectionThreshold: 0.6, edgeOpacity: 0.5, maxConnections: 3 }
      },
      {
        name: '2',
        config: { particleCount: 3000, attractorCount: 4, gravity: 9.0, maxSpeed: 0.5, particleSize: 0.5, cameraSpeed: 0.002, trail: 0.14, hue: 200, harmonyMode: 1, connectionThreshold: 0.8, edgeOpacity: 0.6, maxConnections: 4 }
      },
      {
        name: '3',
        config: { particleCount: 1000, attractorCount: 2, gravity: 5.0, maxSpeed: 1.0, particleSize: 0.5, cameraSpeed: 0.005, trail: 0, hue: 280, harmonyMode: 2, connectionThreshold: 1.2, edgeOpacity: 0.4, maxConnections: 5 }
      },
      {
        name: '4',
        config: { particleCount: 4000, attractorCount: 6, gravity: 3.0, maxSpeed: 0.5, particleSize: 0.5, cameraSpeed: 0.001, trail: 0.06, hue: 30, harmonyMode: 1, connectionThreshold: 0.4, edgeOpacity: 0.7, maxConnections: 2 }
      }
    ];
  }

  init(): void {
    this.scene = new THREE.Scene();
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = false;

    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

    // Trail overlay
    this.fadeScene = new THREE.Scene();
    this.fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fadeGeo = new THREE.PlaneGeometry(2, 2);
    const trail = this.config.trail ?? 0;
    this.fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: trail > 0 ? 0.08 * (1 - trail) : 1
    });
    this.fadeScene.add(new THREE.Mesh(fadeGeo, this.fadeMaterial));
    if (trail > 0) {
      this.renderer.domElement.style.filter = `blur(${trail * 2}px)`;
    }

    this.initializeAttractors();
    this.initializeParticles();
    this.initializeEdges();
    this.updateCameraPosition();
    this.setupMouseControls(this.container);

    const handleResize = () => {
      if (!this.camera || !this.renderer || !this.container) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
  }

  // ── Attractors ──

  private initializeAttractors(): void {
    const count = this.config.attractorCount || 3;
    this.attractors = [];
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const radius = 2.5;
      this.attractors.push({
        position: new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        ),
        mass: 5e7,
        baseMass: 5e7,
        rotationAxis: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
        spinStrength: 2.0
      });
    }
  }

  // ── Particles ──

  private initializeParticles(): void {
    if (this.spectrumTexture) this.spectrumTexture.dispose();

    const count = this.config.particleCount || this.particleCount;
    this.particles = [];

    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const frequencyBins: number[] = [];

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 3 + 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );
      const mass = (Math.random() * 0.75 + 0.25) * 1e4;
      this.particles.push({ position, velocity, mass });

      const frequencyBin = Math.floor(Math.min(63, Math.max(0, (radius - 1) / 3 * 63)));
      const harmonyHues = this.getHarmonyHues(this.config.hue ?? 0, this.config.harmonyMode ?? 0);
      const pickHue = harmonyHues[Math.floor(Math.random() * harmonyHues.length)];
      const hue = pickHue + (Math.random() - 0.5) * 15;
      const saturation = 65 + Math.random() * 35;
      const lightness = this.darkMode ? (50 + Math.random() * 30) : (20 + Math.random() * 25);
      const color = new THREE.Color().setHSL(((hue % 360 + 360) % 360) / 360, saturation / 100, lightness / 100);

      positions.push(position.x, position.y, position.z);
      colors.push(color.r, color.g, color.b);
      sizes.push((mass / 1e4) * (this.config.particleSize || 0.5));
      frequencyBins.push(frequencyBin);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('frequencyBand', new THREE.Float32BufferAttribute(frequencyBins, 1));

    this.spectrumDataArray = new Float32Array(64);
    this.spectrumTexture = new THREE.DataTexture(this.spectrumDataArray, 64, 1, THREE.RedFormat, THREE.FloatType);
    this.spectrumTexture.minFilter = THREE.LinearFilter;
    this.spectrumTexture.magFilter = THREE.LinearFilter;
    this.spectrumTexture.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(this.colors.dominant) },
        colorB: { value: new THREE.Color(this.colors.accent) },
        spectrumData: { value: this.spectrumTexture },
        bassIntensity: { value: 0.0 },
        midIntensity: { value: 0.0 },
        highIntensity: { value: 0.0 },
        beatBoost: { value: 1.0 },
        darkMode: { value: this.darkMode ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float frequencyBand;
        uniform sampler2D spectrumData;
        uniform float beatBoost;
        varying vec3 vColor;
        varying float vAmplitude;

        void main() {
          vColor = color;
          float amplitude = texture2D(spectrumData, vec2((frequencyBand + 0.5) / 64.0, 0.5)).r;
          vAmplitude = amplitude;
          float shellScale = 3.0 - (frequencyBand / 63.0) * 1.5;
          float audioBoost = 1.0 + amplitude * shellScale;
          audioBoost *= beatBoost;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * audioBoost * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float bassIntensity;
        uniform float darkMode;
        varying vec3 vColor;
        varying float vAmplitude;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float gaussian = exp(-dist * dist * 6.0);
          float brightness = 0.2 + vAmplitude * 2.0;
          float maxBright = darkMode > 0.5 ? 3.0 : 1.0;
          brightness = clamp(brightness, 0.2, maxBright);
          float bassPulse = darkMode > 0.5 ? (0.2 + bassIntensity * 0.8) : (0.6 + bassIntensity * 0.4);
          float alpha = gaussian * brightness * bassPulse;
          alpha = darkMode > 0.5 ? alpha : clamp(alpha * 2.5, 0.0, 1.0);
          gl_FragColor = vec4(vColor * brightness, alpha);
        }
      `,
      transparent: true,
      blending: this.darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });

    this.particleMesh = new THREE.Points(geometry, material);
    this.scene!.add(this.particleMesh);
  }

  // ── Edge system ──

  private initializeEdges(): void {
    // Pre-allocate buffers for MAX_EDGES line segments (2 vertices each)
    this.edgePositions = new Float32Array(MAX_EDGES * 2 * 3);
    this.edgeColors = new Float32Array(MAX_EDGES * 2 * 4); // RGBA per vertex

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.edgeColors, 4));
    geometry.setDrawRange(0, 0); // Start with no edges visible

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          gl_FragColor = vColor;
        }
      `,
      transparent: true,
      blending: this.darkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });

    this.edgeMesh = new THREE.LineSegments(geometry, material);
    this.scene!.add(this.edgeMesh);
  }

  private buildSpatialHash(cellSize: number): void {
    this.spatialHash.clear();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i].position;
      const key = `${Math.floor(p.x / cellSize)}|${Math.floor(p.y / cellSize)}|${Math.floor(p.z / cellSize)}`;
      let bucket = this.spatialHash.get(key);
      if (!bucket) {
        bucket = [];
        this.spatialHash.set(key, bucket);
      }
      bucket.push(i);
    }
  }

  private updateEdges(): void {
    if (!this.edgePositions || !this.edgeColors || !this.particleMesh) return;

    const threshold = (this.config.connectionThreshold ?? 0.6) + this.thresholdBoost;
    const baseOpacity = this.config.edgeOpacity ?? 0.5;
    const maxConn = this.config.maxConnections ?? 3;
    const cellSize = threshold; // cell size matches threshold for efficient neighbor lookup

    // Build spatial hash
    this.buildSpatialHash(cellSize);

    // Track connections per node
    const connectionCount = new Uint8Array(this.particles.length);
    const particleColors = this.particleMesh.geometry.attributes.color.array as Float32Array;

    let edgeIdx = 0;
    const thresholdSq = threshold * threshold;

    // Collect keys once to avoid Map iterator (downlevelIteration)
    const keys: string[] = [];
    this.spatialHash.forEach((_bucket, key) => { keys.push(key); });

    // Iterate all cells
    for (let ki = 0; ki < keys.length && edgeIdx < MAX_EDGES; ki++) {
      const key = keys[ki];
      const bucket = this.spatialHash.get(key)!;
      const parts = key.split('|');
      const cx = parseInt(parts[0]);
      const cy = parseInt(parts[1]);
      const cz = parseInt(parts[2]);

      // Check this cell + 13 forward neighbors (avoids double-counting pairs)
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dy === 0 && dz === 0) {
              // Same cell — check pairs within bucket
              for (let a = 0; a < bucket.length; a++) {
                const i = bucket[a];
                if (connectionCount[i] >= maxConn) continue;
                for (let b = a + 1; b < bucket.length; b++) {
                  if (edgeIdx >= MAX_EDGES) break;
                  const j = bucket[b];
                  if (connectionCount[j] >= maxConn) continue;

                  const pi = this.particles[i].position;
                  const pj = this.particles[j].position;
                  const distSq = (pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2 + (pi.z - pj.z) ** 2;
                  if (distSq < thresholdSq) {
                    const alpha = baseOpacity * (1 - Math.sqrt(distSq) / threshold);
                    this.writeEdge(edgeIdx, i, j, alpha, particleColors);
                    edgeIdx++;
                    connectionCount[i]++;
                    connectionCount[j]++;
                  }
                }
              }
              continue;
            }
            if (dx === 0 && (dy < 0 || (dy === 0 && dz < 0))) continue; // Only forward neighbors

            const neighborKey = `${cx + dx}|${cy + dy}|${cz + dz}`;
            const neighborBucket = this.spatialHash.get(neighborKey);
            if (!neighborBucket) continue;

            for (let bi = 0; bi < bucket.length; bi++) {
              const i = bucket[bi];
              if (connectionCount[i] >= maxConn) continue;
              for (let ni = 0; ni < neighborBucket.length; ni++) {
                if (edgeIdx >= MAX_EDGES) break;
                const j = neighborBucket[ni];
                if (connectionCount[j] >= maxConn) continue;

                const pi = this.particles[i].position;
                const pj = this.particles[j].position;
                const distSq = (pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2 + (pi.z - pj.z) ** 2;
                if (distSq < thresholdSq) {
                  const alpha = baseOpacity * (1 - Math.sqrt(distSq) / threshold);
                  this.writeEdge(edgeIdx, i, j, alpha, particleColors);
                  edgeIdx++;
                  connectionCount[i]++;
                  connectionCount[j]++;
                }
              }
            }
          }
        }
      }
    }

    this.edgeCount = edgeIdx;
    if (this.edgeMesh) {
      this.edgeMesh.geometry.setDrawRange(0, edgeIdx * 2);
      this.edgeMesh.geometry.attributes.position.needsUpdate = true;
      this.edgeMesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  private writeEdge(edgeIdx: number, i: number, j: number, alpha: number, particleColors: Float32Array): void {
    const pi = this.particles[i].position;
    const pj = this.particles[j].position;
    const posBase = edgeIdx * 6;
    this.edgePositions![posBase] = pi.x;
    this.edgePositions![posBase + 1] = pi.y;
    this.edgePositions![posBase + 2] = pi.z;
    this.edgePositions![posBase + 3] = pj.x;
    this.edgePositions![posBase + 4] = pj.y;
    this.edgePositions![posBase + 5] = pj.z;

    // Color: average of the two connected nodes
    const colBase = edgeIdx * 8;
    const ci = i * 3;
    const cj = j * 3;
    const r = (particleColors[ci] + particleColors[cj]) * 0.5;
    const g = (particleColors[ci + 1] + particleColors[cj + 1]) * 0.5;
    const b = (particleColors[ci + 2] + particleColors[cj + 2]) * 0.5;
    this.edgeColors![colBase] = r;
    this.edgeColors![colBase + 1] = g;
    this.edgeColors![colBase + 2] = b;
    this.edgeColors![colBase + 3] = alpha;
    this.edgeColors![colBase + 4] = r;
    this.edgeColors![colBase + 5] = g;
    this.edgeColors![colBase + 6] = b;
    this.edgeColors![colBase + 7] = alpha;
  }

  // ── Physics ──

  private updatePhysics(audioAnalysis: AudioAnalysis): void {
    const bassNormalized = audioAnalysis.bassAvg;
    const midNormalized = audioAnalysis.midAvg;
    const highNormalized = audioAnalysis.highAvg;

    const smoothing = 0.3;
    this.smoothBass += (bassNormalized - this.smoothBass) * smoothing;
    this.smoothMid += (midNormalized - this.smoothMid) * smoothing;
    this.smoothHigh += (highNormalized - this.smoothHigh) * smoothing;

    const bass = Math.max(bassNormalized, this.smoothBass);
    const mid = Math.max(midNormalized, this.smoothMid);
    const high = Math.max(highNormalized, this.smoothHigh);

    const gravityMult = this.config.gravity ?? 7.0;

    // Decay beat boost and threshold boost
    this.beatBoost += (1 - this.beatBoost) * 0.06;
    this.thresholdBoost *= 0.92; // Decay threshold expansion

    this.attractors.forEach((attractor, idx) => {
      const freqMod = (idx % 3) / 3;
      const audioValue = freqMod < 0.33 ? bass : freqMod < 0.66 ? mid : high;
      attractor.mass = attractor.baseMass * (gravityMult / 7) * (1 + audioValue * gravityMult) * this.beatBoost;
      attractor.spinStrength = 2.0 + mid * 1.0;
    });

    // Beat detection
    const currentEnergy = bass * 0.5 + mid * 0.3 + high * 0.2;
    if (currentEnergy > this.beatThreshold * 1.9) {
      const now = Date.now();
      if (now - this.lastBeatTime > this.beatCooldown) {
        this.onBeat(currentEnergy);
        this.lastBeatTime = now;
      }
    }
    this.beatThreshold = this.beatThreshold * 0.93 + currentEnergy * 0.07;

    // Particle physics
    const maxSpeed = this.config.maxSpeed ?? 0.5;
    const damping = 0.96;

    this.particles.forEach((particle) => {
      const force = new THREE.Vector3(0, 0, 0);

      this.attractors.forEach((attractor) => {
        const toAttractor = new THREE.Vector3().subVectors(attractor.position, particle.position);
        const distance = toAttractor.length();
        if (distance < 0.1) return;

        const direction = toAttractor.normalize();
        const gravityStrength = (attractor.mass * particle.mass * this.GRAVITY_CONSTANT) / (distance * distance);
        force.add(direction.multiplyScalar(gravityStrength));

        const spinForce = new THREE.Vector3()
          .crossVectors(attractor.rotationAxis, toAttractor)
          .multiplyScalar(gravityStrength * attractor.spinStrength);
        force.add(spinForce);
      });

      // Soft boundary
      const distFromOrigin = particle.position.length();
      if (distFromOrigin > 8) {
        const pullStrength = (distFromOrigin - 8) * 0.15;
        force.add(particle.position.clone().normalize().multiplyScalar(-pullStrength));
      }

      particle.velocity.add(force.multiplyScalar(this.DELTA_TIME));
      const speed = particle.velocity.length();
      if (speed > maxSpeed) particle.velocity.normalize().multiplyScalar(maxSpeed);
      particle.velocity.multiplyScalar(damping);
      particle.position.add(new THREE.Vector3().copy(particle.velocity).multiplyScalar(this.DELTA_TIME));
    });
  }

  private onBeat(energy: number): void {
    this.beatBoost = 1 + energy * 4;
    // Expand connection threshold briefly on beats
    this.thresholdBoost = energy * 0.4;

    this.particles.forEach((particle) => {
      const dir = particle.position.clone().normalize();
      particle.velocity.add(dir.multiplyScalar(energy * 2));
    });
  }

  // ── Camera ──

  private setupMouseControls(element: HTMLDivElement): void {
    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      const pos = 'touches' in e ? e.touches[0] : e;
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      this.cameraRotation.y += (pos.clientX - this.lastMousePos.x) * 0.005;
      this.cameraRotation.x += (pos.clientY - this.lastMousePos.y) * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    const onMouseUp = () => { this.isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDistance = Math.max(2, Math.min(20, this.cameraDistance + e.deltaY * 0.01));
      this.zoomPhase = Math.asin(Math.max(-1, Math.min(1, (this.cameraDistance - 11) / 9)));
      this.updateCameraPosition();
    };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mouseleave', onMouseUp);
    element.addEventListener('touchstart', onMouseDown);
    element.addEventListener('touchmove', onMouseMove);
    element.addEventListener('touchend', onMouseUp);
    element.addEventListener('wheel', onWheel, { passive: false });
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const d = this.config.cameraDistance || this.cameraDistance;
    this.camera.position.x = d * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = d * Math.sin(this.cameraRotation.x);
    this.camera.position.z = d * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, 0);
  }

  // ── Main loop ──

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    if (audioAnalysis.isPlaying) {
      this.updatePhysics(audioAnalysis);
    }

    if (!this.isDragging) {
      this.cameraRotation.y += this.config.cameraSpeed ?? 0.001;
    }
    const zoomSpeed = this.config.zoomSpeed ?? 0;
    if (zoomSpeed > 0) {
      this.zoomPhase += zoomSpeed;
      this.cameraDistance = 11 + 9 * Math.sin(this.zoomPhase);
    }
    this.updateCameraPosition();

    // Update spectrum texture
    if (this.spectrumTexture) {
      const audioData = audioAnalysis.audioData;
      for (let i = 0; i < 64; i++) {
        this.spectrumDataArray[i] = (audioData[i] || 0) / 255;
      }
      this.spectrumTexture.needsUpdate = true;
    }

    // Sync particle geometry
    if (this.particleMesh) {
      const positions = this.particleMesh.geometry.attributes.position.array as Float32Array;
      const sizes = this.particleMesh.geometry.attributes.size.array as Float32Array;
      const baseSize = this.config.particleSize || 0.5;

      if (this.particleMesh.material instanceof THREE.ShaderMaterial) {
        this.particleMesh.material.uniforms.bassIntensity.value = Math.max(audioAnalysis.bassAvg, this.smoothBass);
        this.particleMesh.material.uniforms.midIntensity.value = Math.max(audioAnalysis.midAvg, this.smoothMid);
        this.particleMesh.material.uniforms.highIntensity.value = Math.max(audioAnalysis.highAvg, this.smoothHigh);
        this.particleMesh.material.uniforms.beatBoost.value = this.beatBoost;
      }

      this.particles.forEach((particle, i) => {
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        const speed = particle.velocity.length();
        sizes[i] = (particle.mass / 1e4) * baseSize * (1 + speed * 0.1);
      });

      this.particleMesh.geometry.attributes.position.needsUpdate = true;
      this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }

    // Update edges
    this.updateEdges();
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;

    const trail = this.config.trail ?? 0;
    if (trail > 0 && this.fadeScene && this.fadeCamera) {
      this.renderer.render(this.fadeScene, this.fadeCamera);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ── Lifecycle ──

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.particleMesh) {
      this.particleMesh.geometry.dispose();
      if (this.particleMesh.material instanceof THREE.Material) this.particleMesh.material.dispose();
    }
    if (this.edgeMesh) {
      this.edgeMesh.geometry.dispose();
      if (this.edgeMesh.material instanceof THREE.Material) this.edgeMesh.material.dispose();
    }
    if (this.spectrumTexture) {
      this.spectrumTexture.dispose();
      this.spectrumTexture = null;
    }
    if (this.fadeMaterial) this.fadeMaterial.dispose();
    if (this.renderer) {
      this.renderer.domElement.style.filter = 'none';
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleMesh = null;
    this.edgeMesh = null;
    this.edgePositions = null;
    this.edgeColors = null;
    this.fadeScene = null;
    this.fadeCamera = null;
    this.fadeMaterial = null;
    this.particles = [];
    this.attractors = [];
    this.spatialHash.clear();
  }

  setDarkMode(isDark: boolean): void {
    super.setDarkMode(isDark);
    if (this.renderer) this.renderer.setClearColor(isDark ? 0x000000 : 0xe8ebed, 1);
    if (this.fadeMaterial) this.fadeMaterial.color.set(isDark ? 0x000000 : 0xe8ebed);
    if (this.particleMesh && this.particleMesh.material instanceof THREE.ShaderMaterial) {
      this.particleMesh.material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      this.particleMesh.material.uniforms.darkMode.value = isDark ? 1.0 : 0.0;
      this.particleMesh.material.needsUpdate = true;
    }
    if (this.edgeMesh && this.edgeMesh.material instanceof THREE.ShaderMaterial) {
      this.edgeMesh.material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      this.edgeMesh.material.needsUpdate = true;
    }
    this.recolorParticles();
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    if (key === 'particleCount' && this.scene) {
      if (this.particleMesh) {
        this.scene.remove(this.particleMesh);
        this.particleMesh.geometry.dispose();
        if (this.particleMesh.material instanceof THREE.Material) this.particleMesh.material.dispose();
      }
      this.particleCount = value;
      this.initializeParticles();
    }

    if (key === 'attractorCount' && this.scene) this.initializeAttractors();
    if (key === 'cameraDistance') { this.cameraDistance = value; this.updateCameraPosition(); }

    if (key === 'particleSize' && this.particleMesh) {
      const sizes = this.particleMesh.geometry.attributes.size.array as Float32Array;
      this.particles.forEach((particle, i) => { sizes[i] = (particle.mass / 1e4) * value; });
      this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }

    if (key === 'trail' && this.renderer) {
      if (this.fadeMaterial) this.fadeMaterial.opacity = value > 0 ? 0.08 * (1 - value) : 1;
      this.renderer.domElement.style.filter = value > 0 ? `blur(${value * 2}px)` : 'none';
    }

    if ((key === 'hue' || key === 'harmonyMode') && this.particleMesh) this.recolorParticles();
  }

  updateColors(colors: ColorScheme): void {
    this.colors = colors;
  }

  private getHarmonyHues(hue: number, mode: number): number[] {
    switch (mode) {
      case 0: return [hue];
      case 1: return [hue - 30, hue, hue + 30];
      case 2: return [hue, hue + 180];
      default: return [hue];
    }
  }

  private recolorParticles(): void {
    if (!this.particleMesh) return;
    const colorAttr = this.particleMesh.geometry.getAttribute('color');
    if (!colorAttr) return;
    const arr = colorAttr.array as Float32Array;
    const harmonyHues = this.getHarmonyHues(this.config.hue ?? 0, this.config.harmonyMode ?? 0);
    const count = arr.length / 3;
    const tmpColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const pickHue = harmonyHues[Math.floor(Math.random() * harmonyHues.length)];
      const hue = pickHue + (Math.random() - 0.5) * 15;
      const sat = 65 + Math.random() * 35;
      const lit = this.darkMode ? (50 + Math.random() * 30) : (20 + Math.random() * 25);
      tmpColor.setHSL(((hue % 360 + 360) % 360) / 360, sat / 100, lit / 100);
      arr[i * 3] = tmpColor.r;
      arr[i * 3 + 1] = tmpColor.g;
      arr[i * 3 + 2] = tmpColor.b;
    }
    colorAttr.needsUpdate = true;
  }
}
