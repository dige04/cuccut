import fs from 'node:fs/promises';
import {
  AI_TOOL_APPLY_KINDS,
  AI_TOOL_PIPELINE,
  RpcError,
  type AiToolContext,
  type AiToolKind,
  type AiToolParams,
  type AiToolSummary,
  type AttachmentRef,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type TextModelInfo,
} from '@cuccut/protocol';
import { aiToolParamsSchema } from '@cuccut/protocol/schemas';
import { RcAiTools as M } from '@cuccut/protocol/messages/runtime-core';
import {
  PipelineStepError,
  canonicalJson,
  sha256Hex,
  type ArtifactStore,
  type PipelineDefinition,
  type PipelineStepContext,
  type StepResult,
} from '@cuccut/jobs';
import type { TextGenerator } from '@cuccut/models';
import type { SkillSystemPrompt } from '../skills/skill-brief.ts';
import {
  aiToolMessages,
  chapterDrafts,
  outputSchema,
  polishBatches,
  polishEdits,
  type ContextAttachment,
  type ContextWord,
} from './ai-tool-prompt.ts';

/**
 * AI tool "direct model call" (product design §5.10, `ai-tool`): does not start an agent or go through a conversation. The text in the tool page's prompt box, together with this video's context, goes directly to a text model. It uses the same fixed flow as translation: a background job, progress, cancellation (`jobs.cancel`), and retry from the step where it stopped (`pipelines.retry`). Each call goes through authorization and budget (`withPipelineGrants`).
 *
 * - Frozen at start: the chosen text model; the system prompt composed from the attached skill (only `SKILL.md` and the `references/` it uses); attachments (text files are attached in full; images and other files are not sent, only counted). Retry reuses these frozen values and does not read the skill and attachments again.
 * - Context collection: a Markdown script in the same format as the exported script (with timecodes, speakers and chapters, by range); polishing separately takes the numbered words in range.
 * - Model calls: polishing is batched by paragraph, with one structured output per batch (it can only change words one for one); chapters take one structured output; other tools take one body-text output.
 * - Written into the video (polishing and chapters only): polishing writes the changed words back to the same transcript (`putDocument`); chapters replace the whole set (`setChapters`). Each is one transaction submitted as `system:pipeline`, checked against the version, and undoable with one click in the UI. If the script changes during execution, it fails with `STALE_JOB_INPUT` and nothing is written.
 */

/** Sending the script out: polishing and writing both hand the script to the model; attachments count as documents. */
export const AI_TOOL_DATA_KINDS = ['transcript', 'document'] as const;

const POLISH_BATCH_WORDS = 800;
const APPLY_ATTEMPTS = 3;
/** Limit on text attachments (characters): any excess is cut off, with a note at the end of the body. */
const ATTACHMENT_CHARS = 100_000;
const TEXT_MIME = /^(text\/|application\/json$)/;

export interface AiToolVideos {
  state(videoId: Id): { revision: string; rootSequenceId: Id; documents: Record<Id, DocumentRecord> } | null;
  /** Duration (seconds) of the video's root sequence and the number of existing chapters; null when no video is open. */
  sequence(videoId: Id): { duration: number; chapters: number } | null;
  document(videoId: Id, documentId: Id, revision?: string): Promise<{ revision: string; body: unknown }>;
  apply(
    videoId: Id,
    request: { commandId: Id; expectedRevision: string; operations: EditOperation[]; label: string; run?: { runId: Id; runGeneration: string } },
  ): Promise<{ refs?: Record<string, Id>; transactionId?: Id }>;
}

export interface AiToolDeps {
  videos: AiToolVideos;
  text: Pick<TextGenerator, 'generate'>;
  selectText(target: { provider?: string; model?: string }): Promise<{ providerId: string; modelId: string; model: TextModelInfo }>;
  /** Markdown in the same format as the exported script (`exports.renderText`): body, paragraph count and word count. */
  transcript(videoId: Id, request: { documentId: Id; range?: { start: number; end: number } }): Promise<{ content: string; paragraphs: number; characters: number }>;
  /** The transcribed words in range (on the timeline), in order; each word appears only once. */
  words(videoId: Id, request: { documentId: Id; range?: { start: number; end: number } }): Promise<ContextWord[]>;
  skills(refs: { id: string }[]): Promise<SkillSystemPrompt>;
  attachments(ids: Id[]): Promise<{ ref: AttachmentRef; path: string }[]>;
  artifacts: Pick<ArtifactStore, 'put' | 'read'>;
}

