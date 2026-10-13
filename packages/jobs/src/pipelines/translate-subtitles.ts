import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  type GeneratedOutput,
  type Id,
  type TextModelInfo,
  type TranslateSubtitlesParams,
  type TranslateSubtitlesSummary,
} from '@cuccut/protocol';
import type { TextGenerator } from '@cuccut/models';
import { JobsTranslateSubtitles as J } from '@cuccut/protocol/messages/jobs/translate-subtitles.ts';
import type { ArtifactStore } from '../artifact-store.ts';
import { sha256Hex } from '../input-hash.ts';
import { errorText, jobWarning, withCause, type JobText } from '../job-text.ts';
import { fileInputSchema, rejectUnresolvedEntry } from './entry-input.ts';
import { ParamReader } from './params.ts';
import { PipelineStepError, type PipelineDefinition, type PipelineStepContext, type StepResult } from './pipeline.ts';
import { publishFile } from './transcode.ts';
import { ensureSaveDirectory, ensureSaveDirectoryForStep } from './save-location.ts';
import { MAX_LIBRARY_GLOSSARIES, promptTerms, type GlossaryLibrary } from './translation-glossary.ts';
import {
  GLOSSARIES_SCHEMA,
  GLOSSARY_SCHEMA,
  freezeGlossaryUse,
  glossarySummary,
  loadGlossaries,
  parseGlossaryRefs,
  parseInlineGlossary,
  readArtifact,
  translateInBatches,
  type FrozenGlossaryUse,
} from './translation-batches.ts';
import {
  MAX_SUBTITLE_BYTES,
  MAX_SUBTITLE_CUES,
  SubtitleFileError,
  cueText,
  parseSubtitles,
  plainLines,
  readSubtitleBytes,
  renderSubtitles,
  subtitleFormatOf,
  translationLines,
  type SubtitleDocument,
  type SubtitleFormat,
} from './subtitle-file.ts';

/**
 * Subtitle file translation (architecture design §7.9): one SRT or WebVTT file → a translated subtitle file with the same cue count and timecodes. File to file; creates no video and does not touch any video.
 * The flow itself calls the text model batch by batch (sharing batching, prompts, checking and resending with `translate` via translation-batches.ts), and does not start an agent.
 *
 * Steps: read the subtitles (strict parsing; a file that cannot be read exactly is already rejected at startup; the parse result is published as an artifact) → translate (cues with empty text are not sent; each cue has one ID,
 * matched one to one by ID) → check (write the subtitle file and read it back: cue count, and each cue's start and end times match the source file, and every cue sent for translation has a translation) → publish (written to the output directory,
 * existing files are not overwritten). The output is recorded as a generation record with no video: `result.outputs[0]` carries `path`, and `artifactId` is a digest of the file content (the file is also in the artifact store).
 */

export const TRANSLATE_SUBTITLES_PIPELINE = 'translate-subtitles';

export interface TranslateSubtitlesDeps {
  /** In-process text generation (shares concurrency and counting with `models.generateText`). */
  text: Pick<TextGenerator, 'generate'>;
  /** Selects the provider and model at startup (§6.2); throws `CAPABILITY_NOT_CONFIGURED` when not configured. */
  selectText(target: { provider?: string; model?: string }): Promise<{ providerId: string; modelId: string; model: TextModelInfo }>;
  /** How many more times to send a batch whose output does not meet the contract (default 2). */
  batchRetries?: number;
  /** Number of batches in flight at the same time (default 4). */
  concurrency?: number;
  /** User library (glossaries for translation); without it, only terms supplied directly in the call can be used. */
  library?: GlossaryLibrary;
  /** Artifact store: when a glossary from the library is used, its content is written as an artifact. */
  artifacts?: Pick<ArtifactStore, 'put'>;
  /** When publishing, try a hard link first (see `publishFile`); when `false`, copy instead. For tests. */
  hardLink?: boolean;
  /**
   * The save location when `outDir` is not given (§7.9 “save location”; the Runtime decides from settings and the host); frozen into the parameters at submission. When not wired up (only in unit tests),
   * it is written next to the source file.
   */
  saveDirectory?: () => string;
}

