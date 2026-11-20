import type { Lang } from './types';
import { addDaysKey, dayKey, zonedTime } from './tz';

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

export interface DurationOpts {
  /** Max number of units shown (largest first). */
  maxUnits?: number;
  /** Show seconds when the total is under one hour. */
  seconds?: boolean;
}

/**
 * Compact duration: es "2 d 4 h 13 min", en "2d 4h 13m".
 * Units: d, h, min (m), s.
 */
export function formatDuration(ms: number, lang: Lang, opts: DurationOpts = {}): string {
  const { maxUnits = 3, seconds = true } = opts;
  const total = Math.max(0, Math.floor(ms / S) * S);
  const d = Math.floor(total / D);
  const h = Math.floor((total % D) / H);
  const m = Math.floor((total % H) / M);
  const s = Math.floor((total % M) / S);

  const es = lang === 'es';
  const showSeconds = seconds && total < H;
  const units: [number, string, string][] = [
    [d, 'd', 'd'],
    [h, 'h', 'h'],
    [m, 'min', 'm'],
  ];
  if (showSeconds) units.push([s, 's', 's']);
  const fmt = ([n, ue, un]: [number, string, string]) => (es ? `${n} ${ue}` : `${n}${un}`);

  const first = units.findIndex((u) => u[0] > 0);
  if (first === -1) return total > 0 ? (es ? '<1 min' : '<1m') : fmt(showSeconds ? [0, 's', 's'] : [0, 'min', 'm']);
  return units
    .slice(first, first + maxUnits)
    .filter((u) => u[0] > 0)
    .map(fmt)
    .join(' ');
}

/** "en 2 h 13 min" / "in 2h 13m". */
export function formatIn(ms: number, lang: Lang, opts?: DurationOpts): string {
  const d = formatDuration(ms, lang, opts);
  return lang === 'es' ? `en ${d}` : `in ${d}`;
}

const stripDot = (s: string) => s.replace(/\.$/, '');

/** "dom 23 nov · 22:00" / "Sun 23 Nov · 22:00" */
export function formatDateTime(ts: number, lang: Lang, tz: string): string {
  const loc = lang === 'es' ? 'es-ES' : 'en-GB';
  const parts = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const get = (t: string) => stripDot(parts.find((p) => p.type === t)?.value ?? '');
  const wd = get('weekday');
  return `${wd} ${get('day')} ${get('month')} · ${get('hour')}:${get('minute')}`;
}

/** "22:00" */
export function formatTime(ts: number, lang: Lang, tz: string): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ts));
}

/** "dom" / "Sun" */
export function formatWeekday(ts: number, lang: Lang, tz: string): string {
  return stripDot(
    new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { timeZone: tz, weekday: 'short' }).format(new Date(ts)),
  );
}

/** "dom 23" / "Sun 23" */
export function formatDayShort(ts: number, lang: Lang, tz: string): string {
  const parts = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
  }).formatToParts(new Date(ts));
  const get = (t: string) => stripDot(parts.find((p) => p.type === t)?.value ?? '');
  return `${get('weekday')} ${get('day')}`;
}

/** "HH:mm" from minutes of day. */
/** The instant with local time `minutes` (in tz) closest to `ref` (yesterday, today or tomorrow). */
export function atTimeNear(minutes: number, ref: number, tz: string): number {
  const today = dayKey(ref, tz);
  const opts = [-1, 0, 1].map((d) => zonedTime(addDaysKey(today, d), minutes, tz));
  return opts.reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * Parse a remaining-time override. Accepts:
 * "12h 25m", "12h25", "1d 3h", "90m", "45min", "2d", "12:25" (h:m), "12:25:30" (h:m:s),
 * "1d 3:20", "30s", plain "90" (minutes). Spanish units too: "dias", "seg".
 */
export function parseDuration(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/,/g, '.');
  if (!s) return null;
  let total = 0;
  let matched = false;

  // Clock part (h:m or h:m:s), possibly after a day part.
  const clock = /(\d+):(\d{1,2})(?::(\d{1,2}))?/.exec(s);
  if (clock) {
    const [, h, m, sec] = clock;
    if (Number(m) > 59 || (sec && Number(sec) > 59)) return null;
    total += Number(h) * H + Number(m) * M + (sec ? Number(sec) * S : 0);
    s = s.replace(clock[0], ' ');
    matched = true;
  }

  const unitRe = /(\d+(?:\.\d+)?)\s*(d[ií]as?|d|h(?:oras?|rs?)?|min(?:utos?|s)?|m|seg(?:undos?)?|s(?:ecs?)?)(?![a-z])/g;
  let mm: RegExpExecArray | null;
  while ((mm = unitRe.exec(s))) {
    const n = Number(mm[1]);
    const u = mm[2];
    if (u.startsWith('d')) total += n * D;
    else if (u.startsWith('h')) total += n * H;
    else if (u.startsWith('m')) total += n * M;
    else total += n * S;
    matched = true;
  }
  const rest = s.replace(unitRe, '').trim();

  if (!matched) {
    if (/^\d+(\.\d+)?$/.test(rest)) return Math.round(Number(rest) * M);
    return null;
  }
  // Allow a trailing bare number after hours: "12h 25" → 25 minutes.
  if (rest) {
    if (/^\d+$/.test(rest) && /h/.test(input.toLowerCase()) && !/m/.test(input.toLowerCase())) {
      total += Number(rest) * M;
    } else {
      return null;
    }
  }
  return Math.round(total);
}

export interface DayChip {
  key: string;
  label: string;
}

/** Hoy, Mañana, then weekday names for the next days. */
export function dayChips(now: number, lang: Lang, tz: string, count = 7): DayChip[] {
  const today = dayKey(now, tz);
  const chips: DayChip[] = [];
  for (let i = 0; i < count; i++) {
    const key = addDaysKey(today, i);
    let label: string;
    if (i === 0) label = lang === 'es' ? 'Hoy' : 'Today';
    else if (i === 1) label = lang === 'es' ? 'Mañana' : 'Tomorrow';
    else {
      const wd = formatDayShort(zonedTime(key, 12 * 60, tz), lang, tz);
      label = wd.charAt(0).toUpperCase() + wd.slice(1);
    }
    chips.push({ key, label });
  }
  return chips;
}

export { dayKey, zonedTime };
