import { ParticleField } from './types';

export const jellyFish: ParticleField = {
  key: 'jellyfish',
  name: 'Jellyfish',
  blurb: 'A jellyfish whose tentacles pulse with the spectrum and sway on the beat.',
  defaults: { particleSize: 0.6, cameraSpeed: 0, zoomSpeed: 0, trail: 0.45 },
  body: (c) => {
    const {
      i, count, time, dt, bass, mid, high, level, beat, isPlaying,
      target, color, attr,
      spectrum, band, hash, addControl,
      dominant, accent, paletteHue, isDark,
    } = c;
    // ---- generated body below ------------------------------------------

    // NAME: Spectral Medusa
    // BLURB: A luminous jellyfish bell pulses with bass while long spectral tentacles ripple through the music.
    const bellRadius = addControl("bellRadius", "Bell Radius", 1.5, 5, 0.1, 1.8);
    const bellDepth = addControl("bellDepth", "Bell Depth", 0.5, 3, 0.1, 1.6);
    const tentacleLength = addControl("tentacleLength", "Tentacle Length", 3, 10, 0.1, 10);
    const tentacleCount = addControl("tentacleCount", "Tentacles", 6, 32, 1, 22);
    const flow = addControl("flow", "Tentacle Flow", 0.2, 3, 0.1, 1.5);
    const curl = addControl("curl", "Tip Curl", 0, 3, 0.1, 0.9);
    const t = i / Math.max(count, 1);
    const bellPart = 0.3;
    const isBell = +(t < bellPart);
    const q = Math.min(t / bellPart, 1);
    const tailT = Math.max(0, (t - bellPart) / Math.max(1 - bellPart, 0.001));
    const strandPos = tailT * tentacleCount;
    const strand = Math.min(Math.floor(strandPos), tentacleCount - 1);
    const v = strandPos - strand;
    const phase = hash(strand + 41) * Math.PI * 2;
    const golden = 2.399963229728653;

    // Bell breathes gently with bass
    const pulse = 1 + bass * 0.15;
    const bellAngle = i * golden + time * 0.15;
    const bellRing = bellRadius * Math.sqrt(Math.max(q, 0)) * pulse;
    const bellX = Math.cos(bellAngle) * bellRing;
    const bellY = 2.4 - bellDepth * q + Math.sin(q * Math.PI * 3 - time * 1.2) * 0.08;
    const bellZ = Math.sin(bellAngle) * bellRing;

    // Tentacles: root anchors to bell edge (pulsed), rest free-flows on sine
    const rootPulse = 1 + bass * 0.15 * Math.max(0, 1 - v * 4);
    const rootR = bellRadius * (0.28 + hash(strand + 113) * 0.38) * rootPulse;
    const rootAngle = phase + time * 0.12;
    const sway = (0.15 + v * v * 0.8) * flow * 0.55;
    const wave = time * 0.8 - v * (5 + curl * 3) + phase;
    const tailX = Math.cos(rootAngle) * rootR + Math.sin(wave) * sway;
    const tailY = 1.55 - v * tentacleLength * (0.8 + hash(strand + 77) * 0.4) + Math.sin(wave * 0.55) * v * curl * 0.3;
    const tailZ = Math.sin(rootAngle) * rootR + Math.cos(wave * 0.91) * sway;
    target.set(bellX * isBell + tailX * (1 - isBell), bellY * isBell + tailY * (1 - isBell), bellZ * isBell + tailZ * (1 - isBell));
    color.copy(dominant).lerp(accent, Math.min(1, v * 0.4 + bass * 0.3));
    attr.size = Math.min(6, 0.5 + isBell * 0.4 + bass * 0.6);
    attr.alpha = isDark ? Math.min(1, 0.35 + bass * 0.3 + isBell * 0.15) : Math.min(1, 0.8 + bass * 0.15);

    // ---- generated body above ------------------------------------------
  },
};


