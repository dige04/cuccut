/**
 * 设计稿运行时的 `downloads` 能力（docs/design/canvas §4、§8.3）：导出的文件在 iframe 里，保存要由 CucCut 界面来做。
 *
 * 运行时导出（整份设计稿、单个画板、选区）时调 `save({ filename, data })`，这里转成 `editor:save-file` 发给父窗口；
 * 父窗口交给浏览器下载或弹存储对话框，回 `editor:save-file-result`。`declined`（用户取消了）与 `failed` 都拒绝，
 * 错误带 `code`：运行时把 `declined` 当作用户取消，别的当作宿主没能保存（单个画板的导出退回 iframe 里的浏览器下载）。
 * 不设超时：存储对话框可以一直开着。
 */
import type { SaveFileOutcome } from '@cuccut/slides/editor-messages';
import type { ParentLink } from '@cuccut/slides/editor';

export interface HostSaveFile {
  filename: string;
  data: Blob | ArrayBuffer;
  /** 父窗口经 frame 协议要的那次导出的编号；CucCut 不用它对应。 */
  request?: string;
}

export interface HostDownloadsCapability {
  save(file: HostSaveFile): Promise<void>;
}

export interface DownloadsBridge {
  capability: HostDownloadsCapability;
  /** 停止收父窗口的消息，等着的都按没保存处理。 */
  dispose(): void;
}

/** 拒绝时给运行时读的错误：`code` 是 `declined` 或 `failed`（export/downloads.tsx 的 downloadErrorCode）。 */
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
