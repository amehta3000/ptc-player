/**
 * Orb Visualizer
 * 3D sphere with audio-reactive displacement
 */

import * as THREE from 'three';
import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class OrbVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.IcosahedronGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private originalPositions: Float32Array | null = null;
  private cameraRotation = { x: 0, y: 0 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Orb';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Audio Intensity',
        key: 'freqMultiplier',
        min: 1,
        max: 10,
        step: 0.1,
        default: 3.6,
        value: this.config.freqMultiplier || 3.6
      },
      {
        name: 'Surface Detail',
        key: 'noiseMultiplier',
        min: 0.1,
        max: 2,
        step: 0.05,
        default: 0.55,
        value: this.config.noiseMultiplier || 0.55
      },
      {
        name: 'Animation Speed',
        key: 'timeSpeed',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2.0,
        value: this.config.timeSpeed || 2.0
      },
      {
        name: 'Rotation Speed',
        key: 'autoRotationSpeed',
        min: 0,
        max: 0.01,
        step: 0.0005,
        default: 0.003,
        value: this.config.autoRotationSpeed || 0.003
      }
    ];
  }
  
  init(): void {
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-md aspect-square flex items-center justify-center cursor-grab active:cursor-grabbing';
    wrapper.style.touchAction = 'none';
    
    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      1, // aspect ratio (square)
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    const size = Math.min(wrapper.clientWidth, 500);
    this.renderer.setSize(size, size);
    this.renderer.setClearColor(0x000000, 0);
    wrapper.appendChild(this.renderer.domElement);
    
    // Create icosahedron geometry
    this.geometry = new THREE.IcosahedronGeometry(2, 80);
    this.originalPositions = new Float32Array(this.geometry.attributes.position.array);
    
    // Create vertex colors
    const colors = new Float32Array(this.geometry.attributes.position.count * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = dominantRGB.r;
      colors[i + 1] = dominantRGB.g;
      colors[i + 2] = dominantRGB.b;
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
    this.scene.add(this.mesh);
    
    // Position camera
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);
    
    // Add mouse controls
    this.setupMouseControls(wrapper);
    
    this.container.appendChild(wrapper);
    
    // Start animation loop
    this.startAnimationLoop(() => this.render());
  }
  
  private setupMouseControls(element: HTMLDivElement): void {
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
  
  update(audioAnalysis: AudioAnalysis): void {
    if (!this.geometry || !this.originalPositions || !this.camera) return;
    
    const { normalizedFrequency } = audioAnalysis;
    const freqMultiplier = this.config.freqMultiplier || 3.6;
    const noiseMultiplier = this.config.noiseMultiplier || 0.55;
    const timeSpeed = this.config.timeSpeed || 2.0;
    const autoRotationSpeed = this.config.autoRotationSpeed || 0.003;
    
    // Auto-rotate camera if not dragging
    if (!this.isDragging) {
      this.cameraRotation.y += autoRotationSpeed;
    }
    
    // Update camera position
    const radius = 6;
    this.camera.position.x = radius * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.position.y = radius * Math.sin(this.cameraRotation.x);
    this.camera.position.z = radius * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
    this.camera.lookAt(0, 0, 0);
    
    // Update vertices
    const positions = this.geometry.attributes.position;
    const colorAttr = this.geometry.attributes.color;
    const count = positions.count;
    const time = Date.now() * 0.001 * timeSpeed;
    
    const dominantRGB = this.parseRGB(this.colors.dominant);
    const accentRGB = this.parseRGB(this.colors.accent);
    
    for (let i = 0; i < count; i++) {
      const origX = this.originalPositions[i * 3];
      const origY = this.originalPositions[i * 3 + 1];
      const origZ = this.originalPositions[i * 3 + 2];
      
      // Create position with time offset
      const posX = origX + time;
      const posY = origY + time;
      const posZ = origZ + time;
      
      // Perlin-like noise using layered sine waves
      const noise = 
        Math.sin(posX * 2) * Math.cos(posY * 2) * 0.5 +
        Math.sin(posY * 3) * Math.cos(posZ * 3) * 0.3 +
        Math.sin(posZ * 4) * Math.cos(posX * 2) * 0.4 +
        Math.sin((posX + posY + posZ) * 1.5) * 0.3;
      
      const intensifiedNoise = noise * freqMultiplier * 2;
      const displacement = (normalizedFrequency * noiseMultiplier) * (intensifiedNoise * 0.1);
      
      // Apply displacement along normal
      const scale = 1 + displacement;
      positions.setXYZ(i, origX * scale, origY * scale, origZ * scale);
      
      // Update vertex color
      const colorIntensity = Math.abs(displacement) * 8;
      const blend = Math.min(1, Math.max(0, colorIntensity));
      const timeVariation = Math.sin(time * 0.5 + i * 0.01) * 0.15;
      const finalBlend = Math.min(1, Math.max(0, blend + timeVariation));
      
      const r = dominantRGB.r + (accentRGB.r - dominantRGB.r) * finalBlend;
      const g = dominantRGB.g + (accentRGB.g - dominantRGB.g) * finalBlend;
      const b = dominantRGB.b + (accentRGB.b - dominantRGB.b) * finalBlend;
      
      colorAttr.setXYZ(i, r, g, b);
    }
    
    positions.needsUpdate = true;
    colorAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
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
    this.originalPositions = null;
    
    this.container.innerHTML = '';
  }
}
