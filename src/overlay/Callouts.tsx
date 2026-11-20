import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../i18n';
import { eventColor } from '../lib/colors';
import { urgencyFor, type Callout } from '../lib/schedule';
import { formatIn } from '../lib/time';

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-[0.8rem] w-[0.8rem]">
      {pulse && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: color }} />
      )}
      <span className="relative inline-flex h-[0.8rem] w-[0.8rem] rounded-full" style={{ background: color }} />
    </span>
  );
}

function SoonBadge() {
  const { t } = useT();
  return (
    <span className="accent-gradient animate-pulse-soft rounded-full px-[0.6rem] py-[0.15rem] text-[0.95rem] font-bold tracking-wider text-white">
      {t('soon')}
    </span>
  );
}

function Countdown({ ms, strong }: { ms: number; strong?: boolean }) {
  const { lang } = useT();
  return (
    <span className={`font-display tabular whitespace-nowrap ${strong ? 'accent-text font-bold' : 'text-dim font-semibold'}`}>
      {formatIn(ms, lang)}
    </span>
  );
}

function Chip({ c, now }: { c: Callout; now: number }) {
  const { t } = useT();
  const base = 'glass flex items-center gap-[0.65rem] rounded-full px-[1.1rem] py-[0.5rem] text-[1.3rem]';

  switch (c.kind) {
    case 'live':
      return (
        <div className={base} style={{ boxShadow: '0 0 0 2px var(--color-live), 0 0 1.6rem rgba(255,59,92,.45)' }}>
          <Dot color="var(--color-live)" pulse />
          <span className="text-[1rem] font-extrabold tracking-[0.14em] text-[var(--color-live)]">{t('live')}</span>
          <span className="font-semibold">
            {c.ev.emoji} {c.ev.title}
          </span>
        </div>
      );
    case 'nextEvent': {
      const u = urgencyFor(c.at - now);
      return (
        <div
          className={`${base} ${!c.soon && u === 'imminent' ? 'animate-pulse-fast' : ''}`}
          style={u !== 'calm' || c.soon ? { boxShadow: `0 0 0 2px ${eventColor(c.ev.color)}` } : undefined}
        >
          <span className="text-dim text-[0.95rem] font-bold uppercase tracking-[0.14em]">{t('upNext')}</span>
          <span className="font-semibold">
            {c.ev.emoji} {c.ev.title}
          </span>
          {c.soon ? <SoonBadge /> : <Countdown ms={c.at - now} strong={u !== 'calm'} />}
        </div>
      );
    }
    case 'nextRest': {
      const u = urgencyFor(c.at - now);
      return (
        <div className={base}>
          <span className="text-[1.2rem]">🌙</span>
          <span className="font-semibold">{t('rest')}</span>
          {c.soon ? <SoonBadge /> : <Countdown ms={c.at - now} strong={u !== 'calm'} />}
        </div>
      );
    }
    case 'notStarted':
      return (
        <div className={base}>
          <Dot color="var(--accent)" pulse />
          <span className="font-semibold">{t('startsIn', { in: '' }).trim()}</span>
          <Countdown ms={c.at - now} strong />
        </div>
      );
    default:
      return null;
  }
}

export function Callouts({ items, now }: { items: Callout[]; now: number }) {
  const shown = items.filter((c) => c.kind !== 'none' && c.kind !== 'ended' && c.kind !== 'resting');
  const key = (c: Callout) =>
    c.kind === 'live' || c.kind === 'nextEvent' ? `${c.kind}-${c.ev.id}` : c.kind;
  return (
    <div className="flex items-center gap-[0.75rem]">
      <AnimatePresence mode="popLayout" initial={false}>
        {shown.map((c) => (
          <motion.div
            key={key(c)}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <Chip c={c} now={now} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
