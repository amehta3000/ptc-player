/**
 * Bars Visualizer
 * Classic frequency bars visualization
 */

import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class BarsVisualizer extends BaseVisualizer {
  private barsContainer: HTMLDivElement | null = null;
  private bars: HTMLDivElement[] = [];
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Bars';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Bar Height',
        key: 'scale',
        min: 0.5,
        max: 1.5,
        step: 0.1,
        default: 0.5,
        value: this.config.scale || 0.5
      },
      {
        name: 'Smoothness',
        key: 'smoothness',
        min: 0.1,
        max: 2,
        step: 0.1,
        default: 1.0,
        value: this.config.smoothness || 1.0
      },
      {
        name: 'Bar Width',
        key: 'width',
        min: 2,
        max: 60,
        step: 1,
        default: 4,
        value: this.config.width || 4
      }
    ];
  }
  
  init(): void {
    // Create bars container
    this.barsContainer = document.createElement('div');
    this.barsContainer.className = 'w-full h-64 sm:h-80 md:h-96 flex items-end justify-between px-0';
    this.container.appendChild(this.barsContainer);
    
    // Create bars (will be updated on first render)
    this.createBars(64);
  }
  
  private createBars(count: number): void {
    if (!this.barsContainer) return;
    
    // Clear existing bars
    this.barsContainer.innerHTML = '';
    this.bars = [];
    
    // Create new bars
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'h-full origin-bottom rounded-t-md';
      bar.style.width = `${this.config.width || 4}px`;
      bar.style.maxWidth = `${this.config.width || 4}px`;
      bar.style.minWidth = `${this.config.width || 4}px`;
      this.barsContainer.appendChild(bar);
      this.bars.push(bar);
    }
  }
  
  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized || !this.barsContainer) return;
    
    const { audioData, isPlaying } = audioAnalysis;
    const scale = this.config.scale || 1.0;
    const smoothness = this.config.smoothness || 1.0;
    
    // Update bar count if needed
    if (this.bars.length !== audioData.length) {
      this.createBars(audioData.length);
    }
    
    // Update each bar
    this.bars.forEach((bar, index) => {
      if (index < audioData.length) {
        const value = audioData[index];
        const barScale = Math.max(0.08, (value / 255) * scale);
        
        bar.style.transform = `scaleY(${barScale})`;
        bar.style.background = `linear-gradient(to top, ${this.colors.dominant}, ${this.colors.accent})`;
        bar.style.opacity = isPlaying ? '0.95' : '0.5';
        bar.style.transition = `transform ${smoothness * 100}ms ease-out`;
      }
    });
  }
  
  render(): void {
    // Rendering happens in update for DOM-based visualizer
  }
  
  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
    
    // Update bar widths if width changed
    if (key === 'width') {
      this.bars.forEach(bar => {
        bar.style.width = `${value}px`;
        bar.style.maxWidth = `${value}px`;
        bar.style.minWidth = `${value}px`;
      });
    }
  }
  
  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;
    
    if (this.barsContainer && this.container.contains(this.barsContainer)) {
      this.container.removeChild(this.barsContainer);
      this.barsContainer = null;
    }
    this.bars = [];
  }
}
