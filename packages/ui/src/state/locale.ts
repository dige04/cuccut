import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getLocale, intlLocale, onLocaleChange, resolveLanguage, setLocale, type LanguagePreference, type Locale } from '@cuccut/protocol';
import { useRuntime } from '../runtime/context.tsx';
import { useConnection } from './connection-store.ts';
import { useSetting, useSettings } from './settings-store.ts';
import { useShell } from './shell-store.ts';

/*
 * Interface language (Settings › General › Interface language). The preference is stored in shell-store (the interface on this computer). `system` follows the browser's or system's preferred language,
 * and falls back to English when there is no matching shipped language. The resolved language is set as the process's current language (@cuccut/protocol i18n), and the copy catalog reads text in that language.
 * When it switches, the interface root redraws entirely, keyed by the language (app.tsx), so components do not subscribe individually. Cross-screen state lives in the store and is unaffected.
 */

function systemLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function apply(): void {
  setLocale(resolveLanguage(useShell.getState().language, systemLanguages()));
  if (typeof document !== 'undefined') document.documentElement.lang = intlLocale();
}

// The language is fixed when the module loads, so the first frame draws in the right language without flashing English first.
apply();
useShell.subscribe((s, prev) => {
  if (s.language !== prev.language) apply();
});
if (typeof window !== 'undefined') window.addEventListener('languagechange', apply);

/** The current interface language. When it changes, the components that call it redraw. */
export function useLocale(): Locale {
  return useSyncExternalStore(onLocaleChange, getLocale, getLocale);
}

/**
 * Hosts that can change Runtime settings (desktop) write the interface language into `ui.language`. The Runtime generates text (error reasons, task descriptions, the default names it creates) in that language, so it matches the interface.
 * When connected, the interface's preference wins. If it is later changed elsewhere (the CLI's `cuccut settings set ui.language`), the interface follows it.
 * The browser client cannot change Runtime settings (the Web service's method allowlist), so it only switches its own interface. A host can also use `setLocale` to switch the language of native menus and dialogs.
 */
export function useLanguageSync(): void {
  const runtime = useRuntime();
  const preference = useShell((s) => s.language);
  const setLanguage = useShell((s) => s.setLanguage);
  const seen = useRef<LanguagePreference | null>(null);
  const locale = useLocale();
  const stored = useSetting('ui.language');
  const loaded = useSettings((s) => s.snapshot !== null);
  const connected = useConnection((s) => s.state.status === 'connected');
  const canWrite = runtime.host.platform !== 'web';

  useEffect(() => {
    runtime.host.setLocale?.(locale);
  }, [runtime, locale]);

  useEffect(() => {
    if (!canWrite || !connected || !loaded) return;
    const previous = seen.current;
    seen.current = stored;
    if (stored === preference) return;
    if (previous !== null && stored !== null && stored !== previous) {
      setLanguage(stored);
      return;
    }
    runtime.client.request('settings.set', { values: { 'ui.language': preference } }).catch(() => {
      // If it cannot be written, the interface still switches language. The Runtime writes it the next time it connects.
    });
  }, [runtime, canWrite, connected, loaded, stored, preference, setLanguage]);
}
