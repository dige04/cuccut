import { SAVE_FILE_TYPES, saveFileName, type SaveFileOutcome } from '@cuccut/slides/editor-messages';
import { ToastQueue } from '@react-spectrum/s2';
import type { HostBridge } from '../../host.ts';
import { shortenPath } from '../../model/format.ts';
import { downloadBlob } from '../media/gif.ts';

/** 导出的文案（设计稿 `DESIGN`，docs/design/canvas §8.3）。 */
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
 * 保存编辑器交来的导出文件（`editor:save-file`）：桌面端弹系统存储对话框、主进程写入（`host.saveFile`），存好后提示路径；
 * Web 没有本机路径，按扩展名给文件类型后交给浏览器下载，浏览器自己显示下载。扩展名不在允许的范围里、写不进去时提示，回 `failed`；
 * 在对话框里取消回 `declined`，编辑器不再提示。
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
