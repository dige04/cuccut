import type { FoldPlan } from './shorts-fold.ts';
import type { TranscriptParagraph, TranscriptWord } from './transcript-cut.ts';

/**
 * 子视频进文稿调起止（产品设计 §5.10「改一支短视频」，原型 model-shorts-cut.js `cutEntryAction` / `childLanding` / `entryAnchor`）：
 * 起止就在文稿里调——片段外的话划掉保留，点一下放回来，再剪就是普通的剪（§4.6）。这里只是入口的规则：
 * 横幅那一格写什么、点了去哪；子视频打开时右栏落在哪；进文稿时滚到哪。文案不在这里，界面按 `kind` 取。
 */

/**
 * 横幅入口那一格：
 * - `adjust`：右栏不在文稿（或收着），「去文稿调整」——切到文稿、剪辑打开、滚到片段前面的剪缝，记下来处。
 * - `backResult`：从 AI 工具 Tab 跳进文稿、这一支有结果页且这个表面有 AI 工具，「回到结果页」。
 * - `back`：从别的面板跳进文稿，「回到<那个面板>」（`railLabel` 是它在工具栏上的名字）。
 * - `result`：直接落在文稿（或跳过来之后又换过面板），有结果页且有 AI 工具时「看结果页」。
 * - `null`：都不是，不摆。
 */
export type CutEntryKind = 'adjust' | 'back' | 'backResult' | 'result';

export interface CutEntryAction<T extends string> {
  kind: CutEntryKind | null;
  /** 点了去哪个面板；`adjust` 是文稿，`result` / `backResult` 是 AI 工具。 */
  to: T | 'transcript' | 'aitools' | null;
  /** `back` 时来处的工具栏名字。 */
  railLabel: string | null;
}

/**
 * `tab` 是右栏现在的面板（收着时传 null）；`origin` 是「去文稿调整」/「调起止」记下的来处（别的路径换面板、换视频时清掉）；
 * `hasResult` 这一支有结果页，`ai` 这个表面有 AI 工具，`railLabel` 是来处在工具栏上的名字。
 */
export function cutEntryAction<T extends string>(
  tab: T | null,
  origin: { tab: T } | null | undefined,
  options: { hasResult?: boolean; ai?: boolean; railLabel?: string | null } = {},
): CutEntryAction<T> {
  const result = !!(options.hasResult && options.ai);
  if (tab !== 'transcript') return { kind: 'adjust', to: 'transcript', railLabel: null };
  if (origin && origin.tab !== 'transcript') {
    if (origin.tab === 'aitools' && result) return { kind: 'backResult', to: 'aitools', railLabel: null };
    return { kind: 'back', to: origin.tab, railLabel: options.railLabel || origin.tab };
  }
  if (result) return { kind: 'result', to: 'aitools', railLabel: null };
  return { kind: null, to: null, railLabel: null };
}

/**
 * 打开一部视频时右栏落在哪、要不要打开文稿的剪辑：交接带了面板（结果页点卡、横幅回到原片带的是 AI 工具 Tab）就听它；
 * 没带——Space、会话里的视频卡、父视频「切出的短视频」、直接打开——子视频落在文稿并打开剪辑（片段外的话划掉显示）；
 * 别的视频有内容落在文稿、空的落在视频。`hasItems` 还不知道（快照没到）时不动。
 */
export function landingPanel<T extends string>(options: {
  handoff: T | null | undefined;
  child: boolean;
  hasItems: boolean | undefined;
}): { tab: T | 'transcript' | 'video' | undefined; cut: boolean } {
  if (options.handoff) return { tab: options.handoff, cut: false };
  if (options.hasItems === undefined) return { tab: undefined, cut: false };
  if (options.child) return { tab: 'transcript', cut: true };
  return { tab: options.hasItems ? 'transcript' : 'video', cut: false };
}

/** 进文稿时滚到的那一行：片段前面那条剪缝，或片段第一句所在的段（`paragraphs` 里的下标）。 */
export type EntryAnchor = { fold: 'before' } | { paragraph: number };

/**
 * 「去文稿调整」/「调起止」滚到哪：片段前面收着话就落在那条剪缝（铺开过的也还在）；没有剪缝（片段前面没几句）就落在
 * 片段第一个留下的词所在的段。`words` 是文稿的词，`paragraphs` 是去掉收起的词之后画出来的段。整支剪光了（没有折叠）时 null。
 */
export function entryAnchor(
  plan: FoldPlan | null,
  words: readonly TranscriptWord[],
  paragraphs: readonly TranscriptParagraph[],
): EntryAnchor | null {
  if (!plan) return null;
  if (plan.before) return { fold: 'before' };
  const first = words[plan.firstKept];
  if (!first) return null;
  const index = paragraphs.findIndex((p) => p.words.some((w) => w.index === first.index));
  return index >= 0 ? { paragraph: index } : null;
}
