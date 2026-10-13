import { invalid } from './params.ts';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import path from 'node:path';
import {
  RpcError,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type MediaTime,
  type TextModelInfo,
  type TranslateParams,
  type TranslateRefreshSummary,
  type TranslateSummary,
} from '@cuccut/protocol';
import type { TextGenerator } from '@cuccut/models';
import { JobsTranslate as J } from '@cuccut/protocol/messages/jobs/translate.ts';
import type { WorkerCommand } from '@cuccut/process-host';
import type { ArtifactStore } from '../artifact-store.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { asLocalized } from '../job-text.ts';
import { videoSelection } from '../library-selection.ts';
import {
  readCaptionStyle,
  captionsStep,
  captionsSummary,
  derivedFrom,
  sentenceSpeakers,
  type CaptionLayerOutput,
  type CaptionVideos,
} from './caption-layer.ts';
import { readSpeechWords, retextCaption, workerUnitCues } from './caption-cues.ts';
import { ParamReader } from './params.ts';
import {
  PipelineStepError,
  type PipelineDefinition,
  type PipelinePrepareOptions,
  type PipelineStepContext,
  type StepResult,
} from './pipeline.ts';
import { PIPELINE_ACTOR_ID } from './pipeline-runner.ts';
import { targetSchema, targetStep } from './video-target.ts';
import { MAX_LIBRARY_GLOSSARIES, glossaryRefOf, promptTerms, type GlossaryLibrary } from './translation-glossary.ts';
import {
  GLOSSARIES_SCHEMA,
  GLOSSARY_SCHEMA,
  freezeGlossaryUse,
  glossarySummary,
  loadGlossaries,
  parseGlossaryRefs,
  parseInlineGlossary,
  readArtifact,
  type FrozenGlossaryUse,
} from './translation-batches.ts';
import { sourceSentences, translationProblems, type FrozenSource, type TranslationBody } from './translation-document.ts';
import {
  SPEECH_WORKER_CUES_SCHEMA,
  SPEECH_WORKER_PROTOCOL,
  runSpeechTranslate,
  type SpeechTranslateInput,
  type SpeechWorkerCues,
} from './speech-worker.ts';
import { mergeRefresh, refreshPlan, refreshableTranslation, type RefreshPlan } from './translation-refresh.ts';

// The part moved into translation-batches.ts is re-exported unchanged from here (dubbing and tests import it from this file).
export {
  GLOSSARIES_SCHEMA,
  checkBatch,
  glossarySummary,
  parseGlossaryRefs,
  readArtifact,
  type FrozenGlossaryUse,
} from './translation-batches.ts';

/**
 * Translation (architecture design §7.9): one `speech` document in a video → one new `translation` document (video format spec §5.3).
 * Started from the tool entry point. The pipeline calls the text model and does not start an agent. If no text model is configured, startup rejects with `CAPABILITY_NOT_CONFIGURED` and does not hand over to an agent.
 *
 * Steps: read the source (freeze the current version and body of the source document, split it into sentences by the subtitle and translation core's rules, and publish the result as an artifact) → translate (done in the Speech Worker by the subtitle and translation core: a target-direction brief, page-by-page translation, alignment and wrap-up; every model call goes out through `generateText` here; checkpoints live in this step's staging, so after an interruption or failure a retry resumes from the checkpoint; it produces the translation body and the target-language subtitle cues, `speech-worker.ts`) → assemble (check that the Worker's translation corresponds sentence by sentence with the frozen source, and validate against §5.3) → write to the video (submit `putDocument` through Application as `system:pipeline`, with version checking) → create the target-language caption layer (`caption-layer.ts`, using the cues the Worker split; created only when `captions: true` is given, skipped when it is not, and also skipped when this translation already has a caption layer; the tool entry point, the CLI and the editor's "Translate to…" all pass `captions: true`. With `bilingual`, the two share a style and display as bilingual; by default only the translation is shown, and the paired source caption layer is removed from the picture).
 *
 * Re-running: each run adds a new translation document and does not replace existing ones, since they may have manual edits (architecture design §10.3; consistent with transcription, §7.3).
 * If the source document changed (or was deleted) during the run: the write step fails with `STALE_JOB_INPUT`, the video is unchanged, and artifacts are kept. On retry, the read-source step's output is no longer usable, so the source is re-read from the current version and translated again.
 *
 * In-place refresh (when `translationId` is given): the read-source step also freezes the current version of that translation, and picks the sentences to retranslate (marked stale, whose source changed, that have no translation yet, or that `sentences` names) and the units whose source sentence is no longer there (`translation-refresh.ts`). The Worker uses that translation as a base and retranslates only those sentences. Assembly merges them back into the original translation and leaves other units as they are. The write is one transaction: a new version of the same translation document, together with the caption cues for those sentences in the caption documents generated from it (other cues are untouched, and their times still come from the source sentence's member words). A single undo reverts both sides together. No new caption layer is created (`captions` cannot be given). If the transcript or this translation changed during the run, the write fails with `STALE_JOB_INPUT` and the video is unchanged.
 */

export const TRANSLATE_PIPELINE = 'translate';

