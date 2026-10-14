import fs from 'node:fs/promises';
import { RpcError, type GlossaryEntry, type Id, type JobCallCounts, type TranslateSummary } from '@cuccut/protocol';
import { TextGenerationError, type TextGenerator } from '@cuccut/models';
import type { ArtifactStore } from '../artifact-store.ts';
import { JobsTranslationBatches as J } from '@cuccut/protocol/messages/jobs/translation-batches.ts';
import { joinList } from '../job-text.ts';
import { CallCounter, PipelineStepError, type PipelinePrepareOptions, type ProgressReporter } from './pipeline.ts';
import { translationMessages, translationSchema } from './translation-prompts.ts';
import {
  MAX_LIBRARY_GLOSSARIES,
  glossarySnapshot,
  resolveGlossaries,
  selectTerms,
  type FrozenGlossary,
  type GlossaryLibrary,
  type GlossarySnapshot,
  type PromptTerm,
} from './translation-glossary.ts';

/**
 * Batch translation (architecture design §7.9): the part shared by `translate` (a script inside a video) and `translate-subtitles` (subtitle files). It covers batching, carrying preceding context, carrying only the relevant terms in each batch, checking structured output one-to-one by ID, a limited number of resends when the output does not match, concurrency and call counting, and also validation, freezing and reading of the glossary parameters.
 * Each of the two pipelines decides where its source comes from and where its translation is written.
 */

/** How many preceding sentences each batch carries as reference. */
const CONTEXT_SENTENCES = 3;

/** The `glossary` parameter: terms passed directly in the call. */
export const GLOSSARY_SCHEMA = {
  type: 'array',
  maxItems: 500,
  items: {
    type: 'object',
    properties: { source: { type: 'string' }, target: { type: 'string' }, note: { type: 'string' } },
    required: ['source', 'target'],
    additionalProperties: false,
  },
};

/** The `glossaries` parameter (shared by translation, translated dubbing and subtitle-file translation). */
export const GLOSSARIES_SCHEMA = {
  type: 'array',
  maxItems: MAX_LIBRARY_GLOSSARIES,
  // i18n-ignore: parameter descriptions (JSON Schema for the agent)
  description: 'ID of a translation glossary in the user’s Library (a version can be specified); used together with the glossaries enabled in the video',
  items: {
    type: 'object',
    properties: { id: { type: 'string' }, version: { type: 'integer', minimum: 1 } },
    required: ['id'],
    additionalProperties: false,
  },
};

/** `glossary`: each entry must have a non-empty source term and translation. */
export function parseInlineGlossary(raw: unknown[] | undefined): GlossaryEntry[] | undefined {
  if (raw === undefined) return undefined;
  return raw.map((entry) => {
    const e = entry as Partial<GlossaryEntry> | null;
    if (!e || typeof e.source !== 'string' || typeof e.target !== 'string' || e.source.trim() === '' || e.target.trim() === '') {
      throw new RpcError('invalid-request', J.glossaryItemInvalid());
    }
    if (e.note !== undefined && typeof e.note !== 'string') throw new RpcError('invalid-request', J.glossaryNoteInvalid());
    return { source: e.source, target: e.target, ...(e.note ? { note: e.note } : {}) };
  });
}

/** `glossaries`: the IDs of library glossaries, with an optional version. */
export function parseGlossaryRefs(raw: unknown[] | undefined): Array<{ id: Id; version?: number }> | undefined {
  if (raw === undefined) return undefined;
  return raw.map((item) => {
    const ref = item as { id?: unknown; version?: unknown } | null;
    if (!ref || typeof ref !== 'object' || typeof ref.id !== 'string' || ref.id === '' || ref.id.length > 100) {
      throw new RpcError('invalid-request', J.glossariesItemInvalid());
    }
    const extra = Object.keys(ref).filter((k) => k !== 'id' && k !== 'version');
    if (extra.length > 0) throw new RpcError('invalid-request', J.glossariesUnknownFields({ fields: joinList(extra) }));
    if (ref.version !== undefined && !(Number.isInteger(ref.version) && (ref.version as number) >= 1)) {
      throw new RpcError('invalid-request', J.glossariesVersionInvalid());
    }
    return { id: ref.id, ...(ref.version !== undefined ? { version: ref.version as number } : {}) };
  });
}

/** Frozen glossary: library entries and versions, glossaries the video enables but this run does not use, and the artifacts holding their contents. */
export interface FrozenGlossaryUse {
  entries: FrozenGlossary[];
  skipped: Array<{ id: Id; reason: 'removed' | 'language' }>;
  /** The artifact for a `GlossarySnapshot`. null when there are no library entries (only terms passed in the call are used). */
  artifactId: string | null;
}

