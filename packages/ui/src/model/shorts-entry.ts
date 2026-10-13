import type { FoldPlan } from './shorts-fold.ts';
import type { TranscriptParagraph, TranscriptWord } from './transcript-cut.ts';

/**
 * Entering the script from a child video to adjust its in and out points (product design §5.10 “Change a short video”; prototype model-shorts-cut.js `cutEntryAction` / `childLanding` / `entryAnchor`): in and out are adjusted right in the script. Words outside the clip are struck through and kept; clicking one brings it back, and cutting again is an ordinary cut (§4.6). This module holds only the entry rules: what the banner cell says, where a click goes, where the right column lands when a child video opens, and where the script scrolls to on entry. The copy is not here; the UI picks it by `kind`.
 */

/**
 * The cell in the banner entry:
 * - `adjust`: the right column is not on the script (or is collapsed); “Adjust in script” — switch to the script, open cut editing, scroll to the cut seam in front of the clip, and record the origin.
 * - `backResult`: jumped into the script from the AI tools tab, this branch has a result page, and this surface has an AI tool; “Back to result page”.
 * - `back`: jumped into the script from another panel; “Back to <that panel>”, where `railLabel` is that panel's name on the toolbar.
 * - `result`: landed directly on the script (or switched panels after jumping over); has a result page and an AI tool; “View result page”.
 * - `null`: none of these; nothing is shown.
 */
export type CutEntryKind = 'adjust' | 'back' | 'backResult' | 'result';

export interface CutEntryAction<T extends string> {
  kind: CutEntryKind | null;
  /** Which panel a click goes to: `adjust` is the script; `result` and `backResult` are the AI tools. */
  to: T | 'transcript' | 'aitools' | null;
  /** For `back`, the origin's name on the toolbar. */
  railLabel: string | null;
}

/**
 * `tab` is the panel currently in the right column (pass null when it is collapsed); `origin` is the origin recorded by “去文稿调整” / “adjust in/out” (cleared when another path switches panels or videos); `hasResult` means this branch has a result page; `ai` means this surface has AI tools; `railLabel` is the origin's name on the toolbar.
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
 * Which panel the right column lands on when a video opens, and whether the script's cut editing opens: when a handoff carries a panel (clicking a card on the result page, or the banner's return-to-original carries the AI tools tab), follow it. When none is carried — Space, a video card in the session, a “cut-out short video” from its parent video, or a direct open — a child video lands on the script and opens cut editing (words outside the clip shown struck through); another video with content lands on the script, and an empty one lands on the video. While `hasItems` is not yet known (the snapshot has not arrived), nothing is changed.
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

/** The line to scroll to when entering the script: the cut seam in front of the clip, or the paragraph (its index in `paragraphs`) holding the clip's first sentence. */
export type EntryAnchor = { fold: 'before' } | { paragraph: number };

/**
 * Where “去文稿调整” / “adjust in/out” scrolls to: if words in front of the clip are collapsed, it lands on that cut seam (ones already spread out are still there); if there is no seam (few sentences before the clip), it lands on the paragraph holding the clip's first kept word. `words` are the script's words, and `paragraphs` are the paragraphs drawn after removing collapsed words. null when the whole branch has been cut away (no folding).
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