/** Video capabilities the translation pipeline needs. The Runtime implements them with VideoService, and writes are attributed to `system:pipeline`. */
export interface PipelineVideos {
  /** The video's current version, root sequence and document records; null when it is not open. */
  state(videoId: Id): { revision: string; rootSequenceId: Id; documents: Record<Id, DocumentRecord> } | null;
  /** The body of one version of a document (the current version when none is given). */
  document(videoId: Id, documentId: Id, revision?: string): Promise<{ revision: string; body: unknown }>;
  /** Facts about the media's current version (content fingerprint, duration, sample rate); null when the media is not present. When not given, translation uses the end time of the last word in the transcript as the media duration. */
  asset?(videoId: Id, assetId: Id): { contentHash: string; duration?: MediaTime; sampleRate?: number } | null;
  /** Commits one edit as `system:pipeline`. `run` is this execution (the engine uses it to enforce the stop barrier, §7.4). */
  apply(
    videoId: Id,
    request: {
      commandId: Id;
      expectedRevision: string;
      operations: EditOperation[];
      label: string;
      run?: { runId: Id; runGeneration: string };
    },
  ): Promise<{ refs?: Record<string, Id>; transactionId?: Id }>;
}

export interface TranslateDeps {
  videos: CaptionVideos;
  /** In-process text generation (shares concurrency and call counting with `models.generateText`). */
  text: Pick<TextGenerator, 'generate'>;
  /** Provider and model selected at startup (§6.2); throws `CAPABILITY_NOT_CONFIGURED` when none is configured. */
  selectText(target: { provider?: string; model?: string }): Promise<{ providerId: string; modelId: string; model: TextModelInfo }>;
  /** The Speech Worker command (`resolveSpeechWorkerCommand`); null when it has not been built, and the translation step then fails with `WORKER_FAILED`. */
  speechWorker(): string | WorkerCommand | null;
  /** Multiplier for the subtitle and translation core's backoff durations (default 1; tests lower it). */
  backoffScale?: number;
  /** User library (glossaries for translation). Without it, only terms passed directly in the call can be used. */
  library?: GlossaryLibrary;
  /** Artifact store: at startup, writes the contents of the library glossaries in use as artifacts (after that only the artifacts are read, not the library). Required when a library glossary is used. */
  artifacts?: Pick<ArtifactStore, 'put'>;
}

/** Frozen parameters: the source document, Provider and model, and batch size are all fixed. */
export interface FrozenTranslateParams extends TranslateParams {
  documentId: Id;
  provider: string;
  model: string;
  batchSize: number;
  /** Glossary frozen at startup. Absent when none was passed in the call and the video does not enable one. */
  glossaryUse?: FrozenGlossaryUse;
}

const DEFAULT_BATCH = 20;
const APPLY_ATTEMPTS = 3;

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for the agent)
    videoId: { type: 'string', description: '已打开的视频（等同 target: { videoId }）' },
    target: targetSchema('要翻译的视频：已打开的，或 Space 里的视频条目（流程期间由 Runtime 打开）；与 videoId 给一个', null),
    documentId: { type: 'string', description: '源 speech 文档；视频里只有一份时可以不给' },
    targetLanguage: { type: 'string', description: '目标语言（BCP 47）' },
    style: { type: 'string', maxLength: 500, description: '风格提示' },
    glossary: GLOSSARY_SCHEMA,
    glossaries: GLOSSARIES_SCHEMA,
    provider: { type: 'string', description: '文本模型的 Provider；不给时用默认值' },
    model: { type: 'string' },
    batchSize: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: DEFAULT_BATCH,
      description: '照旧接受；字幕与翻译核心按自己的预算分页，这个值不再影响翻译',
    },
    captionStyle: {
      type: 'object',
      properties: { schema: { const: 'cuccut.legacy-studio-style/0.1' }, style: { type: 'object' } },
      required: ['schema', 'style'],
      description: '新建字幕的 Studio 样式文档；共用已有样式时保留原样',
    },
    captions: { type: 'boolean', default: false, description: '写入译文之后建立目标语言的字幕层（默认不建）；同一份译文已有字幕层时跳过' },
    bilingual: {
      type: 'boolean',
      default: false,
      description: '字幕层双语显示：原文与译文两层字幕共用一份样式；只在 captions 为 true 时可以给',
    },
    translationId: {
      type: 'string',
      description:
        '就地刷新这份译文（translation 文档）：只重译过期与还没有译文的句子（或 sentences 点名的），写成它的新版本，从它生成的字幕层跟着更新；targetLanguage 要与它的语言相同，不能与 captions 同给',
    },
    sentences: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 500,
      description: '就地刷新时重译的句子 ID（s-<首词 ID>），译文新鲜的也重译；只能与 translationId 一起给',
    },
    // i18n-ignore-end
  },
  required: ['targetLanguage'],
  additionalProperties: false,
};

interface FreezeOutput extends Record<string, unknown> {
  artifactId: string;
  /** Frozen transcript body (the Speech Worker's input). */
  speechArtifactId: string;
  /** Facts about the media the transcript belongs to (the Speech Worker clamps subtitle cues within the media duration). */
  media: SpeechTranslateInput['media'];
  documentId: Id;
  revision: string;
  sentenceCount: number;
  /** In-place refresh: the frozen translation (its body is an artifact) and the work to do. */
  translation?: { documentId: Id; revision: string; artifactId: string };
  plan?: RefreshPlan;
}

