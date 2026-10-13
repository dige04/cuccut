import { SAVE_FILE_TYPES, saveFileName, type SaveFileOutcome } from '@cuccut/slides/editor-messages';
import { ToastQueue } from '@react-spectrum/s2';
import type { HostBridge } from '../../host.ts';
import { shortenPath } from '../../model/format.ts';
import { downloadBlob } from '../media/gif.ts';

/** Export copy (design draft `DESIGN`, docs/design/canvas §8.3). */
export interface EditorExportCopy {
  exportMenu: string;
  exportHtml: string;
  exportPdf: string;
  exportPng: string;
  exportDialogTitle: string;
  exportDialogButton: string;
  exportSaved(path: string): string;
  exportFailed(reason: string): string;
  exportUnsupported(name: string): string;
}

/**
 * Save an export file handed over by the editor (`editor:save-file`). On desktop, show the system save dialog and let the main process write it (`host.saveFile`), then show the saved path.
 * The web has no local paths, so it picks a file type from the extension and hands the file to the browser to download; the browser shows the download itself. If the extension is not allowed or the write fails, show a message and return `failed`.
 * Cancelling the dialog returns `declined`, and the editor stops prompting.
 */
export async function saveEditorFile(
  host: Pick<HostBridge, 'saveFile'>,
  file: { filename: string; data: ArrayBuffer | Blob },
  copy: EditorExportCopy,
): Promise<SaveFileOutcome> {
  const name = saveFileName(file.filename);
  if (!name) {
    ToastQueue.negative(copy.exportUnsupported(file.filename.slice(0, 200)), { timeout: 6000 });
    return 'failed';
  }
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  try {
    if (!host.saveFile) {
      downloadBlob(new Blob([file.data], { type: SAVE_FILE_TYPES[ext] }), name);
      return 'saved';
    }
    const data = new Uint8Array(file.data instanceof Blob ? await file.data.arrayBuffer() : file.data);
    const path = await host.saveFile({
      title: copy.exportDialogTitle,
      buttonLabel: copy.exportDialogButton,
      defaultName: name,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      data,
    });
    if (!path) return 'declined';
    ToastQueue.positive(copy.exportSaved(shortenPath(path)), { timeout: 5000 });
    return 'saved';
  } catch (error) {
    ToastQueue.negative(copy.exportFailed(error instanceof Error ? error.message : String(error)), { timeout: 6000 });
    return 'failed';
  }
}
