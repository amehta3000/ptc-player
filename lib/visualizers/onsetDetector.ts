/**
 * Percussive onset detection for visualizers that want one event per hit.
 *
 * Thresholding the bass level misses kicks: a loud passage keeps the level
 * high so the next kick never clears the bar, and a quiet one never reaches
 * it at all. This watches *spectral flux* instead — how much energy rose
 * since the last frame — which spikes on an attack regardless of how loud
 * the surrounding music is, and compares it against the recent flux rather
 * than against a fixed number.
 */

/** Low bars of the 64-band spectrum, roughly kick and low-tom territory. */
const LOW_BANDS = 12;
/** Window of recent flux used as the adaptive floor. */
const HISTORY_SECONDS = 1.2;
/** Shortest gap between two onsets, in seconds — about 400bpm. */
const REFRACTORY = 0.12;
/** Flux is a per-frame difference, so it is rescaled to this nominal rate. */
const NOMINAL_FPS = 60;

export class OnsetDetector {
  private previous = new Float32Array(LOW_BANDS);
  private history: { at: number; flux: number }[] = [];
  private lastOnsetAt = -Infinity;
  private primed = false;

  /**
   * Feed one frame of spectrum.
   *
   * @param now seconds, monotonic
   * @param sensitivity 0..1, higher fires on smaller attacks
   * @returns the onset's strength in 0.35..1, or 0 for no onset this frame
   */
  update(audioData: number[], isPlaying: boolean, now: number, dt: number, sensitivity: number): number {
    if (!isPlaying || dt <= 0) {
      this.previous.fill(0);
      this.history.length = 0;
      this.primed = false;
      return 0;
    }

    // Positive spectral flux: only energy that rose counts, so a decaying
    // note cannot register as a new hit
    let flux = 0;
    for (let i = 0; i < LOW_BANDS; i++) {
      const value = (audioData[i] ?? 0) / 255;
      const rise = value - this.previous[i];
      if (rise > 0) flux += rise;
      this.previous[i] = value;
    }
    flux /= LOW_BANDS;

    // A long frame accumulates more change than a short one, so normalise to
    // a nominal frame or the threshold drifts with the frame rate
    flux *= 1 / (NOMINAL_FPS * dt);

    // The first frame after silence is all rise and would always fire
    if (!this.primed) {
      this.primed = true;
      return 0;
    }

    this.history.push({ at: now, flux });
    while (this.history.length > 0 && now - this.history[0].at > HISTORY_SECONDS) {
      this.history.shift();
    }
    if (this.history.length < 8) return 0;

    let mean = 0;
    for (const h of this.history) mean += h.flux;
    mean /= this.history.length;

    let variance = 0;
    for (const h of this.history) variance += (h.flux - mean) ** 2;
    const deviation = Math.sqrt(variance / this.history.length);

    // Clear the recent average by a margin set in units of its own spread, so
    // a busy mix needs a bigger spike than a sparse one to count
    const margin = 2.2 - sensitivity * 1.6;
    const threshold = mean + deviation * margin + 0.0012;

    if (flux < threshold || now - this.lastOnsetAt < REFRACTORY) return 0;

    this.lastOnsetAt = now;
    return Math.max(0.35, Math.min(1, (flux - threshold) / (threshold + 0.004)));
  }

  reset(): void {
    this.previous.fill(0);
    this.history.length = 0;
    this.lastOnsetAt = -Infinity;
    this.primed = false;
  }
}
