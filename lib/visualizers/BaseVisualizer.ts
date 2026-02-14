/**
 * Base Visualizer Class
 * All visualizers extend this class and implement the required methods
 */

import { AudioAnalysis } from '../audioEngine';

export interface VisualizerConfig {
  [key: string]: number;
}

export interface VisualizerControl {
  name: string;
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
  value: number;
}

export interface ColorScheme {
  dominant: string;
  accent: string;
}

export abstract class BaseVisualizer {
  protected container: HTMLDivElement;
  protected config: VisualizerConfig;
  protected colors: ColorScheme;
  protected animationFrameId: number | null = null;
  public isInitialized: boolean = false;
  protected currentAudioAnalysis: AudioAnalysis | null = null;
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    this.container = container;
    this.config = config;
    this.colors = colors;
  }
  
  /**
   * Initialize the visualizer (setup canvas, Three.js scene, etc.)
   * Should NOT start animation loop - that's handled by start()
   */
  abstract init(): void;
  
  /**
   * Update visualizer internal state with new audio data
   * This is called before render() in the animation loop
   */
  abstract update(audioAnalysis: AudioAnalysis): void;
  
  /**
   * Render the current frame to the canvas/DOM
   * This is called after update() in the animation loop
   */
  abstract render(): void;
  
  /**
   * Clean up resources (remove event listeners, dispose Three.js objects, etc.)
   * Should stop any running animation loops
   */
  abstract destroy(): void;
  
  /**
   * Start the visualizer (init + animation loop)
   * Call this once after construction
   */
  start(): void {
    if (this.isInitialized) {
      console.warn('Visualizer already initialized');
      return;
    }
    
    this.init();
    this.isInitialized = true;
    this.startInternalAnimationLoop();
  }
  
  /**
   * Internal animation loop that calls update() then render()
   * Override this if you need custom loop behavior
   */
  protected startInternalAnimationLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      if (this.currentAudioAnalysis) {
        this.update(this.currentAudioAnalysis);
      }
      
      this.render();
    };
    animate();
  }
  
  /**
   * Set audio data (called from external animation loop)
   * This decouples audio updates from rendering
   */
  setAudioData(audioAnalysis: AudioAnalysis): void {
    this.currentAudioAnalysis = audioAnalysis;
  }
  
  /**
   * Update configuration values
   */
  updateConfig(key: string, value: number) {
    this.config[key] = value;
  }
  
  /**
   * Update color scheme
   */
  updateColors(colors: ColorScheme) {
    this.colors = colors;
  }
  
  /**
   * Get visualizer controls for UI
   */
  abstract getControls(): VisualizerControl[];
  
  /**
   * Get visualizer name
   */
  abstract getName(): string;
  
  /**
   * Start animation loop
   */
  protected startAnimationLoop(callback: () => void) {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      callback();
    };
    animate();
  }
  
  /**
   * Stop animation loop
   */
  protected stopAnimationLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Parse RGB color string to normalized values
   */
  protected parseRGB(rgbString: string): { r: number; g: number; b: number } {
    const match = rgbString.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]) / 255,
        g: parseInt(match[1]) / 255,
        b: parseInt(match[2]) / 255
      };
    }
    return { r: 1, g: 0.5, b: 0 };
  }
}
