/**
 * Listen Tracker
 *
 * Measures how long people actually listen, which the existing Clarity tags
 * cannot express (they carry a label, not a number).
 *
 * Two distinct numbers are reported, because they answer different questions:
 *  - listened_seconds: real playing time, accumulated only while audio is
 *    actually running. Pauses and idle time are excluded, and replaying a
 *    section counts twice, so this is engagement time.
 *  - percent_complete: the furthest point reached in the track, which is what
 *    reveals where people drop off.
 *
 * Sessions are flushed on track change, on pause, and on page hide (via
 * sendBeacon) so partial listens are recorded rather than lost.
 */

import { trackEvent, trackGAEvent } from './analytics';

const MILESTONES = [25, 50, 75, 100] as const;

/** Ignore incidental blips: a listen shorter than this is not reported */
const MIN_REPORTABLE_SECONDS = 3;

export class ListenTracker {
  private title = '';
  private durationSec = 0;
  private accumulatedMs = 0;
  private resumedAt: number | null = null;
  private maxPositionSec = 0;
  private firedMilestones = new Set<number>();

  /** Switch to a new track, flushing whatever the previous one accumulated */
  startTrack(title: string, durationSec = 0): void {
    this.flush('track_change');
    this.title = title;
    this.durationSec = durationSec;
    this.accumulatedMs = 0;
    this.resumedAt = null;
    this.maxPositionSec = 0;
    this.firedMilestones.clear();
  }

  setDuration(durationSec: number): void {
    if (Number.isFinite(durationSec) && durationSec > 0) {
      this.durationSec = durationSec;
    }
  }

  /** Audio started or resumed */
  resume(): void {
    if (this.resumedAt === null) this.resumedAt = Date.now();
  }

  /** Audio paused or stopped: bank the time played so far */
  pause(): void {
    if (this.resumedAt !== null) {
      this.accumulatedMs += Date.now() - this.resumedAt;
      this.resumedAt = null;
    }
  }

  /** Called on timeupdate; drives the drop-off milestones */
  progress(positionSec: number): void {
    if (positionSec > this.maxPositionSec) this.maxPositionSec = positionSec;
    if (!this.durationSec || !this.title) return;

    const pct = Math.min(100, (this.maxPositionSec / this.durationSec) * 100);
    for (const milestone of MILESTONES) {
      if (pct >= milestone && !this.firedMilestones.has(milestone)) {
        this.firedMilestones.add(milestone);
        trackGAEvent('listen_milestone', {
          track_title: this.title,
          percent: milestone,
        });
      }
    }
  }

  private listenedSeconds(): number {
    let ms = this.accumulatedMs;
    if (this.resumedAt !== null) ms += Date.now() - this.resumedAt;
    return Math.round(ms / 1000);
  }

  private percentComplete(): number {
    if (!this.durationSec) return 0;
    return Math.min(100, Math.round((this.maxPositionSec / this.durationSec) * 100));
  }

  /**
   * Report the listening time banked so far and reset the counter, so a later
   * flush of the same track cannot double count it.
   */
  flush(reason: 'track_change' | 'pause' | 'ended' | 'page_hide', useBeacon = false): void {
    const seconds = this.listenedSeconds();
    if (!this.title || seconds < MIN_REPORTABLE_SECONDS) return;

    const percent = this.percentComplete();
    trackGAEvent(
      'track_listen',
      {
        track_title: this.title,
        listened_seconds: seconds,
        percent_complete: percent,
        reason,
      },
      useBeacon
    );
    // Clarity carries a label only, so pack the numbers into it
    trackEvent('track_listen', `${this.title} | ${seconds}s | ${percent}%`);

    this.accumulatedMs = 0;
    if (this.resumedAt !== null) this.resumedAt = Date.now();
  }
}