interface TranslateOutput extends Record<string, unknown> {
  /** Translation body written by the Worker. */
  artifactId: string;
  /** Target-language subtitle cues split by the Worker (`cuccut.speech-worker.cues/1`). */
  cuesArtifactId: string;
  calls: { calls: number; retries: number; failures: number };
  modelVersion: string | null;
  /** Number of glossary entries after deduplication. `cappedBatches` is a field carried over in the summary; the subtitle and translation core never truncates terms, so it is always 0. */
  glossaryTerms?: number;
  cappedBatches?: number;
}

interface AssembleOutput extends Record<string, unknown> {
  artifactId: string;
  unitCount: number;
  /** In-place refresh: the units replaced with new translations (including newly created units). */
  changedUnitIds?: Id[];
}

interface WriteOutput extends Record<string, unknown> {
  documentId: Id;
  /** In-place refresh: the translation's version after the write, the caption documents whose cues were replaced, and that transaction. */
  revision?: string;
  captionDocumentIds?: Id[];
  transactionId?: Id;
}

export function translatePipeline(deps: TranslateDeps): PipelineDefinition<FrozenTranslateParams, TranslateParams> {
  return {
    name: TRANSLATE_PIPELINE,
    label: () => J.label(),
    description: () => J.description(),
    paramsSchema: PARAMS_SCHEMA,
    target: { create: false },
    parse: parseTranslateParams,
    async prepare(params, options) {
      const state = deps.videos.state(params.videoId);
      if (!state) throw new RpcError('not-found', J.videoNotOpen());
      const refresh = params.translationId !== undefined ? await prepareRefresh(deps.videos, params, state.documents) : null;
      const documentId = refresh?.documentId ?? pickSource(state.documents, params.documentId);
      sameLanguageCheck(state.documents[documentId]?.language ?? null, params.targetLanguage);
      // Retries reuse the frozen glossary. On first startup, the glossary passed in the call and the one enabled in the video are resolved, and their versions and contents are frozen and written as artifacts.
      const glossaryUse =
        'glossaryUse' in params || options.retry
          ? (params as FrozenTranslateParams).glossaryUse
          : await freezeGlossaries(deps, params, state.documents, documentId, options.submitter);
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
      const frozen: FrozenTranslateParams = {
        ...params,
        documentId,
        provider: selection.providerId,
        model: selection.modelId,
        batchSize: params.batchSize ?? DEFAULT_BATCH,
        ...(glossaryUse ? { glossaryUse } : {}),
      };
      const revision = state.documents[documentId]!.currentRevision;
      return {
        params: frozen,
        providerId: selection.providerId,
        modelId: selection.modelId,
        videoId: params.videoId,
        contentHash: `sha256:${sha256Hex(
          canonicalJson({ videoId: params.videoId, documentId, revision, ...(refresh ? { refresh: refresh.key } : {}) }),
        )}`,
        ...(glossaryUse?.entries.length
          ? { library: glossaryUse.entries.map(({ library, id, version, contentHash }) => ({ library, id, version, contentHash })) }
          : {}),
      };
    },
    steps: [
      targetStep(),
      {
        name: 'freeze-source',
        label: () => J.stepFreezeSource(),
        run: (context) => freezeSource(deps.videos, context),
        // The source document has a new version: the frozen source is stale, so retries re-read it from the current version. Old outputs without a frozen body are also re-read.
        reusable: async (output, { params, artifacts }) => {
          const o = output as Partial<FreezeOutput>;
          const documents = deps.videos.state(params.videoId)?.documents;
          return (
            documents?.[params.documentId]?.currentRevision === o.revision &&
            (params.translationId === undefined ||
              (o.translation !== undefined && documents?.[params.translationId]?.currentRevision === o.translation.revision)) &&
            typeof o.speechArtifactId === 'string' &&
            (await artifacts.locate(o.speechArtifactId)) !== null
          );
        },
      },
      {
        name: 'translate',
        label: () => J.stepTranslate(),
        run: (context) => translateWithWorker(deps, context),
        reusable: async (output, { artifacts }) => {
          const o = output as Partial<TranslateOutput>;
          return (
            typeof o.artifactId === 'string' &&
            typeof o.cuesArtifactId === 'string' &&
            (await artifacts.locate(o.artifactId)) !== null &&
            (await artifacts.locate(o.cuesArtifactId)) !== null
          );
        },
      },
      {
        name: 'assemble',
        label: () => J.stepAssemble(),
        run: async ({ outputs, artifacts, progress }) => {
          progress(null, 'validating');
          const frozen = outputs['freeze-source'] as FreezeOutput;
          const source = await readArtifact<FrozenSource>(artifacts, frozen.artifactId);
          const translated = outputs.translate as TranslateOutput;
          const body = await readArtifact<TranslationBody>(artifacts, translated.artifactId);
          if (frozen.translation && frozen.plan) {
            const base = await readArtifact<TranslationBody>(artifacts, frozen.translation.artifactId);
            const merged = mergeRefresh(base, body, source.sentences, frozen.plan, source.speechRef);
            if ('problems' in merged) {
              throw new PipelineStepError('WORKER_OUTPUT_INVALID', J.workerMismatch(), { problems: merged.problems.slice(0, 20) });
            }
            const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(merged.body)), 'json');
            return {
              output: { artifactId, unitCount: merged.body.units.length, changedUnitIds: merged.changedUnitIds } satisfies AssembleOutput,
              result: { documentId: null, artifactId },
            };
          }
          // The Worker's sentences and the sentences frozen here come from the same rules, so each sentence's ID, fingerprint and editViewHash must match.
          const problems = translationProblems(body, source);
          if (problems.length > 0) {
            throw new PipelineStepError('WORKER_OUTPUT_INVALID', J.workerMismatch(), {
              problems: problems.slice(0, 20),
            });
          }
          return {
            output: { artifactId: translated.artifactId, unitCount: body.units.length } satisfies AssembleOutput,
            result: { documentId: null, artifactId: translated.artifactId },
          };
        },
        reusable: async (output, { artifacts }) => (await artifacts.locate((output as AssembleOutput).artifactId)) !== null,
      },
      {
        name: 'write',
        label: () => J.stepWrite(),
        run: (context) =>
          context.params.translationId !== undefined ? writeRefresh(deps.videos, context) : writeTranslation(deps.videos, context),
      },
      captionsStep<FrozenTranslateParams>(deps.videos, {
        captionStyle: (params) => params.captionStyle,
        pipeline: TRANSLATE_PIPELINE,
        enabled: (params) => params.captions === true,
        videoId: (params) => params.videoId,
        source: (params, outputs) => {
          const written = outputs.write as WriteOutput | undefined;
          const translated = outputs.translate as TranslateOutput | undefined;
          return written && translated
            ? {
                kind: 'translation',
                documentId: written.documentId,
                bilingual: params.bilingual === true,
                cuesArtifactId: translated.cuesArtifactId,
              }
            : null;
        },
      }),
    ],
    async complete({ params, outputs }) {
      const frozen = outputs['freeze-source'] as FreezeOutput;
      const translated = outputs.translate as TranslateOutput;
      const assembled = outputs.assemble as AssembleOutput;
      const written = outputs.write as WriteOutput;
      const glossary = glossarySummary(params, translated);
      if (frozen.translation && frozen.plan) {
        const refresh: TranslateRefreshSummary = {
          revision: written.revision ?? frozen.translation.revision,
          sentences: frozen.plan.sentences,
          removedUnitIds: frozen.plan.removeUnitIds,
          captionDocumentIds: written.captionDocumentIds ?? [],
          ...(written.transactionId ? { transactionId: written.transactionId } : {}),
        };
        const summary: TranslateSummary = {
          videoId: params.videoId,
          documentId: written.documentId,
          source: { documentId: frozen.documentId, revision: frozen.revision },
          targetLanguage: params.targetLanguage,
          unitCount: assembled.unitCount,
          providerId: params.provider,
          modelId: params.model,
          ...(glossary ? { glossary } : {}),
          refresh,
        };
        return { summary: { ...summary }, result: { documentId: written.documentId, artifactId: assembled.artifactId } };
      }
      const summary: TranslateSummary = {
        videoId: params.videoId,
        documentId: written.documentId,
        source: { documentId: frozen.documentId, revision: frozen.revision },
        targetLanguage: params.targetLanguage,
        unitCount: assembled.unitCount,
        providerId: params.provider,
        modelId: params.model,
        ...(glossary ? { glossary } : {}),
        captions: captionsSummary(
          deps.videos,
          params.captions === true,
          (outputs.captions as CaptionLayerOutput | undefined) ?? null,
          params.videoId,
          written.documentId,
        ),
      };
      return { summary: { ...summary }, result: { documentId: written.documentId, artifactId: assembled.artifactId } };
    },
  };
}