/** The parts frozen at start. */
export interface FrozenAiToolParams extends AiToolParams {
  provider: string;
  model: string;
  /** The transcript used (null for writing tools, which have no transcript). */
  transcriptId: Id | null;
  frozen: {
    /** The output of `{ system, attachments }`. */
    artifactId: string;
    skills: string[];
    references: number;
    attachments: number;
    skippedAttachments: number;
  };
}

interface FrozenInputs {
  system: string;
  attachments: ContextAttachment[];
}

interface ContextOutput extends Record<string, unknown> {
  artifactId: string;
  documentId: Id | null;
  revision: string | null;
  paragraphs: number;
  characters: number;
  chapters: number;
}

interface ContextBody {
  transcript: string | null;
  words: ContextWord[];
  duration: number;
}

interface GenerateOutput extends Record<string, unknown> {
  artifactId: string;
  text: string | null;
  finishReason: 'stop' | 'length';
  /** Polishing: word id → new text; chapters: a draft. */
  edits?: Record<string, string>;
  chapters?: Array<{ at: number; title: string; summary: string }>;
}

interface ApplyOutput extends Record<string, unknown> {
  transactionId: Id | null;
  changes: number;
}

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    videoId: { type: 'string', description: 'An open video' },
    tool: { type: 'string', enum: ['polish', 'chapters', 'summary', 'blog', 'title', 'desc'], description: 'Which AI tool' },
    prompt: { type: 'string', description: 'The prompt' },
    range: {
      type: 'object',
      properties: { start: { type: 'number' }, end: { type: 'number' } },
      required: ['start', 'end'],
      description: 'A span of the timeline (seconds); the whole transcript when absent. Not accepted by chapters',
    },
    documentId: { type: 'string', description: 'Which speech document to use; may be omitted when there is only one' },
    attachments: { type: 'array', items: { type: 'string' }, description: 'Attachment IDs (attachments.prepare)' },
    skills: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, description: 'Skills used as the system prompt, in order' },
    provider: { type: 'string', description: 'The text model provider; the default when absent' },
    model: { type: 'string' },
    uiLanguage: { type: 'string', description: 'The user\'s interface language (BCP 47, e.g. zh-Hans, en), stated in the system prompt' },
  },
  required: ['videoId', 'tool', 'prompt'],
  additionalProperties: false,
};

export function parseAiToolParams(raw: Record<string, unknown>): AiToolParams {
  const parsed = aiToolParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.path.map(String).join('.') || 'params';
    throw new RpcError('invalid-request', M.paramsInvalid({ key }), { key });
  }
  return parsed.data as AiToolParams;
}

const writes = (tool: AiToolKind) => AI_TOOL_APPLY_KINDS.includes(tool);
const structured = (tool: AiToolKind) => outputSchema(tool) !== null;

