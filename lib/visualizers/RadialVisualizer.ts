/**
 * Radial Visualizer
 * Circular frequency bars with wave effects
 */

import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class RadialVisualizer extends BaseVisualizer {
  private svg: SVGSVGElement | null = null;
  private bars: SVGLineElement[] = [];
  private startTime: number = Date.now();
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'Radial';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Intensity',
        key: 'intensity',
        min: 0.5,
        max: 2,
        step: 0.1,
        default: 1.0,
        value: this.config.intensity || 1.0
      },
      {
        name: 'Wave Speed',
        key: 'timeSpeed',
        min: 0.1,
        max: 2,
        step: 0.1,
        default: 0.5,
        value: this.config.timeSpeed || 0.5
      }
    ];
  }
  
  init(): void {
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-md aspect-square flex items-center justify-center';
    
    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'w-full h-full');
    this.svg.setAttribute('viewBox', '0 0 400 400');
    
    // Create gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'radialGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', this.colors.dominant);
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', this.colors.accent);
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    this.svg.appendChild(defs);
    
    // Create center circle
    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', '200');
    centerCircle.setAttribute('cy', '200');
    centerCircle.setAttribute('r', '55');
    centerCircle.setAttribute('fill', 'none');
    centerCircle.setAttribute('stroke', this.colors.dominant);
    centerCircle.setAttribute('stroke-width', '2');
    centerCircle.setAttribute('opacity', '0.3');
    this.svg.appendChild(centerCircle);
    
    wrapper.appendChild(this.svg);
    this.container.appendChild(wrapper);
    
    // Start animation loop
    this.startAnimationLoop(() => this.render());
  }
  
  update(audioAnalysis: AudioAnalysis): void {
    const { audioData, isPlaying } = audioAnalysis;
    const intensity = this.config.intensity || 1.0;
    const timeSpeed = this.config.timeSpeed || 0.5;
    
    // Calculate time for wave effect
    const time = (Date.now() - this.startTime) * 0.001 * timeSpeed;
    
    // Ensure we have the right number of bars
    while (this.bars.length < audioData.length) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', 'url(#radialGradient)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      this.svg?.appendChild(line);
      this.bars.push(line);
    }
    
    // Update each bar
    audioData.forEach((value, index) => {
      if (index >= this.bars.length) return;
      
      const barCount = audioData.length;
      const angle = ((index + 0.5) / barCount) * 360;
      const angleRad = (angle * Math.PI) / 180;
      
      // Normalize frequency value
      const normalizedFreq = value / 255;
      
      // Add traveling wave effect
      const wavePosition = (time * 2) % (Math.PI * 2);
      const waveFactor = Math.sin(angleRad * 3 + wavePosition) * 0.5 + 0.5;
      
      // Combine audio with wave
      const combinedValue = normalizedFreq * 0.7 + waveFactor * 0.3;
      
      // Calculate bar dimensions
      const innerRadius = 60;
      const maxOuterRadius = 180;
      const barLength = combinedValue * (maxOuterRadius - innerRadius) * intensity;
      const outerRadius = innerRadius + barLength;
      
      // Calculate positions
      const x1 = 200 + Math.cos(angleRad) * innerRadius;
      const y1 = 200 + Math.sin(angleRad) * innerRadius;
      const x2 = 200 + Math.cos(angleRad) * outerRadius;
      const y2 = 200 + Math.sin(angleRad) * outerRadius;
      
      // Update bar
      const bar = this.bars[index];
      bar.setAttribute('x1', x1.toString());
      bar.setAttribute('y1', y1.toString());
      bar.setAttribute('x2', x2.toString());
      bar.setAttribute('y2', y2.toString());
      bar.setAttribute('opacity', isPlaying ? '0.9' : '0.4');
    });
  }
  
  render(): void {
    // Rendering happens in update for SVG-based visualizer
  }
  
  updateColors(colors: ColorScheme): void {
    super.updateColors(colors);
    
    // Update gradient colors
    if (this.svg) {
      const gradient = this.svg.querySelector('#radialGradient');
      if (gradient) {
        const stops = gradient.querySelectorAll('stop');
        if (stops[0]) stops[0].setAttribute('stop-color', colors.dominant);
        if (stops[1]) stops[1].setAttribute('stop-color', colors.accent);
      }
      
      // Update center circle
      const circle = this.svg.querySelector('circle');
      if (circle) {
        circle.setAttribute('stroke', colors.dominant);
      }
    }
  }
  
  destroy(): void {
    this.stopAnimationLoop();
    this.bars = [];
    this.svg = null;
    this.container.innerHTML = '';
  }
}
