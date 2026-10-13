import { useEffect, useSyncExternalStore } from 'react';
import type { HistoryEntry, Id } from '@cuccut/protocol';
import { useRuntime } from '../../runtime/context.tsx';
import { useVideo } from '../../state/video-store.ts';

/** How many entries to look back; older change cards fall back to the undo decision recorded in the session. */
const LIMIT = 200;

/**
 * The edit history of the video open in the editor (`videos.history`), shared by all change cards in the thread. It is fetched once per
 * “视频@版本” (video@version) and fetched again when the version changes; until the new fetch completes, the previous result is used. `videos.history` requires the video to be open in the Runtime, so this is only available while the editor has this video open.
 */
let current: { videoId: Id; key: string; entries: HistoryEntry[] } | null = null;
let loading: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => current;

export function useVideoHistory(videoId: Id): readonly HistoryEntry[] | null {
  const runtime = useRuntime();
  const revision = useVideo((s) =>
    s.video?.videoId === videoId && s.video.status === 'ready' ? (s.video.state?.video.revision ?? null) : null,
  );
  const snapshot = useSyncExternalStore(subscribe, read);

  useEffect(() => {
    if (!revision) return;
    const key = `${videoId}@${revision}`;
    if (current?.key === key || loading === key) return;
    loading = key;
    runtime.videos
      .history(LIMIT)
      .then((entries) => {
        if (loading !== key) return;
        loading = null;
        // This fetches the video currently open in the editor: if the video is switched midway, the result is discarded.
        if (useVideo.getState().video?.videoId !== videoId) return;
        current = { videoId, key, entries };
        for (const listener of listeners) listener();
      })
      .catch(() => {
        if (loading === key) loading = null;
      });
  }, [runtime, videoId, revision]);

  return revision && snapshot?.videoId === videoId ? snapshot.entries : null;
}
