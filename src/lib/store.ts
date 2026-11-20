/**
 * Storage backends. Firestore for real use; a localStorage "demo" store (uid = "demo")
 * for trying the app without Firebase. Demo data syncs between tabs of the same browser only.
 *
 * Documents:
 * - `subathons/{uid}`: public (the overlay reads it). Never contains the timer.
 * - `subathons/{uid}/private/drafts`: owner-only. Hidden events + the timer.
 */
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { getDb } from './firebase';
import type { FullState, Private, Subathon, Timer } from './types';

export const DEMO_UID = 'demo';

type Unsub = () => void;

export interface Store {
  watchPublic(uid: string, cb: (s: Subathon | null) => void, onError: (e: Error) => void): Unsub;
  /** Emits null while the private doc isn't usable yet (e.g. before migration). */
  watchPrivate(uid: string, cb: (p: Private | null) => void, onError: (e: Error) => void): Unsub;
  /** Runs `fn` atomically against the current state. Returns the previous state (for Undo). */
  transact(uid: string, fn: (st: FullState | null) => FullState): Promise<FullState | null>;
}

// ───────────── Normalisation (older versions kept the timer in the public doc) ─────────────

type RawPub = Subathon & Partial<Timer>;
type RawPriv = Partial<Private>;

function cleanPub(raw: RawPub): { pub: Subathon; legacyTimer?: Timer } {
  const { remainingMs, remainingSetAt, ...pub } = raw;
  const legacyTimer = remainingMs != null ? { remainingMs, remainingSetAt: remainingSetAt ?? Date.now() } : undefined;
  return { pub, legacyTimer };
}

function cleanPriv(raw: RawPriv | undefined, legacyTimer?: Timer): Private | null {
  const timer = raw?.timer ?? legacyTimer;
  return timer ? { ...raw, events: raw?.events ?? [], timer } : null;
}

/** Full state + whether it must be rewritten to drop legacy fields. */
function normalize(rawPub: RawPub, rawPriv: RawPriv | undefined): { st: FullState; migrate: boolean } {
  const { pub, legacyTimer } = cleanPub(rawPub);
  const priv = cleanPriv(rawPriv, legacyTimer) ?? { events: rawPriv?.events ?? [], timer: { remainingMs: 0, remainingSetAt: Date.now() } };
  return { st: { pub, priv }, migrate: legacyTimer != null || !rawPriv?.timer };
}

function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ───────────── Firestore ─────────────

const firestoreStore: Store = {
  watchPublic(uid, cb, onError) {
    return onSnapshot(
      doc(getDb(), 'subathons', uid),
      (snap) => cb(snap.exists() ? cleanPub(snap.data() as RawPub).pub : null),
      onError,
    );
  },
  watchPrivate(uid, cb, onError) {
    return onSnapshot(
      doc(getDb(), 'subathons', uid, 'private', 'drafts'),
      (snap) => cb(cleanPriv(snap.exists() ? (snap.data() as RawPriv) : undefined)),
      onError,
    );
  },
  async transact(uid, fn) {
    const db = getDb();
    const pubRef = doc(db, 'subathons', uid);
    const privRef = doc(db, 'subathons', uid, 'private', 'drafts');
    return runTransaction(db, async (tx) => {
      const [p, d] = await Promise.all([tx.get(pubRef), tx.get(privRef)]);
      const cur = p.exists() ? normalize(p.data() as RawPub, d.exists() ? (d.data() as RawPriv) : undefined) : null;
      const prev = cur?.st ?? null;
      const next = fn(prev);
      const force = !prev || cur!.migrate;
      if (force || next.pub !== prev!.pub) tx.set(pubRef, stripUndefined(next.pub));
      if (force || next.priv !== prev!.priv) tx.set(privRef, stripUndefined(next.priv));
      return prev;
    });
  },
};

// ───────────── Demo (localStorage) ─────────────

const K_PUB = 'subathon.demo.pub';
const K_PRIV = 'subathon.demo.drafts';
const localListeners = new Set<() => void>();

function readLocal(): FullState | null {
  try {
    const p = localStorage.getItem(K_PUB);
    if (!p) return null;
    const d = localStorage.getItem(K_PRIV);
    return normalize(JSON.parse(p), d ? JSON.parse(d) : undefined).st;
  } catch {
    return null;
  }
}

function subscribeLocal(fn: () => void): Unsub {
  const onStorage = (e: StorageEvent) => {
    if (e.key === K_PUB || e.key === K_PRIV) fn();
  };
  window.addEventListener('storage', onStorage);
  localListeners.add(fn);
  return () => {
    window.removeEventListener('storage', onStorage);
    localListeners.delete(fn);
  };
}

const demoStore: Store = {
  watchPublic(_uid, cb) {
    const emit = () => cb(readLocal()?.pub ?? null);
    emit();
    return subscribeLocal(emit);
  },
  watchPrivate(_uid, cb) {
    const emit = () => cb(readLocal()?.priv ?? null);
    emit();
    return subscribeLocal(emit);
  },
  async transact(_uid, fn) {
    const prev = readLocal();
    const next = stripUndefined(fn(prev));
    localStorage.setItem(K_PUB, JSON.stringify(next.pub));
    localStorage.setItem(K_PRIV, JSON.stringify(next.priv));
    localListeners.forEach((l) => l());
    return prev;
  },
};

/** The demo store only exists in local development, never on the published site. */
export const demoEnabled = import.meta.env.DEV;

export function storeFor(uid: string): Store {
  return demoEnabled && uid === DEMO_UID ? demoStore : firestoreStore;
}
