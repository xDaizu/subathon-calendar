import { useEffect, useState } from 'react';
import { storeFor } from './store';
import type { FullState, Private, Subathon, Timer } from './types';

export interface Live<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useSubathon(uid: string | null): Live<Subathon> {
  const [state, setState] = useState<Live<Subathon>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!uid) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      return storeFor(uid).watchPublic(
        uid,
        (data) => setState({ data, loading: false, error: null }),
        (error) => setState({ data: null, loading: false, error }),
      );
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [uid]);
  return state;
}

/** Owner-only state (hidden events + timer). null while loading. */
export function usePrivate(uid: string | null): Private | null {
  const [priv, setPriv] = useState<Private | null>(null);
  useEffect(() => {
    setPriv(null);
    if (!uid) return;
    try {
      return storeFor(uid).watchPrivate(uid, setPriv, () => setPriv(null));
    } catch {
      setPriv(null);
    }
  }, [uid]);
  return priv;
}

export type Access = 'checking' | 'ok' | 'denied';

/**
 * Whether the signed-in account may use the panel: only owners can read their private doc
 * (Firestore rules), so a permission error means "not an owner".
 */
export function useAccess(uid: string): Access {
  const [access, setAccess] = useState<Access>('checking');
  useEffect(() => {
    setAccess('checking');
    try {
      return storeFor(uid).watchPrivate(
        uid,
        () => setAccess('ok'),
        (e) => setAccess((e as { code?: string }).code === 'permission-denied' ? 'denied' : 'ok'),
      );
    } catch {
      setAccess('ok');
    }
  }, [uid]);
  return access;
}

export type Action = (st: FullState, now: number) => FullState;

/** Applies an action atomically. Resolves with an undo function. */
export async function apply(uid: string, action: Action): Promise<() => Promise<void>> {
  const store = storeFor(uid);
  const prev = await store.transact(uid, (st) => {
    if (!st) throw new Error('Subathon not found');
    return action(st, Date.now());
  });
  return async () => {
    if (prev) await store.transact(uid, () => prev);
  };
}

export async function create(uid: string, pub: Subathon, timer: Timer): Promise<void> {
  await storeFor(uid).transact(uid, (st) => st ?? { pub, priv: { events: [], timer } });
}

/** Rewrites old documents (timer in the public doc) into the current layout. No-op otherwise. */
export async function migrate(uid: string): Promise<void> {
  await storeFor(uid).transact(uid, (st) => {
    if (!st) throw new Error('Subathon not found');
    return st;
  });
}
