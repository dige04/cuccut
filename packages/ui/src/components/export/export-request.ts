import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';

/**
 * 从别处请视频栏打开导出弹层（剪成短视频结果页的「全部导出…」）：先打开那部视频，编辑器挂上它、视频栏的导出按钮看到请求就打开弹层，
 * 只用一次。
 */
export const useExportRequest = create<{ videoId: Id | null }>(() => ({ videoId: null }));

export function requestExport(videoId: Id): void {
  useExportRequest.setState({ videoId });
}

export function clearExportRequest(videoId: Id): void {
  if (useExportRequest.getState().videoId === videoId) useExportRequest.setState({ videoId: null });
}
