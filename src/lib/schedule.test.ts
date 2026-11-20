import { describe, expect, it } from 'vitest';
import * as A from './actions';
import {
  callouts,
  currentRemaining,
  eventDisplayState,
  eventInterval,
  eventWarning,
  DAY,
  HOUR,
  isEnded,
  nextRestSlot,
  MIN,
  projectRests,
  projectSchedule,
  restDisplayState,
  visibleEvents,
} from './schedule';
import { zonedTime } from './tz';
import type { Clock, FullState, PlannedEvent } from './types';

const TZ = 'Europe/Madrid';
/** Local Madrid time on a given Nov-2026 day. */
const at = (day: number, hh: number, mm = 0) =>
  zonedTime(`2026-11-${String(day).padStart(2, '0')}`, hh * 60 + mm, TZ);

function base(over: Partial<Clock> = {}): Clock {
  return {
    title: 'Test',
    startAt: at(20, 10),
    remainingMs: 10 * HOUR,
    remainingSetAt: at(20, 12),
    restStandard: { startMinutes: 3 * 60, durationMin: 8 * 60 }, // 03:00, 8h
    tz: TZ,
    rest: { active: false },
    restLog: [],
    events: [],
    updatedAt: 0,
    ...over,
  };
}
const full = ({ remainingMs, remainingSetAt, ...pub }: Clock, hidden: PlannedEvent[] = []): FullState => ({
  pub,
  priv: { events: hidden, timer: { remainingMs, remainingSetAt } },
});
const clock = A.clockOf;

function ev(over: Partial<PlannedEvent> = {}): PlannedEvent {
  return { id: 'e1', title: 'Horror', startAt: at(20, 19), endAt: at(20, 21), status: 'planned', ...over };
}

describe('currentRemaining', () => {
  it('counts down while streaming', () => {
    expect(currentRemaining(base(), at(20, 13))).toBe(9 * HOUR);
  });
  it('does not run before the subathon start', () => {
    const s = base({ startAt: at(21, 10), remainingSetAt: at(20, 12) });
    expect(currentRemaining(s, at(20, 20))).toBe(10 * HOUR);
    expect(currentRemaining(s, at(21, 11))).toBe(9 * HOUR);
  });
  it('freezes during rest and resumes after', () => {
    let st = full(base());
    st = A.startRest(st, at(20, 14)); // 8h left
    expect(currentRemaining(clock(st), at(20, 20))).toBe(8 * HOUR);
    st = A.stopRest(st, at(20, 22));
    expect(currentRemaining(clock(st), at(20, 23))).toBe(7 * HOUR);
    expect(st.pub.restLog).toEqual([{ startAt: at(20, 14), endAt: at(20, 22) }]);
  });
  it('never goes negative and flags the end', () => {
    expect(currentRemaining(base(), at(21, 12))).toBe(0);
    expect(isEnded(base(), at(21, 12))).toBe(true);
  });
});

describe('setRemaining override', () => {
  it('counts down from the new value and changes only the remaining snapshot', () => {
    const st0 = full(base({ events: [ev()] }));
    const st = A.setRemaining(12 * HOUR + 25 * MIN)(st0, at(20, 15));
    expect(currentRemaining(clock(st), at(20, 15))).toBe(12 * HOUR + 25 * MIN);
    expect(currentRemaining(clock(st), at(20, 16))).toBe(11 * HOUR + 25 * MIN);
    expect(st.pub.events).toEqual(st0.pub.events);
    expect(st.pub.rest).toEqual(st0.pub.rest);
    expect(st.pub.restLog).toEqual(st0.pub.restLog);
    expect(st.pub.restStandard).toEqual(st0.pub.restStandard);
  });
  it('holds the value while resting', () => {
    let st = A.startRest(full(base()), at(20, 14));
    st = A.setRemaining(5 * HOUR)(st, at(20, 16));
    expect(currentRemaining(clock(st), at(20, 20))).toBe(5 * HOUR);
    st = A.stopRest(st, at(20, 21));
    expect(currentRemaining(clock(st), at(20, 22))).toBe(4 * HOUR);
  });
  it('adjustRemaining adds to the live value', () => {
    const st = A.adjustRemaining(15 * MIN)(full(base()), at(20, 13));
    expect(currentRemaining(clock(st), at(20, 13))).toBe(9 * HOUR + 15 * MIN);
  });
});

