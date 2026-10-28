/**
 * Reeds Visualizer
 *
 * A field of thin strokes rooted along a curved baseline and rising to
 * heights read from the spectrum, like a stand of grass or a seismograph
 * drawn in one gesture.
 *
 * Two things shape it. The baseline is an arc, not a straight edge, so the
 * field wraps around the bottom of the screen and the outermost reeds lean
 * outward over the corners. And the tips are pulled toward a convergence
 * point above the field — weighted by height, so the short reeds stay radial
 * while the peaks sweep together like a sheaf being gathered. That weighting
 * is the whole composition: convergence applied evenly just makes a fan.
 *
 * Canvas2D rather than WebGL: these are stroked curves with round caps and
 * detached dashes above the tips, which is a few lines here and a research
 * project in a shader.
 */

import { AudioAnalysis } from '../audioEngine';
import { BaseVisualizer, VisualizerControl, VisualizerPreset, VisualizerConfig, ColorScheme } from './BaseVisualizer';

const BINS = 64;

export class ReedsVisualizer extends BaseVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private smoothed: number[] = new Array(BINS).fill(0);
  private smoothedBass = 0;
  private time = 0;
  private lastFrame = 0;

  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }

  getName(): string {
    return 'Reeds';
  }

  getControls(): VisualizerControl[] {
    return [
      { name: 'Reeds', key: 'count', min: 40, max: 400, step: 10, default: 220, value: this.config.count ?? 220 },
      { name: 'Wrap', key: 'wrap', min: 0, max: 1, step: 0.02, default: 0.55, value: this.config.wrap ?? 0.55 },
      { name: 'Converge', key: 'converge', min: 0, max: 1, step: 0.02, default: 0.5, value: this.config.converge ?? 0.5 },
      { name: 'Focus', key: 'focus', min: -0.2, max: 0.6, step: 0.02, default: 0.16, value: this.config.focus ?? 0.16 },
      { name: 'Height', key: 'height', min: 0.2, max: 1.4, step: 0.05, default: 0.62, value: this.config.height ?? 0.62 },
      { name: 'Fringe', key: 'fringe', min: 0, max: 1, step: 0.05, default: 0.4, value: this.config.fringe ?? 0.4 },
      { name: 'Floor', key: 'floor', min: 0, max: 0.5, step: 0.02, default: 0.18, value: this.config.floor ?? 0.18 },
      { name: 'Thickness', key: 'thickness', min: 0.1, max: 1, step: 0.05, default: 0.45, value: this.config.thickness ?? 0.45 },
      { name: 'Dashes', key: 'dashes', min: 0, max: 1, step: 0.05, default: 0.6, value: this.config.dashes ?? 0.6 },
      { name: 'Sway', key: 'sway', min: 0, max: 1, step: 0.05, default: 0.3, value: this.config.sway ?? 0.3 },
      { name: 'Smoothing', key: 'smoothing', min: 0.05, max: 1, step: 0.05, default: 0.3, value: this.config.smoothing ?? 0.3 },
      { name: 'Reactivity', key: 'reactivity', min: 0.2, max: 2, step: 0.1, default: 1, value: this.config.reactivity ?? 1 },
      { name: 'Duotone', key: 'duotone', min: 0, max: 1, step: 0.05, default: 0.85, value: this.config.duotone ?? 0.85 },
      { name: 'Hue', key: 'hue', min: 0, max: 360, step: 1, default: 0, value: this.config.hue ?? 0 },
      {
        name: 'Harmony',
        key: 'harmonyMode',
        min: 0,
        max: 2,
        step: 1,
        default: 2,
        value: this.config.harmonyMode ?? 2,
        labels: ['Mono', 'Analog', 'Comp']
      }
    ];
  }

  getPresets(): VisualizerPreset[] {
    return [
      // Close to the poster: dense, barely converged, strong wrap
      { name: '1', config: { count: 260, wrap: 0.55, converge: 0.35, focus: 0.16, height: 0.62, fringe: 0.4, floor: 0.18, thickness: 0.45, dashes: 0.6, sway: 0.25, smoothing: 0.3, reactivity: 1, duotone: 0.85, hue: 0, harmonyMode: 2 } },
      // A gathered sheaf — peaks swept hard into the focus point
      { name: '2', config: { count: 180, wrap: 0.75, converge: 0.95, focus: 0.1, height: 0.85, fringe: 0.15, floor: 0.1, thickness: 0.5, dashes: 0.25, sway: 0.5, smoothing: 0.45, reactivity: 1.3, duotone: 0.7, hue: 200, harmonyMode: 2 } },
      // Fine and flat, nearly a seismograph
      { name: '3', config: { count: 400, wrap: 0.12, converge: 0.12, focus: 0.3, height: 0.55, fringe: 0.8, floor: 0.08, thickness: 0.25, dashes: 0.9, sway: 0.1, smoothing: 0.15, reactivity: 1.5, duotone: 0.4, hue: 40, harmonyMode: 1 } },
      // Sparse and tall, leaning right over the corners
      { name: '4', config: { count: 90, wrap: 1, converge: 0.6, focus: -0.05, height: 1.0, fringe: 0.55, floor: 0.25, thickness: 0.8, dashes: 0.4, sway: 0.8, smoothing: 0.6, reactivity: 0.8, duotone: 1, hue: 310, harmonyMode: 2 } }
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

    this.lastFrame = performance.now();
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = (this.container.clientWidth || 800) * dpr;
    this.canvas.height = (this.container.clientHeight || 600) * dpr;
  }

  update(audioAnalysis: AudioAnalysis): void {
    if (!this.isInitialized) return;

    const { audioData, isPlaying, bassAvg } = audioAnalysis;

    const now = performance.now();
    // Clamped so a backgrounded tab doesn't resume with one enormous step
    const dt = Math.min(0.1, (now - this.lastFrame) * 0.001);
    this.lastFrame = now;
    this.time += dt;

    // Smoothing is a time constant, so the field settles at the same rate
    // whatever the frame rate
    const tau = 0.03 + (this.config.smoothing ?? 0.3) * 0.5;
    const k = 1 - Math.exp(-dt / tau);
    const reactivity = this.config.reactivity ?? 1;

    for (let i = 0; i < BINS; i++) {
      const target = isPlaying ? ((audioData[i] ?? 0) / 255) * reactivity : 0;
      this.smoothed[i] += (target - this.smoothed[i]) * k;
    }
    this.smoothedBass += ((isPlaying ? bassAvg : 0) - this.smoothedBass) * k;
  }

  /** Spectrum height for a reed at `t` across the field, interpolated. */
  private heightAt(t: number): number {
    const pos = t * (BINS - 1);
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.smoothed[Math.min(BINS - 1, i)] ?? 0;
    const b = this.smoothed[Math.min(BINS - 1, i + 1)] ?? 0;
    // Smoothstep between bins so the silhouette reads as a curve rather than
    // 64 visible facets
    return a + (b - a) * (f * f * (3 - 2 * f));
  }

  render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    const { dominant, accent } = this.harmonyColorScheme(
      this.config.harmonyMode ?? 2,
      this.config.hue ?? 0
    );
    const reed = this.parseRGB(dominant);
    const tipColor = this.parseRGB(accent);

    // Duotone: the ground takes the accent, the way the reference prints one
    // flat colour behind one flat colour. The two have to be pushed apart in
    // lightness as well as hue — left at their extracted values they land at
    // the same value and the whole field reads as one flat colour.
    const duotone = this.config.duotone ?? 0.85;
    const base = this.darkMode ? { r: 0, g: 0, b: 0 } : { r: 0.91, g: 0.922, b: 0.929 };
    const groundTint = this.darkMode
      ? { r: tipColor.r * 0.16, g: tipColor.g * 0.16, b: tipColor.b * 0.16 }
      : { r: 0.52 + tipColor.r * 0.48, g: 0.52 + tipColor.g * 0.48, b: 0.52 + tipColor.b * 0.48 };
    const ground = {
      r: base.r + (groundTint.r - base.r) * duotone,
      g: base.g + (groundTint.g - base.g) * duotone,
      b: base.b + (groundTint.b - base.b) * duotone
    };

    // Reeds go the other way from the ground: dark ink on a pale field, or
    // bright strokes on a dark one
    const ink = this.darkMode
      ? { r: 0.3 + reed.r * 0.7, g: 0.3 + reed.g * 0.7, b: 0.3 + reed.b * 0.7 }
      : { r: reed.r * 0.38, g: reed.g * 0.38, b: reed.b * 0.38 };
    const inkTip = this.darkMode
      ? { r: 0.3 + tipColor.r * 0.7, g: 0.3 + tipColor.g * 0.7, b: 0.3 + tipColor.b * 0.7 }
      : { r: tipColor.r * 0.45, g: tipColor.g * 0.45, b: tipColor.b * 0.45 };

    ctx.fillStyle = `rgb(${Math.round(ground.r * 255)},${Math.round(ground.g * 255)},${Math.round(ground.b * 255)})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';

    const count = Math.max(10, Math.round(this.config.count ?? 220));
    const wrap = this.config.wrap ?? 0.55;
    const converge = this.config.converge ?? 0.5;
    const heightScale = this.config.height ?? 0.62;
    const floor = this.config.floor ?? 0.18;
    const dashes = this.config.dashes ?? 0.6;
    const fringe = this.config.fringe ?? 0.4;
    const sway = this.config.sway ?? 0.3;

    // The baseline is an arc of this radius, centred below the screen. A
    // small span keeps it nearly flat; a wide one curls the ends down past
    // the bottom corners so the field wraps the edge.
    const span = 0.05 + wrap * 1.15;
    const radius = (w / 2) / Math.sin(span);
    // A full radius below the bottom edge, so the centre reed is rooted
    // exactly on it and the outer ones curve away underneath
    const centreY = h + radius;
    const centreX = w / 2;

    // Where the peaks are gathered
    const focusX = w / 2;
    const focusY = h * (this.config.focus ?? 0.16);

    const spacing = w / count;
    const lineWidth = Math.max(0.4, spacing * (this.config.thickness ?? 0.45) * 2);
    ctx.lineWidth = lineWidth;

    // A bass swell lifts the whole field a little, so sustained low end has
    // somewhere to go even when the spectrum itself is flat
    const swell = 1 + this.smoothedBass * 0.35;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;

      const angle = (t - 0.5) * 2 * span;
      const dirX = Math.sin(angle);
      const dirY = -Math.cos(angle);
      const rootX = centreX + radius * dirX;
      const rootY = centreY - radius * Math.cos(angle);

      // Mirror the spectrum about the centre so both halves carry the same
      // material, with the low end in the middle: run it the other way and
      // the bass piles up in the corners while the centre sits silent
      const mirrored = Math.abs(t - 0.5) * 2;
      const energy = this.heightAt(mirrored);

      // A gentle curve, since most of a mix's bins sit low and a linear map
      // leaves the field as a stub along the bottom
      let norm = floor + Math.pow(energy, 0.6) * heightScale * swell;

      // Break the silhouette up. Straight off the spectrum the outline is a
      // smooth bell; the reference's edge is ragged, individual stalks
      // standing proud of their neighbours. One fast term for stalk-to-stalk
      // variation, one slow one so they clump rather than scatter evenly.
      if (fringe > 0) {
        const stalk = Math.sin(i * 12.9898) * 43758.5453;
        const jitter = (stalk - Math.floor(stalk)) - 0.5;
        norm *= 1 + fringe * (jitter * 0.3 + 0.14 * Math.sin(t * 27.7 + 1.3));
      }
      norm = Math.max(0, Math.min(1, norm));
      const length = norm * h * 0.95;

      // Reeds lean on a slow travelling wave, detuned along the field so the
      // stand never sways as one block
      const lean = sway * 0.12 * Math.sin(this.time * 0.6 + t * 7);

      const tipX = rootX + (dirX + lean) * length;
      const tipY = rootY + dirY * length;

      // Only the peaks are drawn to the focus. Weighting by height is what
      // makes it read as gathering rather than as a fan.
      const pull = converge * Math.pow(norm, 2.2);
      const endX = tipX + (focusX - tipX) * pull;
      const endY = tipY + (focusY - tipY) * pull;

      // Leave the root radially, then bend: the control point sits along the
      // original direction so the base of the field stays a clean rank
      const ctrlX = rootX + (dirX + lean) * length * 0.55;
      const ctrlY = rootY + dirY * length * 0.55;

      // Taller reeds drift toward the accent, so the peaks separate from the
      // mass without breaking the duotone
      const mix = Math.pow(norm, 1.2) * 0.55;
      ctx.strokeStyle = `rgb(${Math.round((ink.r + (inkTip.r - ink.r) * mix) * 255)},${Math.round((ink.g + (inkTip.g - ink.g) * mix) * 255)},${Math.round((ink.b + (inkTip.b - ink.b) * mix) * 255)})`;

      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.stroke();

      // Detached dashes carrying on past the tip, shorter and further apart
      // as they go — the flecks above the peaks in the reference
      if (dashes > 0 && norm > 0.25) {
        const tangentX = endX - ctrlX;
        const tangentY = endY - ctrlY;
        const tangentLength = Math.hypot(tangentX, tangentY) || 1;
        const ux = tangentX / tangentLength;
        const uy = tangentY / tangentLength;

        const step = lineWidth * 2.6 * (0.5 + dashes);
        let cursor = step * 0.8;
        for (let d = 0; d < 2; d++) {
          const dashLength = step * 0.55 * (1 - d * 0.4) * dashes;
          if (dashLength < 0.6) break;
          const x0 = endX + ux * cursor;
          const y0 = endY + uy * cursor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 + ux * dashLength, y0 + uy * dashLength);
          ctx.stroke();
          cursor += dashLength + step * (0.8 + d * 0.5);
        }
      }
    }

    ctx.restore();
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
    this.smoothed = [];
  }
}
