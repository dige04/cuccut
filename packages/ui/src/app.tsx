import './theme/cuccut.css';
import './app.css';
import { useEffect, useState } from 'react';
import { intlLocale } from '@cuccut/protocol';
import { Provider, ToastContainer, ToastQueue } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { AppShell } from './components/app-shell.tsx';
import type { HostBridge } from './host.ts';
import { RuntimeContext } from './runtime/context.tsx';
import { RuntimeSession } from './runtime/session.ts';
import { useLanguageSync, useLocale } from './state/locale.ts';
import { useShell } from './state/shell-store.ts';
import { installToastAutoDismiss, type ToastQueueLike } from './toast-timing.ts';

// Toasts stay up for only a few seconds, including ones with buttons (toast-timing.ts).
installToastAutoDismiss(ToastQueue as unknown as ToastQueueLike);

const rootStyle = style({ height: 'screen', overflow: 'hidden' });

/**
 * Root of the desktop UI. The host only provides connection info and a few native capabilities; everything else goes through the Runtime.
 * `initialHref` is the in-app link to go to at startup (the shape of `hrefFor`): the web client takes it from the address bar (an access link can open a video's editor directly, `webVideoHref`); the desktop app does not provide it.
 */
export function App({ host, initialHref }: { host: HostBridge; initialHref?: string }) {
  // Goes there only once, on the first render; routes are not persisted, and later destinations are decided by the UI itself.
  useState(() => {
    if (initialHref) useShell.getState().navigate(initialHref);
  });
  const [session, setSession] = useState<RuntimeSession | null>(null);
  const navigate = useShell((s) => s.navigate);
  const locale = useLocale();

  // The session is created and released with the effect: under StrictMode the effect runs once and is then cleaned up, so a closed client must not be reused.
  useEffect(() => {
    const next = new RuntimeSession(host);
    next.start();
    setSession(next);
    return () => next.dispose();
  }, [host]);

  if (!session) return null;
  return (
    <RuntimeContext.Provider value={session}>
      <Provider
        locale={intlLocale(locale)}
        background="base"
        // CucCut is dark only (agentcut DESIGN.md).
        colorScheme="dark"
        router={{ navigate }}
        styles={rootStyle}>
        <LanguageSync />
        {/* When the language changes, the whole UI is redrawn: the copy catalog reads the current language when it is read, local state resets with it, and cross-screen state lives in the store. */}
        <AppShell key={locale} platform={host.platform} />
        {/* Toasts sit near the top, under the navigation bar (agentcut sonner; offset in theme/cuccut.css). */}
        <ToastContainer placement="top" />
      </Provider>
    </RuntimeContext.Provider>
  );
}

function LanguageSync() {
  useLanguageSync();
  return null;
}