describe('projectSchedule', () => {
  it('ends at now + remaining when no rest falls before the end', () => {
    const sch = projectSchedule(base(), at(20, 12));
    expect(sch.estimatedEndAt).toBe(at(20, 22));
    expect(sch.projectedRests).toEqual([]);
  });
  it('skips standard rest windows (pushes the end later)', () => {
    const s = base({ remainingMs: 20 * HOUR }); // 12:00 + 15h streaming hits 03:00
    const sch = projectSchedule(s, at(20, 12));
    expect(sch.projectedRests).toHaveLength(1);
    expect(sch.projectedRests[0]).toMatchObject({ startAt: at(21, 3), endAt: at(21, 11), overdue: false });
    expect(sch.estimatedEndAt).toBe(at(21, 16)); // 15h before + 5h after
  });
  it('projects multiple nights', () => {
    const s = base({ remainingMs: 40 * HOUR });
    const sch = projectSchedule(s, at(20, 12));
    expect(sch.projectedRests.map((r) => r.startAt)).toEqual([at(21, 3), at(22, 3)]);
    // 15h + 16h (11→03) + 9h = 40h → 22nd 11:00 + 9h = 20:00
    expect(sch.estimatedEndAt).toBe(at(22, 20));
  });
  it('treats an overdue standard rest as starting now', () => {
    const s = base({ remainingMs: 10 * HOUR, remainingSetAt: at(21, 3, 30) });
    const sch = projectSchedule(s, at(21, 3, 30));
    expect(sch.projectedRests[0]).toMatchObject({ startAt: at(21, 3, 30), overdue: true });
    expect(sch.estimatedEndAt).toBe(at(21, 3, 30) + 8 * HOUR + 10 * HOUR);
  });
  it('the end stays stable while a rest is overdue', () => {
    const s = base({ remainingMs: 10 * HOUR, remainingSetAt: at(21, 3, 30) });
    const a = projectSchedule(s, at(21, 3, 30)).estimatedEndAt;
    const b = projectSchedule(s, at(21, 4)).estimatedEndAt;
    expect(b).toBe(a);
  });
  it('a missed window (rest never taken) is ignored once it is over', () => {
    const s = base({ remainingMs: 10 * HOUR, remainingSetAt: at(21, 12) });
    const sch = projectSchedule(s, at(21, 12));
    expect(sch.projectedRests).toEqual([]);
    expect(sch.estimatedEndAt).toBe(at(21, 22));
  });
  it('a late sleep at 04:00 consumes the 03:00 window', () => {
    let st = full(base({ remainingMs: 40 * HOUR }));
    st = A.startRest(st, at(21, 4));
    st = A.stopRest(st, at(21, 12));
    const sch = projectSchedule(clock(st), at(21, 12));
    expect(sch.projectedRests[0].startAt).toBe(at(22, 3));
  });
  it('a 16:00 nap does not consume that night’s rest', () => {
    let st = full(base({ remainingMs: 30 * HOUR }));
    st = A.startRest(st, at(20, 16));
    st = A.stopRest(st, at(20, 17));
    const sch = projectSchedule(clock(st), at(20, 17));
    expect(sch.projectedRests[0].startAt).toBe(at(21, 3));
  });
  it('while resting the end is computed from the planned wake time', () => {
    let st = full(base({ remainingMs: 5 * HOUR, remainingSetAt: at(21, 3) }));
    st = A.startRest(st, at(21, 3)); // planned wake 11:00, 5h frozen
    expect(projectSchedule(clock(st), at(21, 5)).estimatedEndAt).toBe(at(21, 16));
  });
  it('rest overtime: the end is computed from now', () => {
    let st = full(base({ remainingMs: 5 * HOUR, remainingSetAt: at(21, 3) }));
    st = A.startRest(st, at(21, 3));
    const sch = projectSchedule(clock(st), at(21, 12));
    expect(sch.currentRest?.overtime).toBe(true);
    expect(sch.estimatedEndAt).toBe(at(21, 17));
    expect(restDisplayState(clock(st), at(21, 12)).state).toBe('backSoon');
    expect(restDisplayState(clock(st), at(21, 10)).state).toBe('resting');
  });
  it('before start: projects from the start', () => {
    const s = base({ startAt: at(21, 12), remainingSetAt: at(20, 12) });
    expect(projectSchedule(s, at(20, 12)).estimatedEndAt).toBe(at(21, 22));
  });
  it('disabled rest (duration 0) never projects rests', () => {
    const s = base({ remainingMs: 40 * HOUR, restStandard: { startMinutes: 180, durationMin: 0 } });
    expect(projectSchedule(s, at(20, 12)).projectedRests).toEqual([]);
  });
});

