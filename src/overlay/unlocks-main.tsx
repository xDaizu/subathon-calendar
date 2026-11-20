import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../i18n';
import './overlay.css';
import { readParams } from './params';
import { UnlocksOverlay } from './Unlocks';

const params = readParams();
document.documentElement.classList.add('overlay-root', 'unlocks-root');
document.documentElement.lang = params.lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={params.lang}>
      <UnlocksOverlay params={params} />
    </I18nProvider>
  </StrictMode>,
);