/** Frozen parameters: provider and model, batch size and output format are all settled. */
export interface FrozenTranslateSubtitlesParams extends TranslateSubtitlesParams {
  provider: string;
  model: string;
  batchSize: number;
  format: SubtitleFormat;
  bilingual: boolean;
  glossaryUse?: FrozenGlossaryUse;
}

const DEFAULT_BATCH = 20;
const LANGUAGE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;
const MEDIA_TYPES: Record<SubtitleFormat, string> = { srt: 'application/x-subrip', vtt: 'text/vtt' };

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for the agent)
    input: {
      ...fileInputSchema(
        `字幕文件的绝对路径（.srt 或 .vtt；至多 ${MAX_SUBTITLE_BYTES} 字节、${MAX_SUBTITLE_CUES} 条）`,
        'Space 里的字幕条目（.srt 或 .vtt）',
      ),
    },
    targetLanguage: { type: 'string', description: '目标语言（BCP 47）' },
    sourceLanguage: { type: 'string', description: '源语言（BCP 47）；不给时由模型判断' },
    style: { type: 'string', maxLength: 500, description: '风格提示' },
    glossary: GLOSSARY_SCHEMA,
    glossaries: GLOSSARIES_SCHEMA,
    provider: { type: 'string', description: '文本模型的 Provider；不给时用默认值' },
    model: { type: 'string' },
    batchSize: { type: 'integer', minimum: 1, maximum: 100, default: DEFAULT_BATCH },
    format: { type: 'string', enum: ['srt', 'vtt'], description: '输出格式；不给时与输入相同' },
    bilingual: { type: 'boolean', default: false, description: '双语：每条原文在上、译文在下' },
    outDir: { type: 'string', description: '输出目录的绝对路径（不存在时创建）；不给时是保存位置（设置 downloads.directory，默认主机的下载文件夹）' },
    // i18n-ignore-end
  },
  required: ['input', 'targetLanguage'],
  additionalProperties: false,
};

interface ReadOutput extends Record<string, unknown> {
  /** Artifact of the parse result (`SubtitleDocument`). */
  artifactId: string;
  /** Source file size, modification time and content digest: checked on retry; if they changed, the file is read again. */
  size: number;
  mtimeMs: number;
  contentHash: string;
  cueCount: number;
}

interface TranslateOutput extends Record<string, unknown> {
  artifactId: string;
  translatedCount: number;
  markupStripped: number;
  calls: { calls: number; retries: number; failures: number };
  modelVersion: string | null;
  glossaryTerms?: number;
  cappedBatches?: number;
}

interface CheckOutput extends Record<string, unknown> {
  /** The written subtitle file (`.srt` / `.vtt` in the artifact store). */
  artifactId: string;
  byteLength: number;
  cueCount: number;
  durationSec: number;
  droppedSettings: number;
  droppedBlocks: number;
}

interface PublishOutput extends Record<string, unknown> {
  outputs: GeneratedOutput[];
}

