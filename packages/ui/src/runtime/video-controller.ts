import { applyVideoTopicEvent, type CucCutClient, type ConnectionState } from '@cuccut/client';
import {
  RpcError,
  isEngineErrorBody,
  newId,
  refOf,
  type EditOperation,
  type FileTarget,
  type Id,
  type Localized,
  type MessageRef,
  type VideoRef,
  type TransactionReceipt,
  type UndoTarget,
} from '@cuccut/protocol';
import { useVideo } from '../state/video-store.ts';
import { AssetCache } from './asset-cache.ts';
import { DocumentCache } from './document-cache.ts';
import { MediaAnalysisCache } from './media-analysis.ts';
import { MediaUrlCache } from './media-url-cache.ts';
import { preparePlaybackMedia } from './media-playback.ts';
import { RT } from './runtime-copy.ts';

/**
 * The channel between the editor and the video (architecture design §11): open, subscribe, submit commands, undo.
 *
 * - Only one video is open at a time (one editor per window).
 * - Commands are queued and sent one at a time: each command carries the latest version number at the time it is sent, so the previous command's events always arrive before its receipt.
 * - When the engine is temporarily unavailable, retry with the same commandId; the engine de-duplicates repeated submissions.
 * - After the connection recovers (including a Runtime restart), reopen the video and resubscribe, resuming from the snapshot.
 */
export class VideoController {
  readonly #client: CucCutClient;
  #unsubscribe: (() => void) | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #wasConnected = false;
  #generation = 0;
  /** The current video's document body (subtitle sentences and styles), shared by the preview and the timeline. */
  readonly documents: DocumentCache;
  /** The current video's asset content (Lottie animations, audio spectrum), for the preview. */
  readonly assets: AssetCache;
  /** Analysis results for the current video's assets (waveform peaks, thumbnails), for the timeline. */
  readonly media: MediaAnalysisCache;
  /** Media URL of the current video's asset (the handle from `media.resolve`), shared by the preview and the media element in the assets panel. */
  readonly mediaUrls: MediaUrlCache;

  constructor(client: CucCutClient) {
    this.#client = client;
    this.documents = new DocumentCache((documentId, revision) => {
      const videoId = useVideo.getState().video?.videoId;
      if (!videoId) return Promise.reject(new Error(RT.noOpenVideo));
      return this.#client.request('documents.read', { videoId, documentId, revision });
    });
    this.assets = new AssetCache(async (asset) => {
      const videoId = useVideo.getState().video?.videoId;
      if (!videoId) throw new Error(RT.noOpenVideo);
      const handle = await this.#client.request('media.resolve', { videoId, assetId: asset.id, revision: asset.revision });
      return handle.url;
    });
    this.mediaUrls = new MediaUrlCache((videoId, asset, signal, onProgress) =>
      this.#client.request('media.resolve', { videoId, assetId: asset.id, revision: asset.revision })
        .then(handle => preparePlaybackMedia(this.#client, handle, signal, { onProgress })),
    );
    const videoId = () => {
      const id = useVideo.getState().video?.videoId;
      if (!id) throw new Error(RT.noOpenVideo);
      return id;
    };
    this.media = new MediaAnalysisCache({
      peaks: async (asset) => this.#client.request('media.peaks', { videoId: videoId(), assetId: asset.id, revision: asset.revision }),
      thumbnail: async (asset, at) =>
        this.#client.request('media.thumbnail', { videoId: videoId(), assetId: asset.id, revision: asset.revision, at }),
    });
  }

  /** Connection state change (relayed from the session). On disconnect, mark as not caught up; after reconnecting, drop the old media URLs (handles are invalid after a Runtime restart) and reopen. */
  onConnection(state: ConnectionState): void {
    const connected = state.status === 'connected';
    const video = useVideo.getState().video;
    if (!connected && this.#wasConnected && video && video.status === 'ready') useVideo.getState().update({ status: 'stale' });
    if (connected && !this.#wasConnected) this.mediaUrls.clear();
    if (connected && !this.#wasConnected && video) void this.#open(video.target);
    this.#wasConnected = connected;
  }

  /** Open a video. Does not reopen if the same location is already open. */
  open(target: FileTarget): void {
    const current = useVideo.getState().video;
    if (current && sameTarget(current.target, target) && current.status !== 'error') return;
    this.close();
    useVideo.getState().begin(target);
    void this.#open(target);
  }

  /** Create a new video and open it. Returns the location used to open it (to put into the route). */
  async create(scope: { projectId?: Id; conversationId?: Id }, name?: string): Promise<FileTarget> {
    const { ref } = await this.#client.request('videos.create', { ...scope, ...(name ? { name } : {}), commandId: newId('cmd') });
    return targetOf(ref);
  }

  close(): void {
    const video = useVideo.getState().video;
    this.#generation++;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.documents.clear();
    this.assets.clear();
    this.media.clear();
    this.mediaUrls.clear();
    useVideo.getState().clear();
    if (video?.videoId) void this.#client.request('videos.close', { videoId: video.videoId }).catch(() => {});
  }

  /**
   * Submit an edit transaction. On success, returns the receipt; on failure, the error is recorded in the store (shown in the UI) and null is returned. The changed name is stored together with its catalog reference
   * (command and protocol spec §3.1); history and undo hints are shown in the reader's language. If none is given, the engine names it.
   */
  apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null> {
    return this.#enqueue((videoId, revision) =>
      this.#client.request('edits.apply', {
        videoId,
        commandId: newId('cmd'),
        expectedRevision: revision,
        operations,
        ...(label ? transactionLabel(label) : {}),
      }),
    );
  }

  undo(target: UndoTarget): Promise<TransactionReceipt | null> {
    return this.#enqueue((videoId) => this.#client.request('edits.undo', { videoId, commandId: newId('cmd'), target }));
  }

  /** Apply one speaker-recognition proposal (`edits.applySpeakers`, one transaction); `names` are the names edited on the confirmation page. Failure is handled the same as `apply`. */
  applySpeakers(jobId: Id, names?: Record<Id, string>): Promise<TransactionReceipt | null> {
    return this.#enqueue((videoId) =>
      this.#client.request('edits.applySpeakers', { videoId, jobId, commandId: newId('cmd'), ...(names ? { names } : {}) }),
    );
  }

  /** Every command already sent has a result (synchronously before sending, product design §3.2.4): a version read afterwards includes the changes the user just made. */
  settled(): Promise<void> {
    return this.#queue.then(
      () => {},
      () => {},
    );
  }

