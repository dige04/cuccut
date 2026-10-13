import {
  RpcError,
  itemRangeSeconds,
  type CaptionItem,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type PipelineCaptionsSummary,
  type Sequence,
  type SequenceItem,
} from '@cuccut/protocol';
import { JobsParams } from '@cuccut/protocol/messages/jobs/params.ts';
import { invalid } from './params.ts';
import { JobsCaptionLayer as J } from '@cuccut/protocol/messages/jobs/caption-layer.ts';
import type { ArtifactStore } from '../artifact-store.ts';
import { jobWarning } from '../job-text.ts';
import {
  captionBody,
  deriveCues,
  readSpeechWords,
  translationCues,
  workerCaptionBody,
  type CueTranslationUnit,
  type CueWords,
} from './caption-cues.ts';
import { PipelineStepError, type PipelineStep, type PipelineStepContext, type StepOutputs } from './pipeline.ts';
import { PIPELINE_ACTOR_ID } from './pipeline-runner.ts';
import type { SpeechWorkerCues } from './speech-worker.ts';
import { readArtifact } from './translation-batches.ts';
import type { PipelineVideos } from './translate.ts';

/**
 * The “create caption layer” step of the fixed pipeline (architecture design §7.9, product design S01, S02): given a script (`speech`) or a translation (`translation`), creates an editable caption layer on the root sequence in one transaction (video format spec §3.8, §4.6):
 *
 * - Writes a `caption` document (`cuccut.caption/1`, on the media clock, derived from that script or translation, recording the versions of the media and the source; `extensions.pipeline` records this run) and places a caption instance. The acting instance is the instance on the timeline that uses this asset, and the range covers them; later, when the media is cut or moved, the captions follow it. The script's cues are split the same way as the editor's “generate captions” (`caption-cues.ts`). The translation's cues were split by the Speech Worker at translation time, aligning captions to the translation core (artifact `cuccut.speech-worker.cues/1`), and are written as-is. A translation the agent wrote itself has no Worker cues (`captions_create`, §3.5): it takes the timing of the original sentences via sentence-level alignment and splits cues by display width, the same as the editor's “put on screen” (`translationCues`).
 * - The “caption layer” is a caption instance on the root sequence that references this kind of caption document (§3.8: caption display is driven by instances); a document without an instance does not count.
 *   If the same script (translation) already has a caption layer, this step is recorded as `skipped`, and no second caption track is created (S01's acceptance criterion). Only the derivation (`sourceDocumentId`) is checked, so layers made in the editor and layers made by the pipeline are treated alike.
 * - If no instance on the timeline uses this asset, the layer is not created (captions could not appear on screen); the step still completes and warns `CAPTIONS_NOT_ON_TIMELINE`. If no cues can be split (no words, or the translation is entirely empty), it warns `CAPTIONS_EMPTY`.
 *
 * Display (§3.8, “enable or disable each separately”):
 * - Script: placed on the first empty, unlocked caption track; a new track is created if there is none. When this asset already has another original caption layer displayed on screen, the new layer is placed disabled (`enabled: false`, shown as the dashed “pulled off” chip in the editor) and the existing layer is left alone. Two layers of the same language stacked on top of each other is duplication, and choosing which one to use is a decision made in the editor (§7.9 “no overwrite”). Otherwise it is shown directly.
 * - Translation: same as the editor's “put on screen”. Creates a new track for this language. When only the translation is shown (the default), the paired original caption layer is taken off the screen (`enabled: false`, not deleted). When bilingual, the two layers share one caption style (the preview stacks them as two lines according to the style document, §5.6); if the original has no style, a new default style is created, and an original that was taken off is put back. If the paired original is locked, it is not touched; it only shares its style when it has one.
 * - Bilingual, when the timeline has no original caption layer for this transcript (`pairOriginal`, the agent's `captions_create`): in the same transaction, first create the transcript's original caption layer (placed and split the same way as for a “script”, using its own ref), then create the translation's layer. The two layers share the newly created style. One call makes it bilingual, and undo reverts both layers together. If the new translation layer has to be placed disabled (the same translation already has a layer showing), the original is not created along with it.
 */

type Json = Record<string, unknown>;

/** Writing captions reads the root sequence (tracks and instances). */
export interface CaptionVideos extends PipelineVideos {
  /** The root sequence's tracks and instances at this moment; null when no video is open. */
  rootSequence(videoId: Id): Sequence | null;
}

/** The editor's Studio caption style (`STUDIO_STYLE` in `packages/ui/src/render/text-style.ts`); the default style created for bilingual use is taken from it. */
const STUDIO_STYLE = 'cuccut.legacy-studio-style/0.1';
/**
 * Caption style created for bilingual use: the default preset (video format spec §5.6, “default preset”), field-for-field identical to the editor's `DEFAULT_CAPTION_STYLE` (`packages/ui/src/model/property-values.ts`: the “classic” livery, with its current-word color change plus `punct: true`) and to `video_model::caption_style::default_studio_style`, which the render kernel uses when there is no style document. jobs cannot depend on the UI, so each keeps its own copy here; change all three together.
 */