export function parseTranslateParams(raw: Record<string, unknown>): TranslateParams {
  const reader = new ParamReader(raw, [
    'videoId',
    'documentId',
    'targetLanguage',
    'style',
    'glossary',
    'glossaries',
    'provider',
    'model',
    'batchSize',
    'captions',
    'captionStyle',
    'bilingual',
    'translationId',
    'sentences',
  ]);
  const targetLanguage = reader.string('targetLanguage', { max: 35 });
  if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(targetLanguage)) throw new RpcError('invalid-request', J.targetLanguageInvalid());
  const glossary = parseInlineGlossary(reader.array('glossary', { max: 500, optional: true }));
  const glossaries = parseGlossaryRefs(reader.array('glossaries', { max: MAX_LIBRARY_GLOSSARIES, optional: true }));
  const optional = (key: string, max: number) => reader.string(key, { optional: true, max });
  const documentId = optional('documentId', 128);
  const style = optional('style', 500);
  const provider = optional('provider', 128);
  const model = optional('model', 256);
  const batchSize = reader.int('batchSize', 1, 100);
  const flag = (key: 'captions' | 'bilingual') => {
    const value = raw[key];
    if (value !== undefined && typeof value !== 'boolean') throw new RpcError('invalid-request', J.flagInvalid({ key }));
    return value as boolean | undefined;
  };
  const captionStyle = readCaptionStyle(raw.captionStyle);
  const captions = flag('captions');
  if (captionStyle && captions !== true) throw invalid('captionStyle', JobsParams.onlyOneOf({ other: 'captions: false' }));
  const bilingual = flag('bilingual');
  if (bilingual === true && captions !== true) throw new RpcError('invalid-request', J.bilingualNeedsCaptions());
  const translationId = optional('translationId', 128);
  const sentences = reader.array('sentences', { min: 1, max: 500, optional: true })?.map((id) => {
    if (typeof id !== 'string' || id.trim() === '' || id.length > 200) throw invalid('sentences', JobsParams.mustBeNonEmptyString());
    return id;
  });
  if (sentences && translationId === undefined) throw new RpcError('invalid-request', J.sentencesNeedTranslation());
  if (translationId !== undefined && (captions === true || captionStyle !== undefined || bilingual === true)) {
    throw new RpcError('invalid-request', J.refreshNoCaptions());
  }
  return {
    videoId: reader.string('videoId', { max: 128 }),
    targetLanguage,
    ...(documentId !== undefined ? { documentId } : {}),
    ...(style !== undefined ? { style } : {}),
    ...(glossary !== undefined ? { glossary } : {}),
    ...(glossaries !== undefined ? { glossaries } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(batchSize !== undefined ? { batchSize } : {}),
    ...(captions !== undefined ? { captions } : {}),
    ...(captionStyle !== undefined ? { captionStyle } : {}),
    ...(bilingual !== undefined ? { bilingual } : {}),
    ...(translationId !== undefined ? { translationId } : {}),
    ...(sentences !== undefined ? { sentences: [...new Set(sentences)] } : {}),
  };
}

