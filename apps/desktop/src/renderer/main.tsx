import '@react-spectrum/s2/page.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type HostBridge } from '@cuccut/ui';

declare global {
  interface Window {
    cuccut: HostBridge;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App host={window.cuccut} />
  </StrictMode>,
);
