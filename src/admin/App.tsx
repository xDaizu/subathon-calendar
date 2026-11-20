import type { User } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { firebaseConfigured, signIn, signOut, watchUser } from '../lib/firebase';
import { DEMO_UID, demoEnabled } from '../lib/store';
import { create, useAccess, useSubathon } from '../lib/subathon';
import { formatDuration, parseDuration } from '../lib/time';
import { browserTz, defaultTzLabel } from '../lib/tz';
import { Button, Card, Field, inputCls, Segmented } from '../ui/ui';
import { ToastProvider } from '../ui/toast';
import { Dashboard } from './Dashboard';
import { Loading } from './Loading';

const isDemo = demoEnabled && new URLSearchParams(window.location.search).get('demo') === '1';

export function App() {
  const { t } = useT();
  return (
    <ToastProvider undoLabel={t('undo')}>
      {isDemo ? <Gate uid={DEMO_UID} /> : firebaseConfigured ? <AuthGate /> : <ConfigMissing />}
    </ToastProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">{children}</div>;
}

function Brand() {
  const { t, lang, setLang } = useT();
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl shadow-lg shadow-accent/30">
          ⏳
        </div>
        <div className="font-display text-xl font-bold">{t('appName')}</div>
      </div>
      <Segmented value={lang} onChange={setLang} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} />
    </div>
  );
}

function ConfigMissing() {
  const { t } = useT();
  return (
    <Shell>
      <Brand />
      <Card>
        <h1 className="font-display mb-2 text-xl font-bold">{t('configMissingTitle')}</h1>
        <p className="mb-4 text-sm text-ink-300">{t('configMissingBody')}</p>
        {demoEnabled && (
          <Button variant="primary" className="w-full" onClick={() => (window.location.search = '?demo=1')}>
            ▶ Demo
          </Button>
        )}
      </Card>
    </Shell>
  );
}

function AuthGate() {
  const { t } = useT();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => watchUser(setUser), []);

  if (user === undefined) return <Loading />;
  if (!user)
    return (
      <Shell>
        <Brand />
        <Card>
          <p className="mb-4 text-sm text-ink-300">{t('signInHint')}</p>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => signIn().catch((e: Error) => setErr(e.message))}
          >
            <GoogleIcon /> {t('signIn')}
          </Button>
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        </Card>
      </Shell>
    );
  return <OwnerGate uid={user.uid} email={user.email} />;
}

/** Only owner accounts (see firestore.rules) get past this. */
function OwnerGate({ uid, email }: { uid: string; email: string | null }) {
  const { t } = useT();
  const access = useAccess(uid);
  if (access === 'checking') return <Loading />;
  if (access === 'denied')
    return (
      <Shell>
        <Brand />
        <Card>
          <h1 className="font-display mb-2 text-xl font-bold">🔒 {t('noAccessTitle')}</h1>
          <p className="mb-1 text-sm text-ink-300">{t('noAccessBody')}</p>
          {email && <p className="mb-4 text-sm font-semibold text-ink-100">{email}</p>}
          <Button variant="secondary" className="w-full" onClick={() => signOut()}>
            {t('signOut')}
          </Button>
        </Card>
      </Shell>
    );
  return <Gate uid={uid} />;
}

function Gate({ uid }: { uid: string }) {
  const { data, loading, error } = useSubathon(uid);
  if (loading) return <Loading />;
  if (error)
    return (
      <Shell>
        <Card>
          <p className="text-red-300">{error.message}</p>
        </Card>
      </Shell>
    );
  if (!data) return <Setup uid={uid} />;
  return <Dashboard uid={uid} s={data} demo={uid === DEMO_UID} />;
}

function Setup({ uid }: { uid: string }) {
  const { t, lang } = useT();
  const [title, setTitle] = useState(t('defaultTitle'));
  const [remaining, setRemaining] = useState('24h');
  const parsed = parseDuration(remaining);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (parsed == null) return;
    setBusy(true);
    const now = Date.now();
    const tz = browserTz();
    await create(uid, {
      title: title.trim() || t('defaultTitle'),
      startAt: now,
      restStandard: { startMinutes: 3 * 60, durationMin: 8 * 60 },
      tz,
      tzLabel: defaultTzLabel(tz),
      rest: { active: false },
      restLog: [],
      events: [],
      updatedAt: now,
    }, { remainingMs: parsed, remainingSetAt: now });
    setBusy(false);
  }

  return (
    <Shell>
      <Brand />
      <Card>
        <h1 className="font-display mb-1 text-2xl font-bold">{t('setupTitle')}</h1>
        <p className="mb-5 text-sm text-ink-300">{t('setupBody')}</p>
        <Field label={t('title')}>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t('overrideTitle')} hint={t('overrideHint')}>
          <input
            className={`${inputCls} font-display tabular text-2xl`}
            value={remaining}
            inputMode="text"
            onChange={(e) => setRemaining(e.target.value)}
          />
        </Field>
        <Button variant="primary" size="lg" className="w-full" disabled={parsed == null || busy} onClick={submit}>
          {t('setupCreate')} →
        </Button>
        <p className="mt-3 text-center text-sm text-ink-400">{parsed != null ? formatDuration(parsed, lang) : remaining ? t('overrideInvalid') : ''}</p>
      </Card>
    </Shell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.11z" />
    </svg>
  );
}
