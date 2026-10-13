import {
  defineMessages,
  intlLocale,
  type GenerateTextRequest,
  type JobRecord,
  type SpaceEntry,
  type TextCapabilityParameters,
  type TextJobResult,
  type TextModelInfo,
} from '@cuccut/protocol';
import { EFFORT_LABEL } from './models-text.ts';
import { codePoints, modelKeyOf, type ToolModelOption } from './tools-models.ts';
import { zhHans } from './tools-text.zh-Hans.ts';
import { zhHant } from './tools-text.zh-Hant.ts';
import { ja } from './tools-text.ja.ts';
import { ko } from './tools-text.ko.ts';
import { es } from './tools-text.es.ts';
import { fr } from './tools-text.fr.ts';
import { de } from './tools-text.de.ts';
import { nl } from './tools-text.nl.ts';
import { ptBR } from './tools-text.pt-BR.ts';
import { it } from './tools-text.it.ts';
import { ru } from './tools-text.ru.ts';
import { pl } from './tools-text.pl.ts';
import { tr } from './tools-text.tr.ts';
import { vi } from './tools-text.vi.ts';

/** Copy for the text generation workbench (translations in `tools-text.<语言>.ts`). Numbers are already written for the UI language. */
const en = {
  emptyInput: 'Enter what to generate first',
  tooLong: (max: string) => `Up to ${max} characters at a time`,
  /** "Fill in a sample": fills the input box, and is also sent to the model as-is. */
  sample: 'Write a 30-second voice-over for a city walk video. Keep the tone natural and feature the streets, cafés and dusk.',
  counter: (n: string, max: string) => `${n} / ${max} characters`,
  connectTextModel: 'Connect a text model first',
  connectFirst: (provider: string) => `Connect ${provider} first`,
  effortFixed: 'Reasoning effort · not adjustable for this model',
  effort: (label: string) => `Reasoning effort · ${label} (default set on the Models page)`,
  auto: 'Auto',
  headerChip: (provider: string) => `Online · ${provider} · billed by token`,
  /** Start of the download filename. */
  fileStem: 'Generated text',
  chars: (n: string) => `${n} characters`,
  outputTokens: (n: string) => `${n} output tokens`,
  truncated: 'Reached the output limit; the rest was cut off',
};
export type ToolsTextMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

function num(n: number): string {
  return n.toLocaleString(intlLocale());
}

/**
 * Text generation workbench (design mocks tool-llm.jsx `LlmToolPage kind='text'`, model-llm-tools.js `request`):
 * one text-model call; no agent session is created and no tools are called. There is only one user message; the reasoning effort uses the default set on the models page (`models.setCapabilityParameters`).
 * The result is the output of a `models.generateText` task, which the Runtime lists as a document in Space (runtime-core space/space-derive.ts).
 */

export type TextOption = ToolModelOption<TextModelInfo>;

/** Maximum input characters (design mock model-llm-tools.js `request`: 16,000). Counted in code points. */
export const MAX_TEXT_INPUT = 16_000;

/** A few original phrases from the design mock model-llm-tools.js `request`. */
export function emptyInput(): string {
  return M.emptyInput;
}
export function tooLong(): string {
  return M.tooLong(num(MAX_TEXT_INPUT));
}

/** "Fill in a sample" (design mock tool-llm.jsx `sample`). */
export function textSample(): string {
  return M.sample;
}

export interface TextDraft {
  input: string;
  /** `providerId/modelId`; null means none chosen yet. */
  model: string | null;
}

export const BLANK_TEXT: TextDraft = { input: '', model: null };

// ---- Validation and request ----

export function textProblems(draft: Pick<TextDraft, 'input'>): string[] {
  const input = draft.input.trim();
  if (!input) return [emptyInput()];
  if (codePoints(input) > MAX_TEXT_INPUT) return [tooLong()];
  return [];
}

/** Character count line (design mock `${n} / 16,000 字符`); turns red when over the limit. */
export function textCounter(draft: Pick<TextDraft, 'input'>): { text: string; over: boolean } {
  const n = codePoints(draft.input.trim());
  return { text: M.counter(num(n), num(MAX_TEXT_INPUT)), over: n > MAX_TEXT_INPUT };
}

/**
 * Parameters for `models.generateText`: one user message, naming the provider and model; reasoning effort and output limit are not given (the model page's defaults and the model's limits apply).
 * When a Space item (`material`) is attached, the Runtime appends its text after this message (architecture design §7.9, "Space item as input"); the generation request must still be written.
 */
export function textRequest(
  draft: Pick<TextDraft, 'input'>,
  option: Pick<TextOption, 'providerId' | 'modelId'>,
  material: { entryId: string } | null = null,
): Omit<GenerateTextRequest, 'commandId'> {
  return {
    messages: [{ role: 'user', content: draft.input.trim() }],
    provider: option.providerId,
    model: option.modelId,
    ...(material ? { material: { entryId: material.entryId } } : {}),
  };
}

