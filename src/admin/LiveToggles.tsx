import { motion } from 'motion/react';
import { useState } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { eventColor } from '../lib/colors';
import { eventDisplayState, MIN, restDisplayState } from '../lib/schedule';
import { formatDuration, formatTime } from '../lib/time';
import type { PlannedEvent } from '../lib/types';
import { Button, Card, cx } from '../ui/ui';
import { useAdmin } from './context';
import { RestPlanSheet, useNextRest, useWhen } from './RestPlanSheet';

/** The event the big "En curso" toggle acts on: the live one, else the next planned (visible or hidden). */
export function focusEvent(all: PlannedEvent[]): PlannedEvent | undefined {
  return (
    all.find((e) => e.status === 'live') ??
    all.filter((e) => e.status === 'planned').sort((a, b) => a.startAt - b.startAt)[0]
  );
}

export function LiveToggles() {
  const { s, priv, now, act } = useAdmin();
  const { t, lang } = useT();
  const all = [...s.events, ...priv.events];
  const ev = focusEvent(all);
  const hidden = ev ? priv.events.some((d) => d.id === ev.id) : false;
  const live = ev?.status === 'live';
  const st = ev ? eventDisplayState(ev, now) : null;
  const rest = restDisplayState(s, now);
  const resting = rest.state !== 'awake';
  const nextRest = useNextRest();
  const restsHidden = !!s.restsHidden;
  const when = useWhen();
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ── En curso ── */}
      <Card className={cx('flex flex-col p-3 transition-colors sm:p-4', live && 'ring-2 ring-live/70')}>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
          <span className={cx('h-2 w-2 rounded-full', live ? 'animate-pulse bg-live' : 'bg-ink-600')} />
          {t('inProgress')}
        </div>
        {ev ? (
          <>
            <div className="mb-1 flex min-w-0 items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: `color-mix(in oklab, ${eventColor(ev.color)} 30%, transparent)` }}
              >
                {ev.emoji ?? '•'}
              </span>
              <span className="truncate font-semibold">{ev.title}</span>
              {hidden && <span title={t('hidden')}>🙈</span>}
            </div>
            <div className="mb-3 min-h-10 text-xs leading-snug text-ink-400">
              {live ? (
                <span className="text-red-200">{t('liveForAdmin', { d: formatDuration(now - (ev.actualStartAt ?? now), lang, { seconds: false }) })}</span>
              ) : (
                <>
                  {t('plannedAt', { time: formatTime(ev.startAt, lang, s.tz) })}
                  {st === 'soon' && now - ev.startAt >= MIN && (
                    <span className="ml-1 rounded bg-amber-400/15 px-1 font-semibold text-amber-300">
                      {t('lateBy', { d: formatDuration(now - ev.startAt, lang, { seconds: false }) })}
                    </span>
                  )}
                </>
              )}
            </div>
            <BigToggle
              on={live}
              tone="live"
              labelOn={`■ ${t('endEvent')}`}
              labelOff={`▶ ${t('startEvent')}`}
              onClick={() =>
                live
                  ? act(A.stopEvent(ev.id), t('toastEventEnded', { title: ev.title }))
                  : act(A.startEvent(ev.id), t('toastEventStarted', { title: ev.title }))
              }
            />
            {!live && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => act(A.delayEvent(ev.id, 15 * MIN), t('toastDelayed', { title: ev.title }))}
              >
                ⏱ {t('delay15')}
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-ink-400">{t('noEvent')}</div>
        )}
      </Card>

      {/* ── Modo descanso ── */}
      <Card className={cx('relative flex flex-col overflow-hidden p-3 transition-colors sm:p-4', resting && 'ring-2 ring-night/70')}>
        {resting && <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-night/25 via-transparent to-transparent" />}
        <div className="relative mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
          🌙 {t('restMode')}
        </div>
        <div className="relative mb-1 flex min-h-9 items-center justify-between gap-2">
          <span className="font-semibold">{resting ? t('restOn') : t('restOff')}</span>
          {!resting && (nextRest || restsHidden) && (
            <button
              aria-label={restsHidden ? t('restsShow') : t('restsHide')}
              title={restsHidden ? t('restsShow') : t('restsHide')}
              aria-pressed={!restsHidden}
              onClick={() =>
                act(A.setRestsHidden(!restsHidden), restsHidden ? t('toastRestsShown') : t('toastRestsHidden'))
              }
              className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base transition active:scale-90',
                restsHidden ? 'bg-amber-400/15 ring-1 ring-amber-300/40' : 'bg-ink-700/70',
              )}
            >
              {restsHidden ? '🙈' : '👁'}
            </button>
          )}
        </div>
        <div className="relative mb-3 min-h-10 text-xs leading-snug text-ink-400">
          {rest.state !== 'awake' ? (
            <>
              <button className="underline decoration-dotted underline-offset-2" onClick={() => setPlanOpen(true)}>
                {t('wakeAt', { time: formatTime(rest.plannedEndAt, lang, s.tz) })} ✎
              </button>
              {rest.state === 'backSoon' && <div className="mt-0.5 text-amber-300">{t('overtime')}</div>}
            </>
          ) : (
            nextRest && (
              <button className="block w-full text-left" onClick={() => setPlanOpen(true)}>
                <span className={cx(restsHidden && 'opacity-60')}>
                  {t('nextRestAt', { from: when(nextRest.startAt), to: formatTime(nextRest.endAt, lang, s.tz) })}
                </span>
                {(restsHidden || nextRest.adjusted) && (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {restsHidden && (
                      <span className="rounded bg-amber-400/15 px-1 font-semibold text-amber-300">{t('restsHiddenBadge')}</span>
                    )}
                    {nextRest.adjusted && (
                      <span className="rounded bg-night/25 px-1 font-semibold text-indigo-200">{t('adjusted')}</span>
                    )}
                  </span>
                )}
              </button>
            )
          )}
        </div>
        <div className="relative mt-auto">
          <BigToggle
            on={resting}
            tone="night"
            labelOn={`☀ ${t('restEnd')}`}
            labelOff={`🌙 ${t('restStart')}`}
            onClick={() =>
              resting ? act(A.stopRest, t('toastRestEnded')) : act(A.startRest, t('toastRestStarted'))
            }
          />
          {resting ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => act(A.adjustWake(-30 * MIN))}>
                −30m
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => act(A.adjustWake(30 * MIN))}>
                +30m
              </Button>
            </div>
          ) : nextRest ? (
            <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setPlanOpen(true)}>
              🕑 {t('adjustRest')}
            </Button>
          ) : (
            <div className="h-11" />
          )}
        </div>
        <RestPlanSheet open={planOpen} onOpenChange={setPlanOpen} />
      </Card>
    </div>
  );
}

function BigToggle({
  on,
  tone,
  labelOn,
  labelOff,
  onClick,
}: {
  on: boolean;
  tone: 'live' | 'night';
  labelOn: string;
  labelOff: string;
  onClick: () => void;
}) {
  const onCls = tone === 'live' ? 'bg-live shadow-live/40' : 'bg-night shadow-night/40';
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'relative h-16 w-full overflow-hidden rounded-2xl text-base font-bold shadow-lg transition-colors sm:text-lg',
        on ? `${onCls} text-white` : 'bg-ink-700 text-ink-100 ring-1 ring-white/10',
      )}
    >
      {on && (
        <motion.span
          className="absolute inset-0 bg-white/15"
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
        />
      )}
      <span className="relative">{on ? labelOn : labelOff}</span>
    </motion.button>
  );
}