export function aiToolPipeline(deps: AiToolDeps): PipelineDefinition<FrozenAiToolParams, AiToolParams> {
  return {
    name: AI_TOOL_PIPELINE,
    label: () => M.label(),
    description: () => M.description(),
    paramsSchema: PARAMS_SCHEMA,
    parse: parseAiToolParams,
    async prepare(params, options) {
      const state = deps.videos.state(params.videoId);
      if (!state) throw new RpcError('not-found', M.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
      const documentId = pickTranscript(state.documents, params.documentId, params.tool);
      const selection = await deps.selectText({
        ...(params.provider !== undefined ? { provider: params.provider } : {}),
        ...(params.model !== undefined ? { model: params.model } : {}),
      });
      if (structured(params.tool) && !selection.model.structuredOutput) {
        throw new RpcError('invalid-request', M.noStructuredOutput({ model: selection.modelId }), {
          providerId: selection.providerId,
          modelId: selection.modelId,
        });
      }
      const frozen =
        'frozen' in params || options.retry ? (params as FrozenAiToolParams).frozen : await freezeInputs(deps, params);
      const plan: FrozenAiToolParams = { ...params, provider: selection.providerId, model: selection.modelId, transcriptId: documentId, frozen };
      const revision = documentId ? state.documents[documentId]!.currentRevision : null;
      return {
        params: plan,
        providerId: selection.providerId,
        modelId: selection.modelId,
        videoId: params.videoId,
        contentHash: `sha256:${sha256Hex(
          canonicalJson({
            videoId: params.videoId,
            tool: params.tool,
            prompt: params.prompt,
            range: params.range ?? null,
            documentId,
            revision,
            inputs: frozen.artifactId,
            ...(params.uiLanguage ? { uiLanguage: params.uiLanguage } : {}),
          }),
        )}`,
      };
    },
    steps: [
      {
        name: 'context',
        label: () => M.stepPrepare(),
        run: (context) => gatherContext(deps, context),
        // The script has a new version: recollect on retry.
        reusable: async (output, { params }) => {
          const o = output as Partial<ContextOutput>;
          return o.documentId === null || deps.videos.state(params.videoId)?.documents[o.documentId ?? '']?.currentRevision === o.revision;
        },
      },
      {
        name: 'generate',
        label: () => M.stepGenerate(),
        run: (context) => generate(deps, context),
      },
      {
        name: 'apply',
        label: () => M.stepApply(),
        when: (params) => writes(params.tool),
        run: (context) => apply(deps, context),
      },
    ],
    async complete({ params, outputs }) {
      const ctx = outputs.context as ContextOutput;
      const generated = outputs.generate as GenerateOutput;
      const applied = outputs.apply as ApplyOutput | undefined;
      const context: AiToolContext = {
        paragraphs: ctx.paragraphs,
        characters: ctx.characters,
        chapters: ctx.chapters,
        attachments: params.frozen.attachments,
        skippedAttachments: params.frozen.skippedAttachments,
        skills: params.frozen.skills,
        references: params.frozen.references,
      };
      const summary: AiToolSummary = {
        videoId: params.videoId,
        tool: params.tool,
        providerId: params.provider,
        modelId: params.model,
        context,
        applied: applied ? { transactionId: applied.transactionId, changes: applied.changes } : null,
        text: writes(params.tool) ? null : generated.text,
        artifactId: generated.artifactId,
        finishReason: generated.finishReason,
      };
      return { summary: { ...summary }, result: { documentId: null, artifactId: generated.artifactId } };
    },
  };
}

/** Which transcript to use: if given, it is checked; if not given, the only transcript in the video is used. Writing tools can run without a transcript (prompt only); polishing and chapters need one. */
function pickTranscript(documents: Record<Id, DocumentRecord>, requested: Id | undefined, tool: AiToolKind): Id | null {
  if (requested !== undefined) {
    const doc = documents[requested];
    if (!doc) throw new RpcError('not-found', M.notSpeech({ documentId: requested }), { code: 'ENTITY_NOT_FOUND', documentId: requested });
    if (doc.kind !== 'speech') throw new RpcError('invalid-request', M.notSpeech({ documentId: requested }));
    return requested;
  }
  const speech = Object.values(documents).filter((d) => d.kind === 'speech');
  if (speech.length === 1) return speech[0]!.id;
  if (speech.length > 1) throw new RpcError('invalid-request', M.multipleTranscripts(), { documentIds: speech.map((d) => d.id) });
  if (writes(tool)) throw new RpcError('invalid-request', M.noTranscript());
  return null;
}

/** Freeze the skill and attachments at start: compose the system prompt, read the text attachments, and write them out as one artifact. */
async function freezeInputs(deps: AiToolDeps, params: AiToolParams): Promise<FrozenAiToolParams['frozen']> {
  const skills = await deps.skills(params.skills ?? []);
  const resolved = params.attachments?.length ? await deps.attachments([...new Set(params.attachments)]) : [];
  const attachments: ContextAttachment[] = [];
  let skipped = 0;
  for (const { ref, path } of resolved) {
    if (ref.kind === 'image' || !TEXT_MIME.test(ref.mimeType)) {
      skipped += 1;
      continue;
    }
    const content = await fs.readFile(path, 'utf8');
    attachments.push({
      name: ref.fileName,
      content: content.length > ATTACHMENT_CHARS ? `${content.slice(0, ATTACHMENT_CHARS)}\n[… ${content.length - ATTACHMENT_CHARS} more characters not included]` : content,
    });
  }
  const inputs: FrozenInputs = { system: skills.text, attachments };
  const { artifactId } = await deps.artifacts.put(Buffer.from(JSON.stringify(inputs)), 'json');
  return { artifactId, skills: skills.skills, references: skills.references, attachments: attachments.length, skippedAttachments: skipped };
}

async function readJson<T>(artifacts: Pick<ArtifactStore, 'read'>, artifactId: string): Promise<T> {
  const bytes = await artifacts.read(artifactId);
  if (!bytes) throw new PipelineStepError('STALE_JOB_INPUT', M.sourceChanged(), { artifactId });
  return JSON.parse(bytes.toString('utf8')) as T;
}

async function gatherContext(deps: AiToolDeps, context: PipelineStepContext<FrozenAiToolParams>): Promise<StepResult> {
  const { params, artifacts, progress } = context;
  progress(null, 'loading');
  const state = deps.videos.state(params.videoId);
  if (!state) throw new PipelineStepError('STALE_JOB_INPUT', M.videoClosed());
  const sequence = deps.videos.sequence(params.videoId) ?? { duration: 0, chapters: 0 };
  const documentId = params.transcriptId;
  const range = params.range;
  let body: ContextBody = { transcript: null, words: [], duration: sequence.duration };
  let paragraphs = 0;
  let characters = 0;
  let revision: string | null = null;
  if (documentId) {
    revision = state.documents[documentId]?.currentRevision ?? null;
    if (revision === null) throw new PipelineStepError('STALE_JOB_INPUT', M.sourceChanged(), { documentId });
    const request = { documentId, ...(range ? { range } : {}) };
    const needsWords = params.tool === 'polish' || params.tool === 'chapters';
    // No script in range: the export is rejected with `EXPORT_NOTHING_TO_EXPORT`, and the reason is recorded in the job as is.
    const [rendered, words] = await Promise.all([
      deps.transcript(params.videoId, request),
      needsWords ? deps.words(params.videoId, request) : Promise.resolve([]),
    ]);
    if (needsWords && words.length === 0) throw new PipelineStepError('EXPORT_NOTHING_TO_EXPORT', M.nothingInRange());
    paragraphs = rendered.paragraphs;
    characters = rendered.characters;
    body = { transcript: params.tool === 'polish' ? null : rendered.content, words, duration: sequence.duration };
  }
  const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(body)), 'json');
  return {
    output: { artifactId, documentId, revision, paragraphs, characters, chapters: sequence.chapters } satisfies ContextOutput,
  };
}

