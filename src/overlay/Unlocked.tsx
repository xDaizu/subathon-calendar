import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { useT } from '../i18n';
import { useSubathon } from '../lib/subathon';
import { sizeOf, unlockedNewestFirst } from '../lib/unlocks';
import { ACCENT, ACCENT2, useOverlayLook, type OverlayParams } from './params';
import { Count, Row } from './Unlocks';

/** Page for viewers: every unlock already reached, newest first, with the live sub count. */
export function UnlockedPage({ params }: { params: OverlayParams }) {
  const { data: s, loading } = useSubathon(params.uid);
  const look = useOverlayLook(s, params);
  const { t } = useT();
  const unlocked = useMemo(() => unlockedNewestFirst(s?.unlocks, s?.subs ?? 0), [s?.unlocks, s?.subs]);

  useEffect(() => {
    document.title = s ? `${s.title} · ${t('unlockedTitle')}` : t('unlockedTitle');
  }, [s?.title, t]);

  return (
    <div
      className="ov share-page min-h-dvh px-4 py-6 sm:py-10"
      data-theme={look.theme}
      style={{ ['--accent' as string]: ACCENT, ['--accent2' as string]: ACCENT2 }}
    >
      <div className="mx-auto w-full max-w-[32rem]">
        {s ? (
          <motion.div
            className="glass rounded-[1.4rem] p-[0.8rem]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <header className="flex items-center justify-between gap-[0.6rem] px-[0.35rem] pb-[0.6rem]">
              <h1 className="text-dim text-[0.85rem] font-bold uppercase tracking-[0.2em]">🔓 {t('unlockedTitle')}</h1>
              <div className="flex items-baseline gap-[0.35rem]">
                <span className="font-display tabular accent-text text-[1.7rem] font-bold leading-none">
                  <Count value={s.subs ?? 0} />
                </span>
                <span className="text-dim text-[0.85rem] font-semibold">{t('subsUnit')}</span>
              </div>
            </header>
            {unlocked.length > 0 ? (
              <ul className="flex flex-col gap-[0.45rem]">
                <AnimatePresence initial={false}>
                  {unlocked.map((u, i) => (
                    <motion.li
                      key={u.id}
                      layout
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                    >
                      <Row u={u} size={sizeOf(u, s)} state={i === 0 ? 'latest' : 'unlocked'} progress={0} left={0} wrap />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="text-dim flex flex-col items-center gap-[0.5rem] px-4 py-[2.2rem] text-center text-[0.95rem] font-semibold">
                <span className="text-[2rem]">🔒</span>
                {t('noneUnlockedYet')}
              </div>
            )}
          </motion.div>
        ) : loading ? (
          <div className="flex justify-center py-16" aria-busy="true">
            <div className="share-spinner h-8 w-8 rounded-full" />
          </div>
        ) : (
          <div className="text-dim py-16 text-center font-semibold">{t('subathonNotFound')}</div>
        )}
      </div>
    </div>
  );
}
