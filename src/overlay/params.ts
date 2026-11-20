import { useLayoutEffect } from 'react';
import { useT } from '../i18n';
import type { OverlayLook, Subathon, WindowHours } from '../lib/types';

export const WINDOW_HOURS: readonly WindowHours[] = [12, 24, 48];

export const DEFAULT_LOOK: OverlayLook = { lang: 'es', theme: 'dark', bg: 'glass', pos: 'bottom', hours: 24 };

export const ACCENT = '#a855f7';
export const ACCENT2 = '#ec4899';

export interface OverlayParams {
  uid: string | null;
  /** Rendered inside the admin preview (adds a fake game background). */
  preview: boolean;
  /** Look options from OBS URLs made before the look moved to the subathon document. */
  legacyLook: OverlayLook;
}

export function readParams(search = window.location.search): OverlayParams {
  const q = new URLSearchParams(search);
  const hours = Number(q.get('hours'));
  return {
    uid: q.get('u'),
    preview: q.get('preview') === '1',
    legacyLook: {
      lang: q.get('lang') === 'en' ? 'en' : 'es',
      pos: q.get('pos') === 'top' ? 'top' : 'bottom',
      theme: q.get('theme') === 'light' ? 'light' : 'dark',
      bg: 'glass',
      hours: (WINDOW_HOURS as readonly number[]).includes(hours) ? (hours as WindowHours) : DEFAULT_LOOK.hours,
    },
  };
}

/** The look set in the panel (live), and the page language kept in sync with it. */
export function useOverlayLook(s: Subathon | null, params: OverlayParams): OverlayLook {
  const look = s?.overlay ? { ...DEFAULT_LOOK, ...s.overlay } : params.legacyLook;
  const { lang, setLang } = useT();
  // Before paint, so a language change never flashes the old one.
  useLayoutEffect(() => {
    if (lang !== look.lang) setLang(look.lang);
  }, [lang, look.lang, setLang]);
  return look;
}

/** The two OBS pages. Both read the same public document. */
export type OverlayPage = 'overlay' | 'unlocks';

/** Only identifies the subathon: everything about the look comes live from the panel. */
export function buildOverlayUrl(base: string, uid: string, page: OverlayPage = 'overlay', preview = false): string {
  const q = new URLSearchParams({ u: uid });
  if (preview) q.set('preview', '1');
  return `${base}${page}.html?${q.toString()}`;
}
