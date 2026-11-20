import { describe, expect, it } from 'vitest';
import { dayChips, formatDateTime, formatDuration, formatIn, parseDuration } from './time';
import { makeScale, place, timeWindow } from './timelineScale';
import { zonedTime } from './tz';

const H = 3_600_000;
const M = 60_000;

describe('formatDuration', () => {
  it('es', () => {
    expect(formatDuration(2 * 24 * H + 4 * H + 13 * M, 'es')).toBe('2 d 4 h 13 min');
    expect(formatDuration(2 * 24 * H + 13 * M, 'es')).toBe('2 d 13 min');
    expect(formatDuration(12 * M + 5000, 'es')).toBe('12 min 5 s');
    expect(formatDuration(12 * M + 5000, 'es', { seconds: false })).toBe('12 min');
    expect(formatDuration(0, 'es')).toBe('0 s');
    expect(formatIn(2 * H + 13 * M, 'es')).toBe('en 2 h 13 min');
  });
  it('en', () => {
    expect(formatDuration(2 * 24 * H + 4 * H + 13 * M, 'en')).toBe('2d 4h 13m');
    expect(formatIn(2 * H + 13 * M, 'en')).toBe('in 2h 13m');
  });
});

describe('parseDuration', () => {
  it.each([
    ['12h 25m', 12 * H + 25 * M],
    ['12h25', 12 * H + 25 * M],
    ['12h 25', 12 * H + 25 * M],
    ['1d 3h', 27 * H],
    ['90m', 90 * M],
    ['45 min', 45 * M],
    ['2d', 48 * H],
    ['2 días', 48 * H],
    ['12:25', 12 * H + 25 * M],
    ['12:25:30', 12 * H + 25 * M + 30_000],
    ['1d 3:20', 27 * H + 20 * M],
    ['90', 90 * M],
    ['1.5h', 1.5 * H],
  ])('%s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
  it.each(['', 'abc', '12:75', 'hola 3h'])('rejects %s', (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe('formatDateTime', () => {
  const ts = zonedTime('2026-11-22', 22 * 60, 'Europe/Madrid');
  it('es', () => expect(formatDateTime(ts, 'es', 'Europe/Madrid')).toBe('dom 22 nov · 22:00'));
  it('en', () => expect(formatDateTime(ts, 'en', 'Europe/Madrid')).toBe('Sun 22 Nov · 22:00'));
  it('respects tz', () => expect(formatDateTime(ts, 'es', 'America/Mexico_City')).toBe('dom 22 nov · 15:00'));
});

describe('dayChips', () => {
  it('starts with Hoy / Mañana', () => {
    const chips = dayChips(zonedTime('2026-11-20', 12 * 60, 'Europe/Madrid'), 'es', 'Europe/Madrid');
    expect(chips.slice(0, 3).map((c) => c.label)).toEqual(['Hoy', 'Mañana', 'Dom 22']);
    expect(chips[0].key).toBe('2026-11-20');
  });
});

describe('scale', () => {
  it('linear maps start→0, end→1', () => {
    const s = makeScale(0, 100);
    expect(s.x(0)).toBe(0);
    expect(s.x(50)).toBe(0.5);
    expect(s.x(200)).toBe(1);
  });
  it('the overlay window moves in local quarter steps and never depends on the end', () => {
    const tz = 'Europe/Madrid';
    const at = (h: number, m = 0) => zonedTime('2026-11-20', h * 60 + m, tz);
    const H = 3_600_000;
    // 24h window → 6h steps at 00/06/12/18 local; NOW sits between 1/8 and 3/8.
    expect(timeWindow(at(13, 30), at(0), 24, tz)).toEqual({ start: at(9), end: at(9) + 24 * H });
    expect(timeWindow(at(17, 59), at(0), 24, tz).start).toBe(at(9));
    expect(timeWindow(at(18), at(0), 24, tz).start).toBe(at(15));
    // Shortly after the start: anchored to the start.
    expect(timeWindow(at(13, 30), at(12), 24, tz).start).toBe(at(12));
    // Before the start: normal window.
    expect(timeWindow(at(13, 30), at(20), 24, tz).start).toBe(at(9));
  });
  it('enforces a minimum width and stays in bounds', () => {
    const s = makeScale(0, 1000);
    expect(place({ startAt: 999, endAt: 1000 }, s, 0.05)).toEqual({ left: 0.95, width: 0.05 });
  });
});
