import { useEffect, useState } from 'react';
import type { Id, MediaHandle } from '@cuccut/protocol';
import { useRuntime } from '../../runtime/context.tsx';
import { openPinnedExport } from '../../runtime/publishing-commands.ts';

/** Handles are short-lived; one is reused until a minute before it expires. */
const MARGIN_MS = 60_000;
const handles = new Map<string, Promise<MediaHandle | null>>();

function cached(key: string, open: () => Promise<MediaHandle>): Promise<MediaHandle | null> {
  const hit = handles.get(key);
  if (hit) return hit;
  const promise = open().then(
    (handle) => {
      // Forget it shortly before it expires, so the next reader asks for a fresh one.
      const ms = Date.parse(handle.expiresAt) - Date.now() - MARGIN_MS;
      setTimeout(() => handles.delete(key), Math.max(0, ms));
      return handle;
    },
    // No export pinned for this version (or the file is gone): remembered for this key; a new pin changes the key.
    () => null,
  );
  handles.set(key, promise);
  return promise;
}

/**
 * A read handle of a publication's pinned export (player, entry thumbnail), or null while loading, without an export, or when it could not be
 * opened. `exportKey` names the pinned export (its ID, or the row revision when the ID is not known), so pinning another export asks again.
 */
export function usePinnedExport(publicationId: Id, exportKey: string | null): MediaHandle | null {
  const runtime = useRuntime();
  const [handle, setHandle] = useState<{ key: string; value: MediaHandle | null } | null>(null);
  const key = exportKey ? `${publicationId}:${exportKey}` : null;
  useEffect(() => {
    if (!key) return;
    let live = true;
    void cached(key, () => openPinnedExport(runtime, publicationId)).then((value) => {
      if (live) setHandle({ key, value });
    });
    return () => {
      live = false;
    };
  }, [runtime, publicationId, key]);
  return key && handle?.key === key ? handle.value : null;
}