export function translateSubtitlesPipeline(
  deps: TranslateSubtitlesDeps,
): PipelineDefinition<FrozenTranslateSubtitlesParams, TranslateSubtitlesParams> {
  const retries = deps.batchRetries ?? 2;
  const concurrency = Math.max(1, deps.concurrency ?? 4);

  return {
    name: TRANSLATE_SUBTITLES_PIPELINE,
    label: () => J.label(),
    description: () => J.description(),
    paramsSchema: PARAMS_SCHEMA,
    parse: parseTranslateSubtitlesParams,
    async prepare(params, options) {
      // Files that cannot be read exactly are rejected at startup, and no task is created: `invalid-request` with `details.code`.
      const { bytes } = await readInput(params.input, (code, message, details) =>
        code === 'INPUT_UNREADABLE' ? new RpcError('not-found', message) : new RpcError('invalid-request', message, details),
      );
      // Save location (§7.9): use it when given, otherwise the Runtime's save location; frozen at submission, created if it does not exist, rejected if not writable.
      const outDir = params.outDir ?? deps.saveDirectory?.();
      if (outDir !== undefined) await ensureSaveDirectory(outDir);
      const glossaryUse =
        'glossaryUse' in params || options.retry
          ? (params as FrozenTranslateSubtitlesParams).glossaryUse
          : await freezeGlossaryUse(deps, {
              explicit: params.glossaries ?? [],
              enabled: [],
              targetLanguage: params.targetLanguage,
              sourceLanguage: params.sourceLanguage ?? null,
              submitter: options.submitter,
            });
      const selection = await deps.selectText({
        ...(params.provider !== undefined ? { provider: params.provider } : {}),
        ...(params.model !== undefined ? { model: params.model } : {}),
      });
      if (!selection.model.structuredOutput) {
        throw new RpcError('invalid-request', J.noStructuredOutput({ model: selection.modelId }), {
          providerId: selection.providerId,
          modelId: selection.modelId,
        });
      }
      const frozen: FrozenTranslateSubtitlesParams = {
        ...params,
        ...(outDir !== undefined ? { outDir } : {}),
        provider: selection.providerId,
        model: selection.modelId,
        batchSize: params.batchSize ?? DEFAULT_BATCH,
        format: params.format ?? subtitleFormatOf(params.input)!,
        bilingual: params.bilingual ?? false,
        ...(glossaryUse ? { glossaryUse } : {}),
      };
      return {
        params: frozen,
        providerId: selection.providerId,
        modelId: selection.modelId,
        videoId: null,
        contentHash: `sha256:${sha256Hex(bytes)}`,
        ...(glossaryUse?.entries.length
          ? { library: glossaryUse.entries.map(({ library, id, version, contentHash }) => ({ library, id, version, contentHash })) }
          : {}),
      };
    },
    steps: [
      {
        name: 'read',
        label: () => J.stepRead(),
        run: async ({ params, artifacts, progress }) => {
          progress(null, 'starting');
          const { bytes, stat, document } = await readInput(params.input, (code, message, details) => {
            return new PipelineStepError(code, message, details);
          });
          const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(document)), 'json');
          const output: ReadOutput = {
            artifactId,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            contentHash: `sha256:${sha256Hex(bytes)}`,
            cueCount: document.cues.length,
          };
          return { output, result: { documentId: null, artifactId } };
        },
        // Source file changed: the earlier parse is stale, so on retry it is read again and translated again.
        reusable: async (output, { params, artifacts }) => {
          const read = output as ReadOutput;
          const stat = await fs.stat(params.input).catch(() => null);
          return stat?.size === read.size && stat.mtimeMs === read.mtimeMs && (await artifacts.locate(read.artifactId)) !== null;
        },
      },
      {
        name: 'translate',
        label: () => J.stepTranslate(),
        run: (context) => translateCues(deps, context, retries, concurrency),
        reusable: async (output, { artifacts }) => (await artifacts.locate((output as TranslateOutput).artifactId)) !== null,
      },
      {
        name: 'check',
        label: () => J.stepCheck(),
        run: (context) => check(context),
        reusable: async (output, { artifacts }) => (await artifacts.locate((output as CheckOutput).artifactId)) !== null,
      },
      {
        name: 'publish',
        label: () => J.stepPublish(),
        run: async ({ params, outputs, artifacts, staging, signal, progress, jobId }) => {
          const checked = outputs.check as CheckOutput;
          progress(null, 'publishing');
          const stored = await artifacts.locate(checked.artifactId);
          if (!stored) throw new PipelineStepError('ARTIFACT_NOT_FOUND', J.artifactGone({ artifactId: checked.artifactId }));
          // Copy to staging before publishing: the output file and the one in the artifact store do not share an inode (so when the user edits the output, the artifact is not changed).
          const local = path.join(staging, `translated.${params.format}`);
          await fs.copyFile(stored, local);
          signal.throwIfAborted();
          if (params.outDir !== undefined) await ensureSaveDirectoryForStep(params.outDir);
          const dir = params.outDir ?? path.dirname(params.input);
          const stem = path.basename(params.input).replace(/\.[^.]+$/, '');
          const suffix = `.${params.targetLanguage}${params.bilingual ? '.bilingual' : ''}.${params.format}`;
          const file = await publishFile(local, dir, stem, suffix, jobId, deps.hardLink ?? true);
          const published: GeneratedOutput = {
            artifactId: checked.artifactId,
            mediaType: MEDIA_TYPES[params.format],
            byteLength: checked.byteLength,
            assetId: null,
            media: { kind: 'text', entries: checked.cueCount, durationSec: checked.durationSec },
            path: file,
            format: params.format,
          };
          const output: PublishOutput = { outputs: [published] };
          return { output, result: { documentId: null, artifactId: published.artifactId, outputs: [published] } };
        },
      },
    ],
    async complete({ params, outputs }) {
      const read = outputs.read as ReadOutput;
      const translated = outputs.translate as TranslateOutput;
      const checked = outputs.check as CheckOutput;
      const published = (outputs.publish as PublishOutput).outputs;
      const glossary = glossarySummary(params, translated);
      const summary: TranslateSubtitlesSummary = {
        source: { path: params.input, format: subtitleFormatOf(params.input)!, contentHash: read.contentHash },
        file: published[0]!.path!,
        format: params.format,
        bilingual: params.bilingual,
        targetLanguage: params.targetLanguage,
        sourceLanguage: params.sourceLanguage ?? null,
        cueCount: checked.cueCount,
        translatedCount: translated.translatedCount,
        markupStripped: translated.markupStripped,
        droppedSettings: checked.droppedSettings,
        droppedBlocks: checked.droppedBlocks,
        providerId: params.provider,
        modelId: params.model,
        ...(glossary ? { glossary } : {}),
      };
      return { summary: { ...summary }, result: { documentId: null, artifactId: published[0]!.artifactId, outputs: published } };
    },
  };
}

