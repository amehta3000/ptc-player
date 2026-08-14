import { ParticleField } from './types';

export const spectralHelix: ParticleField = {
  key: 'helix',
  name: 'Spectral Helix',
  blurb: 'A double helix whose strands swell with the spectrum and twist on the beat.',
  body: (c) => {
    const {
      i, count, time, bass, high, beat,
      target, color, attr,
      band, hash, addControl,
      dominant, accent, isDark,
    } = c;
    // ---- generated body below ------------------------------------------
    const radius = addControl('radius', 'Radius', 1, 8, 0.1, 4);
    const twist = addControl('twist', 'Twist', 0, 12, 0.1, 3);
    const spread = addControl('spread', 'Spread', 1, 18, 0.5, 10);
    const t = i / count;
    const strand = (i & 1) * 2 - 1;
    const amp = band(t);
    const jitter = (hash(i) - 0.5) * 0.4;
    const angle = t * Math.PI * 2 * twist + time * 0.6 + strand * Math.PI;
    const r = radius * (1 + Math.min(amp * 1.2 + beat * 0.4 + bass * 0.3, 1.4)) + jitter;
    target.set(
      Math.cos(angle) * r,
      (t - 0.5) * spread + Math.sin(time + t * 6) * 0.3,
      Math.sin(angle) * r
    );
    color.copy(dominant).lerp(accent, Math.min(amp + high * 0.3, 1));
    attr.size = 0.6 + amp * 2.5 + beat * 1.5;
    attr.alpha = isDark ? 0.35 + amp * 0.65 : 0.7 + amp * 0.3;
    // ---- generated body above ------------------------------------------
  },
};