describe('events', () => {
  it('planned time passing never makes an event live', () => {
    expect(eventDisplayState(ev(), at(20, 18))).toBe('upcoming');
    expect(eventDisplayState(ev(), at(20, 19, 30))).toBe('soon');
    expect(eventDisplayState(ev(), at(20, 23))).toBe('soon');
  });
  it('a soon event is shifted to start now, keeping its duration', () => {
    expect(eventInterval(ev(), at(20, 19, 30))).toEqual({ startAt: at(20, 19, 30), endAt: at(20, 21, 30) });
  });
  it('a live event past its planned end stays live and grows', () => {
    let st = full(base({ events: [ev()] }));
    st = A.startEvent('e1')(st, at(20, 19, 10));
    const e = st.pub.events[0];
    expect(eventDisplayState(e, at(20, 22))).toBe('live');
    expect(eventInterval(e, at(20, 22))).toEqual({ startAt: at(20, 19, 10), endAt: at(20, 22) });
  });
  it('toggling off then on resumes the event', () => {
    let st = full(base({ events: [ev()] }));
    st = A.startEvent('e1')(st, at(20, 19));
    st = A.stopEvent('e1')(st, at(20, 20));
    expect(st.pub.events[0]).toMatchObject({ status: 'done', actualEndAt: at(20, 20) });
    st = A.startEvent('e1')(st, at(20, 20, 5));
    expect(st.pub.events[0].status).toBe('live');
    expect(st.pub.events[0].actualStartAt).toBe(at(20, 19));
    expect(st.pub.events[0].actualEndAt).toBeUndefined();
  });
  it('only one event is live at a time', () => {
    let st = full(base({ events: [ev(), ev({ id: 'e2', startAt: at(20, 21), endAt: at(20, 22) })] }));
    st = A.startEvent('e1')(st, at(20, 19));
    st = A.startEvent('e2')(st, at(20, 20));
    expect(st.pub.events.find((e) => e.id === 'e1')?.status).toBe('done');
    expect(st.pub.events.find((e) => e.id === 'e2')?.status).toBe('live');
  });
  it('starting rest stops the live event; starting an event ends rest', () => {
    let st = full(base({ events: [ev()] }));
    st = A.startEvent('e1')(st, at(20, 19));
    st = A.startRest(st, at(20, 20));
    expect(st.pub.events[0].status).toBe('done');
    st = A.startEvent('e1')(st, at(20, 21));
    expect(st.pub.rest.active).toBe(false);
    expect(st.pub.restLog).toHaveLength(1);
  });
  it('hidden events live in drafts; starting one reveals it', () => {
    let st = full(base());
    st = A.upsertEvent(ev(), true)(st, at(20, 12));
    expect(st.pub.events).toHaveLength(0);
    expect(st.priv.events).toHaveLength(1);
    st = A.revealEvent('e1')(st, at(20, 12));
    expect(st.pub.events).toHaveLength(1);
    expect(st.priv.events).toHaveLength(0);
    st = A.hideEvent('e1')(st, at(20, 12));
    expect(st.priv.events).toHaveLength(1);
    st = A.startEvent('e1')(st, at(20, 19));
    expect(st.pub.events[0].status).toBe('live');
    expect(st.priv.events).toHaveLength(0);
  });
  it('events after the end or during projected rest are hidden and flagged', () => {
    const s = base({
      remainingMs: 20 * HOUR,
      events: [
        ev({ id: 'ok' }),
        ev({ id: 'rest', startAt: at(21, 5), endAt: at(21, 6) }),
        ev({ id: 'late', startAt: at(22, 14), endAt: at(22, 15) }),
        ev({ id: 'skip', status: 'skipped' }),
      ],
    });
    const now = at(20, 12);
    const sch = projectSchedule(s, now);
    expect(eventWarning(s.events[1], sch, now)).toBe('duringRest');
    expect(eventWarning(s.events[2], sch, now)).toBe('afterEnd');
    // The overlay doesn't know the end: only rest conflicts are hidden there.
    expect(visibleEvents(s.events, sch, now).map((e) => e.id)).toEqual(['ok', 'late']);
    expect(visibleEvents(s.events, projectRests(s, now, now + 3 * DAY), now).map((e) => e.id)).toEqual(['ok', 'late']);
  });
});