/**
 * Startup checks for an in-place refresh: the translation document exists and is a `translation`; it records which transcript it was translated from (must match `documentId` when given); its language matches `targetLanguage`; and its body is a `/2` that can be refreshed in place. Picks the work to do from the current version; returns `invalid-request` when a named sentence is not in the transcript or when there is no work to do.
 * Returns the source document and the keys used for deduplication (the translation's version and the work to do).
 */
async function prepareRefresh(
  videos: PipelineVideos,
  params: TranslateParams,
  documents: Record<Id, DocumentRecord>,
): Promise<{ documentId: Id; key: unknown }> {
  const translationId = params.translationId!;
  const record = documents[translationId];
  if (!record) throw new RpcError('not-found', J.noDocument({ documentId: translationId }));
  if (record.kind !== 'translation') throw new RpcError('invalid-request', J.notTranslation({ documentId: translationId, kind: record.kind }));
  const documentId = record.sourceDocumentId;
  if (!documentId || documents[documentId]?.kind !== 'speech') {
    throw new RpcError('invalid-request', J.translationNotRefreshable({ documentId: translationId }));
  }
  if (params.documentId !== undefined && params.documentId !== documentId) {
    throw new RpcError('invalid-request', J.translationSourceMismatch({ documentId: translationId, source: documentId }));
  }
  const translation = refreshableTranslation((await videos.document(params.videoId, translationId, record.currentRevision)).body);
  if (!translation) throw new RpcError('invalid-request', J.translationNotRefreshable({ documentId: translationId }));
  const language = record.language ?? translation.language;
  if (language.toLowerCase() !== params.targetLanguage.toLowerCase()) {
    throw new RpcError('invalid-request', J.translationLanguageMismatch({ language, target: params.targetLanguage }));
  }
  const read = sourceSentences((await videos.document(params.videoId, documentId, documents[documentId]!.currentRevision)).body);
  if ('problem' in read) throw new RpcError('invalid-request', asLocalized(read.problem, read.problemRef));
  const plan = refreshPlan(translation, read.sentences, params.sentences);
  if ('unknown' in plan) throw new RpcError('invalid-request', J.unknownSentence({ sentenceId: plan.unknown }));
  if (plan.sentences.length === 0 && plan.removeUnitIds.length === 0) throw new RpcError('invalid-request', J.nothingStale());
  return { documentId, key: { translationId, revision: record.currentRevision, plan } };
}

/** Resolves the glossary at startup: the one passed in the call and the one enabled in the video. When library entries are used, their contents are written as artifacts. undefined when neither exists. */
async function freezeGlossaries(
  deps: TranslateDeps,
  params: TranslateParams,
  documents: Record<Id, DocumentRecord>,
  documentId: Id,
  submitter: PipelinePrepareOptions['submitter'],
): Promise<FrozenGlossaryUse | undefined> {
  const enabled =
    submitter?.kind === 'service' || !deps.library
      ? []
      : (await videoSelection(documents, async (id, revision) => (await deps.videos.document(params.videoId, id, revision)).body)).selection
          .glossaries.translate;
  return freezeGlossaryUse(deps, {
    explicit: params.glossaries ?? [],
    enabled,
    targetLanguage: params.targetLanguage,
    sourceLanguage: documents[documentId]?.language ?? null,
    submitter,
  });
}

/** Source document: the one specified (must be a `speech`), or the only one in the video. */
export function pickSource(documents: Record<Id, DocumentRecord>, documentId: Id | undefined): Id {
  if (documentId !== undefined) {
    const document = documents[documentId];
    if (!document) throw new RpcError('not-found', J.noDocument({ documentId }));
    if (document.kind !== 'speech') throw new RpcError('invalid-request', J.notSpeech({ documentId, kind: document.kind }));
    return documentId;
  }
  const speech = Object.values(documents).filter((d) => d.kind === 'speech');
  if (speech.length === 0) throw new RpcError('not-found', J.noTranscript());
  if (speech.length > 1) {
    throw new RpcError('invalid-request', J.multipleTranscripts(), {
      documents: speech.map((d) => ({ documentId: d.id, name: d.name })),
    });
  }
  return speech[0]!.id;
}