export function parseTranslateSubtitlesParams(raw: Record<string, unknown>): TranslateSubtitlesParams {
  const reader = new ParamReader(raw, [
    'input',
    'targetLanguage',
    'sourceLanguage',
    'style',
    'glossary',
    'glossaries',
    'provider',
    'model',
    'batchSize',
    'format',
    'bilingual',
    'outDir',
  ]);
  rejectUnresolvedEntry('input', raw.input);
  const input = reader.string('input', { max: 4096 });
  if (!path.isAbsolute(input)) throw new RpcError('invalid-request', J.paramNotAbsolute({ key: 'input' }));
  if (!subtitleFormatOf(input)) throw new RpcError('invalid-request', J.inputNotSubtitle());
  const targetLanguage = reader.string('targetLanguage', { max: 35 });
  if (!LANGUAGE.test(targetLanguage)) throw new RpcError('invalid-request', J.languageInvalid({ key: 'targetLanguage' }));
  const sourceLanguage = reader.string('sourceLanguage', { optional: true, max: 35 });
  if (sourceLanguage !== undefined && !LANGUAGE.test(sourceLanguage)) throw new RpcError('invalid-request', J.languageInvalid({ key: 'sourceLanguage' }));
  const glossary = parseInlineGlossary(reader.array('glossary', { max: 500, optional: true }));
  const glossaries = parseGlossaryRefs(reader.array('glossaries', { max: MAX_LIBRARY_GLOSSARIES, optional: true }));
  const optional = (key: string, max: number) => reader.string(key, { optional: true, max });
  const style = optional('style', 500);
  const provider = optional('provider', 128);
  const model = optional('model', 256);
  const batchSize = reader.int('batchSize', 1, 100);
  const format = reader.oneOf('format', ['srt', 'vtt'] as const);
  const bilingual = raw.bilingual;
  if (bilingual !== undefined && typeof bilingual !== 'boolean') throw new RpcError('invalid-request', J.bilingualInvalid());
  const outDir = optional('outDir', 4096);
  if (outDir !== undefined && !path.isAbsolute(outDir)) throw new RpcError('invalid-request', J.paramNotAbsolute({ key: 'outDir' }));
  return {
    input,
    targetLanguage,
    ...(sourceLanguage !== undefined ? { sourceLanguage } : {}),
    ...(style !== undefined ? { style } : {}),
    ...(glossary !== undefined ? { glossary } : {}),
    ...(glossaries !== undefined ? { glossaries } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(batchSize !== undefined ? { batchSize } : {}),
    ...(format !== undefined ? { format } : {}),
    ...(bilingual !== undefined ? { bilingual } : {}),
    ...(outDir !== undefined ? { outDir } : {}),
  };
}

/**
 * Reads the source file: it must be a file, must not exceed the size limit, must parse strictly, and must have at least one cue with text. When it does not meet these, the error built by `fail` is thrown (`RpcError` at startup,
 * `PipelineStepError` during execution; if the file is gone, `INPUT_UNREADABLE`).
 */
async function readInput(
  file: string,
  fail: (code: string, message: JobText, details: Record<string, unknown>) => Error,
): Promise<{ bytes: Buffer; stat: { size: number; mtimeMs: number }; document: SubtitleDocument }> {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) throw fail('INPUT_UNREADABLE', J.fileNotFound({ file }), { file });
  if (stat.size > MAX_SUBTITLE_BYTES) {
    throw fail('SUBTITLE_FILE_TOO_LARGE', J.fileTooLarge({ bytes: stat.size, limit: MAX_SUBTITLE_BYTES }), {
      code: 'SUBTITLE_FILE_TOO_LARGE',
      bytes: stat.size,
      limit: MAX_SUBTITLE_BYTES,
    });
  }
  const bytes = await fs.readFile(file);
  let document: SubtitleDocument;
  try {
    document = readSubtitleBytes(bytes, subtitleFormatOf(file)!);
  } catch (error) {
    if (error instanceof SubtitleFileError) throw fail(error.code, errorText(error), { code: error.code, file, ...error.details });
    throw error;
  }
  if (!document.cues.some((cue) => cueText(plainLines(cue, document.format).lines) !== '')) {
    throw fail('SUBTITLE_FILE_INVALID', J.noText(), { code: 'SUBTITLE_FILE_INVALID', file, problem: J.allEmpty().text });
  }
  return { bytes, stat: { size: stat.size, mtimeMs: stat.mtimeMs }, document };
}

