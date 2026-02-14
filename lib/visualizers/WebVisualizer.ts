/**
 * Web Visualizer
 * Concentric rings with frequency-based effects
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class WebVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private mesh: THREE.Line | null = null;
  private group: THREE.Group | null = null;
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Web';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Bass Pulse',
        key: 'bassPulse',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4,
        value: this.config.bassPulse || 0.4
      },
      {
        name: 'Mid Extension',
        key: 'midExtension',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        value: this.config.midExtension || 0.5
      },
      {
        name: 'High Shimmer',
        key: 'highShimmer',
        min: 0,
        max: 0.5,
        step: 0.05,
        default: 0.1,
        value: this.config.highShimmer || 0.1
      },
      {
        name: 'Rotation Speed',
        key: 'rotationSpeed',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.002,
        value: this.config.rotationSpeed || 0.002
      }
    ];
  }
  
  init(): void {
    // Use container directly
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Handle window resize
    const handleResize = () => {
      if (!this.camera || !this.renderer) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    
    // Position camera
    this.camera.position.set(0, 5, 5);
    this.camera.lookAt(0, 0, 0);
    
    // Create group for rotation
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    // Create concentric rings geometry
    const segmentCount = 64;
    const ringCount = 12;
    const vertices: number[] = [];
    const colors: number[] = [];
    
    const dominantRGB = this.parseRGB(this.colors.dominant);
    
    for (let ring = 0; ring < ringCount; ring++) {
      const radius = (ring / ringCount) * 3;
      for (let seg = 0; seg <= segmentCount; seg++) {
        const theta = (seg / segmentCount) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius;
        const z = 0;
        
        vertices.push(x, y, z);
        colors.push(dominantRGB.r, dominantRGB.g, dominantRGB.b);
      }
    }
    
    // Create indices for line segments
    const indices: number[] = [];
    
    // Radial lines
    for (let seg = 0; seg < segmentCount; seg++) {
      for (let ring = 0; ring < ringCount - 1; ring++) {
        const current = ring * (segmentCount + 1) + seg;
        const next = (ring + 1) * (segmentCount + 1) + seg;
        indices.push(current, next);
      }
    }
    
    // Ring lines
    for (let ring = 0; ring < ringCount; ring++) {
      for (let seg = 0; seg < segmentCount; seg++) {
        const current = ring * (segmentCount + 1) + seg;
        const next = ring * (segmentCount + 1) + seg + 1;
        indices.push(current, next);
      }
    }
    
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setIndex(indices);
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });
    
    this.mesh = new THREE.LineSegments(this.geometry, material);
    this.group.add(this.mesh);
    
    // Animation loop handled by base class start() method
  }
  
  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.geometry || !this.group) return;
    
    const { bassAvg, midAvg, highAvg } = audioAnalysis;
    const bassPulse = this.config.bassPulse || 0.4;
    const midExtension = this.config.midExtension || 0.5;
    const highShimmer = this.config.highShimmer || 0.1;
    const rotationSpeed = this.config.rotationSpeed || 0.002;
    
    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const segmentCount = 64;
    const ringCount = 12;
    const time = Date.now() * 0.001;
    
    const dominantRGB = this.parseRGB(this.colors.dominant);
    const accentRGB = this.parseRGB(this.colors.accent);
    
    let vertexIndex = 0;
    
    for (let ring = 0; ring < ringCount; ring++) {
      const ringPercent = ring / (ringCount - 1);
      const baseRadius = (ring / ringCount) * 3;
      
      // Bass affects inner rings more
      const bassInfluence = (1 - ringPercent) * bassAvg * bassPulse;
      
      // Mids affect middle rings
      const midInfluence = (1 - Math.abs(ringPercent - 0.5) * 2) * midAvg * midExtension;
      
      for (let seg = 0; seg <= segmentCount; seg++) {
        const theta = (seg / segmentCount) * Math.PI * 2;
        
        // High frequencies create shimmer effect
        const highWave = Math.sin(seg * 0.5 + time * 3) * highAvg * highShimmer;
        
        // Combine all influences
        const finalRadius = baseRadius + bassInfluence + midInfluence + highWave;
        
        const x = Math.cos(theta) * finalRadius;
        const y = Math.sin(theta) * finalRadius;
        const z = Math.sin(ring * 0.5 + time + bassAvg * 2) * 0.3;
        
        positions.setXYZ(vertexIndex, x, y, z);
        
        // Color based on position and audio
        const colorBlend = ringPercent;
        const warmIntensity = bassAvg * (1 - colorBlend);
        const coolIntensity = highAvg * colorBlend;
        
        const r = dominantRGB.r * (0.5 + warmIntensity) + accentRGB.r * coolIntensity;
        const g = dominantRGB.g * (0.5 + warmIntensity) + accentRGB.g * coolIntensity;
        const b = dominantRGB.b * (0.5 + warmIntensity) + accentRGB.b * coolIntensity;
        
        colorAttr.setXYZ(vertexIndex, r, g, b);
        vertexIndex++;
      }
    }
    
    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
    
    // Continuous rotation
    this.group.rotation.z += rotationSpeed;
  }
  
  render(): void {
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }
  
  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    // Colors will be updated in next update cycle
  }
  
  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.mesh && this.mesh.material) {
      (this.mesh.material as THREE.Material).dispose();
    }
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.mesh = null;
    this.group = null;
    
    this.container.innerHTML = '';
  }
}
