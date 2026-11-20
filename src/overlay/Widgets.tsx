import { useT } from '../i18n';
import type { RestDisplay } from '../lib/schedule';
import { formatIn, formatTime } from '../lib/time';
import { tzLabelFor } from '../lib/tz';
import type { Subathon } from '../lib/types';

const STARS = [
  [8, 22, 0], [18, 70, 0.6], [27, 35, 1.2], [36, 80, 0.3], [47, 18, 1.8], [58, 62, 0.9],
  [66, 28, 2.2], [74, 78, 1.5], [83, 40, 0.4], [91, 66, 2.6], [12, 50, 2], [52, 85, 1.1],
];

/** Compact night card shown while rest mode is on. */
export function RestWidget({ s, rest, now }: { s: Subathon; rest: Exclude<RestDisplay, { state: 'awake' }>; now: number }) {
  const { t, lang } = useT();
  const total = Math.max(1, rest.plannedEndAt - rest.startedAt);
  const progress = Math.min(1, (now - rest.startedAt) / total);
  const overtime = rest.state === 'backSoon';

  return (
    <div className="night-card relative flex w-[44rem] items-center gap-[1.6rem] overflow-hidden rounded-[1.6rem] px-[1.8rem] py-[0.9rem]">
      {STARS.map(([x, y, d], i) => (
        <span key={i} className="star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
      ))}
      <div className="moon h-[4.2rem] w-[4.2rem] shrink-0" />
      <div className="relative min-w-0 flex-1">
        <div className="text-[0.95rem] font-bold uppercase leading-tight tracking-[0.2em] text-indigo-200/80">
          {t('goodNight')} · {t('rest')}
        </div>
        {overtime ? (
          <div className="font-display animate-pulse-soft text-[2.2rem] font-bold leading-tight tracking-wide">
            {t('backSoon')}
          </div>
        ) : (
          <div className="font-display tabular text-[2.2rem] font-bold leading-tight">
            {t('backIn', { in: formatIn(rest.plannedEndAt - now, lang) })}
          </div>
        )}
        {!overtime && (
          <div className="text-[1.05rem] leading-tight text-indigo-100/70">
            {formatTime(rest.plannedEndAt, lang, s.tz)} {tzLabelFor(s, lang)}
          </div>
        )}
        <div className="mt-[0.6rem] h-[0.3rem] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-amber-200 transition-[width] duration-1000"
            style={{ width: `${(overtime ? 1 : progress) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function EndedWidget() {
  const { t } = useT();
  return (
    <div className="glass relative flex items-center gap-[1.2rem] overflow-hidden rounded-[1.6rem] px-[2rem] py-[1.1rem]">
      <div className="text-[3rem] leading-none">🏁</div>
      <div>
        <div className="font-display accent-text text-[2.3rem] font-bold leading-tight">{t('ended')}</div>
        <div className="text-dim text-[1rem]">{t('endedThanks')} 💜</div>
      </div>
    </div>
  );
}
