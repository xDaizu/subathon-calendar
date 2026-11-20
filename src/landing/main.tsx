import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, initialAdminLang, useT } from '../i18n';
import '../admin/admin.css';
import { Button, Segmented } from '../ui/ui';

function Landing() {
  const { t, lang, setLang } = useT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-3xl shadow-lg shadow-accent/30">
          ⏳
        </div>
        <Segmented value={lang} onChange={setLang} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} />
      </div>
      <div>
        <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-white via-ink-100 to-accent bg-clip-text text-transparent">{t('landingTitle')}</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-300">{t('landingBody')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href="admin.html">
          <Button variant="primary" size="lg">{t('openAdmin')} →</Button>
        </a>
        {import.meta.env.DEV && (
          <a href="admin.html?demo=1">
            <Button variant="secondary" size="lg">▶ Demo</Button>
          </a>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={initialAdminLang()} persist>
      <Landing />
    </I18nProvider>
  </StrictMode>,
);