async function generate(deps: AiToolDeps, context: PipelineStepContext<FrozenAiToolParams>): Promise<StepResult> {
  const { params, outputs, artifacts, signal, progress } = context;
  const ctx = outputs.context as ContextOutput;
  const body = await readJson<ContextBody>(artifacts, ctx.artifactId);
  const inputs = await readJson<FrozenInputs>(deps.artifacts, params.frozen.artifactId);
  const base = {
    tool: params.tool,
    system: inputs.system,
    prompt: params.prompt,
    attachments: inputs.attachments,
    ...(params.uiLanguage ? { uiLanguage: params.uiLanguage } : {}),
  };
  const target = { provider: params.provider, model: params.model };
  const schema = outputSchema(params.tool);

  if (params.tool === 'polish') {
    const batches = polishBatches(body.words, POLISH_BATCH_WORDS);
    const edits: Record<string, string> = {};
    const replies: unknown[] = [];
    for (const [i, batch] of batches.entries()) {
      progress({ done: i, total: batches.length, unit: 'units' }, 'generating');
      const result = await deps.text.generate(
        {
          messages: aiToolMessages({ ...base, transcript: null, words: { items: batch.items, offset: batch.offset, total: body.words.length } }),
          responseFormat: { type: 'json', schema: schema!, name: 'edits' },
          ...target,
        },
        { signal },
      );
      const checked = polishEdits(result.json, batch);
      if ('problem' in checked) throw new PipelineStepError('MODEL_OUTPUT_INVALID', M.polishMismatch(), { batch: i, problem: checked.problem });
      for (const [id, text] of checked.edits) edits[id] = text;
      replies.push(result.json);
    }
    progress({ done: batches.length, total: batches.length, unit: 'units' }, 'generating');
    const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify({ batches: replies, edits })), 'json');
    return { output: { artifactId, text: null, finishReason: 'stop', edits } satisfies GenerateOutput };
  }

  progress(null, 'generating');
  const result = await deps.text.generate(
    {
      messages: aiToolMessages({ ...base, transcript: body.transcript }),
      ...(schema ? { responseFormat: { type: 'json' as const, schema, name: params.tool } } : { responseFormat: { type: 'text' as const } }),
      ...target,
    },
    { signal },
  );
  if (params.tool === 'chapters') {
    const starts = paragraphStarts(body.words);
    const chapters = chapterDrafts(result.json, starts, body.duration);
    if (chapters.length === 0) throw new PipelineStepError('MODEL_OUTPUT_INVALID', M.noChapters());
    const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify({ reply: result.json, chapters })), 'json');
    return { output: { artifactId, text: null, finishReason: result.finishReason, chapters } satisfies GenerateOutput };
  }
  const text = result.text.trim();
  if (!text) throw new PipelineStepError('MODEL_OUTPUT_INVALID', M.outputInvalid());
  const { artifactId } = await artifacts.put(Buffer.from(text), 'md');
  return { output: { artifactId, text, finishReason: result.finishReason } satisfies GenerateOutput, result: { documentId: null, artifactId } };
}

