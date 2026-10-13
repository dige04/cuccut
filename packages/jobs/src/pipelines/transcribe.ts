import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  type DocumentRecord,
  type Id,
  type PipelineCreateScope,
  type PipelineCreateTarget,
  type Sequence,
  type SequenceItem,
  type GeneratedOutput,
  type JobRecord,
  type TranscribeFileSummary,
  type TranscribeParams,
  type TranscribeSummary,
  type TranscriptReplace,
  type TranscriptSwitchImpact,
} from '@cuccut/protocol';
import { EditorWasmError } from '@cuccut/editor-wasm';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { JobsTranscribe } from '@cuccut/protocol/messages/jobs/transcribe.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { withCause } from '../job-text.ts';
import { TRANSCRIPT_SWITCH_EXTENSION, asrStage, contentFingerprint } from '../transcript-switch.ts';
import { readCaptionStyle, captionsStep, captionsSummary, existingCaptionLayer, type CaptionLayerOutput, type CaptionVideos } from './caption-layer.ts';
import { downloadTranscript } from './download-transcript.ts';
import { fileInputSchema, rejectUnresolvedEntry } from './entry-input.ts';
import { ParamReader, invalid } from './params.ts';
import { PipelineStepError, type PipelineDefinition, type PipelineStepContext, type StepOutputs } from './pipeline.ts';
import { ensureSaveDirectory, ensureSaveDirectoryForStep } from './save-location.ts';
import { createHeldVideo, importMedia, transcribeInVideo, type MediaVideos, type PipelineTranscriber } from './video-create.ts';
import { createScopeOf, readCreateTarget, targetSchema, targetStep, type PipelineTargets } from './video-target.ts';

/**
 * Transcription (architecture design §7.9; the backend of the transcription tool): resolve the target → (when creating a new video) create the video, import local media and place it on the timeline → transcribe → build the subtitle layer.
 *
 * It shares its name with the transcription Job submitted by `models.transcribe`, but it is a different thing: this is the parent task (`kind: 'pipeline'`, `pipeline.name: 'transcribe'`),
 * and its “transcribe” step submits one `transcribe` Job (submitter `{ kind: 'pipeline', id: <父任务> }`) and waits for it to complete.
 *
 * - “Apply” happens within the transcription: the transcription Job itself applies the speech document to the video (§7.3, `putDocument` a new `speech`, with `extensions.jobId`
 *   recording that Job), so the flow does not write it again, and there is therefore no separate `apply` step.
 * - Asset: when `assetId` is given, it is used; otherwise the asset on the root sequence's main track is taken (the first video track with a media instance, or when there is none, the first audio track with a media instance),
 *   rejected with `TRANSCRIBE_ASSET_AMBIGUOUS` when there is more than one, and `TRANSCRIBE_ASSET_NOT_FOUND` when there is none (`assetId` must then be given).
 * - Destination (§7.9 “transcription”): when the video already has a transcription of this asset, a second copy is not added to this video. With `destination: 'new-video'` (the default), the `create`
 *   step creates a new video in the project containing the original video (or the session's source directory), imports the same file as a linked asset and places it on the main track; subsequent steps then operate on the new video;
 *   with `replace`, the transcription Job's apply result is the transaction that swaps in the transcript (`transcript-switch.ts`: new version, carried-over translations, captions and dubbing). The subtitle layer has already been
 *   re-cut there, so the `captions` step is skipped according to the existing subtitle-layer rules. For an asset that has no transcription yet, both options write directly into it (summary `target: 'first'`).
 *   The destination is fixed and frozen at submission (retries do not change it).
 * - Manual-edit gate: with `replace`, when the current transcript's full-text fingerprint does not match `stages.asr` (the user edited the source text) and `acceptEdited` is not given, the request is rejected at submission with
 *   `TRANSCRIPT_EDITED` and no task is created; the fingerprint at submission is frozen with the request, and the transcription Job checks it again before applying. A transcript without `stages.asr` is treated as unedited.
 * - When an asset has several transcriptions (earlier versions allowed this), the one swapped in is the one on the root sequence that has a subtitle layer; if none has one, the most recently written one is taken.
 * - New video (`target.create` with `media`): created in the project (the same path as `videos.create`), `media` is imported as a linked asset
 *   (the file stays where it is) and placed on the main track in the same transaction; the origin `origin: 'file-import'` records the file path and this run. When no name is given, the file name is used.
 * - Retries: creating, importing and transcribing each recognize what was half-done last time (`video-create.ts`), so no extra video, asset or transcription is created;
 *   if the document was deleted after transcription completed, transcription runs again.
 * - File only (`file`, without `videoId` / `target`): no video is created; the “transcribe” step submits a transcription Job without a video and waits for it to complete, then writes
 *   `<源文件名>.txt` and `.srt` to the save location (`outDir`; when not given, the Runtime's save location, frozen at submission; the same code path as transcripts downloaded from links, `download-transcript.ts`);
 *   the subtitle layer step is skipped. When `file` is a Space entry (`{ entryId }`), the method layer first replaces it with a path.
 */

