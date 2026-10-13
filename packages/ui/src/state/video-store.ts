import { create } from 'zustand';
import type { Actor, FileTarget, Id, MessageRef, VideoRef, VideoTopicSnapshot, TransactionReceipt, UndoState } from '@cuccut/protocol';

/**
 * The video open in the editor: the projection of the Runtime mirror synced through the topic, and the state of commands sent from this window.
 * The video's content is updated only by the topic; the UI does not change it locally (architecture design §11.1).
 */

/**
 * - `opening`: opening or reopening.
 * - `ready`: caught up; changes can be submitted.
 * - `stale`: the connection dropped or the video was closed in the Runtime; the last version seen is shown and changes cannot be submitted (product design §2.6).
 * - `error`: cannot be opened.
 */
export type VideoStatus = 'opening' | 'ready' | 'stale' | 'error';

export interface CommandError {
  message: string;
  /** Engine error codes, e.g. `PROJECT_REVISION_CONFLICT`, `TIMELINE_OVERLAP`. */
  code: string | null;
}

export interface OpenVideo {
  target: FileTarget;
  videoId: Id | null;
  ref: VideoRef | null;
  state: VideoTopicSnapshot | null;
  status: VideoStatus;
  error: string | null;
  /** Number of commands sent that have not yet received a reply. */
  inFlight: number;
  lastReceipt: TransactionReceipt | null;
  /** Who made the most recent change that landed on the video (from topic events, including other windows and agents). The change name is shown with `localizeText(label, labelRef)`. */
  lastChange: { by: Actor['kind']; label: string; labelRef?: MessageRef | undefined } | null;
  commandError: CommandError | null;
  undo: UndoState;
  /** Number of times `video.replaced` has been received (the whole video is replaced after an engine restart): material state must be re-queried. */
  replaced?: number;
}

export interface VideoStore {
  video: OpenVideo | null;
  begin(target: FileTarget): void;
  update(patch: Partial<OpenVideo>): void;
  clear(): void;
}

export const useVideo = create<VideoStore>()((set) => ({
  video: null,
  begin: (target) =>
    set({
      video: {
        target,
        videoId: null,
        ref: null,
        state: null,
        status: 'opening',
        error: null,
        inFlight: 0,
        lastReceipt: null,
        lastChange: null,
        commandError: null,
        undo: {},
      },
    }),
  update: (patch) => set((s) => (s.video ? { video: { ...s.video, ...patch } } : {})),
  clear: () => set({ video: null }),
}));

/** Whether changes can be submitted now: caught up and not reopening. */
export function canEdit(video: OpenVideo | null): boolean {
  return video?.status === 'ready' && video.state !== null;
}
