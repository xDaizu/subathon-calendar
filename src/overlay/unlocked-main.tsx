import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../i18n';
import './overlay.css';
import { readParams } from './params';
import { UnlockedPage } from './Unlocked';

const params = readParams();
// A normal page for viewers (own background, scrolls): not an OBS source.
document.documentElement.classList.add('share-root');
document.documentElement.lang = params.legacyLook.lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={params.legacyLook.lang}>
      <UnlockedPage params={params} />
    </I18nProvider>
  </StrictMode>,
);
