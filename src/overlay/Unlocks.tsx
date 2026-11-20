import { animate, AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useSubathon } from '../lib/subathon';
import type { Unlock, UnlockSize } from '../lib/types';
import { progressTo, sizeOf, sortUnlocks, unlockViewOf, visibleRange } from '../lib/unlocks';
import { ACCENT, ACCENT2, useOverlayLook, type OverlayParams } from './params';

/** One unlock's fanfare. Then the list scrolls, then the next one (if several were reached). */
const CELEBRATE_MS = 2800;
/** Pause after a scroll before the next fanfare starts. */
const SCROLL_MS = 900;
/** The moment (s) in the fanfare when the lock opens. */
const POP = 0.55;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/**
 * Plays reached unlocks one at a time, by id: celebrate one → mark it shown (the list scrolls) →
 * the next… On first load, or when an unlock stops being reached (count corrected down, target
 * raised, hidden, deleted), it updates straight away with no fanfare. Revealing or lowering an
 * unlock that is already reached gets its fanfare too.
 */
function useUnlockSequence(sorted: Unlock[], subs: number, loaded: boolean) {
  const reachedIds = sorted.filter((u) => u.target <= subs).map((u) => u.id);
  const key = reachedIds.join(',');
  const [shown, setShown] = useState<ReadonlySet<string> | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const lastStep = useRef(0);

  useEffect(() => {
    if (!loaded) return;
    const reached = new Set(reachedIds);
    if (shown == null) {
      setShown(reached);
      return;
    }
    if ([...shown].some((id) => !reached.has(id))) {
      setShown(new Set([...shown].filter((id) => reached.has(id))));
      return;
    }
    if (celebrating) {
      if (!reached.has(celebrating)) setCelebrating(null);
      return;
    }
    const nextId = reachedIds.find((id) => !shown.has(id));
    if (nextId) {
      const wait = Math.max(150, lastStep.current + SCROLL_MS - Date.now());
      const timer = setTimeout(() => setCelebrating(nextId), wait);
      return () => clearTimeout(timer);
    }
  }, [key, loaded, shown, celebrating]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => {
      lastStep.current = Date.now();
      setShown((prev) => new Set([...(prev ?? []), celebrating]));
      setCelebrating(null);
    }, CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);

  return { shown, celebrating, reachedIds };
}

type RowState = 'unlocked' | 'latest' | 'celebrating' | 'next' | 'locked';

