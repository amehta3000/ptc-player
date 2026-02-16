/**
 * Sonic Galaxy Visualizer
 *
 * A particle-based visualizer featuring gravitational attractors that react to audio frequencies.
 * Inspired by the Three.js compute attractor particles example.
 *
 * Key Features:
 * - Configurable particles forming a dynamic galaxy
 * - Multiple attractors positioned in spherical formation
 * - Bass frequencies control attractor gravity strength (particle swirl intensity)
 * - Mid frequencies control spinning force (orbital velocity)
 * - High frequencies affect particle energy/brightness
 * - Beat detection creates temporary gravity waves with velocity kicks
 * - Soft boundary keeps particles in view without hard edges
 * - Auto-rotating camera for cinematic view
 * - Color gradient based on particle velocity
 * - Optional gaussian blur for smoke/nebula effect
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

interface Attractor {
  position: THREE.Vector3;
  mass: number;
  baseMass: number;
  rotationAxis: THREE.Vector3;
  spinStrength: number;
  visualHelper?: THREE.Group;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
}

export class SonicGalaxyVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  private attractors: Attractor[] = [];
  private particles: Particle[] = [];
  private particleMesh: THREE.Points | null = null;
  private particleCount: number = 30000;

  // Trail / fade overlay
  private fadeScene: THREE.Scene | null = null;
  private fadeCamera: THREE.OrthographicCamera | null = null;
  private fadeMaterial: THREE.MeshBasicMaterial | null = null;

  // Physics constants
  private readonly GRAVITY_CONSTANT = 6.67e-10;
  private readonly DELTA_TIME = 1 / 60;

  // Camera controls
  private cameraAngle = 0;
  private cameraHeight = 3;
  private cameraDistance = 8;

  // Beat detection
  private beatThreshold = 0;
  private lastBeatTime = 0;
  private beatCooldown = 300; // ms
  private beatBoost = 1.0;

  // Smoothed audio values for sustained reactivity
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Sonic Galaxy';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Particle Count',
        key: 'particleCount',
        min: 1000,
        max: 100000,
        step: 5000,
        default: 30000,
        value: this.config.particleCount || 30000
      },
      {
        name: 'Attractor Count',
        key: 'attractorCount',
        min: 2,
        max: 6,
        step: 1,
        default: 4,
        value: this.config.attractorCount || 4
      },
      {
        name: 'Bass Gravity',
        key: 'bassGravity',
        min: 0.5,
        max: 10,
        step: 0.5,
        default: 2.0,
        value: this.config.bassGravity || 2.0
      },
      {
        name: 'Mid Spin',
        key: 'midSpin',
        min: 0.5,
        max: 10,
        step: 0.5,
        default: 2.0,
        value: this.config.midSpin || 2.0
      },
      {
        name: 'Max Speed',
        key: 'maxSpeed',
        min: 2,
        max: 15,
        step: 0.5,
        default: 8,
        value: this.config.maxSpeed || 8
      },
      {
        name: 'Velocity Damping',
        key: 'velocityDamping',
        min: 0,
        max: 0.2,
        step: 0.01,
        default: 0.04,
        value: this.config.velocityDamping ?? 0.04
      },
      {
        name: 'Particle Size',
        key: 'particleSize',
        min: 0.5,
        max: 5,
        step: 0.5,
        default: 1.0,
        value: this.config.particleSize || 1.0
      },
      {
        name: 'Camera Speed',
        key: 'cameraSpeed',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0.004,
        value: this.config.cameraSpeed ?? 0.004
      },
      {
        name: 'Trail',
        key: 'trail',
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0,
        value: this.config.trail ?? 0
      },
      {
        name: 'Beat Sensitivity',
        key: 'beatSensitivity',
        min: 0.5,
        max: 2,
        step: 0.1,
        default: 1.2,
        value: this.config.beatSensitivity || 1.2
      }
    ];
  }

  init(): void {
    // Three.js setup - use container directly
    this.scene = new THREE.Scene();

    // Get container dimensions (fallback to reasonable defaults)
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = false;

    this.container.appendChild(this.renderer.domElement);

    // Trail: fade overlay (semi-transparent black plane to create persistence)
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
    const fadeMesh = new THREE.Mesh(fadeGeo, this.fadeMaterial);
    this.fadeScene.add(fadeMesh);

    // Apply subtle CSS blur for softness when trail is on
    if (trail > 0) {
      this.renderer.domElement.style.filter = `blur(${trail * 2}px)`;
    }

    // Initialize attractors
    this.initializeAttractors();

    // Initialize particles
    this.initializeParticles();

    // Set initial camera position
    this.updateCameraPosition();

    // Handle window resize
    const handleResize = () => {
      if (!this.camera || !this.renderer || !this.container) return;
      const width = this.container.clientWidth || 800;
      const height = this.container.clientHeight || 600;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop will be started by base class start() method
  }

  private initializeAttractors(): void {
    const count = this.config.attractorCount || 4;
    this.attractors = [];

    // Position attractors in a spherical formation
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const radius = 2.5;
      const position = new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      );

      // Create random rotation axis for spinning
      const rotationAxis = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      this.attractors.push({
        position: position,
        mass: 5e7,
        baseMass: 5e7,
        rotationAxis: rotationAxis,
        spinStrength: 2.0
      });
    }
  }

  private initializeParticles(): void {
    const count = this.config.particleCount || this.particleCount;
    this.particles = [];

    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < count; i++) {
      // Random spherical distribution
      const radius = Math.random() * 3 + 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // Random initial velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );

      const mass = (Math.random() * 0.75 + 0.25) * 1e4;

      this.particles.push({ position, velocity, mass });

      // Generate random color for each particle
      const hue = Math.random() * 360;
      const saturation = 60 + Math.random() * 40; // 60-100%
      const lightness = 50 + Math.random() * 30; // 50-80%
      const color = new THREE.Color().setHSL(hue / 360, saturation / 100, lightness / 100);

      // Add to geometry arrays
      positions.push(position.x, position.y, position.z);
      colors.push(color.r, color.g, color.b);
      sizes.push((mass / 1e4) * (this.config.particleSize || 1.0));
    }

    // Assign each particle to a frequency band (bass, mid, or high)
    const frequencyBands: number[] = [];
    for (let i = 0; i < count; i++) {
      frequencyBands.push(i % 3); // 0=bass, 1=mid, 2=high
    }

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('frequencyBand', new THREE.Float32BufferAttribute(frequencyBands, 1));

    // Create particle material with audio-reactive shaders
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(this.colors.dominant) },
        colorB: { value: new THREE.Color(this.colors.accent) },
        bassIntensity: { value: 0.0 },
        midIntensity: { value: 0.0 },
        highIntensity: { value: 0.0 },
        beatBoost: { value: 1.0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float frequencyBand;
        uniform float bassIntensity;
        uniform float midIntensity;
        uniform float highIntensity;
        uniform float beatBoost;
        varying vec3 vColor;
        varying float vFrequencyBand;

        void main() {
          vColor = color;
          vFrequencyBand = frequencyBand;

          // Audio-reactive size modulation per frequency band
          float audioBoost = 1.0;
          if (frequencyBand < 0.5) {
            audioBoost += bassIntensity * 3.0;
          } else if (frequencyBand < 1.5) {
            audioBoost += midIntensity * 2.0;
          } else {
            audioBoost += highIntensity * 1.5;
          }
          audioBoost *= beatBoost;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * audioBoost * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float bassIntensity;
        uniform float midIntensity;
        uniform float highIntensity;
        varying vec3 vColor;
        varying float vFrequencyBand;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));

          // Gaussian falloff for smoky, nebula-like appearance
          float gaussian = exp(-dist * dist * 6.0);

          // Get intensity based on frequency band
          float bandIntensity = 0.2;
          if (vFrequencyBand < 0.5) {
            bandIntensity += bassIntensity * 2.0;
          } else if (vFrequencyBand < 1.5) {
            bandIntensity += midIntensity * 2.0;
          } else {
            bandIntensity += highIntensity * 2.0;
          }

          bandIntensity = clamp(bandIntensity, 0.2, 3.0);

          // Bass-driven global opacity pulse
          float bassPulse = 0.2 + bassIntensity * 0.8;

          float alpha = gaussian * bandIntensity * bassPulse;
          gl_FragColor = vec4(vColor * bandIntensity, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleMesh = new THREE.Points(geometry, material);
    this.scene!.add(this.particleMesh);
  }

  private updatePhysics(audioAnalysis: AudioAnalysis): void {
    const bassNormalized = audioAnalysis.bassAvg / 255;
    const midNormalized = audioAnalysis.midAvg / 255;
    const highNormalized = audioAnalysis.highAvg / 255;

    // Smooth audio values for sustained, visible reactivity
    const smoothing = 0.3;
    this.smoothBass += (bassNormalized - this.smoothBass) * smoothing;
    this.smoothMid += (midNormalized - this.smoothMid) * smoothing;
    this.smoothHigh += (highNormalized - this.smoothHigh) * smoothing;

    // Use the higher of raw or smoothed — responsive on attack, sustained on decay
    const bass = Math.max(bassNormalized, this.smoothBass);
    const mid = Math.max(midNormalized, this.smoothMid);
    const high = Math.max(highNormalized, this.smoothHigh);

    // Update attractor properties based on audio
    const bassGravityMult = this.config.bassGravity || 2.0;
    const midSpinMult = this.config.midSpin || 2.0;

    // Decay beat boost toward 1
    this.beatBoost += (1 - this.beatBoost) * 0.06;

    this.attractors.forEach((attractor, idx) => {
      // Different attractors react to different frequencies
      const freqMod = (idx % 3) / 3;
      const audioValue = freqMod < 0.33 ? bass :
                        freqMod < 0.66 ? mid :
                        high;

      // Stronger audio-driven mass changes for dramatic gravity swings
      attractor.mass = attractor.baseMass * (1 + audioValue * bassGravityMult * 12) * this.beatBoost;
      attractor.spinStrength = 2.0 + mid * midSpinMult * 10;
    });

    // Detect beats — weighted toward bass
    const currentEnergy = bass * 0.5 + mid * 0.3 + high * 0.2;
    if (currentEnergy > this.beatThreshold * (this.config.beatSensitivity || 1.2)) {
      const now = Date.now();
      if (now - this.lastBeatTime > this.beatCooldown) {
        this.onBeat(currentEnergy);
        this.lastBeatTime = now;
      }
    }
    this.beatThreshold = this.beatThreshold * 0.93 + currentEnergy * 0.07;

    // Update particle physics
    const maxSpeed = this.config.maxSpeed || 8;
    const damping = 1 - (this.config.velocityDamping ?? 0.04);

    this.particles.forEach((particle) => {
      const force = new THREE.Vector3(0, 0, 0);

      // Calculate forces from each attractor
      this.attractors.forEach((attractor) => {
        const toAttractor = new THREE.Vector3()
          .subVectors(attractor.position, particle.position);
        const distance = toAttractor.length();

        if (distance < 0.1) return; // Avoid singularity

        const direction = toAttractor.normalize();

        // Gravitational force
        const gravityStrength =
          (attractor.mass * particle.mass * this.GRAVITY_CONSTANT) /
          (distance * distance);
        const gravityForce = direction.multiplyScalar(gravityStrength);
        force.add(gravityForce);

        // Spinning force (perpendicular to attractor direction)
        const spinForce = new THREE.Vector3()
          .crossVectors(attractor.rotationAxis, toAttractor)
          .multiplyScalar(gravityStrength * attractor.spinStrength);
        force.add(spinForce);
      });

      // Soft boundary — gentle pull back toward origin when particles drift far
      const distFromOrigin = particle.position.length();
      const softBound = 8;
      if (distFromOrigin > softBound) {
        const pullStrength = (distFromOrigin - softBound) * 0.15;
        const pullBack = particle.position.clone().normalize().multiplyScalar(-pullStrength);
        force.add(pullBack);
      }

      // Update velocity
      particle.velocity.add(force.multiplyScalar(this.DELTA_TIME));

      // Limit speed
      const speed = particle.velocity.length();
      if (speed > maxSpeed) {
        particle.velocity.normalize().multiplyScalar(maxSpeed);
      }

      // Apply damping
      particle.velocity.multiplyScalar(damping);

      // Update position
      particle.position.add(
        new THREE.Vector3().copy(particle.velocity).multiplyScalar(this.DELTA_TIME)
      );
    });
  }

  private onBeat(energy: number): void {
    // Spike the beat boost — decays naturally in updatePhysics
    this.beatBoost = 1 + energy * 4;

    // Give particles an outward velocity kick on beats
    this.particles.forEach((particle) => {
      const dir = particle.position.clone().normalize();
      particle.velocity.add(dir.multiplyScalar(energy * 2));
    });
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;

    const distance = this.config.cameraDistance || this.cameraDistance;
    this.camera.position.x = Math.cos(this.cameraAngle) * distance;
    this.camera.position.z = Math.sin(this.cameraAngle) * distance;
    this.camera.position.y = this.cameraHeight;
    this.camera.lookAt(0, 0, 0);
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    // Only run physics when audio is playing
    if (audioAnalysis.isPlaying) {
      this.updatePhysics(audioAnalysis);
    }

    // Camera always rotates
    const cameraSpeed = this.config.cameraSpeed ?? 0.004;
    this.cameraAngle += cameraSpeed;
    this.updateCameraPosition();

    // Always sync particle geometry
    if (this.particleMesh) {
      const positions = this.particleMesh.geometry.attributes.position.array as Float32Array;
      const sizes = this.particleMesh.geometry.attributes.size.array as Float32Array;

      const baseSize = this.config.particleSize || 1.0;

      // Pass smoothed audio intensities to shader uniforms
      if (this.particleMesh.material instanceof THREE.ShaderMaterial) {
        this.particleMesh.material.uniforms.bassIntensity.value = Math.max(audioAnalysis.bassAvg / 255, this.smoothBass);
        this.particleMesh.material.uniforms.midIntensity.value = Math.max(audioAnalysis.midAvg / 255, this.smoothMid);
        this.particleMesh.material.uniforms.highIntensity.value = Math.max(audioAnalysis.highAvg / 255, this.smoothHigh);
        this.particleMesh.material.uniforms.beatBoost.value = this.beatBoost;
      }

      this.particles.forEach((particle, i) => {
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;

        // Velocity-based size boost — faster particles appear larger
        const speed = particle.velocity.length();
        const speedBoost = 1 + speed * 0.1;
        sizes[i] = (particle.mass / 1e4) * baseSize * speedBoost;
      });

      this.particleMesh.geometry.attributes.position.needsUpdate = true;
      this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }
  }

  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;

    const trail = this.config.trail ?? 0;

    if (trail > 0 && this.fadeScene && this.fadeCamera) {
      // Render fade overlay first (partially fades previous frame)
      this.renderer.render(this.fadeScene, this.fadeCamera);
      // Clear depth buffer so particles aren't blocked by fade plane
      this.renderer.clearDepth();
      // Then render particles on top
      this.renderer.render(this.scene, this.camera);
    } else {
      // No trail: full clear and render
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.particleMesh) {
      this.particleMesh.geometry.dispose();
      if (this.particleMesh.material instanceof THREE.Material) {
        this.particleMesh.material.dispose();
      }
    }

    if (this.fadeMaterial) {
      this.fadeMaterial.dispose();
    }

    if (this.renderer) {
      this.renderer.domElement.style.filter = 'none';
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleMesh = null;
    this.fadeScene = null;
    this.fadeCamera = null;
    this.fadeMaterial = null;
    this.particles = [];
    this.attractors = [];
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    // Handle special config changes that require reinitialization
    if (key === 'particleCount' && this.scene) {
      if (this.particleMesh) {
        this.scene.remove(this.particleMesh);
        this.particleMesh.geometry.dispose();
        if (this.particleMesh.material instanceof THREE.Material) {
          this.particleMesh.material.dispose();
        }
      }
      this.particleCount = value;
      this.initializeParticles();
    }

    if (key === 'attractorCount' && this.scene) {
      this.initializeAttractors();
    }

    if (key === 'cameraDistance') {
      this.cameraDistance = value;
      this.updateCameraPosition();
    }

    if (key === 'particleSize' && this.particleMesh) {
      const sizes = this.particleMesh.geometry.attributes.size.array as Float32Array;
      this.particles.forEach((particle, i) => {
        sizes[i] = (particle.mass / 1e4) * value;
      });
      this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }

    if (key === 'trail' && this.renderer) {
      if (this.fadeMaterial) {
        this.fadeMaterial.opacity = value > 0 ? 0.08 * (1 - value) : 1;
      }
      this.renderer.domElement.style.filter = value > 0 ? `blur(${value * 2}px)` : 'none';
    }
  }

  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);

    if (this.particleMesh && this.particleMesh.material instanceof THREE.ShaderMaterial) {
      this.particleMesh.material.uniforms.colorA.value = new THREE.Color(colors.dominant);
      this.particleMesh.material.uniforms.colorB.value = new THREE.Color(colors.accent);
    }
  }
}
