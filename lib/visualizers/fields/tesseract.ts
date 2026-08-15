import { ParticleField } from './types';

export const tesseract: ParticleField = {
  key: 'tesseract',
  name: 'Breathing Tesseract',
  blurb: 'A tesseract whose edges pulse with the spectrum and rotate on the beat.',
  body: (c) => {
    const {
      i, count, time, dt, bass, mid, high, level, beat, isPlaying,
      target, color, attr,
      spectrum, band, hash, addControl,
      dominant, accent, paletteHue, isDark,
    } = c;
    // ---- generated body below ------------------------------------------

    // NAME: Tesseract Breath
    // BLURB: A 4D hypercube folding through the w-axis, its edges swelling with the lows and punching on the beat.
    const scale = addControl("scale", "Scale", 3, 9, 0.1, 5);
    const wspin = addControl("wspin", "W Spin", 0, 3, 0.05, 0.7);
    const depth = addControl("depth", "W Depth", 2.4, 4, 0.05, 2.8);
    const breathe = addControl("breathe", "Breathe", 0, 2, 0.05, 1);
    const s = i / count;
    const e = Math.min((s * 32) | 0, 31);
    const along = s * 32 - e;
    const d = (e / 8) | 0;
    const fixed = e & 7;
    const m = along * 2 - 1;
    const cx = (d === 0) ? m : (((fixed >> (0 - (0 > d ? 1 : 0))) & 1) * 2 - 1);
    const cy = (d === 1) ? m : (((fixed >> (1 - (1 > d ? 1 : 0))) & 1) * 2 - 1);
    const cz = (d === 2) ? m : (((fixed >> (2 - (2 > d ? 1 : 0))) & 1) * 2 - 1);
    const cw = (d === 3) ? m : (((fixed >> (3 - (3 > d ? 1 : 0))) & 1) * 2 - 1);
    const aXW = time * wspin + mid * 1.4 + beat * 0.5;
    const aYW = time * wspin * 0.55 + Math.sin(time * 0.4) * 0.5;
    const x1 = cx * Math.cos(aXW) - cw * Math.sin(aXW);
    const w1 = cx * Math.sin(aXW) + cw * Math.cos(aXW);
    const y1 = cy * Math.cos(aYW) - w1 * Math.sin(aYW);
    const w2 = cy * Math.sin(aYW) + w1 * Math.cos(aYW);
    const spin = time * 0.3 + mid;
    const px = x1 * Math.cos(spin) - cz * Math.sin(spin);
    const pz = x1 * Math.sin(spin) + cz * Math.cos(spin);
    const amp = band(s);
    const persp = 1 / Math.max(depth - w2, 0.6);
    const pulse = 1 + Math.min(bass * 0.5 + beat * 0.5, 1) * 0.2 * breathe + amp * 0.12;
    const f = scale * persp * pulse;
    const jit = (hash(i) - 0.5) * 0.18;
    target.set((px + jit) * f, (y1 + jit) * f, (pz - jit) * f);
    const wt = Math.min(Math.max((w2 + 1.5) / 3, 0), 1);
    color.copy(dominant).lerp(accent, wt * 0.7 + amp * 0.3);
    const corner = Math.abs(m);
    attr.size = 0.5 + corner * 0.9 + amp * 1.6 + beat * 1.3 + high * 0.6;
    attr.alpha = isDark ? (0.3 + amp * 0.5 + corner * 0.3) : (0.7 + amp * 0.25);

    // ---- generated body above ------------------------------------------
  },
};  
