import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import * as A from '../lib/actions';
import { EVENT_COLORS, EVENT_EMOJIS } from '../lib/colors';
import { HOUR, MIN } from '../lib/schedule';
import { dayChips, dayKey, formatDuration, hhmmToMinutes, minutesToHHMM, zonedTime } from '../lib/time';
import { minutesOfDay } from '../lib/tz';
import type { PlannedEvent } from '../lib/types';
import { Button, Chip, cx, Field, inputCls, Sheet, Switch } from '../ui/ui';
import { useAdmin } from './context';

const DURATIONS = [30 * MIN, HOUR, 90 * MIN, 2 * HOUR, 3 * HOUR, 4 * HOUR];

export interface EditTarget {
  ev: PlannedEvent;
  hidden: boolean;
}

/** Starting values for a new event (e.g. one created from an unlock). */
export interface EventPrefill {
  title: string;
  emoji?: string;
  fromUnlock?: string;
}

export function EventSheet({
  open,
  onOpenChange,
  editing,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: EditTarget | null;
  prefill?: EventPrefill | null;
}) {
  const { s, priv, now, act } = useAdmin();
  const { t, lang } = useT();
  const tz = s.tz;

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState<string | undefined>('🎮');
  const [color, setColor] = useState<string>(EVENT_COLORS[0]);
  const [day, setDay] = useState(dayKey(now, tz));
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(2 * HOUR);
  const [visible, setVisible] = useState(true);

  // Reset form whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const e = editing.ev;
      setTitle(e.title);
      setEmoji(e.emoji);
      setColor(e.color ?? EVENT_COLORS[0]);
      setDay(dayKey(e.startAt, tz));
      setTime(minutesToHHMM(minutesOfDay(e.startAt, tz)));
      setDuration(e.endAt - e.startAt);
      setVisible(!editing.hidden);
    } else {
      // Default: next full hour.
      const nextHour = Math.ceil((Date.now() + 10 * MIN) / HOUR) * HOUR;
      setTitle(prefill?.title ?? '');
      setEmoji(prefill ? prefill.emoji : '🎮');
      setColor(EVENT_COLORS[(s.events.length + priv.events.length) % EVENT_COLORS.length]);
      setDay(dayKey(nextHour, tz));
      setTime(minutesToHHMM(minutesOfDay(nextHour, tz)));
      setDuration(2 * HOUR);
      setVisible(true);
    }
  }, [open, editing, prefill]);

  const chips = useMemo(() => dayChips(now, lang, tz), [now, lang, tz]);
  const recentTitles = useMemo(() => {
    const seen = new Map<string, PlannedEvent>();
    [...s.events, ...priv.events]
      .sort((a, b) => b.startAt - a.startAt)
      .forEach((e) => {
        if (!seen.has(e.title.toLowerCase())) seen.set(e.title.toLowerCase(), e);
      });
    return [...seen.values()].slice(0, 8);
  }, [s.events, priv.events]);

  // An unlock's emoji may not be one of the event emojis: keep it pickable.
  const emojis = emoji && !EVENT_EMOJIS.includes(emoji) ? [emoji, ...EVENT_EMOJIS] : EVENT_EMOJIS;
  const linkedId = editing ? editing.ev.fromUnlock : prefill?.fromUnlock;
  const linkedUnlock = linkedId ? [...(s.unlocks ?? []), ...(priv.unlocks ?? [])].find((u) => u.id === linkedId) : undefined;

  const minutes = hhmmToMinutes(time);
  const valid = title.trim().length > 0 && minutes != null;
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  const save = () => {
    if (!valid || minutes == null) return;
    const startAt = zonedTime(day, minutes, tz);
    const base: PlannedEvent = editing?.ev ?? {
      id: A.newEventId(),
      title: '',
      startAt,
      endAt: startAt,
      status: 'planned',
      ...(prefill?.fromUnlock && { fromUnlock: prefill.fromUnlock }),
    };
    const ev: PlannedEvent = { ...base, title: title.trim(), emoji, color, startAt, endAt: startAt + duration };
    act(A.upsertEvent(ev, !visible), t('toastSaved'));
    onOpenChange(false);
  };

  const close = () => onOpenChange(false);
  const isLiveOrDone = editing && editing.ev.status !== 'planned';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('editEvent') : t('addEvent')}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={save}>
            ✓ {t('save')}
          </Button>
          {editing && (
            <div className="grid grid-cols-3 gap-2">
              {editing.ev.status === 'planned' ? (
                <Button
                  size="sm"
                  onClick={() => {
                    act(A.skipEvent(editing.ev.id), t('toastSkipped', { title: editing.ev.title }));
                    close();
                  }}
                >
                  ⏭ {t('skip')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!isLiveOrDone}
                  onClick={() => {
                    act(A.resetEvent(editing.ev.id), t('toastSaved'));
                    close();
                  }}
                >
                  ↺ {t('reset')}
                </Button>
              )}
              <div />
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  act(A.deleteEvent(editing.ev.id), t('toastDeleted'));
                  close();
                }}
              >
                🗑 {t('delete')}
              </Button>
            </div>
          )}
        </div>
      }
    >
      {linkedUnlock && (
        <div className="mb-4 rounded-xl bg-accent/10 px-3 py-2 text-sm text-violet-200 ring-1 ring-accent/20">
          🔓 {t('fromUnlock', { title: `${linkedUnlock.emoji ?? '🎁'} ${linkedUnlock.title}` })}
        </div>
      )}
      <Field label={t('eventTitle')}>
        <input
          className={inputCls}
          placeholder={t('eventTitlePh')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
      {!editing && !prefill && recentTitles.length > 0 && (
        <div className="-mt-2 mb-4 flex gap-2 overflow-x-auto pb-1">
          {recentTitles.map((r) => (
            <Chip
              key={r.id}
              className="h-8 text-xs"
              onClick={() => {
                setTitle(r.title);
                if (r.emoji) setEmoji(r.emoji);
                if (r.color) setColor(r.color);
                setDuration(r.endAt - r.startAt);
              }}
            >
              {r.emoji} {r.title}
            </Chip>
          ))}
        </div>
      )}

      <Field label={t('day')}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chips.map((c) => (
            <Chip key={c.key} active={c.key === day} onClick={() => setDay(c.key)}>
              {c.label}
            </Chip>
          ))}
          {!chips.some((c) => c.key === day) && <Chip active>{day}</Chip>}
        </div>
      </Field>

      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label={t('startTime')}>
          <input type="time" className={`${inputCls} font-display tabular text-lg`} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label={t('duration')}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {durations.map((d) => (
              <Chip key={d} active={d === duration} onClick={() => setDuration(d)}>
                {formatDuration(d, lang, { seconds: false })}
              </Chip>
            ))}
          </div>
        </Field>
      </div>

      <Field label={t('emoji')}>
        <div className="flex flex-wrap gap-1.5">
          {emojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cx(
                'flex h-10 w-10 items-center justify-center rounded-xl text-xl transition active:scale-90',
                e === emoji ? 'bg-ink-600 ring-2 ring-accent' : 'bg-ink-800 hover:bg-ink-700',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('color')}>
        <div className="flex flex-wrap gap-2">
          {EVENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cx('h-9 w-9 rounded-full transition active:scale-90', c === color && 'ring-2 ring-white ring-offset-2 ring-offset-ink-850')}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink-800 p-4 ring-1 ring-white/5">
        <div>
          <div className="font-semibold">
            {visible ? '👁' : '🙈'} {t('showOnStream')}
          </div>
          <div className="text-xs text-ink-400">{t('showOnStreamHint')}</div>
        </div>
        <Switch checked={visible} onChange={setVisible} label={t('showOnStream')} />
      </div>
    </Sheet>
  );
}