export const DEFAULT_CAPTION_STYLE_BODY: Json = {
  schema: STUDIO_STYLE,
  style: {
    fontStyle: 'normal',
    underline: false,
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
    background: false,
    backgroundColor: '#000000B3',
    backgroundStyle: 'wrap',
    backgroundPadding: 10,
    borderRadius: 15,
    fontFamily: 'system',
    fontWeight: 700,
    bold: true,
    italic: false,
    fontColor: '#FFFFFF',
    textOutline: { on: true, color: '#000000', width: 14 },
    dropShadow: { on: true, blur: 0.12, distance: 0.08, rotation: 45, color: '#000000', opacity: 0.9 },
    outline: true,
    glow: { on: false },
    wordAnimation: { animationId: 'magic-wbw', animationName: 'Color', catalogId: 'colourHighlight', spoken: {}, active: { color: '#18E1D6' }, unspoken: {} },
    punct: true,
  },
};
/** Optional new caption style document; an unknown schema does not reach the renderer, and an existing style is never overwritten by it. */
export function readCaptionStyle(value: unknown): Json | undefined {
  if (value === undefined) return undefined;
  const object = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!object(value) || value.schema !== STUDIO_STYLE || !object(value.style)) {
    throw invalid('captionStyle', JobsParams.mustBeOneOf({ values: '{ schema: "cuccut.legacy-studio-style/0.1", style: {…} }' }));
  }
  return value;
}

function withCaptionStyle(operations: EditOperation[], body: Json): EditOperation[] {
  const freshStyle = operations.find((op) => op.type === 'putDocument' && op.kind === 'caption-style' && !op.documentId);
  if (freshStyle) return operations.map((op) => (op === freshStyle ? { ...op, body } : op));
  const needsStyle = operations.some(
    (op) => op.type === 'insertItems' && op.items.some((item) => item.type === 'caption' && !item.styleDocumentId && !item.styleDocumentRef),
  );
  if (!needsStyle) return operations;
  const ref = 'caption-preferences-style';
  return [
    { type: 'putDocument', ref, kind: 'caption-style', name: J.styleName().text, body },
    ...operations.map((op): EditOperation => {
      if (op.type !== 'insertItems') return op;
      return {
        ...op,
        items: op.items.map((item) =>
          item.type === 'caption' && !item.styleDocumentId && !item.styleDocumentRef
            ? { ...item, styleDocumentId: undefined, styleDocumentRef: ref }
            : item,
        ),
      };
    }),
  ];
}

/** Source record for script captions (same as `SPEECH_CAPTION_EXTENSION` in the editor's speech-cues.ts). */
export const SPEECH_CAPTION_EXTENSION = 'cuccut.speechCues';
/** Source record for translation captions (same as `TRANSLATION_CAPTION_EXTENSION` in the editor's translation-cues.ts). */
export const TRANSLATION_CAPTION_EXTENSION = 'cuccut.translationCues';

/**
 * Whether the caption document was generated from this translation (same as `derivedFrom` in the editor's `translation-cues.ts`). Only this kind has its cues regenerated when the translation changes; cues split some other way are left alone.
 */
export function derivedFrom(record: DocumentRecord, translationDocumentId: Id): boolean {
  const ext = record.extensions?.[TRANSLATION_CAPTION_EXTENSION] as { translationDocumentId?: unknown } | undefined;
  return record.kind === 'caption' && record.sourceDocumentId === translationDocumentId && ext?.translationDocumentId === translationDocumentId;
}
const APPLY_ATTEMPTS = 3;

/** Output of this step: the caption document created and the display state. When nothing was created, `documentId` is null and `reason` says why. */
export interface CaptionLayerOutput {
  documentId: Id | null;
  cueCount: number;
  /** Whether the new layer is displayed on screen. */
  enabled: boolean;
  bilingual?: boolean;
  /** The transaction that created the caption layer (the editor's “undo” reverts it). None if nothing was created, or the Runtime did not provide one. */
  transactionId?: Id;
  /** Not created: already exists (created elsewhere during execution), the asset is not on the timeline, or there are no displayable cues. */
  reason?: 'existing' | 'not-on-timeline' | 'empty';
}

/**
 * Where the caption layer comes from: a script; a translation together with the cues the Speech Worker split at translation time (artifact); or a translation without Worker cues (written by the agent). For the last kind, each cue takes its timing from the original sentence via the unit's sentence-level alignment (`alignment.sourceWordIds`) and is split by display width (`translationCues`).
 */
export type CaptionSource =
  | { kind: 'speech'; documentId: Id }
  | { kind: 'translation'; documentId: Id; bilingual: boolean; cuesArtifactId: string }
  | { kind: 'translation'; documentId: Id; bilingual: boolean; cues: 'sentence-alignment' };

/** Reads the body of the document the caption layer is computed from (read-only). */
export type CaptionDocumentReader = Pick<PipelineVideos, 'document'>;

