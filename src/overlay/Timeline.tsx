import { eventColor } from '../lib/colors';
import {
  eventDisplayState,
  eventInterval,
  urgencyFor,
  visibleEvents,
  type Callout,
  type RestPlan,
} from '../lib/schedule';
import { formatDayShort, formatTime } from '../lib/time';
import { place, timeTicks, type Scale } from '../lib/timelineScale';
import type { Interval, Lang, Subathon } from '../lib/types';

interface Props {
  s: Subathon;
  plan: RestPlan;
  scale: Scale;
  now: number;
  lang: Lang;
  callouts: Callout[];
}

const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
const MIN_PAST_MS = 2 * 60_000;

export function Timeline({ s, plan, scale, now, lang, callouts }: Props) {
  const nowX = scale.x(now);
  const inWindow = (iv: Interval) => iv.endAt > scale.start && iv.startAt < scale.end;
  // Finished blips (a rest toggled on/off, an event started and stopped right away) aren't history.
  const blip = (iv: Interval) => iv.endAt <= now && iv.endAt - iv.startAt < MIN_PAST_MS;
  const events = visibleEvents(s.events, plan, now).filter((ev) => {
    const iv = eventInterval(ev, now);
    return inWindow(iv) && !(eventDisplayState(ev, now) === 'done' && blip(iv));
  });
  const rests: Interval[] = [
    ...s.restLog.filter((r) => !blip(r)),
    ...(plan.currentRest ? [plan.currentRest] : []),
    ...plan.projectedRests,
  ].filter(inWindow);
  const hours = (scale.end - scale.start) / 3_600_000;
  const ticks = timeTicks(scale, s.tz, Math.max(3, Math.round(hours / 4)));
  // Fade the edges that continue beyond the window (left only if the subathon started earlier).
  const fadeLeft = scale.start > s.startAt;
  const mask = `linear-gradient(to right, ${fadeLeft ? 'transparent 0, black 4%' : 'black 0'}, black 90%, transparent 100%)`;

  // The "runway": from NOW to the next thing that viewers are waiting for.
  const target = callouts.find((c) => c.kind === 'nextEvent' || c.kind === 'nextRest') as
    | Extract<Callout, { kind: 'nextEvent' | 'nextRest' }>
    | undefined;
  const nextEv = callouts.find((c): c is Extract<Callout, { kind: 'nextEvent' }> => c.kind === 'nextEvent');
  const nextId = nextEv?.ev.id;
  const targetX = target ? scale.x(target.at) : null;

  return (
    <div className="relative w-full">
      {/* Bar */}
      <div className="glass relative h-[2.8rem] w-full overflow-visible rounded-full">
        <div
          className="absolute inset-[0.3rem] overflow-hidden rounded-full"
          style={{ background: 'var(--track)', maskImage: mask, WebkitMaskImage: mask }}
        >
          {/* Elapsed */}
          <div className="elapsed-fill now-marker absolute inset-y-0 left-0" style={{ width: pct(nowX) }} />

          {/* Time ticks */}
          {ticks.map((tk) => (
            <div
              key={tk.key}
              className="absolute inset-y-0 w-px"
              style={{ left: pct(tk.x), background: 'var(--glass-border)', opacity: tk.midnight ? 1 : 0.5 }}
            />
          ))}

          {/* Runway to next */}
          {targetX != null && targetX > nowX && (
            <div
              className="runway absolute top-1/2 h-[2px] -translate-y-1/2 opacity-80"
              style={{ left: pct(nowX), width: pct(targetX - nowX) }}
            />
          )}

          {/* Rests */}
          {rests.map((r, i) => {
            const past = r.endAt <= now;
            // Past blocks are drawn at their real size; only what's still ahead gets a minimum width.
            const p = place(r, scale, past ? 0 : 0.006);
            return (
              <div
                key={`r${i}-${r.startAt}`}
                className="night-block block absolute inset-y-[0.15rem] flex items-center justify-center rounded-full"
                style={{ left: pct(p.left), width: pct(p.width), opacity: past ? 0.45 : 1 }}
              >
                {p.width > 0.018 && <span className="text-[1.1rem] leading-none">🌙</span>}
              </div>
            );
          })}

          {/* Events */}
          {events.map((ev) => {
            const st = eventDisplayState(ev, now);
            const iv = eventInterval(ev, now);
            const p = place(iv, scale, st === 'done' ? 0 : 0.012);
            const color = eventColor(ev.color);
            const isNext = ev.id === nextId;
            const u = st === 'upcoming' && isNext ? urgencyFor(iv.startAt - now) : 'calm';
            const showTitle = p.width > 0.08;
            const anim =
              st === 'live' || st === 'soon' ? 'animate-pulse-soft' : u === 'imminent' ? 'animate-pulse-fast' : '';
            return (
              <div
                key={ev.id}
                className={`block absolute inset-y-[0.15rem] flex items-center gap-[0.35rem] overflow-hidden rounded-full px-[0.55rem] ${anim}`}
                style={{
                  left: pct(p.left),
                  width: pct(p.width),
                  background:
                    st === 'done'
                      ? `color-mix(in oklab, ${color} 35%, transparent)`
                      : `linear-gradient(180deg, color-mix(in oklab, ${color} 92%, white), ${color})`,
                  opacity: st === 'done' ? 0.55 : 1,
                  boxShadow:
                    st === 'live'
                      ? `0 0 0 2px var(--color-live), 0 0 1.2rem color-mix(in oklab, var(--color-live) 70%, transparent)`
                      : u === 'near' || u === 'imminent' || st === 'soon'
                        ? `0 0 0 2px white, 0 0 1rem ${color}`
                        : undefined,
                  justifyContent: showTitle ? 'flex-start' : 'center',
                }}
              >
                {ev.emoji && (st !== 'done' || p.width > 0.02) && <span className="shrink-0 text-[1.15rem] leading-none">{ev.emoji}</span>}
                {showTitle && (
                  <span className="truncate text-[1rem] font-bold leading-none text-white drop-shadow">
                    {ev.title}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* NOW marker */}
        <div
          className="now-marker pointer-events-none absolute -top-[0.45rem] -bottom-[0.45rem] w-0"
          style={{ left: `calc(0.3rem + (100% - 0.6rem) * ${nowX})` }}
        >
          <div className="absolute inset-y-0 -left-[1.5px] w-[3px] rounded-full bg-white shadow-[0_0_0.8rem_rgba(255,255,255,0.9)]" />
          <div className="accent-gradient absolute -top-[0.3rem] -left-[0.45rem] h-[0.9rem] w-[0.9rem] rounded-full ring-2 ring-white shadow-[0_0_1rem_var(--accent2)]" />
        </div>
      </div>

      {/* Time labels */}
      <div className="relative mt-[0.3rem] h-[1.1rem]">
        {ticks
          .filter((tk) => tk.x < 0.93)
          .map((tk) => (
            <div
              key={tk.key}
              className={`absolute border-l pl-[0.35rem] text-[0.9rem] leading-none whitespace-nowrap ${
                tk.midnight ? 'font-semibold uppercase tracking-wider' : 'text-dim tabular font-medium'
              }`}
              style={{ left: `calc(0.3rem + (100% - 0.6rem) * ${tk.x})`, borderColor: 'var(--glass-border)' }}
            >
              {tk.midnight ? formatDayShort(tk.at + 12 * 3_600_000, lang, s.tz) : formatTime(tk.at, lang, s.tz)}
            </div>
          ))}
      </div>
    </div>
  );
}