export const TRANSCRIBE_PIPELINE = 'transcribe';

export interface TranscribeDeps {
  videos: CaptionVideos & MediaVideos;
  /** Transcription: selects the provider and model (`CAPABILITY_NOT_CONFIGURED` when not configured), submits, and waits. */
  transcriber: PipelineTranscriber;
  /** Create a new video (`target.create`). Without it, `create` is rejected. */
  targets?: Pick<PipelineTargets, 'reserve' | 'create'>;
  /** Transcription glossaries enabled in the video that are still in the library at this moment (§5.9, in enabled order); when not given, no glossary is applied. */
  enabledGlossaries?: (videoId: Id) => Promise<Id[]>;
  /** The save location when only a file is given and `outDir` is not (§7.9); when not wired up (only in unit tests), written next to the source file. */
  saveDirectory?: () => string;
  /**
   * Facts about the original video needed by the `new-video` destination: its name and scope (project or session), and the asset's current version file. When not wired up, `new-video` is rejected
   * (`PIPELINE_TARGET_UNSUPPORTED`).
   */
  sources?: {
    video(videoId: Id): { name: string; scope: PipelineCreateScope } | null;
    assetFile(videoId: Id, assetId: Id): Promise<string | null>;
  };
}

/** The destination fixed at submission (see the file header). */
export type TranscribeLanding =
  | { kind: 'first' }
  | { kind: 'new-video'; sourceVideoId: Id; assetId: Id; name: string; scope: PipelineCreateScope }
  | { kind: 'replace'; assetId: Id; replace: TranscriptReplace };

/** Validated parameters: a given video, a target for a new video, or a file only (`file` is already an absolute path). */
export interface CheckedTranscribeParams extends Omit<TranscribeParams, 'videoId'> {
  videoId?: Id;
  create?: PipelineCreateTarget & { media: string };
  file?: string;
  outDir?: string;
}

/** Frozen parameters: provider and model are selected, and `captions` has its default filled in. */
export interface FrozenTranscribeParams extends CheckedTranscribeParams {
  provider: string;
  model: string;
  captions: boolean;
  /** Applies the transcription glossaries enabled in the video during transcription. The client that starts it is not an externally facing one (same as `models.transcribe`; external services do not touch the user library). */
  videoGlossaries?: boolean;
  /** The destination when a video is given (fixed at submission); absent for a new video or a file-only run. */
  landing?: TranscribeLanding;
}

interface CreateOutput extends Record<string, unknown> {
  videoId: Id;
  place: Record<string, unknown>;
  assetId: Id;
}

/** Output of the “transcribe” step when only a file is given. */
interface FileTranscribeOutput extends Record<string, unknown> {
  jobId: Id;
  files: string[];
  outputs: GeneratedOutput[];
  language: string | null;
}

interface TranscribeOutput extends Record<string, unknown> {
  jobId: Id;
  videoId: Id;
  documentId: Id;
  /** Result artifact of the transcription Job (the transcription result, segment by segment). */
  artifactId: string;
  assetId: Id;
  /** The transaction that wrote the transcript (for a swap, the one used for undo); null when not found. */
  transactionId: Id | null;
}

