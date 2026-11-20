import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { UNLOCK_EMOJIS } from '../lib/colors';
import { formatDayShort, formatTime } from '../lib/time';
import type { Unlock, UnlockSize, UnlockView } from '../lib/types';
import {
  DEFAULT_UNLOCK_SIZE,
  eventsByUnlock,
  MAX_UNLOCK_VIEW,
  sizeOf,
  sortUnlocks,
  suggestTarget,
  UNLOCK_SIZES,
  unlockedCount,
  unlockViewOf,
  visibleRange,
} from '../lib/unlocks';
import { Button, cx, Field, inputCls, Sheet, Switch } from '../ui/ui';
import { useAdmin } from './context';
import { AddRowButton, OverlayLookCard } from './EventList';
import { EventSheet, type EditTarget, type EventPrefill } from './EventSheet';
import { PreviewSection } from './Preview';

interface Row {
  u: Unlock;
  hidden: boolean;
}

/** Event sheet opened from an unlock: edit its event, or create one. */
type EventSheetState = { editing: EditTarget } | { prefill: EventPrefill };

/** Unlocks tab of the lists card. `tabs` goes in the header. */
export function UnlockList({ tabs }: { tabs: ReactNode }) {
  const { s, priv, act } = useAdmin();
  const { t, lang } = useT();
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [eventSheet, setEventSheet] = useState<EventSheetState | null>(null);
  const linked = useMemo(() => eventsByUnlock(s.events, priv.events), [s.events, priv.events]);

  const openEventFor = (u: Unlock) => {
    const found = linked.get(u.id);
    setEventSheet(found ? { editing: found } : { prefill: { title: u.title, emoji: u.emoji ?? '🎁', fromUnlock: u.id } });
  };

  const subs = s.subs ?? 0;
  const view = unlockViewOf(s);
  // What's on stream: public unlocks only.
  const onScreenIds = useMemo(() => {
    const pub = sortUnlocks(s.unlocks);
    const r = visibleRange(pub.length, unlockedCount(pub, subs), view);
    return new Set(pub.slice(r.start, r.end).map((u) => u.id));
  }, [s.unlocks, subs, view.past, view.next]);
  const rows = useMemo<Row[]>(() => {
    const hiddenIds = new Set((priv.unlocks ?? []).map((u) => u.id));
    return sortUnlocks([...(s.unlocks ?? []), ...(priv.unlocks ?? [])]).map((u) => ({ u, hidden: hiddenIds.has(u.id) }));
  }, [s.unlocks, priv.unlocks]);
  const nextId = rows.find((r) => !r.hidden && r.u.target > subs)?.u.id;

  const setView = (patch: Partial<UnlockView>) => {
    const next = { ...view, ...patch };
    if (next.past + next.next > 0) void act(A.setUnlockView(next));
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        {tabs}
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          ＋ <span className="hidden sm:inline">{t('addUnlock')}</span>
        </Button>
      </div>

      <PreviewSection
        page="unlocks"
        frameClassName="max-w-72"
        showFrame={onScreenIds.size > 0}
        customize={
          <div className="flex flex-col gap-3">
            <UnlockViewCard view={view} onChange={setView} />
            <OverlayLookCard page="unlocks" />
          </div>
        }
      />

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-ink-400">{t('noUnlocks')}</div>
      )}

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const { u, hidden } = r;
            const done = u.target <= subs;
            const isNext = u.id === nextId;
            const size = sizeOf(u, s);
            const ev = linked.get(u.id)?.ev;
            return (
              <motion.li
                key={u.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                className={cx(
                  'flex items-center gap-2 rounded-2xl p-2.5 ring-1 transition-colors',
                  hidden ? 'border border-dashed border-white/15 bg-ink-900/60 ring-transparent' : done ? 'bg-ink-800/50 ring-white/5' : 'bg-ink-800/80 ring-white/5',
                  isNext && 'ring-2 ring-accent/60',
                )}
              >
                <button onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className={cx('relative h-11 w-11 shrink-0', size && `tier-${size}`)}>
                    <span
                      className={cx(
                        'relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl text-xl',
                        done && !hidden
                          ? size
                            ? 'metal'
                            : 'bg-gradient-to-br from-accent/60 to-accent-2/50'
                          : 'bg-ink-700/70',
                        size && !(done && !hidden) && 'medal',
                      )}
                    >
                      <span className={cx('relative', (hidden || (!done && !isNext)) && 'opacity-60 grayscale')}>
                        {u.emoji ?? '🎁'}
                      </span>
                    </span>
                    <span className="absolute -right-1 -bottom-1 text-xs">{done ? '✅' : '🔒'}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {size && <SizeChip size={size} />}
                      <span className={cx('min-w-0 truncate font-semibold', (done || hidden) && 'text-ink-300')}>{u.title}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-400">
                      {done ? (
                        <Badge tone="accent">{t('statusUnlocked')}</Badge>
                      ) : (
                        <span className="tabular">{t('subsLeft', { n: u.target - subs })}</span>
                      )}
                      {hidden && <Badge>🙈 {t('hidden')}</Badge>}
                      {onScreenIds.has(u.id) && <Badge>📺 {t('onScreen')}</Badge>}
                      {ev && (
                        <Badge tone="event">
                          📅{' '}
                          <span className={cx('tabular', ev.status === 'skipped' && 'line-through')}>
                            {formatDayShort(ev.startAt, lang, s.tz)} · {formatTime(ev.startAt, lang, s.tz)}
                          </span>
                          {ev.status === 'done' && ' ✓'}
                        </Badge>
                      )}
                    </span>
                  </span>
                </button>
                <TargetInput
                  value={u.target}
                  label={t('unlockTarget')}
                  onCommit={(v) => act(A.setUnlockTarget(u.id, v), t('toastTarget', { title: u.title, n: v }))}
                />
                <button
                  aria-label={hidden ? t('visible') : t('hidden')}
                  onClick={() =>
                    act(A.setUnlockHidden(u.id, !hidden), t(hidden ? 'toastRevealed' : 'toastHidden', { title: u.title }))
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700/70 text-lg transition active:scale-90"
                >
                  {hidden ? '🙈' : '👁'}
                </button>
                <button
                  aria-label={t(ev ? 'openUnlockEvent' : 'createUnlockEvent')}
                  title={t(ev ? 'openUnlockEvent' : 'createUnlockEvent')}
                  onClick={() => openEventFor(u)}
                  className={cx(
                    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition active:scale-90',
                    ev ? 'bg-cyan-400/15 ring-1 ring-cyan-400/30' : 'bg-ink-700/70',
                  )}
                >
                  📅
                  {ev && <span className="absolute -right-1 -bottom-1 text-xs">✅</span>}
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {rows.length > 0 && <AddRowButton label={t('addUnlock')} onClick={() => setAdding(true)} />}

      <UnlockSheet
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (o) return;
          setAdding(false);
          setEditing(null);
        }}
        editing={editing}
        rows={rows}
      />
      <EventSheet
        open={!!eventSheet}
        onOpenChange={(o) => !o && setEventSheet(null)}
        editing={eventSheet && 'editing' in eventSheet ? eventSheet.editing : null}
        prefill={eventSheet && 'prefill' in eventSheet ? eventSheet.prefill : null}
      />
    </>
  );
}