  async history(limit = 100) {
    const videoId = useVideo.getState().video?.videoId;
    if (!videoId) return [];
    const { entries } = await this.#client.request('videos.history', { videoId, limit });
    return entries;
  }

  clearError(): void {
    useVideo.getState().update({ commandError: null });
  }

  // ---- internal ----

  async #open(target: FileTarget): Promise<void> {
    const generation = ++this.#generation;
    const store = useVideo.getState();
    store.update({ status: 'opening', error: null });
    try {
      const { ref, snapshot } = await this.#client.request('videos.open', target);
      if (generation !== this.#generation) return;
      useVideo.getState().update({ videoId: ref.videoId, ref, state: snapshot });
      this.#subscribe(ref.videoId, generation);
    } catch (error) {
      if (generation !== this.#generation) return;
      useVideo.getState().update({ status: 'error', error: (error as Error).message });
    }
  }

  #subscribe(videoId: Id, generation: number): void {
    this.#unsubscribe?.();
    this.#unsubscribe = this.#client.subscribeVideo(videoId, {
      snapshot: (snapshot) => {
        if (generation !== this.#generation) return;
        useVideo.getState().update({ state: snapshot, status: 'ready' });
        void this.#refreshUndo();
      },
      event: (event) => {
        if (generation !== this.#generation) return;
        const video = useVideo.getState().video;
        if (!video?.state) return;
        const next = applyVideoTopicEvent(video.state, event);
        if (next === null) {
          // The video was closed in the Runtime (for example, the engine crashed several times): keep the last frame and reopen.
          useVideo.getState().update({ status: 'stale' });
          void this.#open(video.target);
          return;
        }
        useVideo.getState().update({
          state: next,
          status: 'ready',
          ref: video.ref ? { ...video.ref, name: next.video.name } : video.ref,
          ...(event.type === 'video.event'
            ? { lastChange: { by: event.event.actor.kind, label: event.event.label, labelRef: event.event.labelRef } }
            : {}),
          ...(event.type === 'video.replaced' ? { replaced: (video.replaced ?? 0) + 1 } : {}),
        });
        void this.#refreshUndo();
      },
    });
  }

  async #refreshUndo(): Promise<void> {
    const videoId = useVideo.getState().video?.videoId;
    if (!videoId) return;
    try {
      const undo = await this.#client.request('edits.undoState', { videoId });
      if (useVideo.getState().video?.videoId === videoId) useVideo.getState().update({ undo });
    } catch {
      // On disconnect, fetch again after reopening.
    }
  }

  #enqueue(
    send: (videoId: Id, revision: string) => Promise<{ receipt: TransactionReceipt; replayed: boolean }>,
  ): Promise<TransactionReceipt | null> {
    const store = useVideo.getState();
    const video = store.video;
    if (!video?.videoId || video.status !== 'ready') {
      store.update({ commandError: { message: RT.notCaughtUp, code: null } });
      return Promise.resolve(null);
    }
    store.update({ inFlight: video.inFlight + 1 });
    const run = async (): Promise<TransactionReceipt | null> => {
      try {
        for (let attempt = 0; ; attempt++) {
          const current = useVideo.getState().video;
          if (!current?.videoId || !current.state) return null;
          try {
            const { receipt } = await send(current.videoId, current.state.video.revision);
            useVideo.getState().update({ lastReceipt: receipt, commandError: null });
            return receipt;
          } catch (error) {
            if (error instanceof RpcError && error.code === 'engine-unavailable' && attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        const details = error instanceof RpcError ? error.details : undefined;
        useVideo.getState().update({
          commandError: { message: (error as Error).message, code: isEngineErrorBody(details) ? details.code : null },
        });
        return null;
      } finally {
        const latest = useVideo.getState().video;
        if (latest) useVideo.getState().update({ inFlight: Math.max(0, latest.inFlight - 1) });
      }
    };
    const result = this.#queue.then(run, run);
    this.#queue = result;
    return result;
  }
}

/** The name field of `edits.apply`: the text in the current language and its catalog reference (command and protocol spec §3.1). */
export function transactionLabel(label: Localized): { label: string; labelRef: MessageRef } {
  return { label: label.text, labelRef: refOf(label) };
}

/** The video's location: its relative path within the source directory it is in. */
export function targetOf(ref: VideoRef): FileTarget {
  return ref.source.projectId
    ? { projectId: ref.source.projectId, path: ref.relPath }
    : { conversationId: ref.source.conversationId!, path: ref.relPath };
}

export function sameTarget(a: FileTarget, b: FileTarget): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
