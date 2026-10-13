import { AI_TOOL_APPLY_KINDS, AI_TOOL_KINDS, type AiToolKind, type AiToolParams, type DocumentRecord, type Id } from '@cuccut/protocol';
import type { AgentToolId } from '../../model/ai-tools.ts';
import { languageName } from '../../model/caption-tracks.ts';
import { isStale, needsTranslation, type PairRow } from '../../model/translation-doc.ts';
import { S } from '../shell-copy.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';

/**
 * Pure logic for the tool page's “Use › Call model directly” (product design §5.10; prototype model-ai-prompt.js `contextPack` / `contextLine` / `hint`):
 * which tools can call a model directly, the reason written for those that cannot, the context line sent to the model, the label on the main button and the line under it saying where the result goes.
 * Running goes through the Runtime's `ai-tool` flow (`AI_TOOL_PIPELINE`); this only assembles the parameters. Refreshing stale translations goes through the in-place refresh of the `translate` flow (`directRefresh`).
 */

/** Which kind, when a model can be called directly; null when it cannot (it can only be handed to an Agent). */
export function directTool(tool: AgentToolId): AiToolKind | null {
  return (AI_TOOL_KINDS as readonly string[]).includes(tool) ? (tool as AiToolKind) : null;
}

/**
 * When refreshing stale translations by calling the model directly, `ai-tool` is not used: the `translate` flow refreshes one translation in place (`translationId`, without naming sentences; the Runtime picks the stale ones,
 * those whose source was edited, and those with no translation yet), the same as “retranslate with the model API” on the subtitle panel's AI button (product design §5.10 “sentence by sentence and stale translations”).
 */
export function directRefresh(tool: AgentToolId): boolean {
  return tool === 'stale';
}

/** The reason line when “Call model directly” is greyed out; null when a model can be called directly. */
export function directBlocked(tool: AgentToolId): string | null {
  if (directTool(tool) || directRefresh(tool)) return null;
  switch (tool) {
    case 'retranscribe':
      return C.whyRetranscribe;
    case 'cleanup':
      return C.whyCleanup;
    case 'cover':
      return C.whyCover;
    default:
      return C.whoModelSub;
  }
}

/** Done writes into the video (one undoable transaction); the others only give a result. */
export function directApplies(tool: AiToolKind): boolean {
  return AI_TOOL_APPLY_KINDS.includes(tool);
}

/** Asks the model to reply against a JSON Schema (polishing, chapters): models without structured output support cannot be used. */
export function needsStructuredOutput(tool: AiToolKind): boolean {
  return tool === 'polish' || tool === 'chapters';
}

/** Chapters always cover the whole video (the model must see the full timeline to split chapters), so no range is accepted. */
export function directHasScope(tool: AiToolKind): boolean {
  return tool !== 'chapters';
}

/** The main button states this tool's own action. */
export function directCta(tool: AiToolKind): string {
  switch (tool) {
    case 'polish':
      return C.ctaPolish;
    case 'chapters':
      return C.ctaChapters;
    case 'summary':
      return C.ctaSummary;
    case 'blog':
      return C.ctaBlog;
    case 'title':
      return C.ctaTitle;
    case 'desc':
      return C.ctaDesc;
  }
}

export interface DirectContext {
  tool: AiToolKind;
  /** Number of segments in the range (counted the same way as the script panel); 0 when there is no script. */
  paragraphs: number;
  /** Name of the selected chapter when one is chosen; null for the whole video. */
  scope: string | null;
  /** Number of chapters on the timeline (sent to the model along with the script; polishing gets only the words, without chapters). */
  chapters: number;
  attachments: number;
  /** Names of the attached skills, in attachment order. */
  skills: readonly string[];
}

