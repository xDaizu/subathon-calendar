import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../i18n';
import { Overlay } from './Overlay';
import './overlay.css';
import { readParams } from './params';

const params = readParams();
document.documentElement.classList.add('overlay-root');
document.documentElement.lang = params.lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initial={params.lang}>
      <Overlay params={params} />
    </I18nProvider>
  </StrictMode>,
);
