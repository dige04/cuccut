/**
 * The `downloads` capability of the design canvas runtime (docs/design/canvas §4, §8.3): exported files are in the iframe, so saving has to be done by the CucCut UI.
 *
 * When the runtime exports (the whole canvas, a single board, or a selection), it calls `save({ filename, data })`, which is converted here to `editor:save-file` and sent to the parent window.
 * The parent window hands it to the browser download or opens a save dialog, and replies with `editor:save-file-result`. Both `declined` (the user cancelled) and `failed` reject,
 * with the error carrying `code`. The runtime treats `declined` as the user cancelling, and anything else as the host failing to save (single-board export falls back to the browser download inside the iframe).
 * No timeout: the save dialog may stay open indefinitely.
 */
import type { SaveFileOutcome } from '@cuccut/slides/editor-messages';
import type { ParentLink } from '@cuccut/slides/editor';

export interface HostSaveFile {
  filename: string;
  data: Blob | ArrayBuffer;
  /** The number of that export request that the parent window expects via the frame protocol; CucCut does not use it to match replies. */
  request?: string;
}

export interface HostDownloadsCapability {
  save(file: HostSaveFile): Promise<void>;
}

export interface DownloadsBridge {
  capability: HostDownloadsCapability;
  /** Stops listening to parent-window messages; any pending requests are treated as not saved. */
  dispose(): void;
}

/** Error given to the runtime on rejection: `code` is `declined` or `failed` (downloadErrorCode in export/downloads.tsx). */
class SaveFileError extends Error {
  readonly code: Exclude<SaveFileOutcome, 'saved'>;
  constructor(code: Exclude<SaveFileOutcome, 'saved'>) {
    super(code === 'declined' ? 'the save was cancelled' : 'the file was not saved');
    this.code = code;
  }
}

export function createDownloadsBridge(link: ParentLink, newId: () => string = () => crypto.randomUUID()): DownloadsBridge {
  const pending = new Map<string, (outcome: SaveFileOutcome) => void>();
  const stop = link.onMessage(message => {
    if (message.type === 'editor:save-file-result') pending.get(message.requestId)?.(message.outcome);
  });
  return {
    capability: {
      save: ({ filename, data }) =>
        new Promise<void>((resolve, reject) => {
          const requestId = newId();
          pending.set(requestId, outcome => {
            pending.delete(requestId);
            if (outcome === 'saved') resolve();
            else reject(new SaveFileError(outcome));
          });
          link.post({ type: 'editor:save-file', requestId, filename, data });
        }),
    },
    dispose() {
      stop();
      for (const settle of [...pending.values()]) settle('failed');
    },
  };
}
