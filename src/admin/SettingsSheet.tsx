import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { formatDuration, hhmmToMinutes, minutesToHHMM } from '../lib/time';
import { defaultTzLabel } from '../lib/tz';
import { buildOverlayUrl } from '../overlay/params';
import { Button, Chip, Field, inputCls, Sheet } from '../ui/ui';
import { useAdmin } from './context';
import { appBaseUrl } from './overlayPrefs';

const REST_DURATIONS = [0, 4, 5, 6, 7, 8, 9, 10].map((h) => h * 60);

const COMMON_TZ = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Caracas',
  'America/Montevideo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
];

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { s, uid, act } = useAdmin();
  const { t, lang } = useT();

  const [title, setTitle] = useState(s.title);
  const [start, setStart] = useState('');
  const [restAt, setRestAt] = useState('03:00');
  const [restDur, setRestDur] = useState(480);
  const [tz, setTz] = useState(s.tz);
  const [labelEs, setLabelEs] = useState('');
  const [labelEn, setLabelEn] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(s.title);
    setStart(formatInTimeZone(s.startAt, s.tz, "yyyy-MM-dd'T'HH:mm"));
    setRestAt(minutesToHHMM(s.restStandard.startMinutes));
    setRestDur(s.restStandard.durationMin);
    setTz(s.tz);
    setLabelEs(s.tzLabel?.es ?? defaultTzLabel(s.tz).es);
    setLabelEn(s.tzLabel?.en ?? defaultTzLabel(s.tz).en);
  }, [open]);

  const tzOptions = COMMON_TZ.includes(s.tz) ? COMMON_TZ : [s.tz, ...COMMON_TZ];

  const save = () => {
    const startAt = start ? fromZonedTime(start, tz).getTime() : s.startAt;
    const restMin = hhmmToMinutes(restAt) ?? s.restStandard.startMinutes;
    act(
      A.updateSettings({
        title: title.trim() || s.title,
        startAt,
        restStandard: { startMinutes: restMin, durationMin: restDur },
        tz,
        tzLabel: { es: labelEs.trim(), en: labelEn.trim() },
      }),
      t('toastSaved'),
    );
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings')}
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          ✓ {t('save')}
        </Button>
      }
    >
      {/* OBS URLs first: it's what people come here for. */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-accent/15 to-accent-2/10 p-4 ring-1 ring-accent/25">
        <div className="mb-1 text-sm font-bold">📺 {t('obsUrl')}</div>
        <div className="mb-3 text-xs text-ink-300">{t('obsUrlsHint')}</div>
        <ObsUrl label={t('obsTimeline')} size="1920 × 200" url={buildOverlayUrl(appBaseUrl(), uid)} />
        <ObsUrl label={t('obsUnlocks')} size={t('obsUnlocksSize')} url={buildOverlayUrl(appBaseUrl(), uid, 'unlocks')} />
      </div>

      <div className="mb-5 rounded-2xl bg-ink-800/70 p-4 ring-1 ring-white/5">
        <div className="mb-1 text-sm font-bold">{t('shareUrl')}</div>
        <div className="text-xs text-ink-300">{t('shareUrlHint')}</div>
        <ObsUrl label={`🔓 ${t('unlockedTitle')}`} url={buildOverlayUrl(appBaseUrl(), uid, 'unlocked')} />
      </div>

      <Field label={t('title')}>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label={t('startDate')}>
        <div className="flex gap-2">
          <input type="datetime-local" className={`${inputCls} tabular`} value={start} onChange={(e) => setStart(e.target.value)} />
          <Chip onClick={() => setStart(formatInTimeZone(Date.now(), tz, "yyyy-MM-dd'T'HH:mm"))} className="h-12">
            {t('startNow')}
          </Chip>
        </div>
      </Field>

      <div className="mb-4 rounded-2xl bg-ink-800/70 p-4 ring-1 ring-white/5">
        <div className="mb-1 font-semibold">🌙 {t('restStandard')}</div>
        <div className="mb-3 text-xs text-ink-400">{t('restStandardHint')}</div>
        <Field label={t('restStartsAt')}>
          <input type="time" className={`${inputCls} font-display tabular w-36 text-lg`} value={restAt} onChange={(e) => setRestAt(e.target.value)} />
        </Field>
        <Field label={t('restDuration')}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {REST_DURATIONS.map((d) => (
              <Chip key={d} active={d === restDur} onClick={() => setRestDur(d)}>
                {d === 0 ? '—' : formatDuration(d * 60_000, lang, { seconds: false })}
              </Chip>
            ))}
          </div>
        </Field>
      </div>

      <Field label={t('timezone')}>
        <select
          className={inputCls}
          value={tz}
          onChange={(e) => {
            setTz(e.target.value);
            const d = defaultTzLabel(e.target.value);
            setLabelEs(d.es);
            setLabelEn(d.en);
          }}
        >
          {tzOptions.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('tzLabel')} hint={t('tzLabelHint')}>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} value={labelEs} onChange={(e) => setLabelEs(e.target.value)} placeholder="ES" />
          <input className={inputCls} value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="EN" />
        </div>
      </Field>
      <p className="text-xs text-ink-600">uid: {uid}</p>
    </Sheet>
  );
}

function ObsUrl({ label, size, url }: { label: string; size?: string; url: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="mt-3 rounded-xl bg-ink-950/40 p-3 ring-1 ring-white/5">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-ink-100">{label}</span>
        {size && <span className="tabular text-ink-400">{size}</span>}
      </div>
      <div className="mb-2 break-all rounded-lg bg-ink-950/60 p-2 font-mono text-[0.7rem] text-ink-300">{url}</div>
      <Button variant="primary" size="sm" className="w-full" onClick={copy}>
        {copied ? `✓ ${t('copied')}` : `⧉ ${t('copy')}`}
      </Button>
    </div>
  );
}