/** Upper limit on recognition hints, the same as `hint` in `models.transcribe`. */
const HINT_MAX = 1200;

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for the agent)
    videoId: { type: 'string', description: '已打开的视频（等同 target: { videoId }）' },
    target: targetSchema('要转录的视频：已打开的、Space 里的视频条目（流程期间由 Runtime 打开），或新建视频并导入本机媒体', {
      projectId: '新视频所在的项目',
      conversationId: '新视频建在这个会话的来源目录里（会话属于项目时是那个项目）；与 projectId 给一个',
      name: '新视频的名字；不给时取媒体的文件名',
      media: '本机媒体文件的绝对路径：以链接素材导入（文件留在原处）并放上时间线',
    }),
    assetId: { type: 'string', description: '要转写的素材；不给时取根序列主轨上唯一的素材' },
    language: { type: 'string', description: '断言语言（BCP 47）；不给时自动检测' },
    provider: { type: 'string', description: '转写的 Provider；不给时用默认值' },
    model: { type: 'string' },
    hint: {
      type: 'string',
      maxLength: HINT_MAX,
      description: '识别提示（同 models.transcribe 的 hint；模型不收提示时不交给模型，转写任务记 hint-ignored 提醒）；视频里启用的转写术语表照样拼进去',
    },
    diarize: { type: 'boolean', description: '区分说话人（同 models.transcribe 的 diarize）；不给时按模型，能区分的区分' },
    captionStyle: {
      type: 'object',
      properties: { schema: { const: 'cuccut.legacy-studio-style/0.1' }, style: { type: 'object' } },
      required: ['schema', 'style'],
      description: '新建字幕的 Studio 样式文档；共用已有样式时保留原样',
    },
    captions: { type: 'boolean', default: true, description: '转写之后建立字幕层；同一份文稿已有字幕层时跳过' },
    file: {
      description: '只给文件：不建视频，转写这个媒体文件，把 <源文件名>.txt 与 .srt 写到保存位置；与 videoId、target 不能同时给',
      ...fileInputSchema('媒体文件的绝对路径', 'Space 里的音频、视频文件或成片条目'),
    },
    outDir: { type: 'string', description: '只给文件时的输出目录（绝对路径，不存在时创建）；不给时是保存位置' },
    destination: {
      type: 'string',
      enum: ['new-video', 'replace'],
      default: 'new-video',
      description:
        '视频已有这个素材的转写时的落点：new-video 在同一项目新建一部视频（链接同一份素材）；replace 换用文稿，一笔可撤销的事务里结转译文、字幕与配音。没有转写的视频两种都直接写进它；只配已有的视频',
    },
    name: { type: 'string', description: 'new-video 新建视频的名字；不给时「<原名> · 重新转录」' },
    translations: {
      type: 'string',
      enum: ['carry', 'discard'],
      default: 'carry',
      description: 'replace 时各语言译文：carry 结转（原文没变的句子保留译文与审阅状态，变了的标过期）；discard 不结转',
    },
    acceptEdited: {
      type: 'boolean',
      description: 'replace 而文稿在转录之后被改过（全文指纹与 stages.asr 不符）时仍然取代；不给时以 TRANSCRIPT_EDITED 拒绝',
    },
    // i18n-ignore-end
  },
  additionalProperties: false,
};

const LANGUAGE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

