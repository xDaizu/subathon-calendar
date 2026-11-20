import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../i18n';
import './overlay.css';
import { readParams } from './params';
import { UnlocksOverlay } from './Unlocks';

const params = readParams();
document.documentElement.classList.add('overlay-root', 'unlocks-root');
document.documentElement.lang = params.legacyLook.lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={params.legacyLook.lang}>
      <UnlocksOverlay params={params} />
    </I18nProvider>
  </StrictMode>,
);
