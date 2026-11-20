import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { MIN, nextRestSlot, type ProjectedRest } from '../lib/schedule';
import { atTimeNear, formatDayShort, formatDuration, formatTime, hhmmToMinutes } from '../lib/time';
import { dayKey } from '../lib/tz';
import { Button, inputCls, Sheet } from '../ui/ui';
import { useAdmin } from './context';

const STEPS = [-30, -15, 15, 30].map((m) => m * MIN);
const minuteFloor = (t: number) => Math.floor(t / MIN) * MIN;

/** The next rest slot (not cut at the end), also while rests are hidden from the overlay. */
export function useNextRest(): ProjectedRest | undefined {
  const { s, now } = useAdmin();
  return nextRestSlot(s, now);
}

/** "sáb 21 · 03:00" — the day only when it isn't today. */
export function useWhen() {
  const { s, now } = useAdmin();
  const { lang } = useT();
  return (ts: number) =>
    dayKey(ts, s.tz) === dayKey(now, s.tz)
      ? formatTime(ts, lang, s.tz)
      : `${formatDayShort(ts, lang, s.tz)} · ${formatTime(ts, lang, s.tz)}`;
}

/**
 * Quick edit of the next rest (start + end) or, while resting, of the wake-up time.
 * Moving the start keeps the duration; moving the end changes it.
 */
export function RestPlanSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { s, now, act } = useAdmin();
  const { t, lang } = useT();
  const when = useWhen();
  const next = useNextRest();
  const resting = s.rest.active;

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  useEffect(() => {
    if (!open) return;
    if (resting) {
      setStart(s.rest.startedAt ?? now);
      setEnd(s.rest.plannedEndAt ?? now);
    } else if (next) {
      setStart(next.startAt);
      setEnd(next.endAt);
    }
  }, [open]);

  if (!resting && !next) return null;
  const minStart = minuteFloor(now);
  const minEnd = start + (resting ? 5 : 15) * MIN;

  const moveStart = (to: number) => {
    const v = Math.max(minStart, to);
    setEnd((e) => e + (v - start));
    setStart(v);
  };
  const moveEnd = (to: number) => setEnd(Math.max(minEnd, to));

  const save = () => {
    if (resting) act(A.setWake(end), t('toastWake', { time: formatTime(end, lang, s.tz) }));
    else if (next) act(A.planRest(next.occ, start, end), t('toastRestPlanned', { from: when(start), to: when(end) }));
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`🌙 ${resting ? t('wakeTitle') : t('restPlanTitle')}`}
      footer={
        <div className="flex gap-2">
          {!resting && next?.adjusted && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                act(A.clearRestPlan, t('toastRestPlanReset'));
                onOpenChange(false);
              }}
            >
              ↺ {t('restPlanReset')}
            </Button>
          )}
          <Button variant="night" size="lg" className="flex-1" onClick={save}>
            ✓ {t('save')}
          </Button>
        </div>
      }
    >
      {!resting && (
        <TimeRow label={t('restPlanStart')} hint={t('restPlanStartHint')} value={start} onChange={moveStart} />
      )}
      <TimeRow label={t('restPlanEnd')} value={end} onChange={moveEnd} />
      {!resting && s.restsHidden && <div className="mb-2 text-center text-xs text-amber-300">{t('restsHiddenNote')}</div>}
      <div className="mt-1 text-center text-sm text-ink-300">
        {when(start)} → {when(end)} ·{' '}
        <span className="font-display font-semibold text-ink-100">{formatDuration(end - start, lang, { seconds: false })}</span>
      </div>
    </Sheet>
  );
}

function TimeRow({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  const { s } = useAdmin();
  const { lang } = useT();
  const hhmm = value ? formatInTimeZone(value, s.tz, 'HH:mm') : '';
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink-200">{label}</span>
        <span className="text-xs text-ink-400">{value ? formatDayShort(value, lang, s.tz) : ''}</span>
      </div>
      <input
        type="time"
        className={`${inputCls} font-display tabular h-14 text-center text-2xl`}
        value={hhmm}
        onChange={(e) => {
          const m = hhmmToMinutes(e.target.value);
          if (m != null) onChange(atTimeNear(m, value, s.tz));
        }}
      />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {STEPS.map((d) => (
          <Button key={d} variant="secondary" size="md" className="px-0" onClick={() => onChange(value + d)}>
            {d > 0 ? '+' : '−'}
            {Math.abs(d) / MIN}m
          </Button>
        ))}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}
