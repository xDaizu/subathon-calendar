/**
 * Pure state transitions. Each takes the full (public + private) state and returns the next one.
 * Firestore wrappers in `subathon.ts` run these inside transactions.
 */
import { currentRemaining, isEnded, MIN, overrideMatches, REST_CONSUME_WINDOW } from './schedule';
import type { Clock, FullState, OverlayLook, PlannedEvent, Subathon, Unlock, UnlockView } from './types';

type Action = (st: FullState, now: number) => FullState;

const touch = (pub: Subathon, now: number): Subathon => ({ ...pub, updatedAt: now });

/** Public state + private timer. */
export const clockOf = (st: FullState): Clock => ({ ...st.pub, ...st.priv.timer });

const setTimer = (st: FullState, remainingMs: number, now: number): FullState => ({
  ...st,
  priv: { ...st.priv, timer: { remainingMs: Math.max(0, Math.round(remainingMs)), remainingSetAt: now } },
});

function findEvent(st: FullState, id: string): { ev: PlannedEvent; hidden: boolean } | undefined {
  const pubEv = st.pub.events.find((e) => e.id === id);
  if (pubEv) return { ev: pubEv, hidden: false };
  const draft = st.priv.events.find((e) => e.id === id);
  if (draft) return { ev: draft, hidden: true };
  return undefined;
}

function mapEvents(st: FullState, fn: (e: PlannedEvent) => PlannedEvent): FullState {
  return {
    pub: { ...st.pub, events: st.pub.events.map(fn) },
    priv: { ...st.priv, events: st.priv.events.map(fn) },
  };
}

function stopLiveEvents(st: FullState, now: number, exceptId?: string): FullState {
  return mapEvents(st, (e) =>
    e.status === 'live' && e.id !== exceptId ? { ...e, status: 'done', actualEndAt: now } : e,
  );
}

// ───────────── Remaining time (private; affects only the estimated end) ─────────────

export const setRemaining =
  (ms: number): Action =>
  (st, now) => {
    const next = setTimer(st, ms, now);
    if (next.pub.endedAt == null || ms <= 0) return next;
    // Time added after the end: the subathon is back on.
    const pub = { ...next.pub };
    delete pub.endedAt;
    return { ...next, pub: touch(pub, now) };
  };

export const adjustRemaining =
  (deltaMs: number): Action =>
  (st, now) =>
    setRemaining(Math.max(0, currentRemaining(clockOf(st), now) + deltaMs))(st, now);

/** Timer ran out: stop the live event and tell viewers it's over. Published by the panel. */
export const markEnded: Action = (st, now) => {
  if (!isEnded(clockOf(st), now)) return st;
  const stopped = stopLiveEvents(st, now);
  return { ...stopped, pub: touch({ ...stopped.pub, endedAt: stopped.pub.endedAt ?? now }, now) };
};

// ───────────── Rest ─────────────

/** Stop the rest in a state, if active (used by startEvent / stopRest). */
function endRest(st: FullState, now: number): FullState {
  const { pub } = st;
  if (!pub.rest.active) return st;
  // Remaining was frozen; it resumes counting from now.
  return setTimer(
    {
      ...st,
      pub: {
        ...pub,
        rest: { active: false },
        restLog: [...pub.restLog, { startAt: pub.rest.startedAt ?? now, endAt: now }],
      },
    },
    st.priv.timer.remainingMs,
    now,
  );
}

export const startRest: Action = (st, now) => {
  if (st.pub.rest.active) return st;
  const stopped = stopLiveEvents(st, now);
  const frozen = setTimer(stopped, currentRemaining(clockOf(stopped), now), now);
  // A rest changed by hand: its wake-up time applies if we go to rest around its start.
  const ov = frozen.pub.restOverride;
  const dur = frozen.pub.restStandard.durationMin * MIN;
  const ovStart = ov?.startAt ?? ov?.forOcc ?? 0;
  const ovEnd = ov?.endAt ?? ovStart + dur;
  const near = ov != null && now >= ovStart - REST_CONSUME_WINDOW && now < ovEnd;
  const useOv = near && ov.endAt != null;
  const pub: Subathon = {
    ...frozen.pub,
    rest: { active: true, startedAt: now, plannedEndAt: useOv ? ovEnd : now + dur },
  };
  if (ov && (near || ovEnd <= now)) delete pub.restOverride;
  return { ...frozen, pub: touch(pub, now) };
};

