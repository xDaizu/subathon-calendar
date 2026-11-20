import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** "yyyy-MM-dd" for the given instant in the given timezone. */
export function dayKey(ts: number, tz: string): string {
  return formatInTimeZone(ts, tz, 'yyyy-MM-dd');
}

/** Adds `n` calendar days to a "yyyy-MM-dd" key. */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Epoch ms of `minutes` after local midnight of day `key` in `tz` (DST-safe). */
export function zonedTime(key: string, minutes: number, tz: string): number {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const local = `${key}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  return fromZonedTime(local, tz).getTime();
}

/** Minutes after local midnight for an instant in `tz`. */
export function minutesOfDay(ts: number, tz: string): number {
  const [h, m] = formatInTimeZone(ts, tz, 'HH:mm').split(':').map(Number);
  return h * 60 + m;
}

export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}

const KNOWN_LABELS: Record<string, { es: string; en: string }> = {
  'Europe/Madrid': { es: 'hora España', en: 'Spain time' },
  'Atlantic/Canary': { es: 'hora Canarias', en: 'Canary Is. time' },
  'America/Mexico_City': { es: 'hora CDMX', en: 'Mexico City time' },
  'America/Bogota': { es: 'hora Colombia', en: 'Colombia time' },
  'America/Lima': { es: 'hora Perú', en: 'Peru time' },
  'America/Santiago': { es: 'hora Chile', en: 'Chile time' },
  'America/Argentina/Buenos_Aires': { es: 'hora Argentina', en: 'Argentina time' },
  'America/Buenos_Aires': { es: 'hora Argentina', en: 'Argentina time' },
  'America/Caracas': { es: 'hora Venezuela', en: 'Venezuela time' },
  'America/Montevideo': { es: 'hora Uruguay', en: 'Uruguay time' },
  'America/Guayaquil': { es: 'hora Ecuador', en: 'Ecuador time' },
  'America/La_Paz': { es: 'hora Bolivia', en: 'Bolivia time' },
  'America/Asuncion': { es: 'hora Paraguay', en: 'Paraguay time' },
  'America/Guatemala': { es: 'hora Guatemala', en: 'Guatemala time' },
  'America/Costa_Rica': { es: 'hora Costa Rica', en: 'Costa Rica time' },
  'America/Panama': { es: 'hora Panamá', en: 'Panama time' },
  'America/Santo_Domingo': { es: 'hora R. Dominicana', en: 'Dominican Rep. time' },
  'America/Puerto_Rico': { es: 'hora Puerto Rico', en: 'Puerto Rico time' },
  'America/New_York': { es: 'hora Nueva York', en: 'New York time' },
  'America/Los_Angeles': { es: 'hora Los Ángeles', en: 'LA time' },
  'Europe/London': { es: 'hora Londres', en: 'UK time' },
  'Europe/Berlin': { es: 'hora Alemania', en: 'Germany time' },
};

export function defaultTzLabel(tz: string): { es: string; en: string } {
  if (KNOWN_LABELS[tz]) return KNOWN_LABELS[tz];
  let short = tz;
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    short = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    /* ignore */
  }
  return { es: short, en: short };
}

export function tzLabelFor(s: { tz: string; tzLabel?: { es: string; en: string } }, lang: 'es' | 'en'): string {
  const custom = s.tzLabel?.[lang]?.trim();
  return custom || defaultTzLabel(s.tz)[lang];
}
