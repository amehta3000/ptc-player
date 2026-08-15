import { ParticleField } from './types';

export const nestedVessels: ParticleField = {
  key: 'nestedVessels',
  name: 'Nested Vessels',
  blurb: 'Four concentric shells - sphere in cube in sphere in cube - each breathing and counter-rotating with the mix.',
  body: (nv) => {
    const {
      i, count, time, dt, bass, mid, high, level, beat, isPlaying,
      target, color, attr,
      spectrum, band, hash, addControl,
      dominant, accent, paletteHue, isDark,
    } = nv;
    // ---- generated body below ------------------------------------------

    // NAME: Nested Vessels
    // BLURB: Four concentric shells - sphere in cube in sphere in cube - each breathing and counter-rotating with the mix.
    const spacing = addControl("spacing", "Spacing", 1, 2.2, 0.05, 1.6);
    const spin = addControl("spin", "Spin", 0, 2, 0.05, 0.5);
    const pulse = addControl("pulse", "Pulse", 0, 1.5, 0.05, 0.7);
    const wobble = addControl("wobble", "Wobble", 0, 0.6, 0.02, 0.2);
    const group = i & 3;
    const isSphere = (group & 1) === 0;
    const localT = (i >> 2) / Math.max(count >> 2, 1);
    const y = 1 - localT * 2;
    const rr = Math.sqrt(Math.max(1 - y * y, 0));
    const th = i * 2.399963;
    const sx = Math.cos(th) * rr, sy = y, sz = Math.sin(th) * rr;
    const fc = (hash(i) * 6) | 0;
    const axis = fc >> 1;
    const sgn = (fc & 1) * 2 - 1;
    const fa = hash(i + 31) * 2 - 1, fb = hash(i + 67) * 2 - 1;
    const cx = axis === 0 ? sgn : fa;
    const cy = axis === 1 ? sgn : (axis === 0 ? fa : fb);
    const cz = axis === 2 ? sgn : fb;
    const ux = isSphere ? sx : cx, uy = isSphere ? sy : cy, uz = isSphere ? sz : cz;
    const amp = band(localT);
    const breath = Math.min(bass * pulse + beat * 0.4, 1.2);
    const gain = isSphere ? 0.14 : 0.07;
    const rad = spacing * (group + 1) * (1 + breath * gain + amp * 0.06);
    const rot = time * spin * (isSphere ? 1 : -1) + mid * 0.8;
    const c = Math.cos(rot), s = Math.sin(rot);
    const rx = ux * c - uz * s, rz = ux * s + uz * c;
    const bob = Math.sin(time * 0.6 + group * 1.5) * wobble;
    target.set(rx * rad, uy * rad + bob, rz * rad);
    const mixT = Math.min(group / 3 * 0.6 + amp * 0.4, 1);
    color.copy(dominant).lerp(accent, mixT);
    attr.size = 0.5 + amp * 1.8 + beat * 1.2 + high * 0.6 + (isSphere ? 0 : 0.3);
    attr.alpha = isDark ? 0.3 + amp * 0.5 + (1 - group / 3) * 0.2 : 0.72 + amp * 0.25;

    // ---- generated body above ------------------------------------------
  },
};  