/** The context sent to the model, one sentence per item (prototype `contextPack`). */
export function contextItems(c: DirectContext): string[] {
  const items: string[] = [];
  if (c.paragraphs > 0) items.push(C.contextTranscript(c.paragraphs, c.scope));
  if (c.tool !== 'polish' && c.paragraphs > 0 && c.chapters > 0) items.push(C.contextChapters(c.chapters));
  if (c.attachments > 0) items.push(C.contextAttachments(c.attachments));
  // List items are joined the way the product lists them (Chinese 「A、B」, with the enumeration comma 、), not with the conjunction “and” used in sentences.
  if (c.skills.length) items.push(C.contextSkills(S.list(c.skills)));
  return items;
}

/** The line “what is sent to the model: prompt + …”; with nothing attached, only the prompt (prototype `contextLine`). */
export function contextLine(items: readonly string[]): string {
  return items.length ? C.contextLine(items.join(' · ')) : C.contextNone;
}

/** The line under the main button: which model is called directly, where the result goes, whether it costs money (prototype `hint`). */
export function directHint(o: { tool: AiToolKind; model: string | null; local: boolean }): string {
  return C.modelHint(o.model, directApplies(o.tool), o.local);
}

/** Segments in the range: a segment counts if a word in it falls inside the range (seconds on the timeline); segments cut out entirely do not count. */
export function scopedParagraphs(
  paragraphs: readonly { words: readonly { placements: readonly { start: number; end: number }[] }[] }[],
  range: { start: number; end: number } | null,
): number {
  return paragraphs.filter((p) =>
    p.words.some((w) => w.placements.some((at) => (range ? at.end > range.start && at.start < range.end : true))),
  ).length;
}

/** The arguments for `pipelines.start('ai-tool', …)` (`AiToolParams`). */
export function directParams(o: {
  videoId: Id;
  tool: AiToolKind;
  prompt: string;
  range: { start: number; end: number } | null;
  documentId: Id | null;
  attachments: readonly Id[];
  skills: readonly string[];
  model: { providerId: string; modelId: string } | null;
  /** UI language (`getLocale()`). */
  uiLanguage: string;
}): AiToolParams {
  return {
    videoId: o.videoId,
    tool: o.tool,
    prompt: o.prompt,
    ...(o.range && directHasScope(o.tool) ? { range: { start: o.range.start, end: o.range.end } } : {}),
    ...(o.documentId ? { documentId: o.documentId } : {}),
    ...(o.attachments.length ? { attachments: [...o.attachments] } : {}),
    ...(o.skills.length ? { skills: o.skills.map((id) => ({ id })) } : {}),
    ...(o.model ? { provider: o.model.providerId, model: o.model.modelId } : {}),
    uiLanguage: o.uiLanguage,
  };
}

// ---- Refreshing stale translations: call the model directly (in-place `translate`) ----

/** A translation that can be refreshed in place: translated from a transcript of the video. */
export function refreshableTranslations(documents: Record<Id, DocumentRecord>): DocumentRecord[] {
  return Object.values(documents).filter((d) => d.kind === 'translation' && !!d.sourceDocumentId && documents[d.sourceDocumentId]?.kind === 'speech');
}

/**
 * Which translation to refresh: the chosen one if it still exists; then the one the entry point brought (the subtitle panel passes that one's ID, or just the language name); then the first one. null when there are no translations.
 */
export function pickTranslation(
  translations: readonly DocumentRecord[],
  o: { picked: Id | null; presetId?: Id | null; presetLanguage?: string | null },
): DocumentRecord | null {
  const byId = (id: Id | null | undefined) => (id ? translations.find((t) => t.id === id) : undefined);
  const byLanguage = o.presetLanguage ? translations.find((t) => !!t.language && languageName(t.language) === o.presetLanguage) : undefined;
  return byId(o.picked) ?? byId(o.presetId) ?? byLanguage ?? translations[0] ?? null;
}

/** How many sentences to retranslate (counted the same way as the “stale” and “untranslated” counts in the subtitle panel's stats bar): what the Runtime picks when it does not name any. */
export function refreshCounts(rows: readonly PairRow[]): { todo: number; stale: number; untranslated: number } {
  const stale = rows.filter((r) => isStale(r.state)).length;
  const todo = rows.filter(needsTranslation).length;
  return { todo, stale, untranslated: todo - stale };
}
