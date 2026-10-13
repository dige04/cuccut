import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';
import { hostPanelTab, useEditor, type PanelTab } from '../../state/editor-store.ts';
import { useTranscriptMode } from './transcript-mode.ts';

/** Where the right column was when “去文稿调整”(adjust in script) or “调起止”(adjust start and end) was started (product design §5.10). In the script, the banner is replaced by a cell that returns there. */
export interface CutOrigin {
  videoId: Id;
  tab: PanelTab;
}

/**
 * Opening a child video's cut start and end from the script (prototype editor.jsx `openCutEntry` / `cutOrigin` / `closeCutEntry`):
 * - `origin`: where the user came from. It is cleared when the panel is switched by another path (clicking the toolbar, selecting a clip and jumping to properties, another entry point pushing the user there) or when the video changes. A script opened after that does not count as “jumped here from there”.
 * - `jump`: a request to make the script scroll to the cut seam in front of the clip; `seen` is the request that has already been scrolled to. It is consumed when the script panel mounts, scrolls only once, and does not jump again when the user returns to the page.
 */
export const useCutEntry = create<{ origin: CutOrigin | null; jump: { videoId: Id; n: number } | null; seen: number }>(() => ({
  origin: null,
  jump: null,
  seen: 0,
}));

let jumps = 0;

/** Adjusting the cut's start and end from the script: records the origin (when the right column is on another panel), opens the cut, switches to the script and expands the panel, and asks the script to scroll to the front of the clip. */
export function openCutEntry(videoId: Id, web: boolean): void {
  const editor = useEditor.getState();
  const from = editor.panelHidden ? null : hostPanelTab(editor.panelTab, web);
  const kept = useCutEntry.getState().origin;
  useTranscriptMode.getState().setMode('cut');
  // Switching panels clears the origin (see the subscription below), so switch first, then record.
  editor.showPanel('transcript');
  jumps += 1;
  useCutEntry.setState({
    origin: from && from !== 'transcript' ? { videoId, tab: from } : kept?.videoId === videoId ? kept : null,
    jump: { videoId, n: jumps },
  });
}

/** Goes back to the origin and clears it; does nothing if there is no origin. */
export function closeCutEntry(): void {
  const { origin } = useCutEntry.getState();
  if (!origin) return;
  useCutEntry.setState({ origin: null });
  useEditor.getState().showPanel(origin.tab);
}

export function clearCutOrigin(): void {
  if (useCutEntry.getState().origin) useCutEntry.setState({ origin: null });
}

/** The script has scrolled for the `n`-th request. */
export function consumeCutJump(n: number): void {
  if (useCutEntry.getState().seen !== n) useCutEntry.setState({ seen: n });
}

// Panel or video changed: the origin is invalidated (when the video changes, any unconsumed scroll request is dropped too).
useEditor.subscribe((s, prev) => {
  if (s.videoId !== prev.videoId) {
    const { origin, jump } = useCutEntry.getState();
    if (origin || jump) useCutEntry.setState({ origin: null, jump: null });
  } else if (s.panelTab !== prev.panelTab) clearCutOrigin();
});
