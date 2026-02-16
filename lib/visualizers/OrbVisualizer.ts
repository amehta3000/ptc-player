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
  private geometry: THREE.BufferGeometry | null = null;
  private mesh: THREE.Mesh | null = null;
  private originalPositions: Float32Array | null = null;
  private cameraRotation = { x: 0, y: 0 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private lights: THREE.Light[] = [];
  private orbitLights: THREE.PointLight[] = [];
  private lightTime = 0;
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Orb';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Shape',
        key: 'shape',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        value: this.config.shape ?? 0
      },
      {
        name: 'Light Intensity',
        key: 'lightIntensity',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 2,
        value: this.config.lightIntensity ?? 2
      },
      {
        name: 'Light Speed',
        key: 'lightSpeed',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.5,
        value: this.config.lightSpeed ?? 0.5
      },
      {
        name: 'Ambient',
        key: 'ambient',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        value: this.config.ambient ?? 0.3
      },
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
        value: this.config.autoRotationSpeed ?? 0.003
      },
      {
        name: 'Radius',
        key: 'radius',
        min: 1,
        max: 4,
        step: 0.1,
        default: 2.0,
        value: this.config.radius ?? 2.0
      },
      {
        name: 'Mesh Detail',
        key: 'meshDetail',
        min: 1,
        max: 8,
        step: 1,
        default: 4,
        value: this.config.meshDetail ?? 4
      },
      {
        name: 'Wireframe',
        key: 'wireframe',
        min: 0,
        max: 1,
        step: 1,
        default: 1,
        value: this.config.wireframe ?? 1
      }
    ];
  }
  
  init(): void {
    // Use container directly
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);
    this.container.style.cursor = 'grab';
    this.container.style.touchAction = 'none';

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

    // Build geometry, material, and mesh
    this.buildMesh();

    // Position camera
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);
    
    // Add mouse controls
    this.setupMouseControls(this.container);
    
    // Animation loop handled by base class start() method
  }
  
  private buildMesh(): void {
    if (!this.scene) return;

    // Dispose old mesh
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }
    if (this.geometry) {
      this.geometry.dispose();
    }

    // Remove old lights
    this.lights.forEach((light) => {
      this.scene!.remove(light);
      light.dispose();
    });
    this.lights = [];
    this.orbitLights = [];

    const radius = this.config.radius ?? 2.0;
    const detail = Math.min(Math.round(this.config.meshDetail ?? 4), 8);
    const shape = this.config.shape ?? 0;
    const isWireframe = (this.config.wireframe ?? 1) > 0;

    let material: THREE.Material;

    if (shape === 1) {
      // Disco Ball: SphereGeometry with flat shading for faceted look
      const segments = detail * 3 + 4;
      this.geometry = new THREE.SphereGeometry(radius, segments, segments);

      const lightIntensity = this.config.lightIntensity ?? 2;
      const ambientLevel = this.config.ambient ?? 0.3;

      // Silver/mirror material — lower shininess for wider highlights
      material = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        shininess: 150,
        specular: new THREE.Color(0xffffff),
        wireframe: isWireframe,
        transparent: true,
        opacity: 0.95
      });

      // 3 orbiting point lights — positions animated in update()
      for (let i = 0; i < 3; i++) {
        const light = new THREE.PointLight(0xffffff, lightIntensity, 0);
        light.position.set(8, 0, 0); // initial; overridden in update
        this.scene.add(light);
        this.lights.push(light);
        this.orbitLights.push(light);
      }

      // Backlight for rim glow
      const backlight = new THREE.PointLight(0xffffff, lightIntensity * 0.5, 0);
      backlight.position.set(0, 0, -8);
      this.scene.add(backlight);
      this.lights.push(backlight);

      // Ambient for base visibility
      const ambientVal = Math.round(ambientLevel * 255);
      const ambient = new THREE.AmbientLight(
        new THREE.Color(ambientVal / 255, ambientVal / 255, ambientVal / 255)
      );
      this.scene.add(ambient);
      this.lights.push(ambient);
    } else {
      // Orb: IcosahedronGeometry
      this.geometry = new THREE.IcosahedronGeometry(radius, detail);

      material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        wireframe: isWireframe,
        transparent: true,
        opacity: 0.8
      });
    }

    this.originalPositions = new Float32Array(this.geometry.attributes.position.array);

    // Set up vertex colors
    const vertexColors = new Float32Array(this.geometry.attributes.position.count * 3);
    const dominantRGB = this.parseRGB(this.colors.dominant);
    if (shape === 1) {
      // Disco ball: silver base tinted slightly with dominant color
      for (let i = 0; i < vertexColors.length; i += 3) {
        vertexColors[i] = 0.7 + dominantRGB.r * 0.3;
        vertexColors[i + 1] = 0.7 + dominantRGB.g * 0.3;
        vertexColors[i + 2] = 0.7 + dominantRGB.b * 0.3;
      }
    } else {
      for (let i = 0; i < vertexColors.length; i += 3) {
        vertexColors[i] = dominantRGB.r;
        vertexColors[i + 1] = dominantRGB.g;
        vertexColors[i + 2] = dominantRGB.b;
      }
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.scene.add(this.mesh);
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
    if (!this.isInitialized || !this.geometry || !this.originalPositions || !this.mesh || !this.camera) return;
    
    const { normalizedFrequency } = audioAnalysis;
    const freqMultiplier = this.config.freqMultiplier || 3.6;
    const noiseMultiplier = this.config.noiseMultiplier || 0.55;
    const timeSpeed = this.config.timeSpeed || 2.0;
    const autoRotationSpeed = this.config.autoRotationSpeed ?? 0.003;
    
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

    // For disco ball: orbit lights around the ball at different speeds/planes
    if ((this.config.shape ?? 0) === 1) {
      const lightSpeed = this.config.lightSpeed ?? 0.5;
      this.lightTime += lightSpeed * 0.02;

      // Each light orbits on a different plane at a different speed
      const orbitRadius = 8;
      this.orbitLights.forEach((light, i) => {
        const speed = (1 + i * 0.7) * this.lightTime;
        const tilt = (i * Math.PI) / 3; // different orbital planes
        light.position.x = orbitRadius * Math.cos(speed) * Math.cos(tilt);
        light.position.y = orbitRadius * Math.sin(speed * 0.7 + i);
        light.position.z = orbitRadius * Math.sin(speed) * Math.cos(tilt);
      });

      // Also rotate mesh for extra facet variation
      if (this.mesh) {
        this.mesh.rotation.y += autoRotationSpeed * 2;
        this.mesh.rotation.x += autoRotationSpeed * 0.3;
      }
    }
    
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
    if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }
  
  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    // Colors will be updated in next update cycle
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);

    if (key === 'wireframe' && this.mesh) {
      (this.mesh.material as any).wireframe = value > 0;
    }

    if (key === 'lightIntensity') {
      this.orbitLights.forEach((light) => {
        light.intensity = value;
      });
    }

    if (key === 'ambient') {
      // Find the ambient light and update it
      this.lights.forEach((light) => {
        if (light instanceof THREE.AmbientLight) {
          light.color.setRGB(value, value, value);
        }
      });
    }

    if ((key === 'radius' || key === 'meshDetail' || key === 'shape') && this.scene) {
      this.buildMesh();
    }
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
    this.lights.forEach((light) => light.dispose());
    this.lights = [];

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.geometry = null;
    this.mesh = null;
    this.originalPositions = null;

    this.container.innerHTML = '';
  }
}