/** The sentence beside the main button: the gate, the problem, or who will be used this time. */
export function textStatus(draft: Pick<TextDraft, 'input'>, option: TextOption | null, tried: boolean): { text: string; bad: boolean } {
  if (!option) return { text: M.connectTextModel, bad: true };
  if (!option.usable) return { text: option.connected ? `${option.provider} · ${option.why}` : M.connectFirst(option.provider), bad: true };
  const empty = emptyInput();
  const problem = textProblems(draft).find((p) => tried || p !== empty);
  if (problem) return { text: problem, bad: true };
  return { text: `${option.provider} · ${option.modelId}`, bad: false };
}

// ---- Model ----

/**
 * The reasoning effort sentence: this tool page doesn't pick it separately; it uses the default set on the models page (`models.setCapabilityParameters`). When the model can't adjust it, say so plainly.
 * If the model doesn't have the default tier, the Runtime swaps in the closest tier, and the result notes it.
 */
export function textEffortLine(parameters: Pick<TextCapabilityParameters, 'effort'>, info: Pick<TextModelInfo, 'efforts'>): string {
  if (!info.efforts.length) return M.effortFixed;
  return M.effort(parameters.effort ? EFFORT_LABEL[parameters.effort] : M.auto);
}

/** The header chip: who serves it. Text is billed by token (design mock settings-cloud.jsx's wording). */
export function textHeaderChip(option: Pick<TextOption, 'provider'> | null): string | null {
  return option ? M.headerChip(option.provider) : null;
}

// ---- Records ----

type TextGeneration = Extract<NonNullable<JobRecord['generation']>, { capability: 'generateText' }>;

function generationOf(job: Pick<JobRecord, 'generation'>): TextGeneration | null {
  return job.generation?.capability === 'generateText' ? job.generation : null;
}

/** The generation request for this record: the first user message. */
export function textPrompt(job: Pick<JobRecord, 'generation'>): string {
  return generationOf(job)?.messages.find((m) => m.role === 'user')?.content ?? '';
}

/** Summary of a completed result; null when there is none. */
export function textResultOf(job: Pick<JobRecord, 'result'>): TextJobResult | null {
  return job.result?.text ?? null;
}

/** Hit the output limit and was truncated (the Runtime gives an `output-truncated` warning; the result still completes). */
export function textTruncated(job: Pick<JobRecord, 'warnings' | 'result'>): boolean {
  return job.warnings.some((w) => w.code === 'output-truncated') || job.result?.text?.finishReason === 'length';
}

/**
 * Download filename: same name as the document in Space (runtime-core space/space-derive.ts `fileNameOf`: 生成文本-20261003-101500.txt),
 * structured output is `.json`.
 */
export function textFileName(job: Pick<JobRecord, 'endedAt' | 'createdAt' | 'result'>): string {
  const at = (job.endedAt ?? job.createdAt).replace(/\.\d+Z$/, '').replace(/Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  const ext = job.result?.text?.mediaType === 'application/json' ? 'json' : 'txt';
  return `${M.fileStem}-${at}.${ext}`;
}

/** This result's document in Space (found by artifact ID; ones sent to the trash don't count). */
export function textSpaceEntry(entries: readonly SpaceEntry[], job: Pick<JobRecord, 'result'>): SpaceEntry | null {
  const artifactId = job.result?.artifactId;
  if (!artifactId) return null;
  return entries.find((e) => !e.user.trashedAt && e.ref && 'artifactId' in e.ref && e.ref.artifactId === artifactId) ?? null;
}

/** One line of facts on the result card: how many characters, whether there is structured output, tokens used, and whether it was truncated. */
export function textFacts(job: Pick<JobRecord, 'warnings' | 'result'>): string {
  const text = textResultOf(job);
  if (!text) return '';
  const usage = text.usage;
  return [
    M.chars(num(text.length)),
    text.mediaType === 'application/json' ? 'JSON' : null,
    usage && usage.outputTokens !== null ? M.outputTokens(num(usage.outputTokens)) : null,
    textTruncated(job) ? M.truncated : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Bring back to the left to revise": this record's request and model go back to the form. */
export function againTextDraft(job: JobRecord): Partial<TextDraft> | null {
  const g = generationOf(job);
  if (!g) return null;
  return { input: textPrompt(job), model: modelKeyOf(job.providerId, job.modelId) };
}

/**
 * "Try again": resubmits the frozen parameters unchanged (same provider and model). The reasoning effort goes back to the tier originally requested (`requestedEffort`),
 * not the `effort` after a tier swap; the swap is decided again by the Runtime based on the model.
 */
export function retryTextRequest(job: JobRecord): Omit<GenerateTextRequest, 'commandId'> | null {
  const g = generationOf(job);
  if (!g) return null;
  return {
    messages: g.messages.map((m) => ({ ...m })),
    responseFormat: g.responseFormat,
    maxOutputTokens: g.maxOutputTokens,
    ...(g.temperature !== null ? { temperature: g.temperature } : {}),
    ...(g.requestedEffort !== null ? { effort: g.requestedEffort } : {}),
    ...(g.seed !== null ? { seed: g.seed } : {}),
    provider: job.providerId,
    model: job.modelId,
  };
}
