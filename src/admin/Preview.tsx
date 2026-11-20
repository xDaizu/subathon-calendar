import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { buildOverlayUrl } from '../overlay/params';
import { Card, SectionTitle } from '../ui/ui';
import { useAdmin } from './context';
import { appBaseUrl, useOverlayPrefs } from './overlayPrefs';

const W = 1920;
const H = 200;

/** The real overlay page in a scaled iframe: exactly what viewers see. */
export function Preview() {
  const { uid } = useAdmin();
  const { t } = useT();
  const [prefs] = useOverlayPrefs();
  const [open, setOpen] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const src = buildOverlayUrl(appBaseUrl(), { uid, ...prefs }, { preview: '1' });

  return (
    <Card className="p-3 sm:p-4">
      <SectionTitle
        right={
          <button className="text-xs font-semibold text-ink-400" onClick={() => setOpen((v) => !v)}>
            {open ? '▾' : '▸'}
          </button>
        }
      >
        📺 {t('preview')}
      </SectionTitle>
      {open && (
        <>
          <div ref={box} className="relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ height: H * scale }}>
            <iframe
              title={t('preview')}
              src={src}
              className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
              style={{ width: W, height: H, transform: `scale(${scale})` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-400">{t('previewHint')}</p>
        </>
      )}
    </Card>
  );
}