/** How many unlocks show on stream, and whether sizes are drawn. */
function UnlockViewCard({ view, onChange }: { view: UnlockView; onChange: (patch: Partial<UnlockView>) => void }) {
  const { s, act } = useAdmin();
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-ink-800/70 p-3 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Stepper label={`✓ ${t('showUnlocked')}`} value={view.past} onChange={(v) => onChange({ past: v })} />
        <Stepper label={`🔒 ${t('showNext')}`} value={view.next} onChange={(v) => onChange({ next: v })} />
      </div>
      <div className="mt-2 text-xs text-ink-400">{t('unlocksViewHint')}</div>
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/5 pt-3">
        <div>
          <div className="text-sm font-semibold text-ink-300">💎 {t('showSizes')}</div>
          <div className="text-xs text-ink-400">{t('showSizesHint')}</div>
        </div>
        <Switch
          checked={!!s.unlockSizes}
          onChange={(on) => void act(A.setUnlockSizes(on))}
          label={t('showSizes')}
        />
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'accent' | 'event' }) {
  return (
    <span
      className={cx(
        'rounded-md px-1.5 py-px text-[0.68rem] font-semibold',
        tone === 'accent'
          ? 'bg-accent/15 text-violet-200'
          : tone === 'event'
            ? 'bg-cyan-400/15 text-cyan-200'
            : 'bg-white/5 text-ink-300',
      )}
    >
      {children}
    </span>
  );
}

function SizeChip({ size }: { size: UnlockSize }) {
  return (
    <span className={`tier-${size} shrink-0`}>
      <span className="tier-chip block rounded-md px-1.5 py-1 text-[0.62rem]">{size}</span>
    </span>
  );
}