/** Cues with text are sent for translation as `c<index>` (translation-batches.ts): the whole step either gets all translations or fails. */
async function translateCues(
  deps: TranslateSubtitlesDeps,
  context: PipelineStepContext<FrozenTranslateSubtitlesParams>,
  retries: number,
  concurrency: number,
): Promise<StepResult> {
  const { params, outputs, artifacts, signal, progress, warn } = context;
  const document = await readArtifact<SubtitleDocument>(artifacts, (outputs.read as ReadOutput).artifactId);
  const sentences: Array<{ id: Id; text: string }> = [];
  let markupStripped = 0;
  document.cues.forEach((cue, i) => {
    const plain = plainLines(cue, document.format);
    if (plain.marked) markupStripped++;
    const text = cueText(plain.lines);
    if (text !== '') sentences.push({ id: cueId(i), text });
  });
  if (markupStripped > 0) {
    warn(jobWarning('SUBTITLE_MARKUP_STRIPPED', J.markupStripped({ count: markupStripped })));
  }
  const terms = promptTerms(await loadGlossaries(artifacts, params));
  const translated = await translateInBatches(
    deps.text,
    {
      sentences,
      targetLanguage: params.targetLanguage,
      sourceLanguage: params.sourceLanguage ?? null,
      ...(params.style !== undefined ? { style: params.style } : {}),
      provider: params.provider,
      model: params.model,
      batchSize: params.batchSize,
      terms,
    },
    { retries, concurrency, signal, progress, unit: 'cue' },
  );
  const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify({ translations: translated.translations })), 'json');
  const output: TranslateOutput = {
    artifactId,
    translatedCount: sentences.length,
    markupStripped,
    calls: translated.calls,
    modelVersion: translated.modelVersion,
    ...(terms.length > 0 ? { glossaryTerms: terms.length, cappedBatches: translated.cappedBatches } : {}),
  };
  return { output, result: { documentId: null, artifactId } };
}

