import * as A from '../lib/actions';
import type { OverlayLook } from '../lib/types';
import { DEFAULT_LOOK } from '../overlay/params';
import { useAdmin } from './context';

/** Where the panel kept the look when it was part of the OBS URL (seeds documents without one). */
const LEGACY_KEY = 'subathon.overlayPrefs';

function legacyLook(): OverlayLook {
  try {
    return { ...DEFAULT_LOOK, ...JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}') };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** Overlay look, saved in the subathon: the OBS pages (and the preview) change right away. */
export function useOverlayLookSetting(): [OverlayLook, (patch: Partial<OverlayLook>) => void] {
  const { s, act } = useAdmin();
  const look = s.overlay ? { ...DEFAULT_LOOK, ...s.overlay } : legacyLook();
  return [look, (patch) => void act(A.setOverlayLook({ ...look, ...patch }))];
}

export function appBaseUrl(): string {
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/[^/]*$/, '');
}