export function transcribePipeline(deps: TranscribeDeps): PipelineDefinition<FrozenTranscribeParams, CheckedTranscribeParams> {
  return {
    name: TRANSCRIBE_PIPELINE,
    label: () => JobsTranscribe.label(),
    description: () => JobsTranscribe.description(),
    paramsSchema: PARAMS_SCHEMA,
    target: { create: { media: true } },
    parse: parseTranscribeParams,
    async prepare(params, { retry, submitter }) {
      if (params.file !== undefined) return prepareFile(deps, params, retry);
      if (params.create) {
        if (!deps.targets) throw new RpcError('invalid-request', JobsTranscribe.cannotCreateVideo(), { code: 'PIPELINE_TARGET_UNSUPPORTED' });
        // On retry, if the create step has already completed, the file is not read again.
        if (!retry) await checkMedia(params.create.media);
      } else if (params.videoId === undefined || !deps.videos.state(params.videoId)) {
        throw new RpcError('not-found', JobsTranscribe.videoNotOpen());
      }
      // The destination is fixed at submission; a retry keeps the frozen one (an earlier attempt may already have written to it).
      const frozenLanding = (params as FrozenTranscribeParams).landing;
      const landing = params.create ? undefined : (frozenLanding ?? (await resolveLanding(deps, params, params.videoId!)));
      const selection = await deps.transcriber.check({
        ...(params.provider !== undefined ? { provider: params.provider } : {}),
        ...(params.model !== undefined ? { model: params.model } : {}),
      });
      const frozen: FrozenTranscribeParams = {
        ...params,
        provider: selection.providerId,
        model: selection.modelId,
        captions: params.captions ?? true,
        videoGlossaries: submitter?.kind !== 'service',
        ...(landing ? { landing } : {}),
      };
      return {
        params: frozen,
        providerId: selection.providerId,
        modelId: selection.modelId,
        videoId: frozen.videoId ?? null,
        contentHash: `sha256:${sha256Hex(
          canonicalJson(
            frozen.create
              ? { media: frozen.create.media }
              : {
                  videoId: frozen.videoId,
                  assetId: frozen.assetId ?? null,
                  ...(landing && landing.kind !== 'first' ? { destination: landing.kind } : {}),
                },
          ),
        )}`,
      };
    },
    steps: [
      targetStep(),
      {
        name: 'create',
        label: () => JobsTranscribe.stepCreate(),
        holdsVideo: true,
        when: (params) => params.create !== undefined || params.landing?.kind === 'new-video',
        run: (context) => (context.params.create ? createVideo(deps, context) : createLinkedVideo(deps, context)),
      },
      {
        name: 'transcribe',
        label: () => JobsTranscribe.stepTranscribe(),
        run: (context) => (context.params.file !== undefined ? transcribeFile(deps, context) : transcribe(deps, context)),
        // The document was deleted: retry transcribes again. A file-only transcription that has completed is not redone (the transcript has already been written out).
        reusable: async (output) => {
          if ('files' in output) return true;
          const out = output as TranscribeOutput;
          return deps.videos.state(out.videoId)?.documents[out.documentId]?.kind === 'speech';
        },
      },
      captionsStep<FrozenTranscribeParams>(deps.videos, {
        captionStyle: (params) => params.captionStyle,
        pipeline: TRANSCRIBE_PIPELINE,
        enabled: (params) => params.captions,
        videoId: (params, outputs) => targetVideo(params, outputs),
        source: (_params, outputs) => {
          const transcribed = outputs.transcribe as TranscribeOutput | undefined;
          return transcribed ? { kind: 'speech', documentId: transcribed.documentId } : null;
        },
      }),
    ],
    async complete({ params, outputs }) {
      if (params.file !== undefined) {
        const done = outputs.transcribe as FileTranscribeOutput;
        const summary: TranscribeFileSummary = {
          file: params.file,
          files: done.files,
          transcribeJobId: done.jobId,
          language: done.language,
          providerId: params.provider,
          modelId: params.model,
        };
        return {
          summary: { ...summary },
          result: { documentId: null, artifactId: done.outputs[0]!.artifactId, outputs: done.outputs },
        };
      }
      const videoId = targetVideo(params, outputs)!;
      const transcribed = outputs.transcribe as TranscribeOutput;
      const record = deps.videos.state(videoId)?.documents[transcribed.documentId];
      const landing = params.landing;
      const impact = landing?.kind === 'replace' ? switchImpact(record, transcribed.jobId) : null;
      const summary: TranscribeSummary = {
        videoId,
        createdVideo: params.create !== undefined || landing?.kind === 'new-video',
        assetId: transcribed.assetId,
        transcribeJobId: transcribed.jobId,
        documentId: transcribed.documentId,
        language: record?.language ?? null,
        providerId: params.provider,
        modelId: params.model,
        target: landing?.kind ?? 'first',
        newVideo: landing?.kind === 'new-video' ? { videoId, name: landing.name } : null,
        replaced:
          landing?.kind === 'replace'
            ? {
                documentId: landing.replace.documentId,
                previousVersion: landing.replace.revision,
                transactionId: transcribed.transactionId,
              }
            : null,
        translations: impact?.translations ?? [],
        captionPins: landing?.kind === 'replace' ? (impact?.captionPins ?? { reanchored: 0, orphaned: 0 }) : null,
        dubs: impact?.dubs ?? [],
        speakerCount: speakerCountOf(record),
        captions: captionsSummary(
          deps.videos,
          params.captions,
          (outputs.captions as CaptionLayerOutput | undefined) ?? null,
          videoId,
          transcribed.documentId,
        ),
      };
      return { summary: { ...summary }, result: { documentId: transcribed.documentId, artifactId: transcribed.artifactId } };
    },
  };
}

