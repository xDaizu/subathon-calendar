import { describe, expect, it } from 'vitest';
import { adjustSubs, deleteUnlock, setUnlockHidden, setUnlockSizes, setUnlockTarget, upsertUnlock } from './actions';
import type { FullState, Unlock } from './types';
import { progressTo, sizeOf, sortUnlocks, suggestTarget, unlockedCount, unlockViewOf, visibleRange } from './unlocks';

const u = (id: string, target: number): Unlock => ({ id, title: id, target });
const list = sortUnlocks([u('c', 30), u('a', 10), u('e', 50), u('b', 20), u('d', 40), u('f', 60), u('g', 70)]);
const view = { past: 3, next: 2 };

describe('unlockedCount', () => {
  it('counts reached targets (inclusive)', () => {
    expect(list.map((x) => x.id).join('')).toBe('abcdefg');
    expect(unlockedCount(list, 0)).toBe(0);
    expect(unlockedCount(list, 10)).toBe(1);
    expect(unlockedCount(list, 39)).toBe(3);
    expect(unlockedCount(list, 999)).toBe(7);
  });
});

describe('visibleRange', () => {
  it('shows the latest unlocked, 2 before and 2 next', () => {
    expect(visibleRange(7, 4, view)).toEqual({ start: 1, end: 6 }); // b c d | e f
  });
  it('never shows more upcoming than `next` (nothing unlocked yet)', () => {
    expect(visibleRange(7, 0, view)).toEqual({ start: 0, end: 2 });
    expect(visibleRange(7, 0, { past: 3, next: 1 })).toEqual({ start: 0, end: 1 });
    expect(visibleRange(7, 2, view)).toEqual({ start: 0, end: 4 });
  });
  it('never shows more unlocked than `past` (all unlocked)', () => {
    expect(visibleRange(7, 6, view)).toEqual({ start: 3, end: 7 });
    expect(visibleRange(7, 7, view)).toEqual({ start: 4, end: 7 });
  });
  it('short lists', () => {
    expect(visibleRange(3, 1, view)).toEqual({ start: 0, end: 3 });
    expect(visibleRange(0, 0, view)).toEqual({ start: 0, end: 0 });
  });
  it('respects custom counts', () => {
    expect(visibleRange(7, 4, { past: 1, next: 1 })).toEqual({ start: 3, end: 5 });
    expect(visibleRange(7, 4, { past: 0, next: 3 })).toEqual({ start: 4, end: 7 });
  });
});

describe('unlockViewOf', () => {
  it('defaults and clamps', () => {
    expect(unlockViewOf({})).toEqual({ past: 3, next: 2 });
    expect(unlockViewOf({ unlockView: { past: 0, next: 0 } })).toEqual({ past: 3, next: 2 });
    expect(unlockViewOf({ unlockView: { past: 99, next: -1 } })).toEqual({ past: 10, next: 0 });
  });
});

describe('progressTo', () => {
  it('goes from the previous target to this one', () => {
    expect(progressTo(list, 0, 5)).toBe(0.5);
    expect(progressTo(list, 2, 25)).toBe(0.5);
    expect(progressTo(list, 2, 10)).toBe(0);
    expect(progressTo(list, 2, 99)).toBe(1);
  });
});

describe('suggestTarget', () => {
  it('continues the last step', () => {
    expect(suggestTarget(list, 0)).toBe(80);
    expect(suggestTarget([], 0)).toBe(10);
    expect(suggestTarget([], 123)).toBe(130);
    expect(suggestTarget([u('x', 25)], 0)).toBe(35);
  });
});

describe('actions', () => {
  const st = { pub: { subs: 3, unlocks: [u('a', 10)] }, priv: {} } as unknown as FullState;
  it('adjustSubs never goes below 0', () => {
    expect(adjustSubs(5)(st, 1).pub.subs).toBe(8);
    expect(adjustSubs(-10)(st, 1).pub.subs).toBe(0);
    expect(adjustSubs(1)({ ...st, pub: { ...st.pub, subs: undefined } }, 1).pub.subs).toBe(1);
  });
  it('upsert replaces by id; delete removes', () => {
    const next = upsertUnlock({ ...u('a', 10), title: 'A!' }, false)(st, 1);
    expect(next.pub.unlocks).toEqual([{ id: 'a', title: 'A!', target: 10 }]);
    expect(upsertUnlock(u('b', 20), false)(st, 1).pub.unlocks).toHaveLength(2);
    expect(deleteUnlock('a')(st, 1).pub.unlocks).toEqual([]);
  });
  it('hidden unlocks live only in the private doc', () => {
    const hidden = setUnlockHidden('a', true)(st, 1);
    expect(hidden.pub.unlocks).toEqual([]);
    expect(hidden.priv.unlocks).toEqual([u('a', 10)]);
    const moved = setUnlockTarget('a', 15)(hidden, 1);
    expect(moved.priv.unlocks).toEqual([u('a', 15)]);
    expect(moved.pub.unlocks).toEqual([]);
    const shown = setUnlockHidden('a', false)(moved, 1);
    expect(shown.pub.unlocks).toEqual([u('a', 15)]);
    expect(shown.priv.unlocks).toEqual([]);
    expect(deleteUnlock('a')(hidden, 1).priv.unlocks).toEqual([]);
  });
  it('sizes: toggled for all unlocks, each keeps its own size', () => {
    const sized = upsertUnlock({ ...u('a', 10), size: 'XL' }, false)(st, 1);
    const on = setUnlockSizes(true)(sized, 1);
    expect(on.pub.unlockSizes).toBe(true);
    expect(setUnlockTarget('a', 12)(on, 1).pub.unlocks?.[0].size).toBe('XL');
    expect(setUnlockHidden('a', true)(on, 1).priv.unlocks?.[0].size).toBe('XL');
    expect(setUnlockSizes(false)(on, 1).pub.unlocks?.[0].size).toBe('XL');
  });
});

describe('sizeOf', () => {
  it('is null while sizes are off, M by default when on', () => {
    expect(sizeOf({ ...u('a', 1), size: 'L' }, {})).toBeNull();
    expect(sizeOf({ ...u('a', 1), size: 'L' }, { unlockSizes: false })).toBeNull();
    expect(sizeOf({ ...u('a', 1), size: 'L' }, { unlockSizes: true })).toBe('L');
    expect(sizeOf(u('a', 1), { unlockSizes: true })).toBe('M');
    expect(sizeOf({ ...u('a', 1), size: 'XXL' as never }, { unlockSizes: true })).toBe('M');
  });
});
