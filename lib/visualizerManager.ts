/**
 * Visualizer Manager
 * Manages the lifecycle of visualizers and coordinates with audio engine
 */

import { AudioEngine, AudioAnalysis } from './audioEngine';
import { BaseVisualizer, ColorScheme, VisualizerConfig, VisualizerControl } from './visualizers/BaseVisualizer';
import { VisualizerRegistry, VisualizerType } from './visualizerRegistry';
import { drawMirrored, createMirrorScratch, MirrorState } from './mirrorCompositor';

// Manager-level mirror controls appended to every visualizer's control list.
// The manager intercepts these keys in updateConfig instead of forwarding them.
export const MIRROR_CONFIG_KEY = '__mirror';
export const MIRROR_OFFSET_KEY = '__mirrorOffset';

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
  // Seam position as a fraction of the frame (0.5 = center). The mirrored
  // strip tiles across the rest of the frame, kaleidoscope-style.
  private mirrorOffset: number = 0.5;
  private mirrorCanvas: HTMLCanvasElement | null = null;
  private mirrorScratch: { base: HTMLCanvasElement; pass: HTMLCanvasElement } | null = null;
  
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
    if (key === MIRROR_OFFSET_KEY) {
      this.mirrorOffset = Math.max(0.1, Math.min(0.9, value));
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

    // Common controls lead the list (right under the visualizer picker):
    // manager-level mirror controls, then hue/harmony hoisted from the
    // visualizer's own list (when it offers them).
    const common: VisualizerControl[] = [
      {
        name: 'Mirror',
        key: MIRROR_CONFIG_KEY,
        min: 0,
        max: 3,
        step: 1,
        default: 0,
        value: this.mirrorMode,
        labels: ['Off', 'X', 'Y', 'XY'],
      },
    ];
    if (this.mirrorMode > 0) {
      common.push({
        name: 'Mirror Offset',
        key: MIRROR_OFFSET_KEY,
        min: 0.1,
        max: 0.9,
        step: 0.01,
        default: 0.5,
        value: this.mirrorOffset,
      });
    }

    const commonKeys = new Set(['hue', 'harmonyMode']);
    const hoisted = controls.filter((c) => commonKeys.has(c.key));
    const specific = controls.filter((c) => !commonKeys.has(c.key));

    return [...common, ...hoisted, ...specific];
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
   * Composite the rendered frame onto a mirrored 2D overlay canvas. The
   * source WebGL canvas keeps rendering underneath (hidden) so the effect
   * works for every visualizer without changes. Exporters run the same
   * compositor against their own output frame.
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

    if (!this.mirrorScratch) this.mirrorScratch = createMirrorScratch();
    ctx.clearRect(0, 0, w, h);
    drawMirrored(ctx, src, 0, 0, w, h, w, h, this.getMirrorState(), this.mirrorScratch);
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
   * The un-mirrored render target. Exporters take this and apply the mirror
   * to their own output frame, so a tall crop tiles across the exported
   * frame instead of slicing a window out of the mirrored screen frame.
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.getSourceCanvas();
  }

  /** Current mirror mode + offset, so exporters can reproduce the look */
  getMirrorState(): MirrorState {
    return { mode: this.mirrorMode, offset: this.mirrorOffset };
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
    this.mirrorScratch = null;
    if (this.currentVisualizer) {
      this.currentVisualizer.destroy();
      this.currentVisualizer = null;
    }
  }
}