/** Writes the subtitle file and reads it back to check: cue count, and each cue's start and end times (the whole timing line when the format is the same) match the source file, and every cue sent for translation has a translation. */
async function check(context: PipelineStepContext<FrozenTranslateSubtitlesParams>): Promise<StepResult> {
  const { params, outputs, artifacts, progress, warn } = context;
  progress(null, 'validating');
  const document = await readArtifact<SubtitleDocument>(artifacts, (outputs.read as ReadOutput).artifactId);
  const translated = await readArtifact<{ translations: Array<{ id: Id; text: string }> }>(
    artifacts,
    (outputs.translate as TranslateOutput).artifactId,
  );
  const byId = new Map(translated.translations.map((t) => [t.id, t.text]));
  const problems: string[] = [];
  const texts = document.cues.map((cue, i) => {
    const original = plainLines(cue, document.format).lines;
    if (cueText(original) === '') return [];
    const lines = translationLines(byId.get(cueId(i)) ?? '');
    if (lines.length === 0) problems.push(J.cueNoTranslation({ n: i + 1 }).text);
    return params.bilingual ? [...original, ...lines] : lines;
  });
  const rendered = renderSubtitles(document, texts, params.format);
  let reread: SubtitleDocument | null = null;
  try {
    reread = parseSubtitles(rendered.text, params.format);
  } catch (error) {
    if (!(error instanceof SubtitleFileError)) throw error;
    problems.push(withCause(J.rereadFailed(), error).text);
  }
  if (reread) {
    if (reread.cues.length !== document.cues.length) problems.push(J.cueCountMismatch({ written: reread.cues.length, original: document.cues.length }).text);
    const same = params.format === document.format;
    document.cues.forEach((cue, i) => {
      const out = reread.cues[i];
      if (!out) return;
      if (out.startMs !== cue.startMs || out.endMs !== cue.endMs || (same && out.timing !== cue.timing)) {
        problems.push(J.timingChanged({ n: i + 1, from: cue.timing, to: out.timing }).text);
      }
    });
  }
  if (problems.length > 0) {
    throw new PipelineStepError('MODEL_OUTPUT_INVALID', J.cannotMatch(), { problems: problems.slice(0, 20) });
  }
  if (rendered.droppedSettings > 0 || rendered.droppedBlocks > 0) {
    warn(
      jobWarning('SUBTITLE_SETTINGS_DROPPED', J.settingsDropped({ settings: rendered.droppedSettings, blocks: rendered.droppedBlocks })),
    );
  }
  const bytes = Buffer.from(rendered.text, 'utf8');
  const { artifactId } = await artifacts.put(bytes, params.format);
  const output: CheckOutput = {
    artifactId,
    byteLength: bytes.byteLength,
    cueCount: document.cues.length,
    durationSec: Math.max(...document.cues.map((c) => c.endMs)) / 1000,
    droppedSettings: rendered.droppedSettings,
    droppedBlocks: rendered.droppedBlocks,
  };
  return { output, result: { documentId: null, artifactId } };
}

function cueId(index: number): Id {
  return `c${index + 1}`;
}
