import '@react-spectrum/s2/page.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@cuccut/ui';
import { webHost } from './web-host.ts';

// The path and query of the access link are the screen to go to on startup (`/home?video=…` goes straight to a video's editor); the one-time code is consumed by the login page.
// After handing off to the UI, the address bar goes back to the root path: the UI does not update the address bar when routes change, so leaving the old address would not match the page actually shown. If an access link is opened while already logged in,
// the code in the fragment is also removed from the address bar and history.
const initialHref = location.pathname + location.search;
if (initialHref !== '/' || location.hash) history.replaceState(null, '', '/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App host={webHost} initialHref={initialHref === '/' ? undefined : initialHref} />
  </StrictMode>,
);
