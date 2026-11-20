import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { buildOverlayUrl, type OverlayPage } from '../overlay/params';
import { cx } from '../ui/ui';
import { useAdmin } from './context';
import { appBaseUrl } from './overlayPrefs';

/** Browser-source size each overlay page is designed for. */
export const OVERLAY_SIZE: Record<OverlayPage, { w: number; h: number }> = {
  overlay: { w: 1920, h: 200 },
  unlocks: { w: 500, h: 600 },
};

/** The real overlay page in a scaled iframe: exactly what viewers see. */
export function OverlayFrame({ page, className }: { page: OverlayPage; className?: string }) {
  const { uid } = useAdmin();
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const { w, h } = OVERLAY_SIZE[page];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const src = buildOverlayUrl(appBaseUrl(), uid, page, true);

  return (
    <div ref={box} className={`relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10 ${className ?? ''}`} style={{ height: h * scale }}>
      <iframe
        title={t('preview')}
        src={src}
        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      />
    </div>
  );
}

const toggleCls = 'text-xs font-bold uppercase tracking-[0.14em] transition';

/** Preview header: collapsible preview, plus a Customize accordion that opens below it. */
export function PreviewSection({
  page,
  frameClassName,
  showFrame = true,
  customize,
}: {
  page: OverlayPage;
  frameClassName?: string;
  showFrame?: boolean;
  customize: ReactNode;
}) {
  const { t } = useT();
  const [previewOpen, setPreviewOpen] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        {showFrame ? (
          <button className={cx(toggleCls, 'text-ink-400')} aria-expanded={previewOpen} onClick={() => setPreviewOpen((v) => !v)}>
            {previewOpen ? '▾' : '▸'} 📺 {t('previewShort')}
          </button>
        ) : (
          <span />
        )}
        <button
          className={cx(toggleCls, customizeOpen ? 'text-accent' : 'text-ink-400 hover:text-ink-200')}
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((v) => !v)}
        >
          🎨 {t('customize')} {customizeOpen ? '▾' : '▸'}
        </button>
      </div>
      {showFrame && previewOpen && <OverlayFrame page={page} className={frameClassName} />}
      <AnimatePresence initial={false}>
        {customizeOpen && (
          <motion.div
            key="customize"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className={showFrame && previewOpen ? 'pt-3' : ''}>{customize}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