async function freezeSource(videos: PipelineVideos, context: PipelineStepContext<FrozenTranslateParams>): Promise<StepResult> {
  const { params, artifacts, progress } = context;
  progress(null, 'starting');
  const state = videos.state(params.videoId);
  if (!state) throw new PipelineStepError('STALE_JOB_INPUT', J.videoClosed());
  const record = state.documents[params.documentId];
  if (!record) throw new PipelineStepError('STALE_JOB_INPUT', J.sourceGone(), { documentId: params.documentId });
  const content = await videos.document(params.videoId, params.documentId, record.currentRevision);
  const read = sourceSentences(content.body);
  if ('problem' in read) throw new PipelineStepError('INPUT_UNREADABLE', asLocalized(read.problem, read.problemRef), { documentId: params.documentId });
  if (read.sentences.length === 0)
    throw new PipelineStepError('INPUT_UNREADABLE', J.noSentences(), { documentId: params.documentId });
  const source: FrozenSource = {
    derivation: read.derivation,
    speechRef: { id: params.documentId, revision: content.revision },
    sequenceId: state.rootSequenceId,
    language: record.language ?? null,
    editViewHash: read.editViewHash,
    timescale: read.timescale,
    sentences: read.sentences,
  };
  const refresh = params.translationId !== undefined ? await freezeRefresh(videos, context, state.documents, read.sentences) : null;
  const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(source)), 'json');
  const speech = await artifacts.put(Buffer.from(JSON.stringify(content.body)), 'json');
  const output: FreezeOutput = {
    artifactId,
    speechArtifactId: speech.artifactId,
    media: mediaFacts(videos, params.videoId, record.sourceAssetId ?? null, read),
    documentId: params.documentId,
    revision: content.revision,
    sentenceCount: read.sentences.length,
    ...(refresh ?? {}),
  };
  return { output, result: { documentId: null, artifactId } };
}

/** In-place refresh: the current version of the frozen translation (its body is published as an artifact), with the work to do picked against the frozen source. */
async function freezeRefresh(
  videos: PipelineVideos,
  context: PipelineStepContext<FrozenTranslateParams>,
  documents: Record<Id, DocumentRecord>,
  sentences: FrozenSource['sentences'],
): Promise<Pick<FreezeOutput, 'translation' | 'plan'>> {
  const { params, artifacts } = context;
  const translationId = params.translationId!;
  const record = documents[translationId];
  if (!record) throw new PipelineStepError('STALE_JOB_INPUT', J.translationGone(), { documentId: translationId });
  const content = await videos.document(params.videoId, translationId, record.currentRevision);
  const body = refreshableTranslation(content.body);
  if (!body) throw new PipelineStepError('INPUT_UNREADABLE', J.translationNotRefreshable({ documentId: translationId }));
  const plan = refreshPlan(body, sentences, params.sentences);
  if ('unknown' in plan) throw new PipelineStepError('STALE_JOB_INPUT', J.unknownSentence({ sentenceId: plan.unknown }));
  if (plan.sentences.length === 0 && plan.removeUnitIds.length === 0) throw new PipelineStepError('STALE_JOB_INPUT', J.nothingStale());
  const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(body)), 'json');
  return { translation: { documentId: translationId, revision: content.revision, artifactId }, plan };
}

/**
 * Media facts the Speech Worker needs: the content fingerprint, duration and sample rate of the media's current version. When these cannot be obtained (the transcript does not belong to a media item, or the Runtime did not supply them), the content fingerprint is left empty, and the duration is taken from the end of the last sentence in the transcript (the Worker only uses it to keep subtitle cues within the media).
 */
function mediaFacts(
  videos: PipelineVideos,
  videoId: Id,
  assetId: Id | null,
  read: { timescale: number; sentences: Array<{ end: number }> },
): SpeechTranslateInput['media'] {
  const facts = assetId ? (videos.asset?.(videoId, assetId) ?? null) : null;
  const lastEnd = Math.max(0, ...read.sentences.map((s) => s.end));
  return {
    assetId,
    contentHash: facts?.contentHash ?? '',
    duration: facts?.duration ?? { ticks: String(lastEnd), timescale: read.timescale },
    ...(facts?.sampleRate !== undefined ? { sampleRate: facts.sampleRate } : {}),
  };
}

/** No translation when the source and target have the same primary language subtag (the Speech Worker also rejects this). Rejected at startup with `invalid-request`, and no job is created. */
function sameLanguageCheck(sourceLanguage: string | null, targetLanguage: string): void {
  const primary = (tag: string) => tag.split('-')[0]!.toLowerCase();
  if (sourceLanguage && primary(sourceLanguage) === primary(targetLanguage)) {
    throw new RpcError('invalid-request', J.sameLanguage({ source: sourceLanguage, target: targetLanguage }), {
      sourceLanguage,
      targetLanguage,
    });
  }
}

/**
 * Translates in the Speech Worker (`speech-worker.ts`): the frozen transcript body, media facts, glossary and style hints are passed to the subtitle and translation core. Every model call goes through `deps.text` (authorization, budget, ledger and stop barrier are all handled there). staging is a subdirectory used only by this step, and checkpoints live inside it: after an interruption or failure, a retry does not request pages that were already translated. The translation body and subtitle cues produced are published as artifacts.
 */
