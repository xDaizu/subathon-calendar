import { addDaysKey, dayKey, minutesOfDay, zonedTime } from './tz';

const MIN = 60_000;
const HOUR = 60 * MIN;
import type { Interval } from './types';

export interface Scale {
  /** Fraction 0..1 for a timestamp. */
  x: (t: number) => number;
  start: number;
  end: number;
}

/** Linear mapping start → end. */
export function makeScale(start: number, end: number): Scale {
  const s = Math.min(start, end - 1);
  const e = Math.max(end, s + 1);
  return { start: s, end: e, x: (t) => Math.min(1, Math.max(0, (t - s) / (e - s))) };
}

/**
 * The overlay shows a fixed-length window around now, never the whole subathon
 * (its right edge would give away the end). The window advances in quarter steps aligned to
 * local time, so NOW visibly moves (from 1/8 to 3/8 of the width) and then the window jumps.
 * At the beginning it is anchored to the subathon start.
 */
export function timeWindow(now: number, startAt: number, hours: number, tz: string): { start: number; end: number } {
  const len = hours * HOUR;
  const step = len / 4;
  const stepMin = step / MIN;
  const into = ((minutesOfDay(now, tz) % stepMin) * MIN) + (now % MIN);
  let start = now - into - step / 2;
  if (startAt <= now && startAt > start) start = startAt;
  return { start, end: start + len };
}

export interface Placement {
  left: number;
  width: number;
}

/** Fractional placement of an interval, with a minimum visible width. */
export function place(iv: Interval, scale: Scale, minWidth = 0.008): Placement {
  const a = scale.x(iv.startAt);
  const b = scale.x(iv.endAt);
  let width = Math.max(b - a, minWidth);
  let left = a;
  if (left + width > 1) left = Math.max(0, 1 - width);
  width = Math.min(width, 1 - left);
  return { left, width };
}

export interface TimeTick {
  at: number;
  x: number;
  key: string;
  /** Local midnight (labelled with the day) vs. an hour mark. */
  midnight: boolean;
}

/** Local-time ticks every `stepH` hours inside the scale (stepH must divide 24). */
export function timeTicks(scale: Scale, tz: string, stepH: number): TimeTick[] {
  const ticks: TimeTick[] = [];
  let key = dayKey(scale.start, tz);
  for (let d = 0; d < 400; d++) {
    for (let h = 0; h < 24; h += stepH) {
      const at = zonedTime(key, h * 60, tz);
      if (at >= scale.end) return ticks;
      if (at > scale.start) ticks.push({ at, x: scale.x(at), key: `${key}-${h}`, midnight: h === 0 });
    }
    key = addDaysKey(key, 1);
  }
  return ticks;
}