export function UnlocksOverlay({ params }: { params: OverlayParams }) {
  const { data: s } = useSubathon(params.uid);
  const look = useOverlayLook(s, params);
  const { t } = useT();
  const sorted = useMemo(() => sortUnlocks(s?.unlocks), [s?.unlocks]);
  const subs = s?.subs ?? 0;
  const { shown, celebrating, reachedIds } = useUnlockSequence(sorted, subs, s != null);

  const ready = s != null && shown != null && sorted.length > 0;
  const isShown = (u: Unlock) => shown?.has(u.id) ?? false;
  const at = sorted.filter(isShown).length;
  const latest = sorted.reduce((last, u, i) => (isShown(u) ? i : last), -1);
  const firstLocked = sorted.findIndex((u) => !isShown(u));
  // While unlocks are still queued, the counter stops at each target in turn.
  const pendingId = reachedIds.find((id) => !shown?.has(id));
  const pendingTarget = sorted.find((u) => u.id === pendingId)?.target;
  const displaySubs = pendingTarget != null ? Math.max(pendingTarget, sorted[latest]?.target ?? 0) : subs;
  const view = s ? unlockViewOf(s) : null;
  const range = view ? visibleRange(sorted.length, at, view) : { start: 0, end: 0 };
  // The unlock being celebrated is always on screen (e.g. with 0 upcoming shown).
  const celebIdx = sorted.findIndex((u) => u.id === (celebrating ?? pendingId));
  if (celebIdx >= 0) {
    range.start = Math.min(range.start, celebIdx);
    range.end = Math.max(range.end, celebIdx + 1);
  }
  const items = sorted.slice(range.start, range.end).map((u, k) => {
    const i = range.start + k;
    const state: RowState =
      u.id === celebrating
        ? 'celebrating'
        : isShown(u)
          ? i === latest
            ? 'latest'
            : 'unlocked'
          : i === firstLocked
            ? 'next'
            : 'locked';
    return { u, i, state };
  });

  return (
    <div
      className={cx('ov flex h-screen w-screen flex-col p-[0.8rem]', params.preview && 'preview-bg')}
      data-theme={look.theme}
      data-bg={look.bg}
      style={{ ['--accent' as string]: ACCENT, ['--accent2' as string]: ACCENT2 }}
    >
      <AnimatePresence>
        {ready && (
          <motion.div
            key="card"
            className="glass rounded-[1.4rem] p-[0.8rem]"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <header className="flex items-center justify-between gap-[0.6rem] px-[0.35rem] pb-[0.6rem]">
              <div className="text-dim text-[0.85rem] font-bold uppercase tracking-[0.2em]">🔓 {t('unlocks')}</div>
              <motion.div
                key={celebrating ?? 'idle'}
                className="flex items-baseline gap-[0.35rem]"
                animate={celebrating ? { scale: [1, 1, 1.25, 1] } : undefined}
                transition={{ duration: 0.7, times: [0, POP / 0.7 - 0.05, POP / 0.7 + 0.15, 1] }}
              >
                <span className="font-display tabular accent-text text-[1.7rem] font-bold leading-none">
                  <Count value={displaySubs} />
                </span>
                <span className="text-dim text-[0.85rem] font-semibold">{t('subsUnit')}</span>
              </motion.div>
            </header>
            <ul className="relative flex flex-col gap-[0.45rem]">
              <AnimatePresence mode="popLayout" initial={false}>
                {items.map(({ u, i, state }) => (
                  <motion.li
                    key={u.id}
                    layout
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: '0%' }}
                    exit={{ opacity: 0, y: '-100%', scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                  >
                    <Row
                      u={u}
                      size={s ? sizeOf(u, s) : null}
                      state={state}
                      progress={state === 'next' ? progressTo(sorted, i, displaySubs) : state === 'celebrating' ? 1 : 0}
                      left={u.target - displaySubs}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Row({
  u,
  size,
  state,
  progress,
  left,
  wrap = false,
}: {
  u: Unlock;
  size: UnlockSize | null;
  state: RowState;
  progress: number;
  left: number;
  /** Long titles wrap instead of being cut (the viewers' page; OBS rows keep a fixed height). */
  wrap?: boolean;
}) {
  const { t } = useT();
  const done = state === 'unlocked' || state === 'latest';
  const party = state === 'celebrating';

  return (
    <motion.div
      className={cx(
        'ul-row relative flex items-center gap-[0.75rem] overflow-hidden rounded-[1rem] px-[0.6rem]',
        wrap ? 'min-h-[3.6rem] py-[0.5rem]' : 'h-[3.6rem]',
        `ul-${state}`,
        size && `tier-${size}`,
      )}
      animate={party ? { scale: [1, 1, 1.05, 1.02] } : { scale: 1 }}
      transition={party ? { duration: 1.2, times: [0, POP / 1.2, (POP + 0.2) / 1.2, 1] } : { duration: 0.3 }}
    >
      {party && <Fanfare />}
      <Badge emoji={u.emoji} state={state} size={size} />
      <div className="relative min-w-0 flex-1">
        <div className={cx(wrap ? 'break-words' : 'truncate', 'text-[1.15rem] font-bold leading-tight', state === 'locked' && 'text-dim')}>{u.title}</div>
        {state === 'next' && (
          <div className="mt-[0.3rem] flex items-center gap-[0.5rem]">
            <div className="h-[0.32rem] flex-1 overflow-hidden rounded-full bg-[var(--track)]">
              <div className="ul-bar h-full rounded-full accent-gradient" style={{ width: `${progress * 100}%` }} />
            </div>
            {left > 0 && <span className="text-dim tabular shrink-0 text-[0.8rem] font-semibold">{t('subsLeft', { n: left })}</span>}
          </div>
        )}
        {party && (
          <motion.div
            className="accent-text mt-[0.1rem] text-[0.85rem] font-extrabold tracking-[0.18em]"
            initial={{ opacity: 0, scale: 0.6, x: '-10%' }}
            animate={{ opacity: 1, scale: 1, x: '0%' }}
            transition={{ delay: POP, type: 'spring', stiffness: 500, damping: 18 }}
            style={{ originX: 0 }}
          >
            {t('unlockedBang')}
          </motion.div>
        )}
      </div>
      <div className={cx('relative shrink-0 text-right leading-none', done && 'text-dim')}>
        <div className="font-display tabular text-[1.25rem] font-bold">{u.target}</div>
        <div className="text-dim mt-[0.15rem] text-[0.65rem] font-semibold uppercase tracking-[0.12em]">{t('subsUnit')}</div>
      </div>
    </motion.div>
  );
}

const burst = (n: number, reach: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
    const d = (2.2 + (i % 3) * 0.7) * reach;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, size: i % 3 === 0 ? 0.42 : 0.28 };
  });
/** Bigger unlocks, bigger burst. */
const BURSTS: Record<UnlockSize | 'none', ReturnType<typeof burst>> = {
  none: burst(14, 1),
  S: burst(10, 0.9),
  M: burst(14, 1),
  L: burst(20, 1.15),
  XL: burst(28, 1.35),
};

function Badge({ emoji, state, size }: { emoji?: string; state: RowState; size: UnlockSize | null }) {
  const done = state === 'unlocked' || state === 'latest';
  const party = state === 'celebrating';
  const locked = state === 'next' || state === 'locked';
  return (
    <div className="relative h-[2.6rem] w-[2.6rem] shrink-0">
      <motion.div
        className={cx(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[0.8rem] text-[1.4rem]',
          done
            ? size
              ? 'metal'
              : 'accent-gradient shadow-[0_0_1rem_color-mix(in_oklab,var(--accent)_45%,transparent)]'
            : 'bg-[var(--track)]',
          size && !done && 'medal',
        )}
        animate={party ? { rotate: [0, -14, 12, -10, 8, -4, 0, 0], scale: [1, 1, 1, 1, 1, 1, 1.3, 1] } : { rotate: 0, scale: 1 }}
        transition={party ? { duration: POP + 0.45, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1] } : { duration: 0.2 }}
      >
        {party && (
          <motion.div
            className={cx('absolute inset-0', size ? 'metal' : 'accent-gradient')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: POP, duration: 0.15 }}
          />
        )}
        <span className={cx('relative', state === 'locked' && 'opacity-50 grayscale', state === 'next' && 'opacity-80')}>
          {emoji ?? '🎁'}
        </span>
      </motion.div>
      {(locked || party) && (
        <motion.span
          className="absolute -right-[0.35rem] -bottom-[0.3rem] text-[0.95rem]"
          animate={party ? { y: [0, 0, '-1.6rem'], rotate: [0, 0, 35], opacity: [1, 1, 0] } : undefined}
          transition={{ duration: POP + 0.5, times: [0, POP / (POP + 0.5), 1] }}
        >
          🔒
        </motion.span>
      )}
      {done && (
        <span className="absolute -right-[0.3rem] -bottom-[0.25rem] flex h-[1.1rem] w-[1.1rem] items-center justify-center rounded-full bg-white text-[0.7rem] font-black text-black shadow">
          ✓
        </span>
      )}
      {party &&
        BURSTS[size ?? 'none'].map((p, k) => (
          <motion.span
            key={k}
            className="ul-spark pointer-events-none absolute top-1/2 left-1/2 rounded-full"
            style={{ width: `${p.size}rem`, height: `${p.size}rem`, marginLeft: `${-p.size / 2}rem`, marginTop: `${-p.size / 2}rem` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
            animate={{ x: `${p.x}rem`, y: `${p.y}rem`, opacity: [0, 1, 0], scale: 0.4 }}
            transition={{ delay: POP, duration: 1, ease: 'easeOut' }}
          />
        ))}
    </div>
  );
}

/** Row-wide glow, flash and shine sweep. */
function Fanfare() {
  return (
    <>
      <motion.div
        className="ul-glow pointer-events-none absolute inset-0 rounded-[1rem]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 1, 0.8] }}
        transition={{ duration: 1.4, times: [0, POP / 1.4, (POP + 0.3) / 1.4, 1] }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ delay: POP, duration: 0.45 }}
      />
      <motion.div
        className="ul-shine pointer-events-none absolute inset-y-0 w-1/3"
        initial={{ left: '-40%' }}
        animate={{ left: '120%' }}
        transition={{ delay: POP + 0.05, duration: 0.85, ease: 'easeInOut' }}
      />
    </>
  );
}

/** A number that counts up/down to its new value. */
export function Count({ value }: { value: number }) {
  const { lang } = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const fmt = (v: number) => Math.round(v).toLocaleString(lang);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const controls = animate(from, value, {
      duration: Math.min(1.2, 0.35 + Math.abs(value - from) * 0.03),
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = fmt(v);
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{fmt(value)}</span>;
}
