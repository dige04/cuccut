import type { Id } from '@cuccut/protocol';
import { create } from 'zustand';
import { hostPanelTab, useEditor, type PanelTab } from '../../state/editor-store.ts';
import { useTranscriptMode } from './transcript-mode.ts';

/** 「去文稿调整」/「调起止」出发时右栏在哪（产品设计 §5.10）：横幅在文稿里换成回那里的一格。 */
export interface CutOrigin {
  videoId: Id;
  tab: PanelTab;
}

/**
 * 子视频进文稿调起止（原型 editor.jsx `openCutEntry` / `cutOrigin` / `closeCutEntry`）：
 * - `origin`：来处。用别的路径换面板（点工具栏、选中片段翻到属性、别的入口推过去）或换视频就清掉——那之后的文稿不算「从那儿跳过来的」。
 * - `jump`：要文稿滚到片段前面那条剪缝的请求，`seen` 是已经滚过的那一次；文稿面板挂上时消费，只滚一次，换页回来不再跳。
 */
export const useCutEntry = create<{ origin: CutOrigin | null; jump: { videoId: Id; n: number } | null; seen: number }>(() => ({
  origin: null,
  jump: null,
  seen: 0,
}));

let jumps = 0;

/** 去文稿调起止：记下来处（右栏在别的面板时），剪辑打开，切到文稿并展开面板，请文稿滚到片段前面。 */
export function openCutEntry(videoId: Id, web: boolean): void {
  const editor = useEditor.getState();
  const from = editor.panelHidden ? null : hostPanelTab(editor.panelTab, web);
  const kept = useCutEntry.getState().origin;
  useTranscriptMode.getState().setMode('cut');
  // 换面板会清掉来处（下面的订阅）：先换，再记。
  editor.showPanel('transcript');
  jumps += 1;
  useCutEntry.setState({
    origin: from && from !== 'transcript' ? { videoId, tab: from } : kept?.videoId === videoId ? kept : null,
    jump: { videoId, n: jumps },
  });
}

/** 回到来处并清掉；没有来处时什么也不做。 */
export function closeCutEntry(): void {
  const { origin } = useCutEntry.getState();
  if (!origin) return;
  useCutEntry.setState({ origin: null });
  useEditor.getState().showPanel(origin.tab);
}

export function clearCutOrigin(): void {
  if (useCutEntry.getState().origin) useCutEntry.setState({ origin: null });
}

/** 文稿滚过了第 `n` 次请求。 */
export function consumeCutJump(n: number): void {
  if (useCutEntry.getState().seen !== n) useCutEntry.setState({ seen: n });
}

// 面板或视频换了：来处作废（换视频时连没消费的滚动请求一起丢掉）。
useEditor.subscribe((s, prev) => {
  if (s.videoId !== prev.videoId) {
    const { origin, jump } = useCutEntry.getState();
    if (origin || jump) useCutEntry.setState({ origin: null, jump: null });
  } else if (s.panelTab !== prev.panelTab) clearCutOrigin();
});
