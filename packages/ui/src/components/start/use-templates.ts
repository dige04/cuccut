import { useCallback, useEffect, useState } from 'react';
import type { HomeTemplate } from '../../model/home-templates.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { forgetTemplateFile, loadTemplates, templateFileUrl, templatePrompt } from '../../runtime/template-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useTemplateCatalog, type TemplateCatalogStore } from '../../state/template-catalog-store.ts';

/**
 * Template catalog: fetched once on mount, when `refresh` changes (the dialog opens), and when the connection is re-established. Nothing is sent while disconnected; it waits until connected and then fetches.
 * Returns a mirror of the catalog and a “retry” function.
 */
export function useTemplateCatalogLoader(refresh: unknown = null): TemplateCatalogStore & { retry(): void } {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const catalog = useTemplateCatalog();
  useEffect(() => {
    if (connected) void loadTemplates(runtime);
  }, [runtime, connected, refresh]);
  const retry = useCallback(() => void loadTemplates(runtime), [runtime]);
  return { ...catalog, retry };
}

export type PromptState = { state: 'loading' } | { state: 'ready'; text: string } | { state: 'failed'; message: string };

/** The prompt for one template (`templates.get`): cached by “id@version:language”; when switching templates, loading is shown first. */
export function useTemplatePrompt(template: Pick<HomeTemplate, 'id' | 'version' | 'language'> | null): PromptState & { retry(): void } {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const key = template ? `${template.id}@${template.version}:${template.language}` : '';
  const [state, setState] = useState<{ key: string; value: PromptState }>({ key, value: { state: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const current = state.key === key ? state.value : ({ state: 'loading' } as const);

  useEffect(() => {
    if (!template || !connected) return undefined;
    let cancelled = false;
    templatePrompt(runtime, template.id, template.version, template.language).then(
      (text) => !cancelled && setState({ key, value: { state: 'ready', text } }),
      (error: Error) => !cancelled && setState({ key, value: { state: 'failed', message: error.message } }),
    );
    return () => {
      cancelled = true;
    };
    // `template` only takes effect through `key`: the same id@版本:语言 is not fetched again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, key, connected, attempt]);

  const retry = useCallback(() => {
    setState({ key, value: { state: 'loading' } });
    setAttempt((n) => n + 1);
  }, [key]);
  return { ...current, retry };
}

/**
 * The address of a template's bundled files (cover image, preview video); nothing is fetched when `path` is null. When a media element errors, call `fail`: drop the handle and fetch once more; if it errors again, give up (the caller falls back to the placeholder cover).
 */
export function useTemplateFileUrl(id: string, path: string | null): { url: string | null; failed: boolean; fail(): void } {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const key = path ? `${id}:${path}` : '';
  const [state, setState] = useState<{ key: string; url: string | null; failures: number }>({ key, url: null, failures: 0 });
  const current = state.key === key ? state : { key, url: null, failures: 0 };

  useEffect(() => {
    if (!path || !connected || current.failures > 1) return undefined;
    let cancelled = false;
    templateFileUrl(runtime, id, path).then(
      (url) => !cancelled && setState((s) => ({ key, url, failures: s.key === key ? s.failures : 0 })),
      () => !cancelled && setState((s) => ({ key, url: null, failures: (s.key === key ? s.failures : 0) + 2 })),
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, id, path, key, connected, current.failures]);

  const fail = useCallback(() => {
    if (path) forgetTemplateFile(id, path);
    setState((s) => ({ key, url: null, failures: (s.key === key ? s.failures : 0) + 1 }));
  }, [id, path, key]);
  return { url: current.url, failed: current.failures > 1, fail };
}
