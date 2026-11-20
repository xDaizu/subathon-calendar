import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { eventColor } from '../lib/colors';
import { eventDisplayState, eventWarning } from '../lib/schedule';
import { formatDayShort, formatTime } from '../lib/time';
import type { PlannedEvent, WindowHours } from '../lib/types';
import { WINDOW_HOURS } from '../overlay/params';
import { Button, Chip, cx, Segmented } from '../ui/ui';
import { useAdmin } from './context';
import { EventSheet, type EditTarget } from './EventSheet';
import { useOverlayLookSetting } from './overlayPrefs';
import { PreviewSection } from './Preview';

type Filter = 'all' | 'visible' | 'hidden';

/** Events tab of the lists card. `tabs` goes in the header. */
export function EventList({ onAdd, tabs }: { onAdd: () => void; tabs: ReactNode }) {
  const { s, priv } = useAdmin();
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [showPast, setShowPast] = useState(false);

  const rows = useMemo(() => {
    const all = [
      ...s.events.map((ev) => ({ ev, hidden: false })),
      ...priv.events.map((ev) => ({ ev, hidden: true })),
    ].filter((r) => (filter === 'all' ? true : filter === 'hidden' ? r.hidden : !r.hidden));
    all.sort((a, b) => a.ev.startAt - b.ev.startAt);
    return {
      current: all.filter((r) => r.ev.status === 'planned' || r.ev.status === 'live'),
      past: all.filter((r) => r.ev.status === 'done' || r.ev.status === 'skipped').reverse(),
    };
  }, [s.events, priv.events, filter]);

  const hiddenCount = priv.events.length;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        {tabs}
        {/* Phones use the floating add button. */}
        <span className="hidden lg:block">
          <Button size="sm" variant="secondary" onClick={onAdd}>
            ＋ {t('addEvent')}
          </Button>
        </span>
      </div>

      <PreviewSection page="overlay" customize={<OverlayLookCard />} />

      <div className="mb-3 flex gap-2">
        <Chip active={filter === 'all'} className="h-8 text-xs" onClick={() => setFilter('all')}>
          {t('filterAll')}
        </Chip>
        <Chip active={filter === 'visible'} className="h-8 text-xs" onClick={() => setFilter('visible')}>
          👁 {t('filterVisible')}
        </Chip>
        <Chip active={filter === 'hidden'} className="h-8 text-xs" onClick={() => setFilter('hidden')}>
          🙈 {t('filterHidden')} {hiddenCount > 0 && <span className="ml-1 opacity-70">{hiddenCount}</span>}
        </Chip>
      </div>

      {rows.current.length === 0 && rows.past.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-ink-400">
          {t('noEvents')}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rows.current.map((r) => (
            <Row key={r.ev.id} ev={r.ev} hidden={r.hidden} onEdit={() => setEditing(r)} />
          ))}
        </AnimatePresence>
      </ul>

      {rows.past.length > 0 && (
        <div className="mt-4">
          <button className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-400" onClick={() => setShowPast((v) => !v)}>
            {showPast ? '▾' : '▸'} {t('past')} ({rows.past.length})
          </button>
          {showPast && (
            <ul className="flex flex-col gap-2">
              {rows.past.map((r) => (
                <Row key={r.ev.id} ev={r.ev} hidden={r.hidden} onEdit={() => setEditing(r)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.current.length + rows.past.length > 0 && <AddRowButton label={t('addEvent')} onClick={onAdd} />}


      <EventSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} editing={editing} />
    </>
  );
}

/** How the OBS overlays look (saved in the subathon, so OBS follows it live). */
function OverlayLookCard() {
  const { t } = useT();
  const [look, setLook] = useOverlayLookSetting();
  return (
    <div className="rounded-2xl bg-ink-800/70 p-3 ring-1 ring-white/5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
        <LookRow label={t('language')}>
          <Segmented value={look.lang} onChange={(v) => setLook({ lang: v })} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} />
        </LookRow>
        <LookRow label={t('theme')}>
          <Segmented value={look.theme} onChange={(v) => setLook({ theme: v })} options={[{ value: 'dark', label: t('dark') }, { value: 'light', label: t('light') }]} />
        </LookRow>
        <LookRow label={t('background')}>
          <Segmented value={look.bg} onChange={(v) => setLook({ bg: v })} options={[{ value: 'glass', label: t('bgGlass') }, { value: 'solid', label: t('bgSolid') }]} />
        </LookRow>
        <LookRow label={t('position')}>
          <Segmented value={look.pos} onChange={(v) => setLook({ pos: v })} options={[{ value: 'top', label: t('top') }, { value: 'bottom', label: t('bottom') }]} />
        </LookRow>
        <LookRow label={t('window')}>
          <Segmented
            value={String(look.hours)}
            onChange={(v) => setLook({ hours: Number(v) as WindowHours })}
            options={WINDOW_HOURS.map((h) => ({ value: String(h), label: `${h}h` }))}
          />
        </LookRow>
      </div>
      <div className="mt-2 text-xs text-ink-400">{t('overlayLookHint')}</div>
    </div>
  );
}

function LookRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-semibold text-ink-300">{label}</div>
      {children}
    </div>
  );
}

function Row({ ev, hidden, onEdit }: { ev: PlannedEvent; hidden: boolean; onEdit: () => void }) {
  const { s, now, schedule, act } = useAdmin();
  const { t, lang } = useT();
  const st = eventDisplayState(ev, now);
  const warn = hidden ? null : eventWarning(ev, schedule, now);
  const color = eventColor(ev.color);
  const live = st === 'live';
  const finished = st === 'done' || st === 'skipped';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className={cx(
        'flex items-center gap-3 rounded-2xl p-2.5 ring-1 transition-colors',
        hidden ? 'border border-dashed border-white/15 bg-ink-900/60 ring-transparent' : 'bg-ink-800/80 ring-white/5',
        live && 'ring-2 ring-live/60',
        finished && 'opacity-60',
      )}
    >
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl', hidden && 'grayscale')}
          style={{ background: `color-mix(in oklab, ${color} ${hidden ? 15 : 30}%, transparent)`, boxShadow: `inset 0 0 0 1px ${color}55` }}
        >
          {ev.emoji ?? '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-semibold', hidden && 'text-ink-300')}>{ev.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-400">
            <span className="tabular">
              {formatDayShort(ev.startAt, lang, s.tz)} · {formatTime(ev.startAt, lang, s.tz)}–{formatTime(ev.endAt, lang, s.tz)}
            </span>
            {live && <Badge tone="live">● {t('statusLive')}</Badge>}
            {st === 'soon' && <Badge tone="amber">{t('statusSoon')}</Badge>}
            {st === 'done' && <Badge>{t('statusDone')}</Badge>}
            {st === 'skipped' && <Badge>{t('skipped')}</Badge>}
            {hidden && <Badge>🙈 {t('hidden')}</Badge>}
            {warn && <Badge tone="amber">⚠ {warn === 'afterEnd' ? t('warnAfterEnd') : t('warnDuringRest')}</Badge>}
          </span>
        </span>
      </button>

      {!finished && (
        <button
          aria-label={hidden ? t('visible') : t('hidden')}
          disabled={live}
          onClick={() =>
            hidden
              ? act(A.revealEvent(ev.id), t('toastRevealed', { title: ev.title }))
              : act(A.hideEvent(ev.id), t('toastHidden', { title: ev.title }))
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700/70 text-lg transition active:scale-90 disabled:opacity-30"
        >
          {hidden ? '🙈' : '👁'}
        </button>
      )}
      <button
        aria-label={t('inProgress')}
        onClick={() =>
          live
            ? act(A.stopEvent(ev.id), t('toastEventEnded', { title: ev.title }))
            : act(A.startEvent(ev.id), t('toastEventStarted', { title: ev.title }))
        }
        className={cx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold transition active:scale-90',
          live ? 'bg-live text-white shadow-lg shadow-live/30' : 'bg-ink-700/70 text-ink-200',
        )}
      >
        {live ? '■' : '▶'}
      </button>
    </motion.li>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'live' | 'amber' }) {
  return (
    <span
      className={cx(
        'rounded-md px-1.5 py-px text-[0.68rem] font-semibold',
        tone === 'live' ? 'bg-live/20 text-red-200' : tone === 'amber' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-ink-300',
      )}
    >
      {children}
    </span>
  );
}

/** Add button at the end of a list, so it's reachable when the list grows. */
export function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-semibold text-ink-300 transition hover:bg-white/5 active:scale-[0.98]"
    >
      ＋ {label}
    </button>
  );
}