async function translateWithWorker(deps: TranslateDeps, context: PipelineStepContext<FrozenTranslateParams>): Promise<StepResult> {
  const { params, outputs, artifacts, signal, progress, staging } = context;
  const command = deps.speechWorker();
  if (!command) {
    throw new PipelineStepError('WORKER_FAILED', J.workerMissing(), {
      reason: 'worker-missing',
    });
  }
  const frozen = outputs['freeze-source'] as FreezeOutput;
  const source = await readArtifact<FrozenSource>(artifacts, frozen.artifactId);
  const base = frozen.translation ? await readArtifact<TranslationBody>(artifacts, frozen.translation.artifactId) : null;
  if (base && frozen.plan?.sentences.length === 0) {
    // Only units to remove: no model call is needed. The output is a base pointing to this source, with empty subtitle cues.
    const body: TranslationBody = {
      ...base,
      sourceBasis: { ...base.sourceBasis, speechRef: source.speechRef, sequenceId: source.sequenceId, editViewHash: source.editViewHash },
    };
    const cues: SpeechWorkerCues = { schema: SPEECH_WORKER_CUES_SCHEMA, language: base.language, timescale: source.timescale, cues: [] };
    const translation = await artifacts.put(Buffer.from(JSON.stringify(body)), 'json');
    const stored = await artifacts.put(Buffer.from(JSON.stringify(cues)), 'json');
    const output: TranslateOutput = {
      artifactId: translation.artifactId,
      cuesArtifactId: stored.artifactId,
      calls: { calls: 0, retries: 0, failures: 0 },
      modelVersion: null,
    };
    return { output, result: { documentId: null, artifactId: output.artifactId } };
  }
  const speech = await readArtifact<unknown>(artifacts, frozen.speechArtifactId);
  const snapshot = await loadGlossaries(artifacts, params);
  const terms = promptTerms(snapshot);
  const glossaryRef = glossaryRefOf(snapshot, source.sentences.map((s) => s.text).join('\n'));
  // Model limits (output cap, whether temperature is accepted) are taken from the frozen Provider and model.
  const selection = await deps.selectText({ provider: params.provider, model: params.model });
  const result = await runSpeechTranslate({
    command,
    staging: path.join(staging, 'translate'),
    input: {
      media: frozen.media,
      sourceLanguage: source.language,
      speechRef: source.speechRef,
      sequenceId: source.sequenceId,
      speech,
      targetLanguage: params.targetLanguage,
      glossary: terms.map(({ source: from, target, note }) => ({ source: from, target, ...(note ? { note } : {}) })),
      glossaryRef,
      params: {
        ...(params.style !== undefined ? { instructions: params.style } : {}),
        ...(deps.backoffScale !== undefined ? { backoffScale: deps.backoffScale } : {}),
      },
      ...(base && frozen.plan ? { translation: base, sentences: frozen.plan.sentences } : {}),
    },
    text: deps.text,
    provider: params.provider,
    model: params.model,
    modelInfo: selection.model,
    signal,
    progress,
  });
  const translation = await artifacts.put(Buffer.from(JSON.stringify(result.translation)), 'json');
  const cues = await artifacts.put(Buffer.from(JSON.stringify(result.cues)), 'json');
  const output: TranslateOutput = {
    artifactId: translation.artifactId,
    cuesArtifactId: cues.artifactId,
    calls: result.calls,
    modelVersion: result.modelVersion,
    ...(terms.length > 0 ? { glossaryTerms: terms.length, cappedBatches: 0 } : {}),
  };
  return { output, result: { documentId: null, artifactId: translation.artifactId } };
}

