/**
 * Sonic Galaxy Visualizer
 * 
 * A particle-based visualizer featuring gravitational attractors that react to audio frequencies.
 * Inspired by the Three.js compute attractor particles example.
 * 
 * Key Features:
 * - 50,000+ particles (configurable) forming a dynamic galaxy
 * - Multiple attractors positioned in spherical formation
 * - Bass frequencies control attractor gravity strength (particle swirl intensity)
 * - Mid frequencies control spinning force (orbital velocity)
 * - High frequencies affect particle energy/brightness
 * - Beat detection creates temporary gravity waves
 * - Particles wrap around boundaries (toroidal space)
 * - Auto-rotating camera for cinematic view
 * - Color gradient based on particle velocity
 * 
 * Physics:
 * - Newtonian gravity simulation with damping
 * - Each attractor has mass and rotation axis
 * - Particles experience both gravitational and centrifugal forces
 * - Velocity-based coloring (slow = dominant color, fast = accent color)
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
  private particleCount: number = 50000;
  
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
        min: 10000,
        max: 100000,
        step: 10000,
        default: 10000,
        value: this.config.particleCount || 10000
      },
      {
        name: 'Attractor Count',
        key: 'attractorCount',
        min: 2,
        max: 6,
        step: 1,
        default: 3,
        value: this.config.attractorCount || 3
      },
      {
        name: 'Bass Gravity',
        key: 'bassGravity',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2.0,
        value: this.config.bassGravity || 2.0
      },
      {
        name: 'Mid Spin',
        key: 'midSpin',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2.0,
        value: this.config.midSpin || 2.0
      },
      {
        name: 'High Energy',
        key: 'highEnergy',
        min: 0.5,
        max: 3,
        step: 0.1,
        default: 1.5,
        value: this.config.highEnergy || 1.5
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
        value: this.config.velocityDamping || 0.04
      },
      {
        name: 'Particle Size',
        key: 'particleSize',
        min: 0.5,
        max: 1.5,
        step: 0.1,
        default: 0.5,
        value: this.config.particleSize || 0.5
      },
      {
        name: 'Camera Speed',
        key: 'cameraSpeed',
        min: 0,
        max: 0.02,
        step: 0.001,
        default: 0.004,
        value: this.config.cameraSpeed || 0.004
      },
      {
        name: 'Bound Size',
        key: 'boundSize',
        min: 5,
        max: 20,
        step: 1,
        default: 8,
        value: this.config.boundSize || 8
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
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    
    this.container.appendChild(this.renderer.domElement);
    
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
        mass: 1e7,
        baseMass: 1e7,
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
      sizes.push((mass / 1e4) * (this.config.particleSize || 0.5));
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
    
    // Create particle material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(this.colors.dominant) },
        colorB: { value: new THREE.Color(this.colors.accent) },
        bassIntensity: { value: 0.0 },
        midIntensity: { value: 0.0 },
        highIntensity: { value: 0.0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float frequencyBand;
        varying vec3 vColor;
        varying float vFrequencyBand;
        
        void main() {
          vColor = color;
          vFrequencyBand = frequencyBand;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (100.0 / -mvPosition.z);
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
          if (dist > 0.5) discard;
          
          // Get intensity based on frequency band
          float intensity = 0.3; // Base intensity
          if (vFrequencyBand < 0.5) {
            intensity += bassIntensity * 1.5;
          } else if (vFrequencyBand < 1.5) {
            intensity += midIntensity * 1.5;
          } else {
            intensity += highIntensity * 1.5;
          }
          
          intensity = clamp(intensity, 0.3, 2.0);
          
          float alpha = smoothstep(0.5, 0.2, dist) * intensity;
          gl_FragColor = vec4(vColor * intensity, alpha);
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
    
    // Update attractor properties based on audio
    const bassGravityMult = this.config.bassGravity || 2.0;
    const midSpinMult = this.config.midSpin || 2.0;
    
    this.attractors.forEach((attractor, idx) => {
      // Different attractors react to different frequencies
      const freqMod = (idx % 3) / 3;
      const audioValue = freqMod < 0.33 ? bassNormalized : 
                        freqMod < 0.66 ? midNormalized : 
                        highNormalized;
      
      // More dramatic mass changes for visible gravity effects
      attractor.mass = attractor.baseMass * (1 + audioValue * bassGravityMult * 5);
      attractor.spinStrength = 2.0 + midNormalized * midSpinMult * 3;
    });
    
    // Detect beats and create gravity waves
    const currentEnergy = (bassNormalized + midNormalized + highNormalized) / 3;
    if (currentEnergy > this.beatThreshold * (this.config.beatSensitivity || 1.2)) {
      const now = Date.now();
      if (now - this.lastBeatTime > this.beatCooldown) {
        this.onBeat(currentEnergy);
        this.lastBeatTime = now;
      }
    }
    this.beatThreshold = this.beatThreshold * 0.95 + currentEnergy * 0.05;
    
    // Update particle physics
    const maxSpeed = this.config.maxSpeed || 8;
    const damping = 1 - (this.config.velocityDamping || 0.05);
    const boundHalfSize = (this.config.boundSize || 10) / 2;
    
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
      
      // Boundary wrapping (toroidal space)
      particle.position.x = ((particle.position.x + boundHalfSize) % (boundHalfSize * 2)) - boundHalfSize;
      particle.position.y = ((particle.position.y + boundHalfSize) % (boundHalfSize * 2)) - boundHalfSize;
      particle.position.z = ((particle.position.z + boundHalfSize) % (boundHalfSize * 2)) - boundHalfSize;
    });
  }
  
  private onBeat(energy: number): void {
    // Create a temporary gravity wave effect
    this.attractors.forEach((attractor) => {
      attractor.mass *= (1 + energy * 5);
    });
    
    // Reset after short duration
    setTimeout(() => {
      this.attractors.forEach((attractor) => {
        attractor.mass = attractor.baseMass;
      });
    }, 150);
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
    if (!this.isInitialized || !audioAnalysis.isPlaying) return;
    
    // Update physics simulation
    this.updatePhysics(audioAnalysis);
    
    // Update camera rotation
    const cameraSpeed = this.config.cameraSpeed || 0.005;
    this.cameraAngle += cameraSpeed;
    this.updateCameraPosition();
    
    // Update particle positions in geometry
    if (this.particleMesh) {
      const positions = this.particleMesh.geometry.attributes.position.array as Float32Array;
      const colors = this.particleMesh.geometry.attributes.color.array as Float32Array;
      const sizes = this.particleMesh.geometry.attributes.size.array as Float32Array;
      
      const colorA = new THREE.Color(this.colors.dominant);
      const colorB = new THREE.Color(this.colors.accent);
      const maxSpeed = this.config.maxSpeed || 8;
      
      const baseSize = this.config.particleSize || 0.5;
      
      // Update audio intensity uniforms for shader
      const bassNormalized = audioAnalysis.bassAvg / 255;
      const midNormalized = audioAnalysis.midAvg / 255;
      const highNormalized = audioAnalysis.highAvg / 255;
      
      if (this.particleMesh.material instanceof THREE.ShaderMaterial) {
        this.particleMesh.material.uniforms.bassIntensity.value = bassNormalized;
        this.particleMesh.material.uniforms.midIntensity.value = midNormalized;
        this.particleMesh.material.uniforms.highIntensity.value = highNormalized;
      }
      
      this.particles.forEach((particle, i) => {
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        
        // Keep random colors assigned at initialization
        // Colors don't need updating, they stay constant
        
        // Constant size (no bass pulsing)
        sizes[i] = (particle.mass / 1e4) * baseSize;
      });
      
      this.particleMesh.geometry.attributes.position.needsUpdate = true;
      this.particleMesh.geometry.attributes.size.needsUpdate = true;
    }
  }
  
  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
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
    
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleMesh = null;
    this.particles = [];
    this.attractors = [];
  }
  
  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
    
    // Handle special config changes that require reinitialization
    if (key === 'particleCount' && this.scene) {
      // Reinitialize particles with new count
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
      // Reinitialize attractors with new count
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
  }
  
  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    
    if (this.particleMesh && this.particleMesh.material instanceof THREE.ShaderMaterial) {
      this.particleMesh.material.uniforms.colorA.value = new THREE.Color(colors.dominant);
      this.particleMesh.material.uniforms.colorB.value = new THREE.Color(colors.accent);
    }
  }
}
