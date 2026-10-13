import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LibraryEntry, LibraryEntrySummary } from '@cuccut/protocol';
import { entryKey } from '../model/library-entry.ts';
import { getLibraryEntry, openLibraryHandle } from '../runtime/library-commands.ts';
import { useRuntime } from '../runtime/context.tsx';
import { useLibrary } from '../state/library-store.ts';

type Ref = Pick<LibraryEntrySummary, 'library' | 'id' | 'version'>;

/**
 * The full content of one user library entry (the summary has no terms, colour values or files). It follows the summary's version: re-read when the topic delivers a new version.
 * `reload` reads the current version (used after a version conflict, when the topic's new version may not have arrived yet).
 */
export function useLibraryEntry(ref: Ref | null): { entry: LibraryEntry | null; error: string | null; reload(): void } {
  const runtime = useRuntime();
  const key = ref ? entryKey(ref) : null;
  const [state, setState] = useState<{ key: string | null; entry: LibraryEntry | null; error: string | null }>({
    key: null,
    entry: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ref || !key) return;
    let live = true;
    // Re-reads without a version, taking the Runtime's current one. The ref's content is the key.
    getLibraryEntry(runtime, { library: ref.library, id: ref.id, ...(attempt ? {} : { version: ref.version }) }).then(
      (entry) => live && setState({ key, entry, error: null }),
      (error: Error) => live && setState({ key, entry: null, error: error.message }),
    );
    return () => {
      live = false;
    };
  }, [runtime, key, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return state.key === key ? { entry: state.entry, error: state.error, reload } : { entry: null, error: null, reload };
}

export interface BrandColor {
  id: string;
  name: string;
  value: string;
}

/** Brand colours in the library (for the colour picker): the summary has no colour values, so each is read out (cached by version and shared by all colour pickers). */
export function useBrandColors(): BrandColor[] {
  const runtime = useRuntime();
  const summaries = useLibrary((s) => s.brand);
  const colors = useMemo(() => summaries.filter((s) => s.kind === 'color'), [summaries]);
  const signature = colors.map(entryKey).join('|');
  const [values, setValues] = useState<{ signature: string; list: BrandColor[] }>({ signature: '', list: [] });
  useEffect(() => {
    if (!colors.length) return;
    let live = true;
    void Promise.all(
      colors.map((summary) =>
        getLibraryEntry(runtime, summary).then(
          ({ id, content }) =>
            'kind' in content && content.kind === 'color' ? { id, name: content.name, value: content.value } : null,
          () => null,
        ),
      ),
    ).then((list) => {
      if (live) setValues({ signature, list: list.filter((c): c is BrandColor => c !== null) });
    });
    return () => {
      live = false;
    };
    // The signature summarises colors.
  }, [runtime, signature]);
  return colors.length && values.signature === signature ? values.list : EMPTY;
}

const EMPTY: BrandColor[] = [];

/** The read address for brand entries that have files (thumbnails, font previews); null when it cannot be obtained. */
export function useLibraryFileUrl(ref: Ref | null): string | null {
  const runtime = useRuntime();
  const key = ref ? entryKey(ref) : null;
  const [state, setState] = useState<{ key: string | null; url: string | null }>({ key: null, url: null });
  useEffect(() => {
    if (!ref || !key) return;
    let live = true;
    openLibraryHandle(runtime, { library: ref.library, id: ref.id, version: ref.version }).then(
      (handle) => live && setState({ key, url: handle.url }),
      () => live && setState({ key, url: null }),
    );
    return () => {
      live = false;
    };
  }, [runtime, key]);
  return state.key === key ? state.url : null;
}
