/**
 * Visualizer Manager
 * Manages the lifecycle of visualizers and coordinates with audio engine
 */

import { AudioEngine, AudioAnalysis } from './audioEngine';
import { BaseVisualizer, ColorScheme, VisualizerConfig, VisualizerControl } from './visualizers/BaseVisualizer';
import { VisualizerRegistry, VisualizerType } from './visualizerRegistry';

// Manager-level mirror control appended to every visualizer's control list.
// The manager intercepts this key in updateConfig instead of forwarding it.
export const MIRROR_CONFIG_KEY = '__mirror';

export class VisualizerManager {
  private audioEngine: AudioEngine;
  private currentVisualizer: BaseVisualizer | null = null;
  private currentType: VisualizerType | null = null;
  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private isPlaying: boolean = false;
  private darkMode: boolean = true;
  private resizeObserver: ResizeObserver | null = null;
  // 0 = off, 1 = mirror X, 2 = mirror Y, 3 = both (kaleidoscope base)
  private mirrorMode: number = 0;
  private mirrorCanvas: HTMLCanvasElement | null = null;
  
  constructor(audioEngine: AudioEngine, container: HTMLDivElement) {
    this.audioEngine = audioEngine;
    this.container = container;

    // Observe container size changes and dispatch window resize
    // so all visualizers (which listen on window resize) get notified
    this.resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    this.resizeObserver.observe(this.container);
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
      this.currentVisualizer.isInitialized = true;
      this.currentVisualizer.setDarkMode(this.darkMode);
      this.startAnimationLoop();
    }
  }
  
  /**
   * Update visualizer configuration
   */
  updateConfig(key: string, value: number): void {
    if (key === MIRROR_CONFIG_KEY) {
      this.setMirrorMode(value);
      return;
    }
    if (this.currentVisualizer) {
      this.currentVisualizer.updateConfig(key, value);
    }
  }

  /**
   * Set the mirror mode (0 off, 1 X, 2 Y, 3 both)
   */
  setMirrorMode(mode: number): void {
    this.mirrorMode = Math.max(0, Math.min(3, Math.round(mode)));
    if (this.mirrorMode === 0) {
      if (this.mirrorCanvas) {
        this.mirrorCanvas.remove();
        this.mirrorCanvas = null;
      }
      const src = this.getSourceCanvas();
      if (src) src.style.visibility = '';
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
   * Set dark/light mode
   */
  setDarkMode(isDark: boolean): void {
    this.darkMode = isDark;
    if (this.currentVisualizer) {
      this.currentVisualizer.setDarkMode(isDark);
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
  getCurrentControls(): VisualizerControl[] {
    const controls = this.currentVisualizer?.getControls() || [];
    return [
      ...controls,
      {
        name: 'Mirror',
        key: MIRROR_CONFIG_KEY,
        min: 0,
        max: 3,
        step: 1,
        default: 0,
        value: this.mirrorMode,
        labels: ['Off', 'Mirror X', 'Mirror Y', 'Kaleido'],
      },
    ];
  }

  /**
   * Get current visualizer presets
   */
  getCurrentPresets() {
    return this.currentVisualizer?.getPresets() || [];
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
        if (this.mirrorMode > 0) {
          this.applyMirror();
        }
      }
    };

    animate();
  }

  /**
   * Composite the rendered frame into mirrored halves/quadrants on a 2D
   * overlay canvas. The source WebGL canvas keeps rendering underneath
   * (hidden) so the effect works for every visualizer without changes.
   */
  private applyMirror(): void {
    const src = this.getSourceCanvas();
    if (!src || src.width === 0 || src.height === 0) return;

    if (!this.mirrorCanvas || !this.mirrorCanvas.isConnected) {
      this.mirrorCanvas = document.createElement('canvas');
      this.mirrorCanvas.style.position = 'absolute';
      this.mirrorCanvas.style.inset = '0';
      this.mirrorCanvas.style.width = '100%';
      this.mirrorCanvas.style.height = '100%';
      this.mirrorCanvas.style.pointerEvents = 'none';
      if (!this.container.style.position) {
        this.container.style.position = 'relative';
      }
      this.container.appendChild(this.mirrorCanvas);
    }
    if (src.style.visibility !== 'hidden') {
      src.style.visibility = 'hidden';
    }

    const w = src.width;
    const h = src.height;
    if (this.mirrorCanvas.width !== w || this.mirrorCanvas.height !== h) {
      this.mirrorCanvas.width = w;
      this.mirrorCanvas.height = h;
    }

    const ctx = this.mirrorCanvas.getContext('2d');
    if (!ctx) return;

    const halfW = w / 2;
    const halfH = h / 2;
    ctx.clearRect(0, 0, w, h);

    if (this.mirrorMode === 1) {
      // Left half, reflected onto the right
      ctx.drawImage(src, 0, 0, halfW, h, 0, 0, halfW, h);
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0, halfW, h, 0, 0, halfW, h);
      ctx.restore();
    } else if (this.mirrorMode === 2) {
      // Top half, reflected onto the bottom
      ctx.drawImage(src, 0, 0, w, halfH, 0, 0, w, halfH);
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(src, 0, 0, w, halfH, 0, 0, w, halfH);
      ctx.restore();
    } else {
      // Top-left quadrant reflected into all four quadrants
      ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
      ctx.save();
      ctx.translate(w, h);
      ctx.scale(-1, -1);
      ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
    }
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
   * The visualizer's own WebGL canvas (first canvas in the container —
   * the mirror overlay, when present, is appended after it)
   */
  private getSourceCanvas(): HTMLCanvasElement | null {
    return this.container.querySelector('canvas');
  }

  /**
   * Get the current canvas element for export purposes.
   * When mirroring is active, exports capture the mirrored output.
   */
  getCanvas(): HTMLCanvasElement | null {
    if (this.mirrorMode > 0 && this.mirrorCanvas) {
      return this.mirrorCanvas;
    }
    return this.getSourceCanvas();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAnimationLoop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.mirrorCanvas) {
      this.mirrorCanvas.remove();
      this.mirrorCanvas = null;
    }
    if (this.currentVisualizer) {
      this.currentVisualizer.destroy();
      this.currentVisualizer = null;
    }
  }
}
