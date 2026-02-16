/**
 * Bars Visualizer
 * Canvas2D frequency visualization with multiple layout modes and color palettes
 */

import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';

export class BarsVisualizer extends BaseVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private smoothedData: number[] = new Array(64).fill(0);
  private smoothedBass = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Bars';
  }

  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Mode',
        key: 'mode',
        min: 0,
        max: 3,
        step: 1,
        default: 0,
        value: this.config.mode ?? 0,
        labels: ['Line', 'Circle', 'Sine', 'Dots']
      },
      {
        name: 'Palette',
        key: 'palette',
        min: 0,
        max: 6,
        step: 1,
        default: 0,
        value: this.config.palette ?? 0
      },
      {
        name: 'Bar Height',
        key: 'scale',
        min: 0.5,
        max: 1.5,
        step: 0.1,
        default: 0.5,
        value: this.config.scale ?? 0.5
      },
      {
        name: 'Smoothness',
        key: 'smoothness',
        min: 0.1,
        max: 2,
        step: 0.1,
        default: 1.0,
        value: this.config.smoothness ?? 1.0
      },
      {
        name: 'Bar Width',
        key: 'width',
        min: 2,
        max: 60,
        step: 1,
        default: 4,
        value: this.config.width ?? 4
      }
    ];
  }

  init(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.container);
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    const { audioData, isPlaying, bassAvg } = audioAnalysis;
    const smoothness = this.config.smoothness ?? 1.0;
    const lerpFactor = 1 / (smoothness * 10);

    // Smooth bass for circle pulsation
    const bassTarget = isPlaying ? bassAvg / 255 : 0;
    this.smoothedBass += (bassTarget - this.smoothedBass) * lerpFactor;

    if (this.smoothedData.length !== audioData.length) {
      this.smoothedData = new Array(audioData.length).fill(0);
    }

    for (let i = 0; i < audioData.length; i++) {
      const target = isPlaying ? audioData[i] : 0;
      this.smoothedData[i] += (target - this.smoothedData[i]) * lerpFactor;
    }
  }

  render(): void {
    if (!this.ctx || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    const mode = Math.round(this.config.mode ?? 0);

    switch (mode) {
      case 1:
        this.renderCircle(w, h);
        break;
      case 2:
        this.renderSineWave(w, h);
        break;
      case 3:
        this.renderDots(w, h);
        break;
      default:
        this.renderLine(w, h);
        break;
    }

    this.ctx.restore();
  }

  // ── Mode 0: Line ──────────────────────────────────────────────

  private renderLine(w: number, h: number): void {
    const ctx = this.ctx!;
    const barCount = this.smoothedData.length;
    const scale = this.config.scale ?? 0.5;
    const barWidth = this.config.width ?? 4;
    const gap = 2;

    const maxBarHeight = h * 0.6;
    const floorY = h * 0.85;

    const totalBarsWidth = barCount * (barWidth + gap) - gap;
    const startX = (w - totalBarsWidth) / 2;

    for (let i = 0; i < barCount; i++) {
      const value = this.smoothedData[i] / 255;
      const barHeight = Math.max(2, value * maxBarHeight * scale);
      const x = startX + i * (barWidth + gap);
      const y = floorY - barHeight;

      ctx.fillStyle = this.getBarColor(i, barCount);

      const radius = Math.min(barWidth / 2, 3);
      ctx.beginPath();
      this.roundedRect(ctx, x, y, barWidth, barHeight, radius);
      ctx.fill();
    }
  }

  // ── Mode 1: Circle ────────────────────────────────────────────

  private renderCircle(w: number, h: number): void {
    const ctx = this.ctx!;
    const barCount = this.smoothedData.length;
    const scale = this.config.scale ?? 0.5;
    const barWidth = this.config.width ?? 4;

    const centerX = w / 2;
    const centerY = h / 2;
    const baseRadius = Math.min(w, h) * 0.12;
    const innerRadius = baseRadius + baseRadius * this.smoothedBass * 0.5;
    const maxBarLength = Math.min(w, h) * 0.25;

    for (let i = 0; i < barCount; i++) {
      const value = this.smoothedData[i] / 255;
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const barLength = Math.max(2, value * maxBarLength * scale);

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * (innerRadius + barLength);
      const y2 = centerY + Math.sin(angle) * (innerRadius + barLength);

      ctx.strokeStyle = this.getBarColor(i, barCount);
      ctx.lineWidth = Math.max(1, barWidth * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // ── Mode 2: Sine Wave ─────────────────────────────────────────

  private renderSineWave(w: number, h: number): void {
    const ctx = this.ctx!;
    const barCount = this.smoothedData.length;
    const scale = this.config.scale ?? 0.5;
    const barWidth = this.config.width ?? 4;
    const gap = 2;

    const maxBarHeight = h * 0.45;
    const baseline = h * 0.65;
    const sineAmplitude = h * 0.08;
    const sineFrequency = 2;

    const totalBarsWidth = barCount * (barWidth + gap) - gap;
    const startX = (w - totalBarsWidth) / 2;

    const time = Date.now() * 0.001;

    for (let i = 0; i < barCount; i++) {
      const value = this.smoothedData[i] / 255;
      const barHeight = Math.max(2, value * maxBarHeight * scale);

      const x = startX + i * (barWidth + gap);
      const sineOffset = Math.sin((i / barCount) * Math.PI * 2 * sineFrequency + time) * sineAmplitude;
      const floorY = baseline + sineOffset;
      const y = floorY - barHeight;

      ctx.fillStyle = this.getBarColor(i, barCount);

      const radius = Math.min(barWidth / 2, 3);
      ctx.beginPath();
      this.roundedRect(ctx, x, y, barWidth, barHeight, radius);
      ctx.fill();
    }
  }

  // ── Mode 3: Dots ──────────────────────────────────────────────

  private renderDots(w: number, h: number): void {
    const ctx = this.ctx!;
    const barCount = this.smoothedData.length;
    const scale = this.config.scale ?? 0.5;
    const barWidth = this.config.width ?? 4;
    const dotRadius = Math.max(1, barWidth / 2);
    const dotSpacing = dotRadius * 2.5;
    const gap = 2;

    const maxDots = 20;
    const floorY = h * 0.85;

    const totalWidth = barCount * (barWidth + gap) - gap;
    const startX = (w - totalWidth) / 2;

    for (let i = 0; i < barCount; i++) {
      const value = this.smoothedData[i] / 255;
      const numDots = Math.round(value * maxDots * scale);
      const centerX = startX + i * (barWidth + gap) + barWidth / 2;

      const color = this.getBarColor(i, barCount);

      for (let d = 0; d < numDots; d++) {
        const y = floorY - d * dotSpacing - dotRadius;
        const opacity = 1 - (d / maxDots) * 0.4;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Color palettes ────────────────────────────────────────────

  private getBarColor(index: number, total: number): string {
    const paletteIndex = Math.round(this.config.palette ?? 0);
    const t = total > 1 ? index / (total - 1) : 0;

    switch (paletteIndex) {
      case 0: {
        // Album: dominant → accent
        const d = this.parseRGB(this.colors.dominant);
        const a = this.parseRGB(this.colors.accent);
        const r = Math.round((d.r * (1 - t) + a.r * t) * 255);
        const g = Math.round((d.g * (1 - t) + a.g * t) * 255);
        const b = Math.round((d.b * (1 - t) + a.b * t) * 255);
        return `rgb(${r},${g},${b})`;
      }
      case 1:
        // Rainbow
        return `hsl(${t * 360}, 80%, 55%)`;
      case 2:
        // Fire: red → orange → yellow
        return `hsl(${t * 55}, 90%, ${45 + t * 15}%)`;
      case 3:
        // Ocean: deep blue → cyan → teal
        return `hsl(${220 - t * 50}, 75%, ${40 + t * 20}%)`;
      case 4:
        // Neon: magenta → cyan → lime
        return `hsl(${300 - t * 180}, 100%, 55%)`;
      case 5: {
        // Sunset: purple → magenta → orange → gold
        const hue = t < 0.5 ? 280 + t * 80 : 30 + (t - 0.5) * 30;
        return `hsl(${hue}, 80%, 50%)`;
      }
      case 6:
        // Monochrome: white with varying opacity
        return `rgba(255, 255, 255, ${0.4 + t * 0.6})`;
      default:
        return `hsl(${t * 360}, 80%, 55%)`;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  updateConfig(key: string, value: number): void {
    super.updateConfig(key, value);
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.isInitialized = false;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.canvas && this.container.contains(this.canvas)) {
      this.container.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.smoothedData = [];
  }
}
