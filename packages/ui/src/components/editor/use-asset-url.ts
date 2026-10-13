import { useCallback, useEffect, useRef, useState } from 'react';
import type { Id, VersionRef } from '@cuccut/protocol';
import { useRuntime } from '../../runtime/context.tsx';
import { mediaUrlKey } from '../../runtime/media-url-cache.ts';
import { useConnection } from '../../state/connection-store.ts';

/**
 * Media address of a video asset (architecture design §4.5). Handles expire, and old addresses become invalid after the Runtime restarts.
 * When the media element errors, call `retry` to fetch a new address; also fetch again after reconnecting.
 * The address comes through the video controller's address cache (one request shared by the same asset version). If the cache already holds a fresh address, it is returned on the first render.
 */
export function useAssetUrl(videoId: Id | null, asset: VersionRef): { url: string | null; error: string | null; retry(): void } {
  const urls = useRuntime().videos.mediaUrls;
  const connected = useConnection((s) => s.state.status === 'connected');
  const key = videoId ? mediaUrlKey(videoId, asset) : null;
  const initial = () => ({ key, url: videoId ? urls.peek(videoId, asset) : null, error: null as string | null });
  const [state, setState] = useState(initial);
  // When the asset (or the video) changes, do not hold the previous address or error: check the cache first, otherwise leave it empty and wait for this result.
  const current = state.key === key ? state : initial();
  const [attempt, setAttempt] = useState(0);
  // The address handed out in this render: when the media element errors, compare against it in the cache.
  const shown = useRef({ key, url: current.url });
  shown.current = { key, url: current.url };

  useEffect(() => {
    if (!videoId || !connected) return;
    const target = { id: asset.id, revision: asset.revision };
    const k = mediaUrlKey(videoId, target);
    // If the cache already holds the address in use, there is no need to request again (when thousands of elements mount at once, each one stops here).
    const hit = urls.peek(videoId, target);
    if (hit && hit === shown.current.url && shown.current.key === k) return;
    let cancelled = false;
    urls.get(videoId, target).then(
      (url) => {
        if (cancelled) return;
        setState((prev) => (prev.key === k && prev.url === url && prev.error === null ? prev : { key: k, url, error: null }));
      },
      (error: Error) => !cancelled && setState({ key: k, url: null, error: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [urls, videoId, asset.id, asset.revision, connected, attempt]);

  const retry = useCallback(() => {
    // The first to error removes the invalid address from the cache; the rest follow the same new request.
    const { key: failedKey, url: failedUrl } = shown.current;
    if (videoId && failedUrl && failedKey === mediaUrlKey(videoId, { id: asset.id, revision: asset.revision })) {
      urls.invalidate(videoId, { id: asset.id, revision: asset.revision }, failedUrl);
    }
    setAttempt((n) => (n < 3 ? n + 1 : n));
  }, [urls, videoId, asset.id, asset.revision]);
  return { url: current.url, error: current.error, retry };
}
