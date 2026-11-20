import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` (aligned to the next whole second). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), intervalMs);
    }, 1000 - (Date.now() % 1000));
    return () => {
      clearTimeout(align);
      if (id) clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