export const stopRest: Action = (st, now) => {
  const next = endRest(st, now);
  return { ...next, pub: touch(next.pub, now) };
};

export const adjustWake =
  (deltaMs: number): Action =>
  (st, now) => {
    const r = st.pub.rest;
    if (!r.active) return st;
    const start = r.startedAt ?? now;
    const planned = r.plannedEndAt ?? start;
    return {
      ...st,
      pub: touch({ ...st.pub, rest: { ...r, plannedEndAt: Math.max(start + 5 * MIN, planned + deltaMs) } }, now),
    };
  };

/** Exact wake-up time for the current rest. */
export const setWake =
  (at: number): Action =>
  (st, now) => {
    const r = st.pub.rest;
    if (!r.active) return st;
    return adjustWake(at - (r.plannedEndAt ?? r.startedAt ?? now))(st, now);
  };

function withoutOverride(pub: Subathon): Subathon {
  const next = { ...pub };
  delete next.restOverride;
  return next;
}

/** Change start/end of one upcoming standard rest. */
export const planRest =
  (forOcc: number, startAt: number, endAt: number): Action =>
  (st, now) => {
    const cur = overrideMatches(st.pub.restOverride, forOcc) ? st.pub.restOverride : undefined;
    const times = { startAt, endAt: Math.max(endAt, startAt + 15 * MIN) };
    return { ...st, pub: touch({ ...st.pub, restOverride: { forOcc: cur?.forOcc ?? forOcc, ...times } }, now) };
  };

/**
 * Hide/show planned rests on the overlay. Viewers only: the panel still plans them and counts
 * them in the end estimate. Stays until changed by hand.
 */
export const setRestsHidden =
  (hidden: boolean): Action =>
  (st, now) => {
    const pub = { ...st.pub };
    if (hidden) pub.restsHidden = true;
    else delete pub.restsHidden;
    return { ...st, pub: touch(pub, now) };
  };

/** Back to the usual times. */
export const clearRestPlan: Action = (st, now) =>
  st.pub.restOverride ? { ...st, pub: touch(withoutOverride(st.pub), now) } : st;

// ───────────── Events ─────────────

export const upsertEvent =
  (ev: PlannedEvent, hidden: boolean): Action =>
  (st, now) => {
    const pubEvents = st.pub.events.filter((e) => e.id !== ev.id);
    const draftEvents = st.priv.events.filter((e) => e.id !== ev.id);
    // A live event is always visible.
    const goHidden = hidden && ev.status !== 'live';
    return {
      pub: touch({ ...st.pub, events: goHidden ? pubEvents : [...pubEvents, ev] }, now),
      priv: { ...st.priv, events: goHidden ? [...draftEvents, ev] : draftEvents },
    };
  };

export const deleteEvent =
  (id: string): Action =>
  (st, now) => ({
    pub: touch({ ...st.pub, events: st.pub.events.filter((e) => e.id !== id) }, now),
    priv: { ...st.priv, events: st.priv.events.filter((e) => e.id !== id) },
  });

/** "En curso" on. Resumes a done event, reveals a hidden one, ends rest and any other live event. */
export const startEvent =
  (id: string): Action =>
  (st, now) => {
    const found = findEvent(st, id);
    if (!found) return st;
    let next = stopLiveEvents(st, now, id);
    next = endRest(next, now);
    const { ev } = found;
    const started: PlannedEvent = {
      ...ev,
      status: 'live',
      actualStartAt: ev.status === 'done' && ev.actualStartAt != null ? ev.actualStartAt : now,
      actualEndAt: undefined,
    };
    delete started.actualEndAt;
    return upsertEvent(started, false)(next, now);
  };

/** "En curso" off. */
export const stopEvent =
  (id: string): Action =>
  (st, now) =>
    mapEvents(
      { ...st, pub: touch(st.pub, now) },
      (e) => (e.id === id && e.status === 'live' ? { ...e, status: 'done', actualEndAt: now } : e),
    );

export const skipEvent =
  (id: string): Action =>
  (st, now) =>
    mapEvents({ ...st, pub: touch(st.pub, now) }, (e) =>
      e.id === id && e.status === 'planned' ? { ...e, status: 'skipped' } : e,
    );

/** Back to planned: clears actual times (from the edit sheet). */
export const resetEvent =
  (id: string): Action =>
  (st, now) =>
    mapEvents({ ...st, pub: touch(st.pub, now) }, (e) => {
      if (e.id !== id) return e;
      const r: PlannedEvent = { ...e, status: 'planned' };
      delete r.actualStartAt;
      delete r.actualEndAt;
      return r;
    });

