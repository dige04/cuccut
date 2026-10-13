import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Id, MissingAsset, Sequence, VersionRef } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import {
  STAGE_MEDIA_COPY as C,
  assetsFingerprint,
  notePlayback,
  recoveredAssets,
  stageMediaNotice,
  unplayableRefs,
  type MediaOutcome,
  type PlaybackLog,
  type StageMediaNotice,
} from '../../model/stage-media.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';

/** How long until the next check while the card is still present: when the drive reconnects or the file is moved back, playback recovers without reopening the video. */
const POLL_MS = 5000;
/** When the source element cannot get an address, wait a moment before checking again (several elements often fail together at the same time). */
const UNRESOLVED_DEBOUNCE_MS = 400;

export interface StageMedia {
  /** Card content; null when the main media can all be shown. */
  notice: StageMediaNotice | null;
  /** How many times this asset has recovered. The preview's source element is remounted with this, so it fetches the address again and reloads. */
  revived(assetId: Id): number;
  /** Result of one load of the source element. Stable callback. */
  report(mediaKey: string, ref: VersionRef, outcome: MediaOutcome): void;
  /** Pick a file and re-link the asset on the card. */
  relink(): void;
  /** Verifying content (large files take a few seconds). */
  busy: boolean;
  /** Edits can be committed (the video has caught up). */
  canRelink: boolean;
  /** Reason the last re-link failed (the engine's own words). */
  error: string | null;
}

/**
 * Whether the main media can be shown (design model-stage-media.js): checks `videos.assetStatus`, and receives the load result of the preview's source element.
 *
 * When it checks: the video catches up (open, reconnect), on `video.replaced`, when the asset registration changes (after an asset-type operation is submitted, including from other windows and from agents), when the window comes back to the foreground, and when the source element cannot get an address. While the card is present, it checks again every few seconds (recovers automatically once the drive reconnects). Only the result of the last query is accepted.
 */
export function useStageMedia(videoId: Id | null, sequence: Sequence): StageMedia {
  const runtime = useRuntime();
  const ready = useVideo((s) => s.video?.status === 'ready');
  const editable = useVideo((s) => canEdit(s.video));
  const replaced = useVideo((s) => s.video?.replaced ?? 0);
  const assets = useVideo((s) => s.video?.state?.video.assets);
  const fingerprint = useMemo(() => (assets ? assetsFingerprint(assets) : ''), [assets]);

  // Results are kept per video: switching videos does not reuse the previous video's result.
  const [status, setStatus] = useState<{ videoId: Id; missing: MissingAsset[] } | null>(null);
  const [revive, setRevive] = useState<{ videoId: Id | null; counts: Record<Id, number> }>({ videoId: null, counts: {} });
  const [log, setLog] = useState<{ videoId: Id | null; entries: PlaybackLog }>({ videoId: null, entries: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ videoId: Id; assetId: Id; message: string } | null>(null);

  const latest = useRef(0);
  const previous = useRef<{ videoId: Id; missing: MissingAsset[] } | null>(null);
  const check = useCallback(async () => {
    if (!videoId) return;
    const n = ++latest.current;
    let missing: MissingAsset[];
    try {
      ({ missing } = await runtime.client.request('videos.assetStatus', { videoId }));
    } catch {
      return; // On disconnect, or when the video is closed: check again after catching up.
    }
    if (n !== latest.current) return;
    const before = previous.current?.videoId === videoId ? previous.current.missing : null;
    previous.current = { videoId, missing };
    const back = recoveredAssets(before, missing);
    if (back.length) {
      setRevive((r) => {
        const counts = r.videoId === videoId ? { ...r.counts } : {};
        for (const id of back) counts[id] = (counts[id] ?? 0) + 1;
        return { videoId, counts };
      });
    }
    setStatus({ videoId, missing });
  }, [runtime, videoId]);

  useEffect(() => {
    if (ready) void check();
  }, [check, ready, replaced, fingerprint]);

  useEffect(() => {
    if (!ready) return;
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check, ready]);

  // On switching video (`check` changes with it) or on unmount, cancel the pending check that has not yet come due. Do not query with the previous video, so as not to override the new video's result.
  const unresolvedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (unresolvedTimer.current) clearTimeout(unresolvedTimer.current);
      unresolvedTimer.current = null;
    },
    [check],
  );

  const report = useCallback(
    (mediaKey: string, ref: VersionRef, outcome: MediaOutcome) => {
      if (outcome.kind === 'unresolved') {
        if (unresolvedTimer.current) clearTimeout(unresolvedTimer.current);
        unresolvedTimer.current = setTimeout(() => void check(), UNRESOLVED_DEBOUNCE_MS);
        return;
      }
      setLog((current) => {
        const entries = current.videoId === videoId ? current.entries : {};
        const next = notePlayback(entries, mediaKey, ref, outcome);
        return next === entries && current.videoId === videoId ? current : { videoId, entries: next };
      });
    },
    [videoId, check],
  );

  const missing = status && status.videoId === videoId ? status.missing : null;
  const unplayable = useMemo(() => unplayableRefs(log.videoId === videoId ? log.entries : {}), [log, videoId]);
  const canPick = !!runtime.host.pickFiles;
  const notice = useMemo(
    () => (assets ? stageMediaNotice({ sequence, assets, missing, unplayable, canPick }) : null),
    [sequence, assets, missing, unplayable, canPick],
  );

  // If it still cannot be read, check again after a few seconds. Do not poll when the player cannot open (the file exists, and checking again would give the same result).
  const waiting = !!notice && notice.kind !== 'unplayable' && ready;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(timer);
  }, [check, waiting]);

  const target = notice?.relink ?? null;
  const relink = useCallback(async () => {
    const pick = runtime.host.pickFiles;
    if (!target || !pick || !videoId || busy) return;
    const [path] = await pick({ title: C.pickTitle(target.name), buttonLabel: C.pickButton });
    if (!path) return;
    setError(null);
    setBusy(true);
    // The failure reason is recorded in the video store. The editor shows a toast and clears it right away, so catch it before it is cleared.
    let failure: string | null = null;
    const unsubscribe = useVideo.subscribe((s) => {
      const reason = s.video?.commandError?.message;
      if (reason) failure = reason;
    });
    try {
      const receipt = await runtime.videos.apply([{ type: 'relinkAsset', assetId: target.assetId, path }], EditLabel.relinkAsset({ name: target.name }));
      if (!receipt) {
        const reason = failure ?? useVideo.getState().video?.commandError?.message ?? E.notEditableNow;
        setError({ videoId, assetId: target.assetId, message: C.relinkFailed(reason) });
      }
    } finally {
      unsubscribe();
      setBusy(false);
    }
    await check();
  }, [runtime, target, videoId, busy, check]);

  const revived = useCallback((assetId: Id) => (revive.videoId === videoId ? (revive.counts[assetId] ?? 0) : 0), [revive, videoId]);

  return {
    notice,
    revived,
    report,
    relink: () => void relink(),
    busy,
    canRelink: editable,
    error: error && error.videoId === videoId && error.assetId === target?.assetId ? error.message : null,
  };
}
