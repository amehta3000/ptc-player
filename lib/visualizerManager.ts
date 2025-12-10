/**
 * Visualizer Manager
 * Manages the lifecycle of visualizers and coordinates with audio engine
 */

import { AudioEngine, AudioAnalysis } from './audioEngine';
import { BaseVisualizer, ColorScheme, VisualizerConfig } from './visualizers/BaseVisualizer';
import { VisualizerRegistry, VisualizerType } from './visualizerRegistry';

export class VisualizerManager {
  private audioEngine: AudioEngine;
  private currentVisualizer: BaseVisualizer | null = null;
  private currentType: VisualizerType | null = null;
  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private isPlaying: boolean = false;
  
  constructor(audioEngine: AudioEngine, container: HTMLDivElement) {
    this.audioEngine = audioEngine;
    this.container = container;
  }
  
  /**
   * Switch to a different visualizer
   */
  switchVisualizer(
    type: VisualizerType,
    config: VisualizerConfig,
    colors: ColorScheme
  ): void {
    // Destroy current visualizer
    if (this.currentVisualizer) {
      this.currentVisualizer.destroy();
      this.currentVisualizer = null;
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create new visualizer
    this.currentVisualizer = VisualizerRegistry.create(type, this.container, config, colors);
    this.currentType = type;
    
    if (this.currentVisualizer) {
      this.currentVisualizer.init();
      this.startAnimationLoop();
    }
  }
  
  /**
   * Update visualizer configuration
   */
  updateConfig(key: string, value: number): void {
    if (this.currentVisualizer) {
      this.currentVisualizer.updateConfig(key, value);
    }
  }
  
  /**
   * Update color scheme
   */
  updateColors(colors: ColorScheme): void {
    if (this.currentVisualizer) {
      this.currentVisualizer.updateColors(colors);
    }
  }
  
  /**
   * Set playback state
   */
  setPlaybackState(isPlaying: boolean): void {
    this.isPlaying = isPlaying;
  }
  
  /**
   * Get current visualizer controls
   */
  getCurrentControls() {
    return this.currentVisualizer?.getControls() || [];
  }
  
  /**
   * Get current visualizer name
   */
  getCurrentName(): string {
    return this.currentVisualizer?.getName() || '';
  }
  
  /**
   * Start animation loop
   */
  private startAnimationLoop(): void {
    this.stopAnimationLoop();
    
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      if (this.currentVisualizer) {
        const audioAnalysis = this.audioEngine.getAnalysis(this.isPlaying);
        this.currentVisualizer.update(audioAnalysis);
        this.currentVisualizer.render();
      }
    };
    
    animate();
  }
  
  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAnimationLoop();
    if (this.currentVisualizer) {
      this.currentVisualizer.destroy();
      this.currentVisualizer = null;
    }
  }
}