export function parseTranscribeParams(raw: Record<string, unknown>): CheckedTranscribeParams {
  const reader = new ParamReader(raw, [
    'videoId',
    'target',
    'assetId',
    'language',
    'provider',
    'model',
    'hint',
    'diarize',
    'captions',
    'captionStyle',
    'file',
    'outDir',
    'destination',
    'name',
    'translations',
    'acceptEdited',
  ]);
  const videoId = reader.string('videoId', { max: 200, optional: true });
  const assetId = reader.string('assetId', { max: 200, optional: true });
  const language = reader.string('language', { max: 35, optional: true });
  if (language !== undefined && !LANGUAGE.test(language)) throw invalid('language', JobsParams.mustBeLanguageTag());
  const provider = reader.string('provider', { max: 128, optional: true });
  const model = reader.string('model', { max: 256, optional: true });
  const hint = reader.string('hint', { max: HINT_MAX, optional: true })?.trim();
  const captionStyle = readCaptionStyle(raw.captionStyle);
  const captions = raw.captions;
  if (captions !== undefined && typeof captions !== 'boolean') throw invalid('captions', JobsParams.mustBeBoolean());
  if (captionStyle && (captions === false || raw.file !== undefined)) throw invalid('captionStyle', JobsParams.onlyOneOf({ other: raw.file !== undefined ? 'file' : 'captions: false' }));
  const diarize = raw.diarize;
  if (diarize !== undefined && typeof diarize !== 'boolean') throw invalid('diarize', JobsParams.mustBeBoolean());
  const outDir = reader.string('outDir', { max: 4096, optional: true });
  const destination = reader.oneOf('destination', ['new-video', 'replace'] as const);
  const name = reader.string('name', { max: 200, optional: true })?.trim();
  const translations = reader.oneOf('translations', ['carry', 'discard'] as const);
  const acceptEdited = raw.acceptEdited;
  if (acceptEdited !== undefined && typeof acceptEdited !== 'boolean') throw invalid('acceptEdited', JobsParams.mustBeBoolean());
  // The destination parameters apply only to existing videos (`{ videoId }`, `{ entryId }`).
  const landingKey = (['destination', 'name', 'translations', 'acceptEdited'] as const).find((key) => raw[key] !== undefined);
  if (landingKey && (raw.file !== undefined || raw.target !== undefined)) throw invalid(landingKey, JobsTranscribe.landingNeedsVideo());
  if (name !== undefined && destination === 'replace') throw invalid('name', JobsTranscribe.nameNewVideoOnly());
  if (translations !== undefined && destination !== 'replace') throw invalid('translations', JobsTranscribe.replaceOnly());
  if (acceptEdited !== undefined && destination !== 'replace') throw invalid('acceptEdited', JobsTranscribe.replaceOnly());
  if (raw.file !== undefined) {
    const file = fileOf(raw.file);
    if (videoId !== undefined || raw.target !== undefined) throw invalid('file', JobsTranscribe.fileExcludesVideo());
    if (assetId !== undefined) throw invalid('assetId', JobsTranscribe.assetIdWithFile());
    if (captions !== undefined) throw invalid('captions', JobsTranscribe.captionsWithFile());
    if (diarize !== undefined) throw invalid('diarize', JobsTranscribe.diarizeWithFile());
    if (outDir !== undefined && !path.isAbsolute(outDir)) throw invalid('outDir', JobsParams.mustBeAbsolutePath());
    return {
      file,
      ...(outDir !== undefined ? { outDir } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(hint ? { hint } : {}),
    };
  }
  if (outDir !== undefined) throw invalid('outDir', JobsTranscribe.outDirFileOnly());
  // The targets `{ videoId }` and `{ entryId }` are replaced by PipelineRunner with the top-level `videoId`; only creation remains here.
  const create = raw.target === undefined ? undefined : createOf(raw.target);
  if (create && videoId !== undefined) throw invalid('target', JobsParams.createExcludesVideoId());
  if (create && assetId !== undefined) throw invalid('assetId', JobsTranscribe.assetIdWithCreate());
  if (!create && videoId === undefined) throw new RpcError('invalid-request', JobsTranscribe.needVideoOrFile());
  return {
    ...(videoId !== undefined ? { videoId } : {}),
    ...(create ? { create } : {}),
    ...(assetId !== undefined ? { assetId } : {}),
    ...(language !== undefined ? { language } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(hint ? { hint } : {}),
    ...(diarize !== undefined ? { diarize } : {}),
    ...(captions !== undefined ? { captions } : {}),
    ...(destination !== undefined ? { destination } : {}),
    ...(name ? { name } : {}),
    ...(translations !== undefined ? { translations } : {}),
    ...(acceptEdited !== undefined ? { acceptEdited } : {}),
    ...(captionStyle !== undefined ? { captionStyle } : {}),
  };
}

function createOf(target: unknown): PipelineCreateTarget & { media: string } {
  if (typeof target !== 'object' || target === null || Array.isArray(target) || Object.keys(target).join() !== 'create') {
    throw invalid('target', JobsParams.targetShape());
  }
  const create = readCreateTarget((target as { create: unknown }).create, true);
  if (create.media === undefined) throw invalid('target.create.media', JobsTranscribe.createMediaRequired());
  return { ...create, media: create.media };
}

/** `file` when only a file is given: an absolute path. A Space entry (`{ entryId }`) must first be replaced with a path by the method layer; if it is still unreplaced here, that is a caller error. */
function fileOf(value: unknown): string {
  if (typeof value === 'string') {
    if (!path.isAbsolute(value)) throw invalid('file', JobsParams.mustBeAbsolutePath());
    return value;
  }
  rejectUnresolvedEntry('file', value);
  throw invalid('file', JobsTranscribe.fileShape());
}

/** File only: checks the file, freezes the output directory and provider; no video. */
async function prepareFile(deps: TranscribeDeps, params: CheckedTranscribeParams, retry: boolean) {
  const file = params.file!;
  if (!deps.transcriber.submitFile) {
    throw new RpcError('conflict', JobsTranscribe.cannotTranscribeFile(), { code: 'CAPABILITY_NOT_CONFIGURED', capability: 'transcribe' });
  }
  if (!retry) await checkMedia(file);
  // Save location (§7.9): use it when given, otherwise the Runtime's save location; frozen at submission, created if it does not exist, rejected if not writable.
  const outDir = params.outDir ?? deps.saveDirectory?.() ?? path.dirname(file);
  await ensureSaveDirectory(outDir);
  const selection = await deps.transcriber.check({
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.model !== undefined ? { model: params.model } : {}),
  });
  const frozen: FrozenTranscribeParams = {
    ...params,
    outDir,
    provider: selection.providerId,
    model: selection.modelId,
    captions: false,
  };
  return {
    params: frozen,
    providerId: selection.providerId,
    modelId: selection.modelId,
    videoId: null,
    contentHash: `sha256:${sha256Hex(canonicalJson({ file }))}`,
  };
}

/** File-only transcription: submits a transcription without a video, waits for it to complete, and writes the TXT and SRT to the output directory under the source file name. */
async function transcribeFile(
  deps: TranscribeDeps,
  context: PipelineStepContext<FrozenTranscribeParams>,
): Promise<{ output: FileTranscribeOutput; result: NonNullable<JobRecord['result']> }> {
  const { params } = context;
  const stat = await fs.stat(params.file!).catch(() => null);
  if (!stat?.isFile()) throw new PipelineStepError('INPUT_NOT_FOUND', JobsTranscribe.mediaToTranscribeNotFound(), {});
  await ensureSaveDirectoryForStep(params.outDir!);
  const done = await downloadTranscript(deps.transcriber, context, {
    file: params.file!,
    directory: params.outDir!,
    provider: params.provider,
    model: params.model,
    ...(params.language !== undefined ? { language: params.language } : {}),
    ...(params.hint !== undefined ? { hint: params.hint } : {}),
    naming: 'source',
  });
  return {
    output: done,
    result: { documentId: null, artifactId: done.outputs[0]!.artifactId, outputs: done.outputs },
  };
}

/** The media file exists and is a regular file; `not-found` when it does not. */
async function checkMedia(media: string): Promise<void> {
  const stat = await fs.stat(media).catch(() => null);
  if (!stat?.isFile()) throw new RpcError('not-found', JobsTranscribe.mediaToImportNotFound(), { code: 'INPUT_NOT_FOUND' });
}

/** The video the transcription is written into: the new video when one was created (`target.create` or destination `new-video`), otherwise the given video. */
function targetVideo(params: FrozenTranscribeParams, outputs: StepOutputs): Id | null {
  return (outputs.create as CreateOutput | undefined)?.videoId ?? params.videoId ?? null;
}

/**
 * The destination for a given video (see the file header). When no asset is given and the single one on the main track cannot be identified, `first` is used, and the transcription step still reports the asset error. `replace` passes the
 * manual-edit gate here, and freezes the transcript's version and full-text fingerprint.
 */
async function resolveLanding(deps: TranscribeDeps, params: CheckedTranscribeParams, videoId: Id): Promise<TranscribeLanding> {
  const state = deps.videos.state(videoId)!;
  const sequence = deps.videos.rootSequence(videoId);
  let assetId = params.assetId;
  if (assetId === undefined) {
    const found = sequence ? mainTrackAssets(sequence) : [];
    if (found.length !== 1) return { kind: 'first' };
    assetId = found[0]!;
  }
  const transcripts = Object.values(state.documents).filter((doc) => doc.kind === 'speech' && doc.sourceAssetId === assetId);
  if (!transcripts.length) return { kind: 'first' };
  if ((params.destination ?? 'new-video') === 'new-video') {
    const source = deps.sources?.video(videoId);
    if (!deps.targets || !source) {
      throw new RpcError('invalid-request', JobsTranscribe.cannotCreateVideo(), { code: 'PIPELINE_TARGET_UNSUPPORTED' });
    }
    const name = params.name ?? JobsTranscribe.retranscribedName({ name: source.name }).text;
    return { kind: 'new-video', sourceVideoId: videoId, assetId, name, scope: source.scope };
  }
  const record = currentTranscript(transcripts, sequence, state.documents);
  const content = await deps.videos.document(videoId, record.id);
  let fingerprint: string;
  try {
    fingerprint = contentFingerprint(content.body);
  } catch (error) {
    if (error instanceof EditorWasmError) {
      throw new RpcError('conflict', withCause(JobsTranscribe.transcriptUnreadable(), error), {
        code: 'INPUT_UNREADABLE',
        documentId: record.id,
      });
    }
    throw error;
  }
  const asr = asrStage(content.body);
  if (asr !== null && asr !== fingerprint && params.acceptEdited !== true) {
    throw new RpcError('conflict', JobsTranscribe.transcriptEdited(), {
      code: 'TRANSCRIPT_EDITED',
      documentId: record.id,
      fingerprint,
      asr,
    });
  }
  return {
    kind: 'replace',
    assetId,
    replace: { documentId: record.id, revision: content.revision, fingerprint, translations: params.translations ?? 'carry' },
  };
}

/** Which of an asset's transcriptions to swap in: the one with a subtitle layer on the root sequence; when none has one (or all do), the most recently written. */
function currentTranscript(
  transcripts: DocumentRecord[],
  sequence: Sequence | null,
  documents: Record<Id, DocumentRecord>,
): DocumentRecord {
  const written = (doc: DocumentRecord) => doc.revisions[doc.currentRevision]?.createdAt ?? '';
  const ranked = [...transcripts].sort((a, b) => {
    const shown = (doc: DocumentRecord) => (sequence && existingCaptionLayer(sequence, documents, doc.id) ? 1 : 0);
    return shown(b) - shown(a) || (written(a) < written(b) ? 1 : written(a) > written(b) ? -1 : 0);
  });
  return ranked[0]!;
}

/** The effect of the transcript-swap transaction recorded in the transcript extension (committed in the same transaction as the new version); null when this transcription did not record it. */
function switchImpact(record: DocumentRecord | undefined, jobId: Id): TranscriptSwitchImpact | null {
  const value = record?.extensions?.[TRANSCRIPT_SWITCH_EXTENSION] as { jobId?: unknown; impact?: TranscriptSwitchImpact } | undefined;
  return value && value.jobId === jobId && value.impact ? value.impact : null;
}

/** Destination `new-video`: creates a video within the scope of the original video, imports the same asset file as a linked asset, and places it on the main track. */
async function createLinkedVideo(
  deps: TranscribeDeps,
  context: PipelineStepContext<FrozenTranscribeParams>,
): Promise<{ output: CreateOutput }> {
  const landing = context.params.landing;
  if (landing?.kind !== 'new-video' || !deps.targets || !deps.sources) {
    throw new PipelineStepError('PIPELINE_TARGET_UNSUPPORTED', JobsTranscribe.cannotCreateVideo(), {});
  }
  const file = await deps.sources.assetFile(landing.sourceVideoId, landing.assetId);
  const stat = file ? await fs.stat(file).catch(() => null) : null;
  if (!file || !stat?.isFile()) throw new PipelineStepError('INPUT_NOT_FOUND', JobsTranscribe.mediaToImportNotFound(), {});
  context.progress(null, 'applying');
  const lease = await createHeldVideo(deps.targets, context, { ...landing.scope, name: landing.name });
  const { assetId } = await importMedia(deps.videos, context, {
    videoId: lease.videoId,
    file,
    name: path.basename(file),
    place: true,
    label: JobsTranscribe.importMediaLabel().text,
    provenance: { origin: 'file-import', source: { path: file, jobId: context.parentJobId } },
  });
  return { output: { videoId: lease.videoId, place: lease.place, assetId } };
}

/** Creates a video and imports the media (placed on the main track in the same transaction). */
async function createVideo(deps: TranscribeDeps, context: PipelineStepContext<FrozenTranscribeParams>): Promise<{ output: CreateOutput }> {
  const create = context.params.create!;
  if (!deps.targets) throw new PipelineStepError('PIPELINE_TARGET_UNSUPPORTED', JobsTranscribe.cannotCreateVideo(), {});
  const stat = await fs.stat(create.media).catch(() => null);
  if (!stat?.isFile()) throw new PipelineStepError('INPUT_NOT_FOUND', JobsTranscribe.mediaToImportNotFound(), {});
  context.progress(null, 'applying');
  const base = path.basename(create.media, path.extname(create.media)).trim() || path.basename(create.media);
  const lease = await createHeldVideo(deps.targets, context, { ...createScopeOf(create), name: create.name ?? base });
  const { assetId } = await importMedia(deps.videos, context, {
    videoId: lease.videoId,
    file: create.media,
    name: path.basename(create.media),
    place: true,
    label: JobsTranscribe.importMediaLabel().text,
    provenance: { origin: 'file-import', source: { path: create.media, jobId: context.parentJobId } },
  });
  return { output: { videoId: lease.videoId, place: lease.place, assetId } };
}

async function transcribe(
  deps: TranscribeDeps,
  context: PipelineStepContext<FrozenTranscribeParams>,
): Promise<{ output: TranscribeOutput; result: { documentId: Id; artifactId: string } }> {
  const { params, outputs } = context;
  const videoId = targetVideo(params, outputs);
  if (!videoId) throw new PipelineStepError('INTERNAL', JobsTranscribe.noVideo(), {});
  const created = outputs.create as CreateOutput | undefined;
  // The asset that the transcription imports into the new video; for destination `new-video`, the given `assetId` is the one in the original video.
  const assetId = created?.assetId ?? params.assetId ?? mainAsset(deps.videos, videoId);
  const landing = params.landing;
  // Transcription glossaries enabled in the video (§5.9): read at submission time, as with `models.transcribe` (a newly created video has already adopted the library's default-enabled ones at this point);
  // the version is frozen by the transcription Job.
  const glossaries = params.videoGlossaries && deps.enabledGlossaries ? await deps.enabledGlossaries(videoId) : [];
  const { jobId, documentId, artifactId, transactionId } = await transcribeInVideo(
    deps.transcriber,
    context,
    {
      videoId,
      assetId,
      provider: params.provider,
      model: params.model,
      ...(params.language !== undefined ? { language: { mode: 'assert' as const, tag: params.language } } : {}),
      ...(params.hint !== undefined ? { hint: params.hint } : {}),
      ...(params.diarize !== undefined ? { diarize: params.diarize } : {}),
      ...(glossaries.length ? { glossaries: glossaries.map((id) => ({ id })) } : {}),
      ...(landing?.kind === 'replace' ? { replace: landing.replace } : {}),
    },
    // The document written by the last completed transcription was deleted: transcribe again.
    (job) => !!job.result?.documentId && deps.videos.state(videoId)?.documents[job.result.documentId]?.kind === 'speech',
  );
  if (!documentId || !artifactId) throw new PipelineStepError('APPLY_FAILED', JobsTranscribe.notApplied(), { jobId });
  return {
    output: { jobId, videoId, documentId, artifactId, assetId, transactionId },
    result: { documentId, artifactId },
  };
}

/** Number of speakers distinguished in the transcript written this time (`speakerCount` in the document version summary); null when it cannot be read. */
function speakerCountOf(record: DocumentRecord | undefined): number | null {
  const summary = record?.revisions[record.currentRevision]?.summary;
  const count = summary && typeof summary === 'object' ? (summary as { speakerCount?: unknown }).speakerCount : undefined;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
}

/** The single asset on the main track (see the file header); `VIDEO_NOT_OPEN` when the video is not open. */
function mainAsset(videos: CaptionVideos, videoId: Id): Id {
  const sequence = videos.rootSequence(videoId);
  if (!sequence) throw new PipelineStepError('VIDEO_NOT_OPEN', JobsTranscribe.videoClosed(), {});
  const found = mainTrackAssets(sequence);
  if (found.length === 1) return found[0]!;
  if (found.length === 0) {
    throw new PipelineStepError('TRANSCRIBE_ASSET_NOT_FOUND', JobsTranscribe.noMainAsset(), {});
  }
  throw new PipelineStepError('TRANSCRIBE_ASSET_AMBIGUOUS', JobsTranscribe.ambiguousMainAsset(), {
    assetIds: found,
  });
}

/**
 * Main track: the first video track (smallest `order`) that has audio/video instances, or when there is none, the first audio track that has them; returns the assets on it (deduplicated, in the order they appear on the timeline).
 */
export function mainTrackAssets(sequence: Sequence): Id[] {
  const media = (trackId: Id) =>
    sequence.items.filter(
      (item): item is Extract<SequenceItem, { type: 'video' | 'audio' }> =>
        item.trackId === trackId && (item.type === 'video' || item.type === 'audio'),
    );
  const tracks = [...sequence.tracks].sort((a, b) => a.order - b.order);
  const main =
    tracks.find((track) => track.kind === 'visual' && media(track.id).length > 0) ??
    tracks.find((track) => track.kind === 'audio' && media(track.id).length > 0);
  if (!main) return [];
  const start = (item: Extract<SequenceItem, { type: 'video' | 'audio' }>) =>
    item.type === 'audio' ? item.fromFrame : item.span.fromFrame;
  const items = media(main.id).sort((a, b) => start(a) - start(b));
  return [...new Set(items.map((item) => item.assetRef.id))];
}
