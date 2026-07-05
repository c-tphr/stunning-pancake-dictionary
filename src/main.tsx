import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts, bundled by Vite — no runtime font fetches (offline requirement).
// EB Garamond's lightest cut is 400; CSS declares weight 300 and the browser
// resolves to this face, which reads suitably light for the editorial display voice.
import '@fontsource/eb-garamond/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

import './theme/tokens.css';
import './theme/global.css';
import './theme/components.css';
import './theme/pages.css';

import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