describe('callouts', () => {
  it('shows SOON (not live) for a planned event past its start', () => {
    const s = base({ events: [ev()] });
    const now = at(20, 19, 20);
    const c = callouts(s, projectSchedule(s, now), now);
    expect(c[0]).toMatchObject({ kind: 'nextEvent', soon: true });
  });
  it('live first, then the next item', () => {
    let st = full(base({ remainingMs: 20 * HOUR, events: [ev()] }));
    st = A.startEvent('e1')(st, at(20, 19));
    const now = at(20, 20);
    const c = callouts(st.pub, projectSchedule(clock(st), now), now);
    expect(c.map((x) => x.kind)).toEqual(['live', 'nextRest']);
  });
  it('skipped events do not block the next one', () => {
    const s = base({ events: [ev({ status: 'skipped' }), ev({ id: 'e2', startAt: at(20, 21), endAt: at(20, 22) })] });
    const now = at(20, 19, 30);
    const c = callouts(s, projectSchedule(s, now), now);
    expect(c[0]).toMatchObject({ kind: 'nextEvent', ev: { id: 'e2' } });
  });
  it('not started / ended / resting states', () => {
    const pre = base({ startAt: at(21, 10) });
    expect(callouts(pre, projectSchedule(pre, at(20, 12)), at(20, 12))[0].kind).toBe('notStarted');
    const done = A.markEnded(full(base()), at(21, 12)).pub;
    expect(callouts(done, projectRests(done, at(21, 12), at(22, 12)), at(21, 12))[0].kind).toBe('ended');
    const st = A.startRest(full(base()), at(20, 13));
    expect(callouts(st.pub, projectSchedule(clock(st), at(20, 14)), at(20, 14))[0].kind).toBe('resting');
  });
});

