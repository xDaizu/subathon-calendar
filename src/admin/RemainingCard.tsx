import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { currentRemaining, HOUR, MIN, projectSchedule } from '../lib/schedule';
import { formatDateTime, formatDuration, parseDuration } from '../lib/time';
import { Button, inputCls, Sheet } from '../ui/ui';
import { useAdmin } from './context';

const QUICK = [5 * MIN, 15 * MIN, 30 * MIN, HOUR];

/** Remaining-time tab of the counter card. */
export function RemainingPanel({ tabs }: { tabs: ReactNode }) {
  const { s, clock, now, schedule, act } = useAdmin();
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const remaining = currentRemaining(clock, now);
  const paused = s.rest.active;

  const delta = (ms: number) => {
    const sign = ms > 0 ? '+' : '−';
    act(A.adjustRemaining(ms), t('toastAdded', { delta: `${sign}${formatDuration(Math.abs(ms), lang)}` }));
  };

  return (
    <>
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">
          {t('remaining')} {paused && <span className="ml-1 rounded-md bg-night/25 px-1.5 py-0.5 text-indigo-200">⏸ {t('paused')}</span>}
        </div>
        {tabs}
      </div>
      <button
        className="font-display tabular mt-1 block w-full text-left text-[2.6rem] leading-none font-bold tracking-tight transition active:scale-[0.98] sm:text-5xl"
        onClick={() => setOpen(true)}
      >
        <span className={paused ? 'text-ink-300' : 'bg-gradient-to-r from-white to-ink-300 bg-clip-text text-transparent'}>
          {formatDuration(remaining, lang)}
        </span>
      </button>
      <div className="mt-2 text-sm text-ink-300">
        {t('estimatedEnd')} <span className="font-semibold text-ink-100">≈ {formatDateTime(schedule.estimatedEndAt, lang, s.tz)}</span>
        {schedule.projectedRests.length > 0 && (
          <span className="text-ink-400"> · 🌙×{schedule.projectedRests.length}</span>
        )}
      </div>
      <div className="mt-1 text-xs text-ink-500">🔒 {t('privateHint')}</div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        <Button size="md" variant="secondary" className="px-0 text-ink-300" onClick={() => delta(-5 * MIN)}>
          −5m
        </Button>
        {QUICK.map((ms) => (
          <Button key={ms} size="md" variant="secondary" className="px-0" onClick={() => delta(ms)}>
            +{ms >= HOUR ? '1h' : `${ms / MIN}m`}
          </Button>
        ))}
      </div>
      <Button variant="primary" className="mt-2 w-full" onClick={() => setOpen(true)}>
        ✎ {t('update')}
      </Button>

      <OverrideSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/** On touch devices the on-screen keypad replaces the system keyboard. */
const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'd', '0', 'h'];

function OverrideSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { s, clock, now, act } = useAdmin();
  const { t, lang } = useT();
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const parsed = parseDuration(text);
  const previewEnd = useMemo(() => {
    if (parsed == null) return null;
    return projectSchedule({ ...clock, remainingMs: parsed, remainingSetAt: now }, now).estimatedEndAt;
  }, [parsed, clock, now]);

  const press = (k: string) => {
    setText((v) => {
      if (k === 'd' || k === 'h') return /\d$/.test(v) ? `${v}${k} ` : v;
      if (k === 'm') return /\d$/.test(v) ? `${v}m` : v;
      return v + k;
    });
  };

  const submit = () => {
    if (parsed == null) return;
    act(A.setRemaining(parsed), t('toastRemaining', { d: formatDuration(parsed, lang) }));
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('overrideTitle')}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={parsed == null} onClick={submit}>
          ✓ {t('save')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-400">{t('overrideHint')}</p>
      <input
        autoFocus={!coarse}
        inputMode={coarse ? 'none' : 'text'}
        className={`${inputCls} font-display tabular h-16 text-center text-3xl`}
        placeholder="12h 25m"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="mt-2 h-6 text-center text-sm">
        {text && parsed == null && <span className="text-red-300">{t('overrideInvalid')}</span>}
        {parsed != null && previewEnd != null && (
          <span className="text-ink-300">
            <span className="font-display font-semibold text-ink-100">{formatDuration(parsed, lang)}</span> ·{' '}
            {t('overridePreview', { date: formatDateTime(previewEnd, lang, s.tz) })}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <Button
            key={k}
            variant={/\d/.test(k) ? 'secondary' : 'ghost'}
            size="lg"
            className={`font-display text-2xl ${/\d/.test(k) ? '' : 'bg-accent/15 text-accent'}`}
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
        <Button variant="ghost" size="lg" className="font-display bg-accent/15 text-2xl text-accent" onClick={() => press('m')}>
          m
        </Button>
        <Button variant="ghost" size="lg" className="text-xl" onClick={() => setText('')}>
          C
        </Button>
        <Button variant="ghost" size="lg" className="text-xl" onClick={() => setText((v) => v.trimEnd().slice(0, -1))}>
          ⌫
        </Button>
      </div>
    </Sheet>
  );
}
