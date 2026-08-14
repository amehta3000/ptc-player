/**
 * Particle Field types
 *
 * A "field" is the per-particle body of a particle simulation, with none of
 * the Three.js boilerplate. ParticleFieldVisualizer owns the scene, camera,
 * renderer, points mesh, audio smoothing and beat detection, and calls a
 * field's `body` once per particle, per frame.
 *
 * Everything a field needs arrives on the FieldContext. See
 * ../PARTICLE_FIELD_PROMPT.md for the prompt that generates these bodies and
 * fields/README.md for how to add one.
 */

import * as THREE from 'three';

/** Per-particle draw properties. Reset to defaults before every body call. */
export interface FieldAttr {
  /** Point size multiplier, sensible range 0.2 - 6.0. Default 1. */
  size: number;
  /** Opacity 0 - 1. Default 1. */
  alpha: number;
}

export interface FieldContext {
  // --- identity -----------------------------------------------------------
  /** Index of the current particle, 0 to count-1. */
  i: number;
  /** Total particles this frame. */
  count: number;

  // --- clock --------------------------------------------------------------
  /** Seconds since the visualizer mounted. Advances even while paused. */
  time: number;
  /** Seconds since the previous frame, clamped to a sane range. */
  dt: number;

  // --- audio (all normalized 0-1, smoothed, never NaN) --------------------
  bass: number;
  mid: number;
  high: number;
  /** Overall average energy. */
  level: number;
  /** Transient envelope: spikes toward 1 on a beat, decays over ~300ms. */
  beat: number;
  isPlaying: boolean;

  // --- outputs (mutate, never reassign) -----------------------------------
  target: THREE.Vector3;
  color: THREE.Color;
  attr: FieldAttr;

  // --- helpers ------------------------------------------------------------
  /** Amplitude 0-1 for integer bin 0-63 (low = bass). Index is clamped. */
  spectrum: (bin: number) => number;
  /** Amplitude 0-1 for t in 0-1, interpolated across the 64 bins. */
  band: (t: number) => number;
  /** Deterministic pseudo-random 0-1. Stable across frames. */
  hash: (n: number) => number;
  /** Registers a slider in the player UI and returns its current value. */
  addControl: (
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number
  ) => number;

  // --- palette (from the playing track's album art) -----------------------
  dominant: THREE.Color;
  accent: THREE.Color;
  /** Base hue 0-1 of the album art, with the user's hue offset applied. */
  paletteHue: number;
  isDark: boolean;

  THREE: typeof THREE;
}

export interface ParticleField {
  /** Stable camelCase id. Used to namespace this field's control keys. */
  key: string;
  /** Display name, shown on the Field slider. */
  name: string;
  /** One-line description of the visual. */
  blurb: string;
  /** Runs once per particle, per frame. Must set `target` and `color`. */
  body: (c: FieldContext) => void;
}

/** A control discovered by probing a field's body. */
export interface FieldControlSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}
