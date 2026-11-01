/**
 * Auto-switch: move to another visualizer on a timer.
 *
 * Two things make this feel deliberate rather than twitchy. It draws from a
 * shuffle bag rather than picking at random, so a selection of thirteen does
 * not land on the same visualizer twice in a row roughly one time in
 * thirteen. And any manual change — switching by hand, touching a control —
 * restarts the clock, so the view is never yanked away a second after you
 * start exploring.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VisualizerType, VISUALIZER_TYPES } from '../store/usePlayerStore';

export const AUTO_SWITCH_MODES = ['Presets', 'Presets + hue', 'Random', 'Keep look'];

export interface AutoSwitchOptions {
  enabled: boolean;
  seconds: number;
  /** Chosen visualizers; empty means every one in the cycle. */
  types: VisualizerType[];
  currentType: VisualizerType;
  /** Gates: a paused track or a take in progress holds the timer. */
  isPlaying: boolean;
  isRecording: boolean;
  onSwitch: (next: VisualizerType) => void;
}

/** Fisher-Yates, on a copy. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function useAutoSwitch(options: AutoSwitchOptions): { deferAutoSwitch: () => void } {
  const opts = useRef(options);
  opts.current = options;

  const bag = useRef<VisualizerType[]>([]);
  // Bumping this restarts the countdown
  const [restartToken, setRestartToken] = useState(0);
  const deferAutoSwitch = useCallback(() => setRestartToken((n) => n + 1), []);

  const pickNext = useCallback((): VisualizerType | null => {
    const { types, currentType } = opts.current;
    const pool = types.length ? types : VISUALIZER_TYPES;
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0] === currentType ? null : pool[0];

    // Refill the bag when it runs dry, and never open a fresh bag on the
    // visualizer that is already showing
    if (bag.current.length === 0) {
      let refilled = shuffled(pool);
      if (refilled[0] === currentType && refilled.length > 1) {
        [refilled[0], refilled[1]] = [refilled[1], refilled[0]];
      }
      bag.current = refilled;
    }

    let next = bag.current.shift() ?? null;
    // The pool can change under us, or the user can switch by hand to the
    // one we were about to play
    if (next === currentType) next = bag.current.shift() ?? null;
    return next;
  }, []);

  useEffect(() => {
    const { enabled, seconds, isPlaying, isRecording } = opts.current;
    if (!enabled || !isPlaying || isRecording) return;

    const id = window.setTimeout(() => {
      const next = pickNext();
      if (next) opts.current.onSwitch(next);
    }, Math.max(5, seconds) * 1000);

    return () => window.clearTimeout(id);
    // currentType is in here on purpose: switching by hand restarts the clock
  }, [
    options.enabled,
    options.seconds,
    options.isPlaying,
    options.isRecording,
    options.currentType,
    restartToken,
    pickNext
  ]);

  // A fresh selection shouldn't keep dealing from the old bag
  useEffect(() => {
    bag.current = [];
  }, [options.types]);

  return { deferAutoSwitch };
}