describe('privacy of the timer', () => {
  it('the public doc never holds the timer', () => {
    let st = full(base());
    st = A.setRemaining(5 * HOUR)(st, at(20, 13));
    st = A.startRest(st, at(20, 14));
    st = A.stopRest(st, at(20, 20));
    st = A.adjustRemaining(HOUR)(st, at(20, 21));
    expect(st.pub).not.toHaveProperty('remainingMs');
    expect(st.pub).not.toHaveProperty('remainingSetAt');
    expect(st.priv.timer.remainingMs).toBe(5 * HOUR - HOUR - 1 * HOUR + HOUR); // 5h −1h before rest, −1h after, +1h
  });
  it('rests are projected from public data alone, the same as the panel sees them', () => {
    const c = base({ remainingMs: 40 * HOUR });
    const now = at(20, 12);
    const { remainingMs: _r, remainingSetAt: _s, ...pub } = c;
    const plan = projectRests(pub, now, now + 3 * DAY);
    const sch = projectSchedule(c, now);
    expect(plan.projectedRests.slice(0, 2)).toEqual(sch.projectedRests);
    // …and keep going past the (private) end.
    expect(plan.projectedRests.length).toBeGreaterThan(sch.projectedRests.length);
  });
  it('markEnded publishes the end; adding time brings it back', () => {
    let st = full(base({ events: [ev({ startAt: at(20, 19), endAt: at(20, 23) })] }));
    st = A.startEvent('e1')(st, at(20, 19));
    expect(A.markEnded(st, at(20, 20))).toBe(st); // not ended yet: no-op
    st = A.markEnded(st, at(20, 22, 1));
    expect(st.pub.endedAt).toBe(at(20, 22, 1));
    expect(st.pub.events[0].status).toBe('done');
    st = A.adjustRemaining(30 * MIN)(st, at(20, 22, 5));
    expect(st.pub.endedAt).toBeUndefined();
    expect(isEnded(clock(st), at(20, 22, 10))).toBe(false);
  });
});

describe('adjusting the next rest', () => {
  const plan = (st: FullState, now: number) => projectRests(st.pub, now, now + 2 * DAY).projectedRests;

  it('replaces only that occurrence; later nights keep the standard', () => {
    let st = full(base({ remainingMs: 40 * HOUR }));
    st = A.planRest(at(21, 3), at(21, 5), at(21, 12))(st, at(20, 12));
    const rests = plan(st, at(20, 12));
    expect(rests[0]).toMatchObject({ startAt: at(21, 5), endAt: at(21, 12), adjusted: true, occ: at(21, 3) });
    expect(rests[1]).toMatchObject({ startAt: at(22, 3), endAt: at(22, 11), adjusted: false });
    // The panel's end estimate uses it too: 17h before 05:00, 15h from 12:00 to 03:00, then 8h after 11:00.
    expect(projectSchedule(clock(st), at(20, 12)).estimatedEndAt).toBe(at(22, 19));
  });
  it('a much later start still counts as that night (no double rest)', () => {
    let st = full(base({ remainingMs: 40 * HOUR }));
    st = A.planRest(at(21, 3), at(21, 9), at(21, 16))(st, at(20, 12));
    st = A.startRest(st, at(21, 9));
    expect(st.pub.rest.plannedEndAt).toBe(at(21, 16)); // the adjusted wake-up time
    expect(st.pub.restOverride).toBeUndefined();
    st = A.stopRest(st, at(21, 16));
    expect(plan(st, at(21, 16))[0].startAt).toBe(at(22, 3));
  });
  it('a nap far from the adjusted rest uses the standard duration and keeps the plan', () => {
    let st = full(base());
    st = A.planRest(at(21, 3), at(21, 4), at(21, 10))(st, at(20, 12));
    st = A.startRest(st, at(20, 16));
    expect(st.pub.rest.plannedEndAt).toBe(at(20, 16) + 8 * HOUR);
    expect(st.pub.restOverride).toBeDefined();
  });
  it('back to usual, and the end is never before the start', () => {
    let st = full(base());
    st = A.planRest(at(21, 3), at(21, 5), at(21, 4))(st, at(20, 12));
    expect(st.pub.restOverride!.endAt).toBe(at(21, 5, 15));
    st = A.clearRestPlan(st, at(20, 12));
    expect(plan(st, at(20, 12))[0]).toMatchObject({ startAt: at(21, 3), adjusted: false });
  });
  it('setWake sets the exact wake-up time', () => {
    let st = A.startRest(full(base()), at(21, 3));
    st = A.setWake(at(21, 12, 30))(st, at(21, 4));
    expect(st.pub.rest.plannedEndAt).toBe(at(21, 12, 30));
  });
});

