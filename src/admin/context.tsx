import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useT } from '../i18n';
import type { Schedule } from '../lib/schedule';
import { apply, type Action } from '../lib/subathon';
import type { Clock, Private, Subathon } from '../lib/types';
import { useToast } from '../ui/toast';

export interface AdminCtx {
  uid: string;
  s: Subathon;
  /** Owner-only: hidden events + timer. */
  priv: Private;
  /** Public state + private timer. */
  clock: Clock;
  now: number;
  schedule: Schedule;
  /** Run an action, then show `message` with Undo. */
  act: (action: Action, message?: string) => Promise<void>;
}

const Ctx = createContext<AdminCtx | null>(null);

export function AdminProvider({ value, children }: { value: Omit<AdminCtx, 'act'>; children: ReactNode }) {
  const toast = useToast();
  const { t } = useT();
  const { uid } = value;
  const act = useCallback<AdminCtx['act']>(
    async (action, message) => {
      try {
        const undo = await apply(uid, action);
        if (message) toast.show(message, { undo });
      } catch (e) {
        toast.show(t('error', { msg: (e as Error).message }), { tone: 'error' });
      }
    },
    [uid, toast, t],
  );
  return <Ctx.Provider value={{ ...value, act }}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin outside AdminProvider');
  return c;
}
