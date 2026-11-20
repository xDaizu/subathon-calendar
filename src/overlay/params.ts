import type { Lang } from '../lib/types';

export const WINDOW_HOURS = [12, 24, 48] as const;
export type WindowHours = (typeof WINDOW_HOURS)[number];

export interface OverlayParams {
  uid: string | null;
  lang: Lang;
  pos: 'top' | 'bottom';
  theme: 'dark' | 'light';
  accent: string;
  accent2: string;
  /** Length of the visible time window. */
  hours: WindowHours;
  /** Rendered inside the admin preview (adds a fake game background). */
  preview: boolean;
}

const HEX = /^#?[0-9a-f]{3,8}$/i;
const hex = (v: string | null, fallback: string) => (v && HEX.test(v) ? (v.startsWith('#') ? v : `#${v}`) : fallback);

export function readParams(search = window.location.search): OverlayParams {
  const q = new URLSearchParams(search);
  return {
    uid: q.get('u'),
    lang: q.get('lang') === 'en' ? 'en' : 'es',
    pos: q.get('pos') === 'top' ? 'top' : 'bottom',
    theme: q.get('theme') === 'light' ? 'light' : 'dark',
    accent: hex(q.get('accent'), '#a855f7'),
    accent2: hex(q.get('accent2'), '#ec4899'),
    hours: (WINDOW_HOURS as readonly number[]).includes(Number(q.get('hours'))) ? (Number(q.get('hours')) as WindowHours) : 24,
    preview: q.get('preview') === '1',
  };
}

export function buildOverlayUrl(
  base: string,
  p: Partial<Omit<OverlayParams, 'preview'>> & { uid: string },
  extra: Record<string, string> = {},
): string {
  const q = new URLSearchParams({ u: p.uid });
  if (p.lang && p.lang !== 'es') q.set('lang', p.lang);
  if (p.pos && p.pos !== 'bottom') q.set('pos', p.pos);
  if (p.theme && p.theme !== 'dark') q.set('theme', p.theme);
  if (p.hours && p.hours !== 24) q.set('hours', String(p.hours));
  if (p.accent && p.accent !== '#a855f7') q.set('accent', p.accent.replace('#', ''));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `${base}overlay.html?${q.toString()}`;
}
