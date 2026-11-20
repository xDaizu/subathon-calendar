import { useEffect, useState } from 'react';
import type { WindowHours } from '../overlay/params';
import type { Lang } from '../lib/types';

export interface OverlayPrefs {
  lang: Lang;
  pos: 'top' | 'bottom';
  theme: 'dark' | 'light';
  hours: WindowHours;
}

const KEY = 'subathon.overlayPrefs';
const DEFAULTS: OverlayPrefs = { lang: 'es', pos: 'bottom', theme: 'dark', hours: 24 };

let listeners: ((p: OverlayPrefs) => void)[] = [];

function read(): OverlayPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

/** Overlay URL options (stored locally; they're part of the OBS URL, not the subathon). */
export function useOverlayPrefs(): [OverlayPrefs, (patch: Partial<OverlayPrefs>) => void] {
  const [prefs, setPrefs] = useState(read);
  useEffect(() => {
    listeners.push(setPrefs);
    return () => {
      listeners = listeners.filter((l) => l !== setPrefs);
    };
  }, []);
  const update = (patch: Partial<OverlayPrefs>) => {
    const next = { ...read(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l(next));
  };
  return [prefs, update];
}

export function appBaseUrl(): string {
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/[^/]*$/, '');
}