export const revealEvent =
  (id: string): Action =>
  (st, now) => {
    const found = findEvent(st, id);
    if (!found || !found.hidden) return st;
    return upsertEvent(found.ev, false)(st, now);
  };

export const hideEvent =
  (id: string): Action =>
  (st, now) => {
    const found = findEvent(st, id);
    if (!found || found.hidden || found.ev.status === 'live') return st;
    return upsertEvent(found.ev, true)(st, now);
  };

/** Shift the planned times of one event. */
export const delayEvent =
  (id: string, deltaMs: number): Action =>
  (st, now) =>
    mapEvents({ ...st, pub: touch(st.pub, now) }, (e) =>
      e.id === id ? { ...e, startAt: e.startAt + deltaMs, endAt: e.endAt + deltaMs } : e,
    );

// ───────────── Subs & unlocks (public: the unlocks overlay shows them) ─────────────

export const setSubs =
  (n: number): Action =>
  (st, now) => ({ ...st, pub: touch({ ...st.pub, subs: Math.max(0, Math.round(n)) }, now) });

export const adjustSubs =
  (delta: number): Action =>
  (st, now) =>
    setSubs((st.pub.subs ?? 0) + delta)(st, now);

/** Hidden unlocks live in the private doc, so viewers can't see them at all. */
export const upsertUnlock =
  (u: Unlock, hidden: boolean): Action =>
  (st, now) => {
    const pubU = (st.pub.unlocks ?? []).filter((x) => x.id !== u.id);
    const privU = (st.priv.unlocks ?? []).filter((x) => x.id !== u.id);
    return {
      pub: touch({ ...st.pub, unlocks: hidden ? pubU : [...pubU, u] }, now),
      priv: { ...st.priv, unlocks: hidden ? [...privU, u] : privU },
    };
  };

function findUnlock(st: FullState, id: string): { u: Unlock; hidden: boolean } | undefined {
  const pubU = st.pub.unlocks?.find((x) => x.id === id);
  if (pubU) return { u: pubU, hidden: false };
  const privU = st.priv.unlocks?.find((x) => x.id === id);
  return privU ? { u: privU, hidden: true } : undefined;
}

/** Events created from it stay, just no longer linked. */
export const deleteUnlock =
  (id: string): Action =>
  (st, now) => {
    const unlinked = mapEvents(st, (e) => {
      if (e.fromUnlock !== id) return e;
      const r = { ...e };
      delete r.fromUnlock;
      return r;
    });
    return {
      pub: touch({ ...unlinked.pub, unlocks: (unlinked.pub.unlocks ?? []).filter((x) => x.id !== id) }, now),
      priv: { ...unlinked.priv, unlocks: (unlinked.priv.unlocks ?? []).filter((x) => x.id !== id) },
    };
  };

export const setUnlockHidden =
  (id: string, hidden: boolean): Action =>
  (st, now) => {
    const found = findUnlock(st, id);
    if (!found || found.hidden === hidden) return st;
    return upsertUnlock(found.u, hidden)(st, now);
  };

export const setUnlockTarget =
  (id: string, target: number): Action =>
  (st, now) => {
    const found = findUnlock(st, id);
    if (!found) return st;
    return upsertUnlock({ ...found.u, target: Math.max(1, Math.round(target)) }, found.hidden)(st, now);
  };

export const setUnlockView =
  (view: UnlockView): Action =>
  (st, now) => ({ ...st, pub: touch({ ...st.pub, unlockView: view }, now) });

/** Sizes on/off for every unlock. Each unlock keeps its size while they're off. */
export const setUnlockSizes =
  (on: boolean): Action =>
  (st, now) => ({ ...st, pub: touch({ ...st.pub, unlockSizes: on }, now) });

/** Overlay look (language, theme, position, window). The OBS pages pick it up live. */
export const setOverlayLook =
  (look: OverlayLook): Action =>
  (st, now) => ({ ...st, pub: touch({ ...st.pub, overlay: look }, now) });

export const updateSettings =
  (patch: Partial<Pick<Subathon, 'title' | 'startAt' | 'restStandard' | 'tz' | 'tzLabel'>>): Action =>
  (st, now) => ({ ...st, pub: touch({ ...st.pub, ...patch }, now) });

export function newEventId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