/** The transaction that creates the caption layer (not yet committed). */
export interface CaptionLayerPlan {
  operations: EditOperation[];
  cueCount: number;
  /** Whether the new layer is displayed on screen. */
  enabled: boolean;
  /** Existing caption layer for the same document. The new layer is still created (§7.9 “no overwrite”). null if none. */
  existing: { documentId: Id; itemIds: Id[] } | null;
  /** Translation only: the existing original caption layer paired with it (shares style and is put back on screen when bilingual); null if none. Scripts have no such field. */
  paired?: { documentId: Id; itemIds: Id[] } | null;
  /**
   * For a bilingual translation when the timeline has no original caption layer (`pairOriginal`): the original caption layer created along with it in the same transaction. `documentRef` is the ref of its caption document in the transaction (the receipt's `refs` gives the document ID by this ref). Absent when none was created along with it.
   */
  original?: { documentRef: string; cueCount: number };
}

/** `ref` of the new caption document in the transaction: the receipt's `refs` gives the document ID by this ref. */
export const CAPTION_DOCUMENT_REF = 'caption';
/** For a bilingual translation, the original caption layer created along with it: its caption document's `ref` in the transaction. */
export const ORIGINAL_CAPTION_DOCUMENT_REF = 'original-caption';

/** The caption layer on the root sequence derived from this document (the `sourceDocumentId` of the `caption` document that the caption instance references is this document); null if none. */
export function existingCaptionLayer(
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  sourceDocumentId: Id,
): { documentId: Id; itemIds: Id[] } | null {
  const items = sequence.items.filter(
    (item): item is CaptionItem =>
      item.type === 'caption' &&
      documents[item.documentId]?.kind === 'caption' &&
      documents[item.documentId]?.sourceDocumentId === sourceDocumentId,
  );
  if (!items.length) return null;
  const documentId = items[0]!.documentId;
  return { documentId, itemIds: items.filter((item) => item.documentId === documentId).map((item) => item.id) };
}

/**
 * The “create caption layer” step. `source` reads from the arguments and earlier outputs the document to caption (none: not created); `videoId` likewise.
 * If it is turned off (`enabled` returns false) or a caption layer already exists, it is recorded as `skipped`.
 */
export function captionsStep<P>(
  videos: CaptionVideos,
  options: {
    pipeline: string;
    enabled(params: P): boolean;
    videoId(params: P, outputs: StepOutputs): Id | null;
    source(params: P, outputs: StepOutputs): CaptionSource | null;
    captionStyle?(params: P): Json | undefined;
  },
): PipelineStep<P> {
  return {
    name: 'captions',
    label: () => J.label(),
    when: (params, outputs) => {
      if (!options.enabled(params)) return false;
      const videoId = options.videoId(params, outputs);
      const source = options.source(params, outputs);
      if (!videoId || !source) return true;
      const state = videos.state(videoId);
      const sequence = videos.rootSequence(videoId);
      // Runs as usual when no video is open; this step reports it.
      if (!state || !sequence) return true;
      return existingCaptionLayer(sequence, state.documents, source.documentId) === null;
    },
    run: async (context) => {
      const videoId = options.videoId(context.params, context.outputs);
      const source = options.source(context.params, context.outputs);
      if (!videoId || !source) throw new PipelineStepError('INTERNAL', J.noSource(), {});
      const output = await buildCaptionLayer(videos, context, { pipeline: options.pipeline, videoId, source, captionStyle: options.captionStyle?.(context.params) });
      return { output: { ...output } };
    },
  };
}

/** The `captions` entry in the parent task's summary: this step's output, or the reason it was skipped (turned off, or a caption layer already exists). */
export function captionsSummary(
  videos: CaptionVideos,
  enabled: boolean,
  output: CaptionLayerOutput | null,
  videoId: Id,
  sourceDocumentId: Id,
): PipelineCaptionsSummary {
  if (!enabled) return { status: 'disabled', documentId: null, cueCount: null, enabled: null };
  if (output) {
    if (output.reason) return { status: output.reason, documentId: output.documentId, cueCount: null, enabled: null };
    return {
      status: 'created',
      documentId: output.documentId,
      cueCount: output.cueCount,
      enabled: output.enabled,
      ...(output.bilingual !== undefined ? { bilingual: output.bilingual } : {}),
      ...(output.transactionId !== undefined ? { transactionId: output.transactionId } : {}),
    };
  }
  const state = videos.state(videoId);
  const sequence = videos.rootSequence(videoId);
  const existing = state && sequence ? existingCaptionLayer(sequence, state.documents, sourceDocumentId) : null;
  return { status: 'existing', documentId: existing?.documentId ?? null, cueCount: null, enabled: null };
}

