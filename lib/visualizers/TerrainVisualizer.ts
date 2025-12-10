/**
 * Terrain Visualizer
 * 3D audio wave terrain with history
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class TerrainVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private waveHistory: number[][] = [];
  private lastUpdateTime: number = 0;
  private segmentsX: number = 64;
  private segmentsZ: number = 40; // Reduced for better performance
  private cameraRotation = { x: -0.5, y: 0 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private frameCount: number = 0;
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Terrain';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Wave Amplitude',
        key: 'amplitude',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2.0,
        value: this.config.amplitude || 2.0
      },
      {
        name: 'Wave Speed',
        key: 'speed',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 1.0,
        value: this.config.speed || 1.0
      },
      {
        name: 'Wave Decay',
        key: 'decay',
        min: 0.85,
        max: 0.99,
        step: 0.01,
        default: 0.95,
        value: this.config.decay || 0.95
      },
      {
        name: 'Camera Distance',
        key: 'cameraDistance',
        min: 5,
        max: 15,
        step: 0.5,
        default: 8,
        value: this.config.cameraDistance || 8
      },
      {
        name: 'Auto Rotation',
        key: 'autoRotation',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.002,
        value: this.config.autoRotation || 0.002
      }
    ];
  }
  
  init(): void {
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-2xl h-96 flex items-center justify-center cursor-grab active:cursor-grabbing';
    wrapper.style.touchAction = 'none';
    
    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      wrapper.clientWidth / wrapper.clientHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false, // Disable for performance
      alpha: true,
      powerPreference: 'high-performance'
    });
    
    this.renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    wrapper.appendChild(this.renderer.domElement);
    
    // Initial camera position
    this.updateCameraPosition();
    
    // Create plane geometry
    const width = 10;
    const depth = 20;
    this.geometry = new THREE.PlaneGeometry(
      width,
      depth,
      this.segmentsX - 1,
      this.segmentsZ - 1
    );
    this.geometry.rotateX(-Math.PI / 2);
    
    // Initialize wave history
    for (let i = 0; i < this.segmentsZ; i++) {
      this.waveHistory.push(new Array(this.segmentsX).fill(0));
    }
    
    // Create vertex colors
    const positions = this.geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);
    
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = dominantRGB.r;
      colors[i * 3 + 1] = dominantRGB.g;
      colors[i * 3 + 2] = dominantRGB.b;
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.z = -depth / 2;
    this.scene.add(this.mesh);
    
    this.lastUpdateTime = Date.now();
    
    // Add mouse/touch controls
    this.setupCameraControls(wrapper);
    
    this.container.appendChild(wrapper);
    
    // Start animation loop
    this.startAnimationLoop(() => this.render());
  }
  
  private setupCameraControls(element: HTMLDivElement): void {
    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      const pos = 'touches' in e ? e.touches[0] : e;
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const pos = 'touches' in e ? e.touches[0] : e;
      const deltaX = pos.clientX - this.lastMousePos.x;
      const deltaY = pos.clientY - this.lastMousePos.y;
      
      this.cameraRotation.y += deltaX * 0.005;
      this.cameraRotation.x += deltaY * 0.005;
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
      
      this.lastMousePos = { x: pos.clientX, y: pos.clientY };
    };
    
    const onMouseUp = () => {
      this.isDragging = false;
    };
    
    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mouseleave', onMouseUp);
    element.addEventListener('touchstart', onMouseDown);
    element.addEventListener('touchmove', onMouseMove);
    element.addEventListener('touchend', onMouseUp);
  }
  
  private updateCameraPosition(): void {
    if (!this.camera) return;
    
    const distance = this.config.cameraDistance || 8;
    const autoRotation = this.config.autoRotation || 0.002;
    
    // Apply auto-rotation if not dragging
    if (!this.isDragging) {
      this.cameraRotation.y += autoRotation;
    }
    
    // Calculate camera position
    this.camera.position.x = distance * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = distance * Math.sin(this.cameraRotation.x);
    this.camera.position.z = distance * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, -5);
  }
  
  update(audioAnalysis: AudioAnalysis): void {
    if (!this.geometry) return;
    
    const { audioData } = audioAnalysis;
    const amplitude = this.config.amplitude || 2.0;
    const speed = this.config.speed || 1.0;
    const decay = this.config.decay || 0.95;
    
    const currentTime = Date.now();
    const updateInterval = 1000 / speed;
    
    // Update camera position
    this.updateCameraPosition();
    
    // Update wave history at specified interval
    if (currentTime - this.lastUpdateTime >= updateInterval) {
      // Shift all waves back
      this.waveHistory.pop();
      
      // Create new wave from audio data
      const newWave = audioData.map(value => (value / 255) * amplitude);
      this.waveHistory.unshift(newWave);
      
      this.lastUpdateTime = currentTime;
    }
    
    // Skip geometry updates on some frames for performance (update every 2 frames)
    this.frameCount++;
    if (this.frameCount % 2 !== 0) return;
    
    // Update geometry vertices
    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const dominantRGB = this.parseRGB(this.colors.dominant);
    const accentRGB = this.parseRGB(this.colors.accent);
    
    // Pre-calculate decay factors
    const decayFactors: number[] = [];
    for (let z = 0; z < this.segmentsZ; z++) {
      decayFactors[z] = Math.pow(decay, z);
    }
    
    // Update vertices
    for (let z = 0; z < this.segmentsZ; z++) {
      const decayFactor = decayFactors[z];
      
      for (let x = 0; x < this.segmentsX; x++) {
        const index = z * this.segmentsX + x;
        
        // Get wave height from history
        let waveHeight = (this.waveHistory[z]?.[x] || 0) * decayFactor;
        
        // Update Y position
        positions.setY(index, waveHeight);
        
        // Update color based on height (only for visible vertices)
        if (z < this.segmentsZ * 0.7) { // Skip color updates for far vertices
          const heightIntensity = Math.min(1, waveHeight / amplitude);
          const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * heightIntensity;
          const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * heightIntensity;
          const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * heightIntensity;
          
          colorAttr.setXYZ(index, r, g, b);
        }
      }
    }
    
    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }
  
  render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    // Colors will be updated in next update cycle
  }
  
  destroy(): void {
    this.stopAnimationLoop();
    
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
    this.waveHistory = [];
    
    this.container.innerHTML = '';
  }
}
