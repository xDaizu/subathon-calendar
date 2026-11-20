import { useState } from 'react';

/** A tab choice remembered on this device. */
export function useStoredTab<T extends string>(key: string, values: readonly T[], fallback: T): [T, (v: T) => void] {
  const [tab, setTabState] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key);
      return values.includes(v as T) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const setTab = (v: T) => {
    setTabState(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [tab, setTab];
}
