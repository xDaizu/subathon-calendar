import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, initialAdminLang } from '../i18n';
import './admin.css';
import { App } from './App';

// The panel never runs inside a frame from another site (protects against click-tricks).
let framedByOtherSite = false;
try {
  framedByOtherSite = window.top !== window.self && window.top!.location.origin !== window.location.origin;
} catch {
  framedByOtherSite = true; // cross-origin parent: reading its location throws
}

if (framedByOtherSite) {
  document.body.textContent = '';
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider initial={initialAdminLang()} persist>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}