async function buildCaptionLayer<P>(
  videos: CaptionVideos,
  context: PipelineStepContext<P>,
  request: { pipeline: string; videoId: Id; source: CaptionSource; captionStyle?: Json },
): Promise<CaptionLayerOutput> {
  const { jobId, parentJobId, run, progress, warn } = context;
  const { videoId, source } = request;
  progress(null, 'applying');
  const provenance = { name: request.pipeline, jobId: parentJobId, actor: PIPELINE_ACTOR_ID };
  for (let attempt = 1; ; attempt++) {
    const state = videos.state(videoId);
    const sequence = videos.rootSequence(videoId);
    if (!state || !sequence) throw new PipelineStepError('VIDEO_NOT_OPEN', J.videoClosed(), {});
    // Created elsewhere (in the editor) in the meantime: do not create a second layer.
    const existing = existingCaptionLayer(sequence, state.documents, source.documentId);
    if (existing) return { documentId: existing.documentId, cueCount: 0, enabled: false, reason: 'existing' };
    const plan = await planCaptionLayer(videos, {
      videoId,
      sequence,
      documents: state.documents,
      source,
      artifacts: context.artifacts,
      pipeline: provenance,
      captionStyle: request.captionStyle,
    });
    if ('reason' in plan) {
      warn(
        plan.reason === 'empty'
          ? jobWarning('CAPTIONS_EMPTY', J.empty())
          : jobWarning('CAPTIONS_NOT_ON_TIMELINE', J.notOnTimeline()),
      );
      return { documentId: null, cueCount: 0, enabled: false, reason: plan.reason };
    }
    try {
      const receipt = await videos.apply(videoId, {
        commandId: `cmd_${jobId}_captions_${attempt}`,
        expectedRevision: state.revision,
        operations: plan.operations,
        label: J.label().text,
        run,
      });
      const documentId = receipt.refs?.[DOCUMENT_REF];
      if (!documentId) throw new PipelineStepError('APPLY_FAILED', J.noDocumentId());
      return {
        documentId,
        cueCount: plan.cueCount,
        enabled: plan.enabled,
        ...(source.kind === 'translation' ? { bilingual: source.bilingual } : {}),
        ...(receipt.transactionId !== undefined ? { transactionId: receipt.transactionId } : {}),
      };
    } catch (error) {
      // The video was changed between read and write: re-read, recompute, and submit again with a new command.
      if (error instanceof RpcError && error.code === 'conflict' && attempt < APPLY_ATTEMPTS) continue;
      if (error instanceof PipelineStepError) throw error;
      throw new PipelineStepError('APPLY_FAILED', J.rejected(), {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

type Plan = CaptionLayerPlan | { reason: 'not-on-timeline' | 'empty' };

const DOCUMENT_REF = CAPTION_DOCUMENT_REF;
const TRACK_REF = 'caption-track';
const ORIGINAL_TRACK_REF = 'original-caption-track';
const STYLE_REF = 'caption-style';

/**
 * Computes, without committing, the transaction that creates a caption layer for a script or translation. Shared by the fixed pipeline's `captions` step and the agent's `captions_create` (§3.5).
 * `pipeline` is the pipeline's run record (written into the caption document's `extensions.pipeline`); agent calls have none.
 *
 * If the same document already has a caption layer, a new layer is still computed (§7.9 “no overwrite”). `existing` points to the existing layer. Whether to create it is up to the caller (the pipeline skips). A new original caption layer is placed disabled if the same asset already has original captions displayed. A new translation layer is likewise placed disabled if a layer for the same translation is already displayed, and it does not touch the paired original (two layers of the same language are not stacked). For `pairOriginal`, a bilingual translation with no paired original caption layer first gets a layer for the transcript (`original`) in the same transaction. If the document is missing, of the wrong kind, or its body cannot be read, it throws `PipelineStepError`.
 */
async function planCaptionLayerBase(
  videos: CaptionDocumentReader,
  request: {
    videoId: Id;
    sequence: Sequence;
    documents: Record<Id, DocumentRecord>;
    source: CaptionSource;
    /** Artifact store for Worker cues: needed for translations with `cuesArtifactId`. */
    artifacts?: ArtifactStore;
    pipeline?: Json;
    /** For a bilingual translation with no paired original caption layer, also create one (the agent's `captions_create`); by default only the translation's layer is created. */
    pairOriginal?: boolean;
    captionStyle?: Json;
  },
): Promise<Plan> {
  const { videoId, sequence, documents, source, pipeline } = request;
  const record = documents[source.documentId];
  if (!record) throw new PipelineStepError('STALE_JOB_INPUT', J.documentGone(), { documentId: source.documentId });
  const existing = existingCaptionLayer(sequence, documents, source.documentId);
  if (source.kind === 'speech') return speechPlan(videos, videoId, record, sequence, documents, pipeline, existing);
  const options: TranslationOptions = { bilingual: source.bilingual, pairOriginal: request.pairOriginal === true, pipeline, existing };
  if ('cuesArtifactId' in source) {
    if (!request.artifacts) throw new PipelineStepError('INTERNAL', J.needsOutputStore(), {});
    return translationPlan(videos, request.artifacts, videoId, record, sequence, documents, source, options);
  }
  return sentenceTranslationPlan(videos, videoId, record, sequence, documents, options);
}

/** Client preferences passed in are applied only when creating new; captions and style are one transaction, reverted together on undo. */
export async function planCaptionLayer(videos: CaptionDocumentReader, request: Parameters<typeof planCaptionLayerBase>[1]): Promise<Plan> {
  const plan = await planCaptionLayerBase(videos, request);
  return 'reason' in plan || !request.captionStyle ? plan : { ...plan, operations: withCaptionStyle(plan.operations, request.captionStyle) };
}

async function speechPlan(
  videos: CaptionDocumentReader,
  videoId: Id,
  record: DocumentRecord,
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  pipeline: Json | undefined,
  existing: CaptionLayerPlan['existing'],
): Promise<Plan> {
  if (record.kind !== 'speech') throw new PipelineStepError('INPUT_UNREADABLE', J.notSpeech(), { documentId: record.id });
  // First check whether it can be shown on screen (not the asset's transcript, or the asset is not on the timeline), then read the body.
  const assetId = record.sourceAssetId;
  const placement = assetId ? captionPlacement(sequence, assetId) : null;
  if (!assetId || !placement) return { reason: 'not-on-timeline' };
  const { span, scopeItemIds } = placement;
  const content = await videos.document(videoId, record.id, record.currentRevision);
  const speech = readSpeechWords(content.body);
  if (!speech) throw new PipelineStepError('INPUT_UNREADABLE', J.speechUnreadable(), { documentId: record.id });
  const made = speechOperations({ record, revision: content.revision, speech, assetId, placement }, sequence, documents, pipeline, {
    documentRef: DOCUMENT_REF,
    trackRef: TRACK_REF,
  });
  if (!made) return { reason: 'empty' };
  return { operations: made.operations, cueCount: made.cueCount, enabled: made.enabled, existing };
}

/**
 * Operation that creates an original caption layer for a transcript: split cues, pick an empty caption track (create one if none, `refs.trackRef`), write the caption document (`refs.documentRef`), and place the instance. null if no cues can be split. `styleDocumentRef` is the caption style created earlier in the same transaction (shared with the translation when bilingual); it is attached directly when the instance is placed.
 */
function speechOperations(
  source: { record: DocumentRecord; revision: string; speech: CueWords; assetId: Id; placement: CaptionPlacement },
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  pipeline: Json | undefined,
  refs: { documentRef: string; trackRef: string },
  styleDocumentRef?: string,
): { operations: EditOperation[]; cueCount: number; enabled: boolean } | null {
  const { record, revision, speech, assetId } = source;
  const { span, scopeItemIds } = source.placement;
  const cues = deriveCues(speech.words);
  if (!cues.length) return null;
  const body = captionBody(cues, speech.speakers);
  // This asset already has original captions showing: the new layer is placed disabled, so two layers of the same language are not stacked.
  const shown = sequence.items.some(
    (item) =>
      item.type === 'caption' &&
      item.enabled &&
      documents[item.documentId]?.kind === 'caption' &&
      documents[item.documentId]?.sourceAssetId === assetId &&
      captionKind(item.documentId, documents) === 'original',
  );
  const free = sequence.tracks
    .filter((track) => track.kind === 'subtitle' && !track.locked)
    .sort((a, b) => a.order - b.order)
    .find((track) => trackFree(sequence, track.id, span.fromFrame, span.fromFrame + span.durationFrames));
  const operations: EditOperation[] = [];
  if (!free) operations.push({ type: 'addTrack', sequenceId: sequence.id, kind: 'subtitle', ref: refs.trackRef, name: J.subtitlesName().text });
  operations.push({
    type: 'putDocument',
    ref: refs.documentRef,
    kind: 'caption',
    name: J.subtitlesName().text,
    ...(record.language ? { language: record.language } : {}),
    sourceAsset: { assetId },
    sourceDocument: { documentId: record.id },
    body,
    summary: { cueCount: cues.length },
    extensions: {
      [SPEECH_CAPTION_EXTENSION]: { speechDocumentId: record.id, speechRevision: revision, assetId },
      ...(pipeline ? { pipeline } : {}),
    },
  });
  operations.push({
    type: 'insertItems',
    sequenceId: sequence.id,
    items: [
      {
        type: 'caption',
        name: J.subtitlesName().text,
        span,
        documentRef: refs.documentRef,
        ...(scopeItemIds.length ? { scopeItemIds } : {}),
        ...(free ? { trackId: free.id } : { trackRef: refs.trackRef }),
        ...(styleDocumentRef ? { styleDocumentRef } : {}),
        ...(shown ? { enabled: false } : {}),
      },
    ],
  });
  return { operations, cueCount: cues.length, enabled: !shown };
}

/** How the translation's caption layer is created: bilingual or not, whether to also create the original layer when none exists, the pipeline's run record, and the existing layer for the same translation. */
interface TranslationOptions {
  bilingual: boolean;
  pairOriginal: boolean;
  pipeline: Json | undefined;
  existing: CaptionLayerPlan['existing'];
}

async function translationPlan(
  videos: CaptionDocumentReader,
  artifacts: ArtifactStore,
  videoId: Id,
  record: DocumentRecord,
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  source: Extract<CaptionSource, { cuesArtifactId: string }>,
  options: TranslationOptions,
): Promise<Plan> {
  const read = await readTranslationSource(videos, videoId, record, sequence, documents);
  if ('reason' in read) return read;
  // The cues were split at translation time (integer ticks on the transcript clock); speaker display names are taken from the transcript.
  const workerCues = await readArtifact<SpeechWorkerCues>(artifacts, source.cuesArtifactId);
  const body = workerCaptionBody(workerCues, sentenceSpeakers(read.speech.words), read.speech.speakers);
  return translationOperations(read, body, sequence, documents, options);
}

/**
 * A translation without Worker cues (written by the agent): each unit takes the timing of its member words in the original sentence via sentence-level alignment (`alignment.sourceWordIds`), and is split by display width (`translationCues`, same as the editor's “put on screen”). The model alignment of the Worker is not used. A unit with no alignment (`alignment` is null) cannot be timed: if any such unit exists, it is rejected with `TRANSLATION_UNALIGNED`, rather than silently dropping a few sentences. (Rewrite the translation; the Runtime will add the sentence alignment.)
 */
async function sentenceTranslationPlan(
  videos: CaptionDocumentReader,
  videoId: Id,
  record: DocumentRecord,
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  options: TranslationOptions,
): Promise<Plan> {
  const read = await readTranslationSource(videos, videoId, record, sequence, documents);
  if ('reason' in read) return read;
  const units = translationUnits(read.translation?.units);
  if (!units) throw new PipelineStepError('INPUT_UNREADABLE', J.translationUnreadable(), { documentId: record.id });
  const unaligned = units.filter((unit) => unit.status !== 'stale' && unit.alignment === null).map((unit) => unit.id);
  if (unaligned.length) {
    throw new PipelineStepError(
      'TRANSLATION_UNALIGNED',
      J.unaligned({ count: unaligned.length }),
      {
        documentId: record.id,
        unitIds: unaligned.slice(0, 20),
      },
    );
  }
  const cues = translationCues(read.speech, units);
  if (!cues.length) return { reason: 'empty' };
  return translationOperations(read, captionBody(cues, read.speech.speakers), sequence, documents, options);
}

/** Units in the translation body (only the fields needed for captions); null if it is not an array. */
function translationUnits(value: unknown): CueTranslationUnit[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((raw): CueTranslationUnit[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const unit = raw as Record<string, unknown>;
    if (typeof unit.id !== 'string') return [];
    const rewrite = unit.displayRewrite as { text?: unknown } | undefined;
    const alignment = unit.alignment as { sourceWordIds?: unknown } | null | undefined;
    const ids = alignment && Array.isArray(alignment.sourceWordIds) ? alignment.sourceWordIds.filter((id) => typeof id === 'string') : null;
    return [
      {
        id: unit.id,
        naturalText: typeof unit.naturalText === 'string' ? unit.naturalText : '',
        ...(rewrite && typeof rewrite.text === 'string' ? { displayRewrite: { text: rewrite.text } } : {}),
        alignment: ids ? { sourceWordIds: ids } : null,
        status: typeof unit.status === 'string' ? unit.status : 'draft',
      },
    ];
  });
}

/** Where the caption instance is placed: the range covering the instances on the timeline that use this asset, and the acting instance. */
export interface CaptionPlacement {
  span: { fromFrame: number; durationFrames: number };
  scopeItemIds: Id[];
}

interface TranslationSource {
  record: DocumentRecord;
  content: { revision: string; body: unknown };
  translation: { language?: unknown; sourceBasis?: { speechRef?: { id?: unknown; revision?: unknown } }; units?: unknown } | null;
  speechRecord: DocumentRecord;
  /** The transcript version this translation was translated from (the translation's recorded `sourceBasis`; the version read if none is recorded). */
  speechRevision: string;
  /** The transcript's current version (used when reading the body); recorded on the original caption layer created along with it. */
  speechCurrentRevision: string;
  speech: CueWords;
  assetId: Id;
  placement: CaptionPlacement;
}

/** Reads the translation and the transcript it was translated from, and checks whether it can be shown on screen (not shown if the transcript is not the asset's, or the asset is not on the timeline). */
async function readTranslationSource(
  videos: CaptionDocumentReader,
  videoId: Id,
  record: DocumentRecord,
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
): Promise<TranslationSource | { reason: 'not-on-timeline' }> {
  const content = await videos.document(videoId, record.id, record.currentRevision);
  const translation = content.body as TranslationSource['translation'];
  const speechRef = translation?.sourceBasis?.speechRef?.id;
  const speechDocumentId = record.sourceDocumentId ?? (typeof speechRef === 'string' ? speechRef : null);
  const speechRecord = speechDocumentId ? documents[speechDocumentId] : undefined;
  if (record.kind !== 'translation' || !speechRecord) {
    throw new PipelineStepError('INPUT_UNREADABLE', J.noSourceSpeech(), { documentId: record.id });
  }
  // First check whether it can be shown on screen (transcript not the asset's, or asset not on the timeline), then read the body.
  const assetId = speechRecord.sourceAssetId;
  const placement = assetId ? captionPlacement(sequence, assetId) : null;
  if (!assetId || !placement) return { reason: 'not-on-timeline' };
  const speechContent = await videos.document(videoId, speechRecord.id, speechRecord.currentRevision);
  const speech = readSpeechWords(speechContent.body);
  if (!speech) throw new PipelineStepError('INPUT_UNREADABLE', J.speechUnreadable(), { documentId: speechRecord.id });
  const speechRevision =
    typeof translation?.sourceBasis?.speechRef?.revision === 'string' ? translation.sourceBasis.speechRef.revision : speechContent.revision;
  return {
    record,
    content,
    translation,
    speechRecord,
    speechRevision,
    speechCurrentRevision: speechContent.revision,
    speech,
    assetId,
    placement,
  };
}

/**
 * Transaction for the translation's caption layer (same as the editor's `translationCaptionOperations`): creates a new caption track for this language, writes the caption document, and places the caption instance. When only the translation is shown, the paired original is taken off (not deleted). When bilingual, the two layers share one caption style, and the original is put back on screen. If the same translation already has a layer showing, the new layer is placed disabled and the paired original is left alone. When bilingual with no paired original (`pairOriginal`), the original's layer comes first: the new style is written first, the original's instance is placed with it directly, and the translation's instance uses it too.
 */
function translationOperations(
  read: TranslationSource,
  body: Json,
  sequence: Sequence,
  documents: Record<Id, DocumentRecord>,
  options: TranslationOptions,
): Plan {
  const { bilingual, pipeline, existing } = options;
  const { record, content, translation, speechRecord, speechRevision, assetId, placement } = read;
  const cueCount = (body.cues as unknown[]).length;
  if (!cueCount) return { reason: 'empty' };
  const language = (typeof translation?.language === 'string' && translation.language) || record.language || '';
  const name = language ? languageName(language) : J.translationName().text;
  const paired = pairedOriginal(sequence, documents, speechRecord.id);
  const duplicateShown = existing !== null && existingShown(sequence, existing.itemIds);
  // Bilingual, but the timeline has no original caption layer: create one for the transcript first, sharing the newly created style with the translation.
  const original =
    bilingual && options.pairOriginal && !paired && !duplicateShown
      ? speechOperations(
          { record: speechRecord, revision: read.speechCurrentRevision, speech: read.speech, assetId, placement },
          sequence,
          documents,
          pipeline,
          { documentRef: ORIGINAL_CAPTION_DOCUMENT_REF, trackRef: ORIGINAL_TRACK_REF },
          STYLE_REF,
        )
      : null;
  const operations: EditOperation[] = [];
  if (original) {
    const [first, ...rest] = original.operations;
    // The style must be written before the original's instance; the original's track (created if needed) still goes first.
    if (first!.type === 'addTrack') operations.push(first!);
    operations.push({
      type: 'putDocument',
      ref: STYLE_REF,
      kind: 'caption-style',
      name: J.styleName().text,
      body: DEFAULT_CAPTION_STYLE_BODY,
    });
    operations.push(...(first!.type === 'addTrack' ? rest : original.operations));
  }
  operations.push(
    { type: 'addTrack', sequenceId: sequence.id, kind: 'subtitle', ref: TRACK_REF, name },
    {
      type: 'putDocument',
      ref: DOCUMENT_REF,
      kind: 'caption',
      name,
      ...(language ? { language } : {}),
      sourceAsset: { assetId },
      sourceDocument: { documentId: record.id },
      body,
      summary: { cueCount },
      extensions: {
        [TRANSLATION_CAPTION_EXTENSION]: {
          translationDocumentId: record.id,
          translationRevision: content.revision,
          speechDocumentId: speechRecord.id,
          speechRevision,
          assetId,
        },
        ...(pipeline ? { pipeline } : {}),
      },
    },
  );
  const touch = paired && !paired.locked && !duplicateShown ? paired : null;
  let style: { styleDocumentId: Id } | { styleDocumentRef: string } | null = paired?.styleDocumentId
    ? { styleDocumentId: paired.styleDocumentId }
    : original
      ? { styleDocumentRef: STYLE_REF }
      : null;
  if (bilingual && touch) {
    if (!style) {
      operations.push({
        type: 'putDocument',
        ref: STYLE_REF,
        kind: 'caption-style',
        name: J.styleName().text,
        body: DEFAULT_CAPTION_STYLE_BODY,
      });
      for (const itemId of touch.itemIds) {
        operations.push({ type: 'setCaptionStyle', sequenceId: sequence.id, itemId, styleDocument: { ref: STYLE_REF } });
      }
      style = { styleDocumentRef: STYLE_REF };
    }
    if (touch.shelved) {
      for (const itemId of touch.itemIds) operations.push({ type: 'updateItem', sequenceId: sequence.id, itemId, enabled: true });
    }
  } else if (!bilingual && touch && !touch.shelved) {
    for (const itemId of touch.itemIds) operations.push({ type: 'updateItem', sequenceId: sequence.id, itemId, enabled: false });
  }
  operations.push({
    type: 'insertItems',
    sequenceId: sequence.id,
    items: [
      {
        type: 'caption',
        name,
        span: placement.span,
        documentRef: DOCUMENT_REF,
        trackRef: TRACK_REF,
        ...(placement.scopeItemIds.length ? { scopeItemIds: placement.scopeItemIds } : {}),
        ...(style ?? {}),
        ...(duplicateShown ? { enabled: false } : {}),
      },
    ],
  });
  return {
    operations,
    cueCount,
    enabled: !duplicateShown,
    existing,
    paired: paired ? { documentId: paired.documentId, itemIds: paired.itemIds } : null,
    ...(original ? { original: { documentRef: ORIGINAL_CAPTION_DOCUMENT_REF, cueCount: original.cueCount } } : {}),
  };
}

/** The existing layer has an instance displayed on screen. */
function existingShown(sequence: Sequence, itemIds: readonly Id[]): boolean {
  return sequence.items.some((item) => itemIds.includes(item.id) && item.enabled);
}

/** Sentence ID (`s-<first word ID>`) → speaker of the first word. Worker cues are per sentence, and the speaker follows that sentence. */
export function sentenceSpeakers(words: ReadonlyArray<{ id: string; speaker?: string }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const word of words) if (word.speaker !== undefined) out.set(`s-${word.id.replace(/~\d+$/, '')}`, word.speaker);
  return out;
}

// ---- Sequence ----

/** Whether a caption layer is original or translation: determined by which kind of document the caption document is derived from (same as `captionKind` in the editor's caption-tracks.ts). */
function captionKind(documentId: Id, documents: Record<Id, DocumentRecord>): 'original' | 'translation' {
  const record = documents[documentId];
  const parent = record?.sourceDocumentId ? documents[record.sourceDocumentId] : undefined;
  return parent?.kind === 'translation' ? 'translation' : 'original';
}

interface CaptionGroup {
  documentId: Id;
  itemIds: Id[];
  /** All instances are disabled (the ones “pulled off” in the editor). */
  shelved: boolean;
  locked: boolean;
  styleDocumentId?: Id;
}

/**
 * The original caption layer paired with the translation (`pairedOriginal` in the editor's translation-cues.ts): the layer generated from the same transcript; if there is none, the first original layer on screen. A layer is one caption document on one caption track (an instance split into several segments still counts as one layer).
 */
function pairedOriginal(sequence: Sequence, documents: Record<Id, DocumentRecord>, speechDocumentId: Id): CaptionGroup | null {
  const tracks = new Map(sequence.tracks.map((track) => [track.id, track]));
  const items = sequence.items
    .filter((item): item is CaptionItem => item.type === 'caption' && !!documents[item.documentId])
    .sort((a, b) => (tracks.get(a.trackId)?.order ?? 0) - (tracks.get(b.trackId)?.order ?? 0) || a.span.fromFrame - b.span.fromFrame);
  const groups = new Map<string, CaptionItem[]>();
  for (const item of items) {
    const key = `${item.trackId}:${item.documentId}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const originals = [...groups.values()]
    .filter((members) => captionKind(members[0]!.documentId, documents) === 'original')
    .map((members): CaptionGroup => {
      const style = members.find((item) => item.styleDocumentId)?.styleDocumentId;
      return {
        documentId: members[0]!.documentId,
        itemIds: members.map((item) => item.id),
        shelved: members.every((item) => !item.enabled),
        locked: !!tracks.get(members[0]!.trackId)?.locked || members.some((item) => item.locked),
        ...(style ? { styleDocumentId: style } : {}),
      };
    });
  return (
    originals.find((group) => documents[group.documentId]?.sourceDocumentId === speechDocumentId) ??
    originals.find((group) => !group.shelved) ??
    null
  );
}

/** Assets the instances use: video and audio assets, and the pre-rendered stand-in of a composition (if none, the code package). */
function sourceAsset(item: SequenceItem): Id | undefined {
  if (item.type === 'video' || item.type === 'audio') return item.assetRef.id;
  if (item.type === 'composition') return (item.prerender ?? (item.source.kind === 'bundle' ? item.source.assetRef : undefined))?.id;
  return undefined;
}

function linear(item: SequenceItem): boolean {
  if (item.type !== 'video' && item.type !== 'audio' && item.type !== 'composition') return false;
  if (item.timeMap.kind !== 'linear') return false;
  return item.timeMap.rate.num / item.timeMap.rate.den > 0;
}

/**
 * Where the caption instance is placed on the media clock (`captionPlacement` in the editor's speech-cues.ts). The acting instance is the instance on the timeline that uses this asset (sorted by start), and the range covers them. null if there is no such instance on the timeline.
 */
export function captionPlacement(sequence: Sequence, assetId: Id): CaptionPlacement | null {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const scope = sequence.items
    .filter((item) => sourceAsset(item) === assetId && linear(item))
    .map((item) => {
      const range = itemRangeSeconds(item, sequence.fps);
      return { item, frames: { start: Math.floor(range.start * perSecond + 1e-6), end: Math.ceil(range.end * perSecond - 1e-6) } };
    })
    .sort((a, b) => a.frames.start - b.frames.start || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  if (!scope.length) return null;
  const fromFrame = Math.min(...scope.map((s) => s.frames.start));
  return {
    span: { fromFrame, durationFrames: Math.max(1, Math.max(...scope.map((s) => s.frames.end)) - fromFrame) },
    scopeItemIds: scope.map((s) => s.item.id),
  };
}

/** The track is empty over the frame range [start, end) (`trackFree` in the editor's editor-ops.ts). */
function trackFree(sequence: Sequence, trackId: Id, start: number, end: number): boolean {
  const perSecond = sequence.fps.num / sequence.fps.den;
  return sequence.items.every((item) => {
    if (item.trackId !== trackId) return true;
    const range = itemRangeSeconds(item, sequence.fps);
    const from = item.type === 'audio' ? range.start * perSecond : item.span.fromFrame;
    const to = item.type === 'audio' ? range.end * perSecond : item.span.fromFrame + item.span.durationFrames;
    return to <= start + 1e-6 || from >= end - 1e-6;
  });
}

/** Language tag → the language's own name (`en` → English). Returned as-is when not recognized (same as the editor's caption track names). */
function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    return name ? name.charAt(0).toLocaleUpperCase(tag) + name.slice(1) : tag;
  } catch {
    return tag;
  }
}
