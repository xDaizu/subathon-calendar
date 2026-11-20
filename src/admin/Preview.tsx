import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { buildOverlayUrl, type OverlayPage } from '../overlay/params';
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
