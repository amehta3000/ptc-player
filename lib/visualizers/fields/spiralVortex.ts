import { ParticleField } from './types';

export const spiralVortex: ParticleField = {
  key: 'vortex',
  name: 'Spiral Vortex',
  blurb: 'A swept disc of spiral arms around a bright spectral ring, folding into a twin-lobed core.',
  // A flat disc at the default pitch is seen almost edge-on; look down on it
  defaults: { cameraPitch: 0.6 },
  body: (c) => {
    const {
      i, count, time, bass, high, beat,
      target, color, attr,
      band, hash, addControl,
      paletteHue, isDark,
    } = c;
    // ---- generated body below ------------------------------------------
    const arms = addControl('arms', 'Arms', 8, 96, 1, 48);
    const twist = addControl('twist', 'Twist', 0, 8, 0.1, 0.9);
    const spin = addControl('spin', 'Spin Speed', 0, 3, 0.05, 0.45);
    const radius = addControl('radius', 'Radius', 2, 9, 0.1, 6.5);

    const armCount = Math.max(1, Math.round(arms));
    const arm = i % armCount;
    // Position along this arm, 0 at the core to 1 at the tip
    const along = (i - arm) / Math.max(1, count - armCount);
    const amp = band(along);

    // sqrt packs particles toward the core, matching the density falloff
    const rr = radius * Math.sqrt(along) * (1 + bass * 0.25) + (hash(i) - 0.5) * 0.12;
    const sweep = arm * (Math.PI * 2 / armCount) + Math.pow(along, 0.7) * twist * Math.PI + time * spin;

    // The 2-theta term folds the inner disc into the twin-lobed core; exp
    // decay keeps the fold from reaching the outer arms
    const fold = Math.sin(sweep * 2) * Math.exp(-along * 7) * 1.2;
    const y = fold + Math.sin(along * 9 - time * 1.4) * (0.15 + amp * 0.9 + beat * 0.3);

    target.set(Math.cos(sweep) * rr, y, Math.sin(sweep) * rr);

    // Gaussian band near the core desaturates to a bright white ring
    const ringEdge = (along - 0.22) * 20;
    const ring = Math.exp(-ringEdge * ringEdge);
    // Arms thin out with radius, so lift the tips to keep them readable
    const tip = along * along;
    color.setHSL(
      paletteHue + along * 0.08 + high * 0.05,
      0.7 - ring * 0.6,
      isDark ? 0.28 + ring * 0.4 + tip * 0.2 + amp * 0.25 : 0.3 - ring * 0.1 + amp * 0.12
    );
    attr.size = 0.4 + ring * 1.2 + tip * 0.5 + amp * 1.8 + beat * 0.8;
    attr.alpha = isDark ? 0.16 + ring * 0.35 + tip * 0.2 + amp * 0.28 : 0.7 + amp * 0.3;
    // ---- generated body above ------------------------------------------
  },
};
