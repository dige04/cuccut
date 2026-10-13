import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';

/**
 * Asking the video bar from elsewhere to open the export panel (the "Export all…" on the short-video result page): first open that video, the editor mounts it, and the video bar's export button sees the request and opens the panel. Used once only.
 */
export const useExportRequest = create<{ videoId: Id | null }>(() => ({ videoId: null }));

export function requestExport(videoId: Id): void {
  useExportRequest.setState({ videoId });
}

export function clearExportRequest(videoId: Id): void {
  if (useExportRequest.getState().videoId === videoId) useExportRequest.setState({ videoId: null });
}
