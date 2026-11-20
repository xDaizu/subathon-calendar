/** Pure helpers for the unlocks (rewards by sub count). Shared by the panel and the overlay. */
import type { Subathon, Unlock, UnlockView } from './types';

/** Default: the latest unlocked + the 2 before it, and the 2 next. */
export const DEFAULT_UNLOCK_VIEW: UnlockView = { past: 3, next: 2 };
export const MAX_UNLOCK_VIEW = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** By target (ties keep a stable order). */
export function sortUnlocks(list: Unlock[] | undefined): Unlock[] {
  return [...(list ?? [])].sort((a, b) => a.target - b.target || a.id.localeCompare(b.id));
}

/** How many of the (sorted) unlocks `subs` has reached. */
export function unlockedCount(sorted: Unlock[], subs: number): number {
  let n = 0;
  while (n < sorted.length && sorted[n].target <= subs) n++;
  return n;
}

export function unlockViewOf(s: Pick<Subathon, 'unlockView'>): UnlockView {
  const v = s.unlockView ?? DEFAULT_UNLOCK_VIEW;
  const past = clamp(Math.round(v.past), 0, MAX_UNLOCK_VIEW);
  const next = clamp(Math.round(v.next), 0, MAX_UNLOCK_VIEW);
  return past + next > 0 ? { past, next } : DEFAULT_UNLOCK_VIEW;
}

/**
 * Slice [start, end) of the sorted list shown with `n` unlocked: up to `past` unlocked (the latest
 * ones) + up to `next` locked. Strict limits: free slots are never filled from the other side.
 */
export function visibleRange(len: number, n: number, view: UnlockView): { start: number; end: number } {
  const at = clamp(n, 0, len);
  return { start: Math.max(0, at - view.past), end: Math.min(len, at + view.next) };
}

/** Progress from the previous target (or 0) to the target of unlock `i`. 0..1 */
export function progressTo(sorted: Unlock[], i: number, subs: number): number {
  const to = sorted[i]?.target;
  if (to == null) return 0;
  const from = i > 0 ? sorted[i - 1].target : 0;
  if (to <= from) return subs >= to ? 1 : 0;
  return clamp((subs - from) / (to - from), 0, 1);
}

/** Suggested target for a new unlock: one step past the last. */
export function suggestTarget(sorted: Unlock[], subs: number): number {
  const last = sorted.at(-1)?.target;
  if (last == null) return Math.max(10, Math.ceil((subs + 1) / 10) * 10);
  const step = sorted.length > 1 ? last - sorted[sorted.length - 2].target : 10;
  return last + Math.max(1, step);
}