async function writeTranslation(videos: PipelineVideos, context: PipelineStepContext<FrozenTranslateParams>): Promise<StepResult> {
  const { params, outputs, artifacts, progress, jobId, parentJobId, run } = context;
  progress(null, 'applying');
  const frozen = outputs['freeze-source'] as FreezeOutput;
  const translated = outputs.translate as TranslateOutput;
  const assembled = outputs.assemble as AssembleOutput;
  const body = await readArtifact<TranslationBody>(artifacts, assembled.artifactId);
  const operation: EditOperation = {
    type: 'putDocument',
    ref: 'translation',
    kind: 'translation',
    name: J.documentName({ language: params.targetLanguage }).text,
    language: params.targetLanguage,
    sourceDocument: { documentId: frozen.documentId },
    body,
    summary: { unitCount: body.units.length, sourceRevision: frozen.revision },
    extensions: {
      engine: {
        providerId: params.provider,
        modelId: params.model,
        modelVersion: translated.modelVersion,
        promptVersion: SPEECH_WORKER_PROTOCOL,
      },
      pipeline: { name: TRANSLATE_PIPELINE, jobId: parentJobId, actor: PIPELINE_ACTOR_ID, translationArtifactId: translated.artifactId },
    },
  };
  for (let attempt = 1; ; attempt++) {
    const state = videos.state(params.videoId);
    if (!state) throw new PipelineStepError('STALE_JOB_INPUT', J.videoClosedKept());
    const current = state.documents[frozen.documentId];
    if (!current || current.currentRevision !== frozen.revision) {
      throw new PipelineStepError('STALE_JOB_INPUT', J.sourceChanged(), {
        documentId: frozen.documentId,
        frozenRevision: frozen.revision,
        currentRevision: current?.currentRevision ?? null,
      });
    }
    try {
      const receipt = await videos.apply(params.videoId, {
        commandId: `cmd_${jobId}_write_${attempt}`,
        expectedRevision: state.revision,
        operations: [operation],
        label: J.transactionLabel({ language: params.targetLanguage }).text,
        run,
      });
      const documentId = receipt.refs?.translation;
      if (!documentId) throw new PipelineStepError('APPLY_FAILED', J.noDocumentId());
      return { output: { documentId } satisfies WriteOutput, result: { documentId, artifactId: assembled.artifactId } };
    } catch (error) {
      // The video was changed between read and write: read again, re-check the source document, and submit again with a new command.
      if (error instanceof RpcError && error.code === 'conflict' && attempt < APPLY_ATTEMPTS) continue;
      if (error instanceof PipelineStepError) throw error;
      throw new PipelineStepError('APPLY_FAILED', J.rejected(), {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * In-place refresh write: one transaction writes a new version of the same translation document, together with the cues in each caption document generated from it for the sentences that were retranslated or removed (`retextCaption`; the cues are the ones the Worker split, and other cues are left alone). Before committing, it checks that the transcript and this translation are still at the frozen versions. If the video was changed between read and write (`conflict`), the caption documents are read again and the command is resubmitted with a new one.
 */
async function writeRefresh(videos: PipelineVideos, context: PipelineStepContext<FrozenTranslateParams>): Promise<StepResult> {
  const { params, outputs, artifacts, progress, jobId, run } = context;
  progress(null, 'applying');
  const frozen = outputs['freeze-source'] as FreezeOutput;
  const translated = outputs.translate as TranslateOutput;
  const assembled = outputs.assemble as AssembleOutput;
  const frozenTranslation = frozen.translation!;
  const translationId = frozenTranslation.documentId;
  const body = await readArtifact<TranslationBody>(artifacts, assembled.artifactId);
  const cues = await readArtifact<SpeechWorkerCues>(artifacts, translated.cuesArtifactId);
  const speech = readSpeechWords(await readArtifact<unknown>(artifacts, frozen.speechArtifactId));
  const bySentence = sentenceSpeakers(speech?.words ?? []);
  const speakers = speech?.speakers ?? new Map<string, string>();
  const changed = (assembled.changedUnitIds ?? []).map((unitId) => ({ unitId, fresh: workerUnitCues(cues, unitId, bySentence) }));
  const removed = (frozen.plan?.removeUnitIds ?? []).map((unitId) => ({ unitId, fresh: [] }));
  for (let attempt = 1; ; attempt++) {
    const state = videos.state(params.videoId);
    if (!state) throw new PipelineStepError('STALE_JOB_INPUT', J.videoClosedKept());
    const source = state.documents[frozen.documentId];
    if (!source || source.currentRevision !== frozen.revision) {
      throw new PipelineStepError('STALE_JOB_INPUT', J.sourceChanged(), {
        documentId: frozen.documentId,
        frozenRevision: frozen.revision,
        currentRevision: source?.currentRevision ?? null,
      });
    }
    const record = state.documents[translationId];
    if (!record) throw new PipelineStepError('STALE_JOB_INPUT', J.translationGone(), { documentId: translationId });
    if (record.currentRevision !== frozenTranslation.revision) {
      throw new PipelineStepError('STALE_JOB_INPUT', J.translationChanged(), {
        documentId: translationId,
        frozenRevision: frozenTranslation.revision,
        currentRevision: record.currentRevision,
      });
    }
    const previous = record.revisions?.[record.currentRevision]?.summary;
    const operations: EditOperation[] = [
      {
        type: 'putDocument',
        documentId: translationId,
        kind: 'translation',
        body,
        summary: { ...(previous && typeof previous === 'object' ? previous : {}), unitCount: body.units.length, sourceRevision: frozen.revision },
      },
    ];
    const captionDocumentIds: Id[] = [];
    for (const caption of Object.values(state.documents)) {
      if (!derivedFrom(caption, translationId)) continue;
      const content = await videos.document(params.videoId, caption.id, caption.currentRevision);
      if (typeof content.body !== 'object' || content.body === null) continue;
      let next = content.body as Record<string, unknown>;
      for (const { unitId, fresh } of [...changed, ...removed]) next = retextCaption(next, unitId, fresh, speakers);
      const summary = caption.revisions?.[caption.currentRevision]?.summary;
      operations.push({
        type: 'putDocument',
        documentId: caption.id,
        kind: caption.kind,
        body: next,
        summary: { ...(summary && typeof summary === 'object' ? summary : {}), cueCount: Array.isArray(next.cues) ? next.cues.length : 0 },
      });
      captionDocumentIds.push(caption.id);
    }
    try {
      const receipt = await videos.apply(params.videoId, {
        commandId: `cmd_${jobId}_refresh_${attempt}`,
        expectedRevision: state.revision,
        operations,
        label: J.refreshLabel({ language: params.targetLanguage }).text,
        run,
      });
      const revision = videos.state(params.videoId)?.documents[translationId]?.currentRevision ?? frozenTranslation.revision;
      const output: WriteOutput = {
        documentId: translationId,
        revision,
        captionDocumentIds,
        ...(receipt.transactionId ? { transactionId: receipt.transactionId } : {}),
      };
      return { output, result: { documentId: translationId, artifactId: assembled.artifactId } };
    } catch (error) {
      if (error instanceof RpcError && error.code === 'conflict' && attempt < APPLY_ATTEMPTS) continue;
      if (error instanceof PipelineStepError) throw error;
      throw new PipelineStepError('APPLY_FAILED', J.rejected(), {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
