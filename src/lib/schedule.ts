import type { Interval, PlannedEvent, Subathon, Timer } from './types';
import { addDaysKey, dayKey, zonedTime } from './tz';

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** An actual rest that started within this distance of a standard occurrence "consumes" it. */
export const REST_CONSUME_WINDOW = 4 * HOUR;

/** Whether a one-off rest change (keyed by occurrence) applies to occurrence `occ`. */
export function overrideMatches(ov: { forOcc: number } | undefined, occ: number): boolean {
  return ov != null && Math.abs(ov.forOcc - occ) < 12 * HOUR;
}

/** What rest projection needs (all public). */
type RestInputs = Pick<Subathon, 'startAt' | 'restStandard' | 'tz' | 'rest' | 'restLog' | 'restOverride'>;
/** What end estimation needs (public + private timer). */
type TimeState = RestInputs & Timer;

// ───────────────────────── Remaining time (private) ─────────────────────────

/**
 * Remaining stream time at `now`.
 * - Doesn't run before the subathon start.
 * - Frozen while resting (the snapshot is taken when rest starts).
 */
export function currentRemaining(s: TimeState, now: number): number {
  if (s.rest.active) return Math.max(0, s.remainingMs);
  const runningFrom = Math.max(s.remainingSetAt, s.startAt);
  const elapsed = Math.max(0, now - runningFrom);
  return Math.max(0, s.remainingMs - elapsed);
}

export function hasStarted(s: Pick<Subathon, 'startAt'>, now: number): boolean {
  return now >= s.startAt;
}

export function isEnded(s: TimeState, now: number): boolean {
  return hasStarted(s, now) && !s.rest.active && currentRemaining(s, now) <= 0;
}

// ───────────────────────── Projection ─────────────────────────

export interface ProjectedRest extends Interval {
  /** The standard start already passed but rest mode wasn't turned on yet. */
  overdue: boolean;
  /** The standard occurrence this rest comes from (key for a RestOverride). */
  occ: number;
  /** Times changed by hand for this one rest. */
  adjusted: boolean;
  /** Turned off for this one time (only returned by `nextRestSlot`). */
  skipped?: boolean;
}

/** Rests ahead of `now`. Public: computed by the overlay without knowing the end. */
export interface RestPlan {
  projectedRests: ProjectedRest[];
  /** Current (active) rest interval, with end = max(plannedEnd, now). */
  currentRest?: Interval & { overtime: boolean };
}

/** Panel-only: rest plan cut at the estimated end. */
export interface Schedule extends RestPlan {
  estimatedEndAt: number;
  ended: boolean;
}

function currentRestOf(s: RestInputs, now: number): RestPlan['currentRest'] {
  if (!s.rest.active) return undefined;
  const start = s.rest.startedAt ?? now;
  const plannedEnd = s.rest.plannedEndAt ?? start + s.restStandard.durationMin * MIN;
  return { startAt: start, endAt: Math.max(plannedEnd, now), overtime: now > plannedEnd };
}

/**
 * Successive future rests, assuming streaming in between. Each daily standard occurrence is
 * skipped if already taken (an actual rest started within ±4h), or if its window is over.
 * An overdue one is assumed to start right away.
 */
function* restWindows(s: RestInputs, now: number, withSkipped = false): Generator<ProjectedRest> {
  const dur = Math.max(0, s.restStandard.durationMin) * MIN;
  if (dur <= 0) return;
  let t = Math.max(now, s.startAt);
  const cur = currentRestOf(s, now);
  if (cur) t = Math.max(t, cur.endAt);

  const actualStarts = s.restLog.map((r) => r.startAt);
  if (s.rest.active && s.rest.startedAt != null) actualStarts.push(s.rest.startedAt);
  const consumed = (occ: number) => actualStarts.some((a) => Math.abs(a - occ) <= REST_CONSUME_WINDOW);

  // Start one day back so an occurrence whose window is still open is considered.
  let day = dayKey(t - DAY, s.tz);
  const ov = s.restOverride;
  for (let i = 0; i < 800; i++) {
    const occ = zonedTime(day, s.restStandard.startMinutes, s.tz);
    day = addDaysKey(day, 1);
    if (occ < s.startAt) continue;
    const match = overrideMatches(ov, occ);
    const adjusted = match && ov!.startAt != null && ov!.endAt != null;
    const start = adjusted ? ov!.startAt! : occ;
    const len = adjusted ? Math.max(MIN, ov!.endAt! - ov!.startAt!) : dur;
    if (consumed(start)) continue;
    if (start + len <= t) continue; // window already over: missed, ignore
    if (match && ov!.skipped) {
      // Turned off: streaming continues through it.
      if (withSkipped) yield { startAt: Math.max(start, t), endAt: Math.max(start, t) + len, overdue: false, occ, adjusted, skipped: true };
      continue;
    }
    const restStart = Math.max(start, t);
    yield { startAt: restStart, endAt: restStart + len, overdue: start < now && !s.rest.active, occ, adjusted };
    t = restStart + len;
  }
}