/** The two term-related items in the frozen parameters. */
export interface GlossaryParams {
  glossary?: GlossaryEntry[];
  glossaryUse?: FrozenGlossaryUse;
}

/**
 * Resolves library glossaries at startup: the ones passed in the call (`explicit`) and the ones enabled in the video (`enabled`, empty when there is no video). When library entries are used, their contents are written as artifacts, and later steps read only those artifacts. undefined when there are none.
 */
export async function freezeGlossaryUse(
  deps: { library?: GlossaryLibrary; artifacts?: Pick<ArtifactStore, 'put'> },
  input: {
    explicit: Array<{ id: Id; version?: number }>;
    enabled: Id[];
    targetLanguage: string;
    sourceLanguage: string | null;
    submitter: PipelinePrepareOptions['submitter'];
  },
): Promise<FrozenGlossaryUse | undefined> {
  const resolved = resolveGlossaries({ library: deps.library, ...input });
  if (resolved.entries.length === 0 && resolved.skipped.length === 0) return undefined;
  let artifactId: string | null = null;
  if (resolved.entries.length > 0) {
    if (!deps.artifacts) throw new RpcError('invalid-request', J.cannotFreezeGlossaries());
    // Immediately after resolution, read out the frozen versions and write them as artifacts. Later steps read only the artifacts.
    const snapshot = glossarySnapshot(deps.library, [], resolved.entries);
    artifactId = (await deps.artifacts.put(Buffer.from(JSON.stringify(snapshot)), 'json')).artifactId;
  }
  return { entries: resolved.entries, skipped: resolved.skipped, artifactId };
}

/** Terms used for this translation: those passed directly in the call, plus the contents of the frozen library glossaries. */
export async function loadGlossaries(artifacts: ArtifactStore, params: GlossaryParams): Promise<GlossarySnapshot> {
  const stored = params.glossaryUse?.artifactId ? await readArtifact<GlossarySnapshot>(artifacts, params.glossaryUse.artifactId) : null;
  return { inline: params.glossary ?? [], entries: stored?.entries ?? [] };
}

/** Glossary in the summary: undefined when none was passed in the call and the video does not enable one. */
export function glossarySummary(
  params: GlossaryParams,
  translated: { glossaryTerms?: number; cappedBatches?: number } | null | undefined,
): TranslateSummary['glossary'] {
  const use = params.glossaryUse;
  if (!use && !params.glossary?.length) return undefined;
  return {
    entries: (use?.entries ?? []).map(({ id, version, contentHash, name, origin }) => ({ id, version, contentHash, name, origin })),
    skipped: use?.skipped ?? [],
    terms: translated?.glossaryTerms ?? 0,
    cappedBatches: translated?.cappedBatches ?? 0,
  };
}

export async function readArtifact<T>(artifacts: ArtifactStore, artifactId: string): Promise<T> {
  const file = await artifacts.locate(artifactId);
  if (!file) throw new PipelineStepError('ARTIFACT_NOT_FOUND', J.artifactGone({ artifactId }));
  return JSON.parse(await fs.readFile(file, 'utf8')) as T;
}

/** Input for one batch translation: the source (by ID), languages, style, frozen model and batch size, and the terms after deduplication. */
export interface BatchTranslationInput {
  sentences: Array<{ id: Id; text: string }>;
  targetLanguage: string;
  sourceLanguage: string | null;
  style?: string;
  provider: string;
  model: string;
  batchSize: number;
  terms: PromptTerm[];
}

export interface BatchTranslationOptions {
  /** How many more times to resend a batch when its output does not match the contract. */
  retries: number;
  /** Number of batches in flight at the same time. */
  concurrency: number;
  signal: AbortSignal;
  progress: ProgressReporter;
  /** What one source item is (used in error messages): a sentence for a script (the default), a single cue for a subtitle file. */
  unit?: 'sentence' | 'cue';
}

export interface BatchTranslationResult {
  /** One-to-one with the input, in the same order. */
  translations: Array<{ id: Id; text: string }>;
  calls: JobCallCounts;
  modelVersion: string | null;
  /** Number of batches where the relevant terms exceeded the limit. */
  cappedBatches: number;
}

