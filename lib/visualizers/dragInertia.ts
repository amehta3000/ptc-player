/**
 * Drag Inertia
 *
 * Gives orbit-drag the "throw it and let it coast" feel: release mid-motion
 * and the rotation keeps going, easing to a stop instead of stopping dead.
 *
 * Works in **screen pixels**, not radians, so each visualizer keeps its own
 * pixels-to-radians factor, axis signs and clamping. Wire it up with four
 * calls:
 *
 *   pointer down  -> grab()
 *   pointer move  -> record(dxPixels, dyPixels)
 *   pointer up    -> release()
 *   every frame   -> step() (or glideOrbit() for the common {x,y} case)
 *
 * Velocity is tracked in pixels/second against the wall clock, and decay is
 * exponential in real time, so the glide is identical at 30fps and 120fps.
 */

/** Weight of the newest sample in the velocity average (0-1). */
const SMOOTHING = 0.45;
/** Exponential decay rate, per second. ~4% of the throw survives 1 second. */
const FRICTION = 2.6;
/** Ceiling on throw speed, pixels/second. */
const MAX_SPEED = 1200;
/** Below this, pixels/second, the glide is over. */
const MIN_SPEED = 3;
/**
 * If the pointer was still for longer than this before release, the user
 * parked the object rather than throwing it — so do not glide.
 */
const PAUSE_MS = 120;
/** Floor on the gap between move samples, ms. Guards against dt of 0. */
const MIN_SAMPLE_MS = 8;
/** Ceiling on a single glide step, seconds. Stops backgrounded tabs jumping. */
const MAX_STEP_S = 0.1;

export class DragInertia {
  private vx = 0;
  private vy = 0;
  private gliding = false;
  private lastRecordTime = 0;
  private lastStepTime = 0;

  /** Pointer went down: cancel any glide in progress and start fresh. */
  grab(): void {
    this.vx = 0;
    this.vy = 0;
    this.gliding = false;
    this.lastRecordTime = performance.now();
  }

  /** Pointer moved by this many pixels since the previous move. */
  record(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const now = performance.now();
    const dt = Math.max(MIN_SAMPLE_MS, now - this.lastRecordTime) / 1000;
    this.lastRecordTime = now;
    this.vx += (dx / dt - this.vx) * SMOOTHING;
    this.vy += (dy / dt - this.vy) * SMOOTHING;
  }

  /** Pointer released: coast from the current velocity. */
  release(): void {
    // Held still before letting go — a park, not a throw
    if (performance.now() - this.lastRecordTime > PAUSE_MS) {
      this.vx = 0;
      this.vy = 0;
      this.gliding = false;
      return;
    }
    this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));
    this.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vy));
    this.gliding = Math.abs(this.vx) > MIN_SPEED || Math.abs(this.vy) > MIN_SPEED;
    this.lastStepTime = performance.now();
  }

  /** True while the glide is still running. */
  isGliding(): boolean {
    return this.gliding;
  }

  /** Stop the pitch axis, e.g. when rotation ran into a clamp. */
  stopPitch(): void {
    this.vy = 0;
    if (Math.abs(this.vx) <= MIN_SPEED) this.gliding = false;
  }

  /**
   * Advance the glide by one frame. Returns the pixel deltas to apply, or
   * null when nothing is coasting.
   */
  step(): { dx: number; dy: number } | null {
    if (!this.gliding) return null;

    const now = performance.now();
    const dt = Math.min(MAX_STEP_S, Math.max(0, (now - this.lastStepTime) / 1000));
    this.lastStepTime = now;

    const dx = this.vx * dt;
    const dy = this.vy * dt;

    const decay = Math.exp(-FRICTION * dt);
    this.vx *= decay;
    this.vy *= decay;

    if (Math.abs(this.vx) < MIN_SPEED && Math.abs(this.vy) < MIN_SPEED) {
      this.vx = 0;
      this.vy = 0;
      this.gliding = false;
    }

    return { dx, dy };
  }

  /**
   * Advance the glide against the usual orbit-camera pair, where horizontal
   * drag turns yaw and vertical drag turns pitch. Pitch is clamped, and
   * hitting the clamp kills that axis so the glide does not grind against
   * the limit. Returns true if the rotation changed.
   */
  glideOrbit(
    rot: { x: number; y: number },
    scale: number = 0.005,
    minPitch: number = -Math.PI / 2,
    maxPitch: number = Math.PI / 2
  ): boolean {
    const glide = this.step();
    if (!glide) return false;

    rot.y += glide.dx * scale;
    const pitch = rot.x + glide.dy * scale;
    const clamped = Math.max(minPitch, Math.min(maxPitch, pitch));
    rot.x = clamped;
    if (clamped !== pitch) this.stopPitch();
    return true;
  }
}