/** The next rest slot for the panel, including one that was turned off (so it can be turned on again). */
export function nextRestSlot(s: RestInputs, now: number): ProjectedRest | undefined {
  for (const r of restWindows(s, now, true)) return r;
  return undefined;
}

/** Rests starting before `until`. Doesn't need (or reveal) the remaining time. */
export function projectRests(s: RestInputs, now: number, until: number): RestPlan {
  const projectedRests: ProjectedRest[] = [];
  for (const r of restWindows(s, now)) {
    if (r.startAt >= until) break;
    projectedRests.push(r);
  }
  return { projectedRests, currentRest: currentRestOf(s, now) };
}

/**
 * Projects the end of the subathon: stream time is consumed only outside of rest,
 * and future rests follow the daily standard rest unless already taken.
 */
export function projectSchedule(s: TimeState, now: number): Schedule {
  const currentRest = currentRestOf(s, now);
  let rem = currentRemaining(s, now);
  let t = Math.max(now, s.startAt);
  if (currentRest) t = Math.max(t, currentRest.endAt);
  else if (hasStarted(s, now) && rem <= 0) {
    const endedAt = Math.max(s.remainingSetAt, s.startAt) + Math.max(0, s.remainingMs);
    return { estimatedEndAt: Math.min(endedAt, now), projectedRests: [], ended: true };
  }

  const projectedRests: ProjectedRest[] = [];
  for (const r of restWindows(s, now)) {
    if (t + rem <= r.startAt) break; // the subathon ends before this rest
    rem -= r.startAt - t;
    projectedRests.push(r);
    t = r.endAt;
  }
  return { estimatedEndAt: t + rem, projectedRests, currentRest, ended: false };
}

// ───────────────────────── Events ─────────────────────────

export type EventDisplayState = 'upcoming' | 'soon' | 'live' | 'done' | 'skipped';

export function eventDisplayState(ev: PlannedEvent, now: number): EventDisplayState {
  switch (ev.status) {
    case 'live':
      return 'live';
    case 'done':
      return 'done';
    case 'skipped':
      return 'skipped';
    default:
      return now < ev.startAt ? 'upcoming' : 'soon';
  }
}

export function plannedDuration(ev: PlannedEvent): number {
  return Math.max(MIN, ev.endAt - ev.startAt);
}

/** Where the event block is drawn, depending on its display state. */
export function eventInterval(ev: PlannedEvent, now: number): Interval {
  const d = plannedDuration(ev);
  switch (eventDisplayState(ev, now)) {
    case 'upcoming':
      return { startAt: ev.startAt, endAt: ev.endAt };
    case 'soon':
      // Shifted to start at NOW: reads as "about to begin", never "missed".
      return { startAt: now, endAt: now + d };
    case 'live': {
      const start = ev.actualStartAt ?? ev.startAt;
      return { startAt: start, endAt: Math.max(now, start + d) };
    }
    case 'done':
    case 'skipped': {
      const start = ev.actualStartAt ?? ev.startAt;
      return { startAt: start, endAt: ev.actualEndAt ?? start + d };
    }
  }
}

export type EventWarning = 'afterEnd' | 'duringRest' | null;