/** Translates sentence by sentence in batches. Each batch's output must correspond one-to-one with that batch. If it does not match, resend; if it still does not match, throw (no half-finished translation is kept). */
export async function translateInBatches(
  text: Pick<TextGenerator, 'generate'>,
  input: BatchTranslationInput,
  options: BatchTranslationOptions,
): Promise<BatchTranslationResult> {
  const { sentences, terms } = input;
  const { retries, signal, progress } = options;
  const unit = options.unit ?? 'sentence';
  const batches: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < sentences.length; start += input.batchSize)
    batches.push({ start, end: Math.min(sentences.length, start + input.batchSize) });

  const counter = new CallCounter();
  const texts = new Map<Id, string>();
  let modelVersion: string | null = null;
  const report = () => progress({ done: texts.size, total: sentences.length, unit: 'units', calls: counter.snapshot() }, 'generating');
  report();

  // When one batch fails, stop the remaining batches.
  const local = new AbortController();
  const stop = () => local.abort();
  signal.addEventListener('abort', stop, { once: true });
  let cappedBatches = 0;
  const baseInstructions = {
    targetLanguage: input.targetLanguage,
    sourceLanguage: input.sourceLanguage,
    ...(input.style !== undefined ? { style: input.style } : {}),
  };

  const runBatch = async ({ start, end }: { start: number; end: number }) => {
    const items = sentences.slice(start, end).map((s) => ({ id: s.id, text: s.text }));
    const ids = items.map((i) => i.id);
    const context = sentences.slice(Math.max(0, start - CONTEXT_SENTENCES), start).map((s) => s.text);
    // Terms: each batch carries only the relevant ones, and the count is capped (see translation-glossary.ts).
    const selected = selectTerms(terms, [...context, ...items.map((i) => i.text)].join('\n'));
    if (selected.capped > 0) cappedBatches++;
    const instructions = {
      ...baseInstructions,
      ...(selected.terms.length > 0
        ? { glossary: selected.terms.map((t) => ({ source: t.source, target: t.target, ...(t.note ? { note: t.note } : {}) })) }
        : {}),
    };
    for (let attempt = 0; ; attempt++) {
      local.signal.throwIfAborted();
      counter.calls++;
      report();
      let problem: string;
      try {
        const result = await text.generate(
          {
            messages: translationMessages({ sentences: items, context }, instructions),
            responseFormat: { type: 'json', schema: translationSchema(ids), name: 'translations' },
            provider: input.provider,
            model: input.model,
          },
          { signal: local.signal },
        );
        const checked = checkBatch(result.json, ids);
        if (Array.isArray(checked)) {
          for (const t of checked) texts.set(t.id, t.text);
          modelVersion ??= result.modelVersion;
          report();
          return;
        }
        problem = checked.problem;
      } catch (error) {
        if (!(error instanceof TextGenerationError && error.code === 'MODEL_OUTPUT_INVALID')) {
          counter.failures++;
          report();
          throw error;
        }
        problem = error.message;
      }
      if (attempt >= retries) {
        counter.failures++;
        report();
        const range = { first: start + 1, last: end, retries };
        throw new PipelineStepError('MODEL_OUTPUT_INVALID', unit === 'cue' ? J.batchFailedCues(range) : J.batchFailedSentences(range), {
          reason: 'schema',
          problem,
          sentences: { first: ids[0], last: ids[ids.length - 1] },
          calls: counter.snapshot(),
        });
      }
      counter.retries++;
    }
  };

  try {
    let next = 0;
    let failure: unknown = null;
    const worker = async () => {
      while (next < batches.length && failure === null) {
        const batch = batches[next++]!;
        try {
          await runBatch(batch);
        } catch (error) {
          failure ??= error;
          local.abort();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency, batches.length) }, worker));
    if (failure !== null) throw failure;
  } finally {
    signal.removeEventListener('abort', stop);
  }
  return {
    translations: sentences.map((s) => ({ id: s.id, text: texts.get(s.id)! })),
    calls: counter.snapshot(),
    modelVersion,
    cappedBatches,
  };
}

/** Checks a batch's output: same count as the input, IDs one-to-one, text non-empty. */
export function checkBatch(json: unknown, ids: Id[]): Array<{ id: Id; text: string }> | { problem: string } {
  const list = (json as { translations?: unknown } | null)?.translations;
  if (!Array.isArray(list)) return { problem: J.outputNoTranslations().text };
  if (list.length !== ids.length) return { problem: J.outputCountMismatch({ output: list.length, input: ids.length }).text };
  const byId = new Map<string, string>();
  for (const item of list as Array<{ id?: unknown; text?: unknown }>) {
    if (typeof item?.id !== 'string' || typeof item.text !== 'string' || item.text.trim() === '')
      return { problem: J.outputIncompleteItem().text };
    if (byId.has(item.id)) return { problem: J.outputDuplicateId({ id: item.id }).text };
    byId.set(item.id, item.text.trim());
  }
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) return { problem: J.outputMissingIds({ ids: joinList(missing) }).text };
  return ids.map((id) => ({ id, text: byId.get(id)! }));
}
