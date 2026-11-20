import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { callouts as computeCallouts, DAY, projectRests, restDisplayState } from '../lib/schedule';
import { makeScale, timeWindow } from '../lib/timelineScale';
import { useSubathon } from '../lib/subathon';
import { useNow } from '../lib/useNow';
import { Callouts } from './Callouts';
import { ACCENT, ACCENT2, useOverlayLook, type OverlayParams } from './params';
import { Timeline } from './Timeline';
import { EndedWidget, RestWidget } from './Widgets';

const spring = { type: 'spring', stiffness: 260, damping: 30 } as const;

export function Overlay({ params }: { params: OverlayParams }) {
  const { data: s } = useSubathon(params.uid);
  const now = useNow();
  const look = useOverlayLook(s, params);

  const view = useMemo(() => {
    if (!s) return null;
    // The overlay never knows the end: only the public rest plan within a time window.
    const win = timeWindow(now, s.startAt, look.hours, s.tz);
    const plan = projectRests(s, now, Math.max(win.end, now + 2 * DAY));
    return {
      plan,
      scale: makeScale(win.start, win.end),
      rest: restDisplayState(s, now),
      callouts: computeCallouts(s, plan, now),
    };
  }, [s, now, look.hours]);

  const top = look.pos === 'top';

  return (
    <div
      className={`ov relative flex h-screen w-screen flex-col px-[1.5rem] py-[0.75rem] ${top ? 'justify-start' : 'justify-end'} ${
        params.preview ? 'preview-bg' : ''
      }`}
      data-theme={look.theme}
      data-bg={look.bg}
      style={{ ['--accent' as string]: ACCENT, ['--accent2' as string]: ACCENT2 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!s || !view ? null : s.endedAt != null ? (
          <motion.div
            key="ended"
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring}
          >
            <EndedWidget />
          </motion.div>
        ) : view.rest.state !== 'awake' ? (
          <motion.div
            key="rest"
            className="flex justify-center"
            initial={{ opacity: 0, scaleX: 0.4, y: top ? -20 : 20 }}
            animate={{ opacity: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, scaleX: 0.4 }}
            transition={spring}
          >
            <RestWidget s={s} rest={view.rest} now={now} />
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            className={`mx-auto flex w-full max-w-[66rem] gap-[0.6rem] ${top ? 'flex-col-reverse' : 'flex-col'}`}
            initial={{ opacity: 0, scaleX: 0.6 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.6 }}
            transition={spring}
          >
            <div className="flex min-h-[2.95rem] items-end">
              <Callouts items={view.callouts} now={now} />
            </div>
            <Timeline s={s} plan={view.plan} scale={view.scale} now={now} lang={look.lang} callouts={view.callouts} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