describe('hiding rests from the overlay', () => {
  const now = at(20, 12);
  const hide = A.setRestsHidden(true);
  const shown = (st: FullState, t = now) => projectRests(st.pub, t, t + 3 * DAY).projectedRests;

  it('hides every planned rest, not just the next one; the panel still plans them', () => {
    const st0 = full(base({ remainingMs: 60 * HOUR }));
    const st = hide(st0, now);
    expect(st.pub.restsHidden).toBe(true);
    expect(shown(st0).length).toBeGreaterThan(1);
    expect(shown(st)).toEqual([]);
    expect(callouts(st.pub, projectRests(st.pub, now, now + 2 * DAY), now)).toEqual([{ kind: 'none' }]);
    // End estimate and the panel's next rest don't change.
    expect(projectSchedule(clock(st), now)).toEqual(projectSchedule(clock(st0), now));
    expect(nextRestSlot(st.pub, now)).toMatchObject({ startAt: at(21, 3) });
  });
  it('still shows the current rest and past ones', () => {
    let st = hide(full(base({ remainingMs: 60 * HOUR })), now);
    st = A.startRest(st, at(21, 3));
    expect(projectRests(st.pub, at(21, 4), at(23, 4)).currentRest).toMatchObject({ startAt: at(21, 3) });
    expect(restDisplayState(st.pub, at(21, 4)).state).toBe('resting');
    st = A.stopRest(st, at(21, 11));
    expect(st.pub.restLog).toEqual([{ startAt: at(21, 3), endAt: at(21, 11) }]);
    expect(st.pub.restsHidden).toBe(true); // resting doesn't turn it off
    expect(shown(st, at(21, 12))).toEqual([]);
  });
  it('stays hidden through any other panel action', () => {
    let st = hide(full(base({ events: [ev()] })), now);
    for (const action of [
      A.planRest(at(21, 3), at(21, 5), at(21, 12)),
      A.clearRestPlan,
      A.setRemaining(30 * HOUR),
      A.adjustRemaining(HOUR),
      A.upsertEvent(ev({ id: 'e2' }), true),
      A.revealEvent('e2'),
      A.startEvent('e1'),
      A.delayEvent('e2', 15 * MIN),
      A.stopEvent('e1'),
      A.updateSettings({ title: 'X', startAt: at(20, 9), restStandard: { startMinutes: 60, durationMin: 7 * 60 } }),
      A.markEnded,
    ]) {
      st = action(st, now);
      expect(st.pub.restsHidden).toBe(true);
      expect(shown(st)).toEqual([]);
    }
  });
  it('times adjusted while hidden show once rests are shown again', () => {
    let st = hide(full(base({ remainingMs: 60 * HOUR })), now);
    st = A.planRest(at(21, 3), at(21, 5), at(21, 12))(st, now);
    expect(shown(st)).toEqual([]);
    st = A.setRestsHidden(false)(st, now);
    expect(st.pub.restsHidden).toBeUndefined();
    expect(shown(st)[0]).toMatchObject({ startAt: at(21, 5), endAt: at(21, 12), adjusted: true });
    expect(shown(st)[1]).toMatchObject({ startAt: at(22, 3) });
  });
  it('drops the old one-rest "off" switch from older documents', () => {
    const st0 = full(base());
    st0.pub.restOverride = { forOcc: at(21, 3), skipped: true } as never;
    expect(A.setRestsHidden(true)(st0, now).pub.restOverride).toBeUndefined();
  });
});
