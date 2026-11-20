import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { progressTo, sortUnlocks, unlockedCount } from '../lib/unlocks';
import type { Unlock } from '../lib/types';
import { Button, inputCls, Sheet } from '../ui/ui';
import { useAdmin } from './context';

const QUICK = [-1, 1, 5, 10];

/** Unlocks reached by going from `from` to `to` subs. */
function newlyUnlocked(sorted: Unlock[], from: number, to: number): Unlock[] {
  return sorted.slice(unlockedCount(sorted, from), unlockedCount(sorted, to));
}

/** Subs tab of the counter card. */
export function SubsPanel({ tabs }: { tabs: ReactNode }) {
  const { s, act } = useAdmin();
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const subs = s.subs ?? 0;
  const sorted = useMemo(() => sortUnlocks(s.unlocks), [s.unlocks]);
  const n = unlockedCount(sorted, subs);
  const next = sorted[n];

  const message = (to: number) => {
    const got = newlyUnlocked(sorted, subs, to);
    if (got.length === 1) return t('toastUnlocked', { title: got[0].title });
    if (got.length > 1) return t('toastUnlockedMany', { n: got.length });
    return t('toastSubs', { n: to.toLocaleString(lang) });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">
          {t('subs')}
          {sorted.length > 0 && (
            <span className="ml-1 rounded-md bg-white/5 px-1.5 py-0.5 tracking-normal text-ink-300 tabular">
              🔓 {n}/{sorted.length}
            </span>
          )}
        </div>
        {tabs}
      </div>
      <button
        className="font-display tabular mt-1 block text-left text-[2.6rem] leading-none font-bold tracking-tight transition active:scale-[0.98] sm:text-5xl"
        onClick={() => setOpen(true)}
      >
        {subs.toLocaleString(lang)}
      </button>

      {next ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-ink-300">
              {t('nextUnlock')}: <span className="font-semibold text-ink-100">{next.emoji} {next.title}</span>
            </span>
            <span className="shrink-0 text-xs text-ink-400 tabular">
              {t('subsLeft', { n: next.target - subs })} · {next.target}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500"
              style={{ width: `${progressTo(sorted, n, subs) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        sorted.length > 0 && <div className="mt-3 text-sm font-semibold text-ink-300">🎉 {t('allUnlocked')}</div>
      )}

      <div className="mt-4 grid grid-cols-5 gap-2">
        {QUICK.map((d) => (
          <Button
            key={d}
            size="md"
            variant="secondary"
            className={`px-0 ${d < 0 ? 'text-ink-300' : ''}`}
            disabled={d < 0 && subs <= 0}
            onClick={() => act(A.adjustSubs(d), message(Math.max(0, subs + d)))}
          >
            {d > 0 ? `+${d}` : `−${-d}`}
          </Button>
        ))}
        <Button size="md" variant="primary" className="px-0" aria-label={t('subsSetTitle')} onClick={() => setOpen(true)}>
          ✎
        </Button>
      </div>

      <SubsSheet open={open} onOpenChange={setOpen} sorted={sorted} message={message} />
    </>
  );
}

function SubsSheet({
  open,
  onOpenChange,
  sorted,
  message,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sorted: Unlock[];
  message: (to: number) => string;
}) {
  const { s, act } = useAdmin();
  const { t } = useT();
  const [text, setText] = useState('');
  const subs = s.subs ?? 0;
  useEffect(() => {
    if (open) setText(String(subs));
  }, [open]);

  const parsed = /^\d{1,7}$/.test(text.trim()) ? Number(text.trim()) : null;
  const got = parsed != null && parsed > subs ? newlyUnlocked(sorted, subs, parsed) : [];

  const submit = () => {
    if (parsed == null) return;
    act(A.setSubs(parsed), message(parsed));
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('subsSetTitle')}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={parsed == null} onClick={submit}>
          ✓ {t('save')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-400">{t('subsSetHint')}</p>
      <input
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        className={`${inputCls} font-display tabular h-16 text-center text-3xl`}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="mt-2 min-h-6 text-center text-sm text-ink-300">
        {got.length > 0 && t('subsWillUnlock', { list: got.map((u) => `${u.emoji ?? '🎁'} ${u.title}`).join(', ') })}
      </div>
    </Sheet>
  );
}
