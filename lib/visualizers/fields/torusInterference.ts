import { ParticleField } from './types';

export const torusInterference: ParticleField = {
  key: 'torus',
  name: 'Torus Interference',
  blurb: 'A torus skin rippling with two interfering spectrum waves, punched outward on the beat.',
  body: (c) => {
    const {
      i, count, time, bass, high, beat,
      target, color, attr,
      band, hash, addControl,
      paletteHue, isDark,
    } = c;
    // ---- generated body below ------------------------------------------
    const knots = addControl('knots', 'Knots', 1, 9, 1, 3);
    const spread = addControl('spread', 'Spread', 1, 6, 0.1, 3.5);
    const ripple = addControl('ripple', 'Ripple', 0, 4, 0.1, 1.4);
    const t = i / count;
    const u = t * Math.PI * 2 * knots + time * 0.25;
    const v = t * Math.PI * 2 * 61 + time * 0.9;
    const amp = band(t);
    const wave = Math.sin(u * 2 - time * 1.5) * Math.cos(v * 0.5 + time);
    const major = spread * (1 + bass * 0.35);
    const minor = 0.5 + amp * ripple + wave * 0.25 + beat * 0.3 + hash(i) * 0.08;
    const ring = major + minor * Math.cos(v);
    target.set(
      ring * Math.cos(u),
      minor * Math.sin(v) + Math.sin(time * 0.6 + t * 8) * 0.2,
      ring * Math.sin(u)
    );
    color.setHSL(
      paletteHue + amp * 0.15 + high * 0.1,
      0.75,
      isDark ? 0.45 + amp * 0.35 : 0.3 + amp * 0.15
    );
    attr.size = 0.5 + amp * 2 + beat;
    attr.alpha = isDark ? 0.3 + amp * 0.7 : 0.75;
    // ---- generated body above ------------------------------------------
  },
};