/** Why a not-yet-started event is problematic. `afterEnd` needs the (private) schedule. */
export function eventWarning(ev: PlannedEvent, schedule: RestPlan & { estimatedEndAt?: number }, now: number): EventWarning {
  if (ev.status !== 'planned') return null;
  const iv = eventInterval(ev, now);
  if (schedule.estimatedEndAt != null && iv.startAt >= schedule.estimatedEndAt) return 'afterEnd';
  const rests: Interval[] = [...schedule.projectedRests];
  if (schedule.currentRest) rests.push(schedule.currentRest);
  if (rests.some((r) => iv.startAt >= r.startAt && iv.startAt < r.endAt)) return 'duringRest';
  return null;
}

/** Events that viewers can see on the timeline (planned ones inside a projected rest are left out). */
export function visibleEvents(events: PlannedEvent[], schedule: RestPlan, now: number): PlannedEvent[] {
  return events
    .filter((ev) => ev.status !== 'skipped')
    .filter((ev) => ev.status !== 'planned' || eventWarning(ev, schedule, now) !== 'duringRest')
    .sort((a, b) => eventInterval(a, now).startAt - eventInterval(b, now).startAt);
}

export function liveEvent(events: PlannedEvent[]): PlannedEvent | undefined {
  return events.find((e) => e.status === 'live');
}

/** Next not-started event (by planned start), optionally only among a filtered set. */
export function nextPlanned(events: PlannedEvent[]): PlannedEvent | undefined {
  return events.filter((e) => e.status === 'planned').sort((a, b) => a.startAt - b.startAt)[0];
}

// ───────────────────────── Rest display ─────────────────────────

export type RestDisplay =
  | { state: 'resting'; plannedEndAt: number; startedAt: number }
  | { state: 'backSoon'; plannedEndAt: number; startedAt: number }
  | { state: 'awake' };

export function restDisplayState(s: RestInputs, now: number): RestDisplay {
  if (!s.rest.active) return { state: 'awake' };
  const startedAt = s.rest.startedAt ?? now;
  const plannedEndAt = s.rest.plannedEndAt ?? startedAt + s.restStandard.durationMin * MIN;
  return now > plannedEndAt
    ? { state: 'backSoon', plannedEndAt, startedAt }
    : { state: 'resting', plannedEndAt, startedAt };
}

// ───────────────────────── Callout ─────────────────────────

export type Callout =
  | { kind: 'ended' }
  | { kind: 'notStarted'; at: number }
  | { kind: 'resting' }
  | { kind: 'live'; ev: PlannedEvent; since: number }
  | { kind: 'nextEvent'; ev: PlannedEvent; at: number; soon: boolean }
  | { kind: 'nextRest'; at: number; soon: boolean }
  | { kind: 'none' };

/**
 * What the overlay should call out. Returns a primary and an optional secondary item
 * (e.g. live event + upcoming rest).
 */
export function callouts(s: Subathon, schedule: RestPlan, now: number): Callout[] {
  if (!hasStarted(s, now)) return [{ kind: 'notStarted', at: s.startAt }];
  if (s.endedAt != null) return [{ kind: 'ended' }];
  if (s.rest.active) return [{ kind: 'resting' }];

  const out: Callout[] = [];
  const shown = visibleEvents(s.events, schedule, now);
  const live = liveEvent(shown);
  if (live) out.push({ kind: 'live', ev: live, since: live.actualStartAt ?? now });

  const next = nextPlanned(shown);
  const nextRest = schedule.projectedRests[0];
  const candidates: Callout[] = [];
  if (next) {
    const st = eventDisplayState(next, now);
    candidates.push({ kind: 'nextEvent', ev: next, at: eventInterval(next, now).startAt, soon: st === 'soon' });
  }
  if (nextRest) candidates.push({ kind: 'nextRest', at: nextRest.startAt, soon: nextRest.overdue });
  candidates.sort((a, b) => (a as { at: number }).at - (b as { at: number }).at);

  for (const c of candidates) if (out.length < 2) out.push(c);
  return out.length ? out : [{ kind: 'none' }];
}

// ───────────────────────── Urgency ─────────────────────────

export type Urgency = 'calm' | 'near' | 'imminent' | 'soon' | 'live';

export function urgencyFor(msUntil: number): Urgency {
  if (msUntil <= 10 * MIN) return 'imminent';
  if (msUntil <= HOUR) return 'near';
  return 'calm';
}