/** Paragraph start points (seconds on the timeline): chapters snap to these moments. */
export function paragraphStarts(words: readonly ContextWord[]): number[] {
  return words.filter((w, i) => i === 0 || w.paragraphStart).map((w) => w.start);
}

/** Polishing: write the changed words back to the frozen version of the transcript (only text is changed). */
export function polishedBody(body: unknown, edits: Record<string, string>): { body: unknown; changes: number } {
  const source = body as { words?: Array<{ id?: unknown; text?: unknown }> } | null;
  if (!source || !Array.isArray(source.words)) return { body, changes: 0 };
  let changes = 0;
  const words = source.words.map((word) => {
    const next = typeof word.id === 'string' ? edits[word.id] : undefined;
    if (next === undefined || next === word.text) return word;
    changes += 1;
    return { ...word, text: next };
  });
  return { body: { ...source, words }, changes };
}

async function apply(deps: AiToolDeps, context: PipelineStepContext<FrozenAiToolParams>): Promise<StepResult> {
  const { params, outputs, jobId, run, progress } = context;
  progress(null, 'applying');
  const ctx = outputs.context as ContextOutput;
  const generated = outputs.generate as GenerateOutput;
  for (let attempt = 1; ; attempt++) {
    const state = deps.videos.state(params.videoId);
    if (!state) throw new PipelineStepError('STALE_JOB_INPUT', M.videoClosed());
    let operation: EditOperation;
    let changes: number;
    let label: string;
    if (params.tool === 'polish') {
      const documentId = ctx.documentId!;
      const current = state.documents[documentId];
      if (!current || current.currentRevision !== ctx.revision) {
        throw new PipelineStepError('STALE_JOB_INPUT', M.sourceChanged(), {
          documentId,
          frozenRevision: ctx.revision,
          currentRevision: current?.currentRevision ?? null,
        });
      }
      const { body } = await deps.videos.document(params.videoId, documentId, ctx.revision!);
      const polished = polishedBody(body, generated.edits ?? {});
      // Nothing to change: do not submit an empty transaction.
      if (polished.changes === 0) return { output: { transactionId: null, changes: 0 } satisfies ApplyOutput };
      operation = { type: 'putDocument', documentId, kind: current.kind, body: polished.body };
      changes = polished.changes;
      label = M.transactionPolish().text;
    } else {
      const chapters = generated.chapters ?? [];
      operation = {
        type: 'setChapters',
        sequenceId: state.rootSequenceId,
        chapters: chapters.map((c) => ({ at: { unit: 'seconds', value: c.at.toFixed(3) }, title: c.title, ...(c.summary ? { summary: c.summary } : {}) })),
        alignment: 'nearest-frame',
      };
      changes = chapters.length;
      label = M.transactionChapters().text;
    }
    try {
      const receipt = await deps.videos.apply(params.videoId, {
        commandId: `cmd_${jobId}_apply_${attempt}`,
        expectedRevision: state.revision,
        operations: [operation],
        label,
        run,
      });
      return { output: { transactionId: receipt.transactionId ?? null, changes } satisfies ApplyOutput };
    } catch (error) {
      if (error instanceof RpcError && error.code === 'conflict' && attempt < APPLY_ATTEMPTS) continue;
      if (error instanceof PipelineStepError) throw error;
      throw new PipelineStepError('APPLY_FAILED', M.rejected(), { cause: error instanceof Error ? error.message : String(error) });
    }
  }
}
