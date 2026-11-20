import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { signOut } from '../lib/firebase';
import { isEnded, projectSchedule } from '../lib/schedule';
import { apply, migrate, usePrivate } from '../lib/subathon';
import type { Private, Subathon } from '../lib/types';
import { useNow } from '../lib/useNow';
import { Button, Segmented } from '../ui/ui';
import { Loading } from './Loading';
import { AdminProvider } from './context';
import { EventList } from './EventList';
import { EventSheet } from './EventSheet';
import { LiveToggles } from './LiveToggles';
import { Preview } from './Preview';
import { RemainingCard } from './RemainingCard';
import { SettingsSheet } from './SettingsSheet';

export function Dashboard({ uid, s, demo }: { uid: string; s: Subathon; demo: boolean }) {
  const priv = usePrivate(uid);
  // Older documents kept the timer in the public doc: move it to the private one.
  useEffect(() => {
    void migrate(uid).catch(() => {});
  }, [uid]);
  if (!priv) return <Loading />;
  return <Ready uid={uid} s={s} priv={priv} demo={demo} />;
}

function Ready({ uid, s, priv, demo }: { uid: string; s: Subathon; priv: Private; demo: boolean }) {
  const { t, lang, setLang } = useT();
  const now = useNow();
  const clock = useMemo(() => ({ ...s, ...priv.timer }), [s, priv.timer]);
  const schedule = useMemo(() => projectSchedule(clock, now), [clock, now]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // When the timer runs out: stop whatever is live and show "the end" on stream.
  // (Only the panel knows the timer, so this happens while the panel is open.)
  const ended = isEnded(clock, now);
  const liveId = s.events.find((e) => e.status === 'live')?.id;
  const needsEnd = ended && (liveId != null || s.endedAt == null);
  useEffect(() => {
    if (needsEnd) void apply(uid, A.markEnded);
  }, [needsEnd, uid]);

  return (
    <AdminProvider value={{ uid, s, priv, clock, now, schedule }}>
      <div className="mx-auto max-w-6xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32 sm:px-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-xl shadow-lg shadow-accent/30">
              ⏳
            </div>
            <div className="min-w-0">
              <div className="font-display truncate text-lg font-bold leading-tight">{s.title}</div>
              {demo && <div className="text-xs font-semibold text-amber-300">DEMO · localStorage</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Segmented value={lang} onChange={setLang} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} />
            <Button variant="secondary" size="sm" aria-label={t('settings')} onClick={() => setSettingsOpen(true)}>
              ⚙︎
            </Button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            <RemainingCard />
            <LiveToggles />
          </div>
          <div className="flex flex-col gap-4">
            <Preview />
            <EventList onAdd={() => setAddOpen(true)} />
          </div>
        </div>

        {!demo && (
          <div className="mt-8 flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              {t('signOut')}
            </Button>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex justify-end px-5 lg:hidden">
        <Button
          variant="primary"
          size="lg"
          className="pointer-events-auto rounded-full px-6 shadow-2xl"
          onClick={() => setAddOpen(true)}
        >
          ＋ {t('addEvent')}
        </Button>
      </div>

      <EventSheet open={addOpen} onOpenChange={setAddOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AdminProvider>
  );
}
