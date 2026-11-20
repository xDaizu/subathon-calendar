export type Lang = 'es' | 'en';

export type EventStatus = 'planned' | 'live' | 'done' | 'skipped';

export interface PlannedEvent {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
  /** Planned start (epoch ms). Only a forecast — never drives the live state by itself. */
  startAt: number;
  /** Planned end (epoch ms). */
  endAt: number;
  /** Changed only by manual actions (En curso toggle / Saltar). */
  status: EventStatus;
  actualStartAt?: number;
  actualEndAt?: number;
}

export interface RestStandard {
  /** Minutes after local midnight (in `tz`) when the daily rest usually starts. */
  startMinutes: number;
  /** Usual rest duration in minutes. 0 disables rest projection. */
  durationMin: number;
}

export interface RestState {
  active: boolean;
  startedAt?: number;
  plannedEndAt?: number;
}

/**
 * One-off change to a single upcoming standard rest. Public, so it only ever holds what viewers
 * see: either new times ("tonight 05:00–12:00") or `skipped` alone (no times).
 */
export interface RestOverride {
  /** The standard occurrence (epoch ms) it applies to. Matches the nearest occurrence (±12h),
   *  so it survives changes to the usual rest time or timezone. */
  forOcc: number;
  startAt?: number;
  endAt?: number;
  /** Turned off. Stays off until turned on by hand (or by actually going to rest). */
  skipped?: boolean;
}

/** Adjusted times of a rest that is turned off, kept privately until it's turned on again. */
export interface RestStash {
  forOcc: number;
  startAt: number;
  endAt: number;
}

export interface Interval {
  startAt: number;
  endAt: number;
}

/** A reward viewers unlock when the sub count reaches `target`. Public (shown on the unlocks overlay). */
export interface Unlock {
  id: string;
  title: string;
  emoji?: string;
  /** Sub count that unlocks it. */
  target: number;
}

/** How many unlocks the overlay shows around the current one. */
export interface UnlockView {
  /** Unlocked ones, counting the latest. */
  past: number;
  /** Still locked ones. */
  next: number;
}

export interface Subathon {
  title: string;
  /** When the subathon starts. The countdown doesn't run before it. */
  startAt: number;
  restStandard: RestStandard;
  /** IANA timezone of the streamer, e.g. "Europe/Madrid". */
  tz: string;
  tzLabel?: { es: string; en: string };
  rest: RestState;
  restOverride?: RestOverride;
  restLog: Interval[];
  events: PlannedEvent[];
  /** Current sub count (drives the unlocks). Missing in older documents: 0. */
  subs?: number;
  unlocks?: Unlock[];
  unlockView?: UnlockView;
  /** Set by the panel when the timer runs out (the timer itself is private). */
  endedAt?: number;
  updatedAt: number;
}

/** Remaining *stream* time snapshot, valid at `remainingSetAt`. Private: never shown to viewers. */
export interface Timer {
  remainingMs: number;
  remainingSetAt: number;
}

/** Owner-only document: hidden events and unlocks + the timer. */
export interface Private {
  events: PlannedEvent[];
  /** Hidden unlocks: not on stream until revealed. */
  unlocks?: Unlock[];
  timer: Timer;
  restStash?: RestStash;
}

export interface FullState {
  pub: Subathon;
  priv: Private;
}

/** Public state + timer: what the panel uses to estimate the end. */
export type Clock = Subathon & Timer;
