import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../lib/types';
import { en } from './en';
import { es, type MessageKey } from './es';

const DICTS = { es, en } as const;

export type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? es[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = 'subathon.lang';

export function initialAdminLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  // Spanish first: English only when explicitly chosen.
  return 'es';
}

export function I18nProvider({ initial, persist, children }: { initial: Lang; persist?: boolean; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      if (persist) {
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          /* ignore */
        }
      }
      document.documentElement.lang = l;
    },
    [persist],
  );
  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useT outside I18nProvider');
  return c;
}