/** Edit the sub target right in the list: Enter / leaving the field saves, Esc cancels. */
function TargetInput({ value, label, onCommit }: { value: number; label: string; onCommit: (v: number) => void }) {
  const { t } = useT();
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const cancel = useRef(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    const v = Number(text);
    if (!cancel.current && /^\d{1,7}$/.test(text) && v > 0 && v !== value) onCommit(v);
    else setText(String(value));
    cancel.current = false;
  };

  return (
    <label className="flex shrink-0 flex-col items-center">
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancel.current = true;
            e.currentTarget.blur();
          }
        }}
        className="font-display tabular h-9 w-[4.5rem] rounded-xl bg-ink-900/70 text-center text-lg font-bold text-ink-100 ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-accent"
      />
      <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-400">{t('subsUnit')}</span>
    </label>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-ink-300">{label}</span>
      <div className="flex items-center rounded-xl bg-ink-900/70 ring-1 ring-white/5">
        <button
          className="h-9 w-9 rounded-l-xl text-lg text-ink-300 transition active:scale-90 disabled:opacity-30"
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span className="font-display tabular w-6 text-center text-lg font-bold">{value}</span>
        <button
          className="h-9 w-9 rounded-r-xl text-lg text-ink-300 transition active:scale-90 disabled:opacity-30"
          disabled={value >= MAX_UNLOCK_VIEW}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function UnlockSheet({
  open,
  onOpenChange,
  editing,
  rows,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Row | null;
  rows: Row[];
}) {
  const { s, act } = useAdmin();
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState<string>(UNLOCK_EMOJIS[0]);
  const [target, setTarget] = useState('');
  const [visible, setVisible] = useState(true);
  const [size, setSize] = useState<UnlockSize>(DEFAULT_UNLOCK_SIZE);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.u.title ?? '');
    setEmoji(editing?.u.emoji ?? UNLOCK_EMOJIS[0]);
    setTarget(String(editing?.u.target ?? suggestTarget(rows.map((r) => r.u), s.subs ?? 0)));
    setVisible(!editing?.hidden);
    setSize(editing?.u.size ?? DEFAULT_UNLOCK_SIZE);
  }, [open, editing]);

  const targetNum = /^\d{1,7}$/.test(target) ? Number(target) : null;
  const valid = title.trim().length > 0 && targetNum != null && targetNum > 0;

  const save = () => {
    if (!valid || targetNum == null) return;
    const u: Unlock = { id: editing?.u.id ?? A.newEventId(), title: title.trim(), emoji, target: targetNum, size };
    void act(A.upsertUnlock(u, !visible), t('toastUnlockSaved'));
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('editUnlock') : t('addUnlock')}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={save}>
            ✓ {t('save')}
          </Button>
          {editing && (
            <Button
              size="sm"
              variant="danger"
              className="self-end"
              onClick={() => {
                void act(A.deleteUnlock(editing.u.id), t('toastUnlockDeleted'));
                onOpenChange(false);
              }}
            >
              🗑 {t('delete')}
            </Button>
          )}
        </div>
      }
    >
      <Field label={t('unlockTitle')}>
        <input
          className={inputCls}
          placeholder={t('unlockTitlePh')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
      <Field label={t('unlockTarget')} hint={t('unlockTargetHint')}>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            className={`${inputCls} font-display tabular w-36 text-lg`}
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <span className="text-sm font-semibold text-ink-400">{t('subsUnit')}</span>
        </div>
      </Field>
      <Field label={t('unlockSize')} hint={t(s.unlockSizes ? 'unlockSizeHint' : 'unlockSizeOffHint')}>
        <div className="grid grid-cols-4 gap-1.5">
          {UNLOCK_SIZES.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setSize(z)}
              className={cx(
                `tier-${z} flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition active:scale-95`,
                z === size ? 'bg-ink-600 ring-2 ring-accent' : 'bg-ink-800 hover:bg-ink-700',
              )}
            >
              <span className="metal relative h-6 w-6 overflow-hidden rounded-full" />
              <span className="text-center leading-tight">
                <span className="block text-sm font-bold">{z}</span>
                <span className="block text-[0.68rem] text-ink-400">{t(`size${z}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('emoji')}>
        <div className="flex flex-wrap gap-1.5">
          {UNLOCK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cx(
                'flex h-10 w-10 items-center justify-center rounded-xl text-xl transition active:scale-90',
                e === emoji ? 'bg-ink-600 ring-2 ring-accent' : 'bg-ink-800 hover:bg-ink-700',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink-800 p-4 ring-1 ring-white/5">
        <div>
          <div className="font-semibold">
            {visible ? '👁' : '🙈'} {t('showOnStream')}
          </div>
          <div className="text-xs text-ink-400">{t('unlockHiddenHint')}</div>
        </div>
        <Switch checked={visible} onChange={setVisible} label={t('showOnStream')} />
      </div>
    </Sheet>
  );
}
