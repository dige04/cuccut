import fs from 'node:fs/promises';
import path from 'node:path';
import { applySpeakers, EditorWasmError, speakerProposal, type SpeakerProposal } from '@cuccut/editor-wasm';
import { sha256File, type SpeakersFile, type WorkerFootprint } from '@cuccut/models';
import { RpcError, type EditOperation, type Id, type ModelBundleStatus, type SpeakersParams, type SpeakersSummary } from '@cuccut/protocol';
import { JobsSpeakers as J } from '@cuccut/protocol/messages/jobs/speakers.ts';
import type { ArtifactStore } from '../artifact-store.ts';
import { canonicalJson, sha256Hex } from '../input-hash.ts';
import { withCause, type JobText } from '../job-text.ts';
import type { LocalDiarizeOutcome, LocalDiarizeRun } from '../local-provider.ts';
import { localTranscribeResources } from '../resource-profiles.ts';
import { providerStepError } from './dub-separator.ts';
import { ParamReader } from './params.ts';
import { PipelineStepError, type PipelineDefinition, type PipelineStepContext, type StepResult } from './pipeline.ts';
import { pickSource, type PipelineVideos } from './translate.ts';
import { readArtifact } from './translation-batches.ts';

/**
 * Speaker recognition (architecture design §6.6; the backend of the AI tool “Recognize speakers”): re-separates the speakers of an existing transcript of a video by voiceprint, without transcribing again.
 *
 * 1. Diarization: the “speaker diarization” model package on this machine is loaded separately (Pyannote segmentation plus WeSpeaker voiceprints). The whole audio track and the word timings of the transcript are handed to the Model Worker (`job.run`'s `diarize`, Model Worker protocol spec §2.5.5), which projects the speakers onto each word (`speakers.json`, stored as an artifact).
 * 2. Consolidation: the clusters on the words reuse existing speakers by overlap duration (keeping their IDs and names, so the voice bindings in the library and the speaker bindings for dubbing stay intact). Clusters that cannot be matched to an existing speaker are created as new ones.
 *    At the same time, a trial application is computed once, giving each speaker's sentence count, preview clips, and the number of translation entries that would be re-cut (for subtitles and the translation core, via `@cuccut/editor-wasm`). The proposal is stored as an artifact, and a summary goes to the confirmation page in the UI.
 *
 * The pipeline does not change the video. After the user confirms on the confirmation page (renaming is allowed), `edits.applySpeakers` applies it (`applySpeakerProposal`) as a single undoable edit.
 */

export const SPEAKERS_PIPELINE = 'speakers';
/** The format of the proposal artifact. */
export const SPEAKER_PROPOSAL_SCHEMA = 'cuccut.speaker-proposal/1';

/** Frozen parameters: the transcript and its version, the media, the model package and its Worker estimate are all settled. */
export interface FrozenSpeakersParams extends SpeakersParams {
  documentId: Id;
  revision: string;
  assetId: Id;
  bundleId: string;
  footprint: WorkerFootprint | null;
}

/** The capability to read the video for speaker recognition: on top of translation, it adds the source file of the media. */
export interface SpeakersVideos extends PipelineVideos {
  assetFile(videoId: Id, assetId: Id): Promise<{ file: string; revision: string } | null>;
}

export interface SpeakersDeps {
  videos: SpeakersVideos;
  /** The state of this machine's “speaker diarization” model package at this moment; null when it is not registered. */
  pack(): Promise<ModelBundleStatus | null>;
  /** Roughly how much stays resident after its Model Worker loads (`ModelCatalog.workerFootprint`). */
  footprint(bundleId: string): Promise<WorkerFootprint | null>;
  diarizer: {
    diarize(
      run: LocalDiarizeRun,
      signal: AbortSignal,
      onProgress?: (done: number, total: number | null, phase: 'decoding' | 'diarizing' | 'finalizing') => void,
    ): Promise<LocalDiarizeOutcome>;
  };
}

/** The proposal artifact. When it is applied, it is read to check that the transcript and translations are still at the version used during recognition. */
export interface SpeakerProposalFile extends SpeakerProposal {
  schema: typeof SPEAKER_PROPOSAL_SCHEMA;
  videoId: Id;
  documentId: Id;
  revision: string;
  /** The translations (`cuccut.translation/2`) that take part in the trial computation, and their versions. */
  translations: Array<{ documentId: Id; revision: string }>;
  skippedTranslations: number;
  timescale: number;
}

interface DiarizeOutput extends Record<string, unknown> {
  artifactId: string;
  speakers: number;
  diarizeMs: number;
}

interface ProposeOutput extends Record<string, unknown> {
  artifactId: string;
}

const PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    // i18n-ignore-start: parameter descriptions (JSON Schema for agents)
    videoId: { type: 'string', description: 'Video that is open' },
    documentId: { type: 'string', description: 'Speech document to separate speakers in; can be omitted when the video has only one' },
    // i18n-ignore-end
  },
  required: ['videoId'],
  additionalProperties: false,
};

/** Whether this machine's local model package can be used: installed, not disabled, and supported on this machine. */
function usable(status: ModelBundleStatus): boolean {
  return status.state === 'installed' || status.state === 'loading' || status.state === 'ready' || status.state === 'busy';
}

export function speakersPipeline(deps: SpeakersDeps): PipelineDefinition<FrozenSpeakersParams, SpeakersParams> {
  return {
    name: SPEAKERS_PIPELINE,
    label: () => J.label(),
    description: () => J.description(),
    paramsSchema: PARAMS_SCHEMA,
    parse(raw) {
      const reader = new ParamReader(raw, ['videoId', 'documentId']);
      const videoId = reader.string('videoId', { max: 128 })!;
      const documentId = reader.string('documentId', { optional: true, max: 128 });
      return { videoId, ...(documentId !== undefined ? { documentId } : {}) };
    },
    async prepare(params) {
      const state = deps.videos.state(params.videoId);
      if (!state) throw new RpcError('not-found', J.videoNotOpen());
      const documentId = pickSource(state.documents, params.documentId);
      const record = state.documents[documentId]!;
      if (!record.sourceAssetId) throw new RpcError('invalid-request', J.notFromAsset(), { documentId });
      const pack = await deps.pack();
      if (!pack) throw new RpcError('conflict', J.modelMissing(), { code: 'MODEL_UNAVAILABLE' });
      if (!usable(pack)) {
        throw new RpcError('conflict', J.modelNotInstalled(), { code: 'MODEL_UNAVAILABLE', bundle: pack });
      }
      // A retry keeps the frozen transcript version (applying still checks it); on the first start, the current version is taken.
      const frozen = params as Partial<FrozenSpeakersParams>;
      const revision = frozen.revision ?? record.currentRevision;
      const next: FrozenSpeakersParams = {
        videoId: params.videoId,
        documentId,
        revision,
        assetId: record.sourceAssetId,
        bundleId: pack.bundleId,
        footprint: await deps.footprint(pack.bundleId),
      };
      return {
        params: next,
        providerId: 'local',
        modelId: pack.bundleId,
        videoId: params.videoId,
        contentHash: `sha256:${sha256Hex(canonicalJson({ videoId: params.videoId, documentId, revision }))}`,
      };
    },
    steps: [
      {
        name: 'diarize',
        label: () => J.stepDiarize(),
        // The Worker process is estimated per model package (tasks with the same model package share it); this step's own part is the decoded audio.
        resources: (params) => localTranscribeResources(params.bundleId, params.footprint),
        run: (context) => diarize(deps, context),
        reusable: async (output, { artifacts }) => (await artifacts.locate((output as DiarizeOutput).artifactId)) !== null,
      },
      {
        name: 'propose',
        label: () => J.stepPropose(),
        run: (context) => propose(deps.videos, context),
        reusable: async (output, { artifacts }) => (await artifacts.locate((output as ProposeOutput).artifactId)) !== null,
      },
    ],
    async complete({ params, outputs, artifacts }) {
      const diarized = outputs.diarize as DiarizeOutput;
      const proposed = outputs.propose as ProposeOutput;
      const proposal = await readArtifact<SpeakerProposalFile>(artifacts, proposed.artifactId);
      const summary: SpeakersSummary = {
        videoId: params.videoId,
        source: { documentId: params.documentId, revision: params.revision },
        timescale: proposal.timescale,
        speakers: proposal.speakers,
        relabeled: proposal.relabeled,
        translationsSplit: proposal.translationsSplit,
        skippedTranslations: proposal.skippedTranslations,
        proposalArtifactId: proposed.artifactId,
        bundleId: params.bundleId,
        diarizeMs: diarized.diarizeMs,
      };
      return { summary: summary as unknown as Record<string, unknown>, result: { documentId: null, artifactId: proposed.artifactId } };
    },
  };
}

interface SpeechWordLike {
  id: string;
  start?: number;
  end?: number;
}

/** The words and timings in the transcript body. `PipelineStepError` when they cannot be read. */
function speechWords(body: unknown, documentId: Id): { words: SpeechWordLike[]; timescale: number } {
  const b = body as { schema?: unknown; timescale?: unknown; words?: unknown } | null;
  if (!b || b.schema !== 'cuccut.speech/1' || !Array.isArray(b.words)) {
    throw new PipelineStepError('INPUT_UNREADABLE', J.transcriptUnreadable(), { documentId });
  }
  const timescale = typeof b.timescale === 'number' && b.timescale > 0 ? b.timescale : 1_000_000;
  return { words: b.words as SpeechWordLike[], timescale };
}

async function diarize(deps: SpeakersDeps, context: PipelineStepContext<FrozenSpeakersParams>): Promise<StepResult> {
  const { params, artifacts, progress, signal, jobId, staging } = context;
  progress(null, 'starting');
  const state = deps.videos.state(params.videoId);
  if (!state) throw new PipelineStepError('STALE_JOB_INPUT', J.videoClosed());
  if (!state.documents[params.documentId]) {
    throw new PipelineStepError('STALE_JOB_INPUT', J.transcriptGone(), { documentId: params.documentId });
  }
  const content = await deps.videos.document(params.videoId, params.documentId, params.revision);
  const { words, timescale } = speechWords(content.body, params.documentId);
  if (words.length === 0) throw new PipelineStepError('INPUT_UNREADABLE', J.noWords(), { documentId: params.documentId });
  const spans: Array<[number, number]> = [];
  for (const word of words) {
    if (!Number.isSafeInteger(word.start) || !Number.isSafeInteger(word.end)) {
      throw new PipelineStepError('INPUT_UNREADABLE', J.untimedWords(), { wordId: word.id });
    }
    spans.push([Math.max(0, word.start!), Math.max(0, word.start!, word.end!)]);
  }
  const source = await deps.videos.assetFile(params.videoId, params.assetId);
  const facts = deps.videos.asset?.(params.videoId, params.assetId) ?? null;
  if (!source) throw new PipelineStepError('INPUT_UNREADABLE', J.sourceMissing(), { assetId: params.assetId });
  const contentHash = facts?.contentHash ?? `sha256:${await sha256File(source.file).catch(() => '')}`;

  const dir = path.join(staging, 'diarize');
  await fs.mkdir(dir, { recursive: true });
  const started = Date.now();
  let outcome: LocalDiarizeOutcome;
  try {
    outcome = await deps.diarizer.diarize(
      {
        bundleId: params.bundleId,
        jobId,
        input: { file: source.file, contentHash, track: 0 },
        timescale,
        words: spans,
        staging: dir,
      },
      signal,
      (done, total, phase) => progress(total === null ? null : { done, total, unit: phase === 'decoding' ? 'seconds' : 'steps' }, phase),
    );
  } catch (error) {
    throw providerStepError(error);
  }
  if (outcome.outcome === 'cancelled') throw signal.reason ?? new DOMException('aborted', 'AbortError');
  progress(null, 'validating');
  const hex = await sha256File(outcome.file);
  if (hex !== outcome.sha256) throw new PipelineStepError('MODEL_OUTPUT_INVALID', J.hashMismatch());
  const parsed = JSON.parse(await fs.readFile(outcome.file, 'utf8')) as SpeakersFile;
  if (parsed.schema !== 'cuccut.speakers/v1' || !Array.isArray(parsed.words) || parsed.words.length !== words.length) {
    throw new PipelineStepError('MODEL_OUTPUT_INVALID', J.wordCountMismatch(), {
      words: words.length,
      labels: Array.isArray(parsed.words) ? parsed.words.length : null,
    });
  }
  const stored = await artifacts.putFile(outcome.file, 'json');
  const output: DiarizeOutput = {
    artifactId: stored.artifactId,
    speakers: outcome.result.speakers,
    diarizeMs: outcome.result.stats.diarizeMs || Date.now() - started,
  };
  return { output, result: { documentId: null, artifactId: stored.artifactId } };
}

async function propose(videos: PipelineVideos, context: PipelineStepContext<FrozenSpeakersParams>): Promise<StepResult> {
  const { params, artifacts, outputs, progress } = context;
  progress(null, 'finalizing');
  const diarized = outputs.diarize as DiarizeOutput;
  const speakers = await readArtifact<SpeakersFile>(artifacts, diarized.artifactId);
  const content = await videos.document(params.videoId, params.documentId, params.revision);
  const { timescale } = speechWords(content.body, params.documentId);
  const state = videos.state(params.videoId);
  if (!state) throw new PipelineStepError('STALE_JOB_INPUT', J.videoClosed());
  const { bodies, refs, skipped } = await translationsOf(videos, params.videoId, state.documents, params.documentId);
  let proposal: SpeakerProposal;
  try {
    proposal = speakerProposal(content.body, bodies, speakers.words);
  } catch (error) {
    if (error instanceof EditorWasmError) {
      throw new PipelineStepError('INPUT_UNREADABLE', withCause(J.transcriptUnreadable(), error), {
        documentId: params.documentId,
        code: error.code,
      });
    }
    throw error;
  }
  const file: SpeakerProposalFile = {
    schema: SPEAKER_PROPOSAL_SCHEMA,
    videoId: params.videoId,
    documentId: params.documentId,
    revision: params.revision,
    translations: refs,
    skippedTranslations: skipped,
    timescale,
    ...proposal,
  };
  const { artifactId } = await artifacts.put(Buffer.from(JSON.stringify(file)), 'json');
  return { output: { artifactId } satisfies ProposeOutput, result: { documentId: null, artifactId } };
}

/** The translations of this transcript (current version): current-format ones take part in re-cutting; old-format ones are skipped (only counted). */
export async function translationsOf(
  videos: Pick<PipelineVideos, 'document'>,
  videoId: Id,
  documents: Record<Id, { id: Id; kind: string; sourceDocumentId?: Id; currentRevision: string }>,
  documentId: Id,
): Promise<{ bodies: unknown[]; refs: Array<{ documentId: Id; revision: string }>; skipped: number }> {
  const bodies: unknown[] = [];
  const refs: Array<{ documentId: Id; revision: string }> = [];
  let skipped = 0;
  for (const record of Object.values(documents)) {
    if (record.kind !== 'translation' || record.sourceDocumentId !== documentId) continue;
    const content = await videos.document(videoId, record.id, record.currentRevision);
    if ((content.body as { schema?: unknown } | null)?.schema !== 'cuccut.translation/2') {
      skipped += 1;
      continue;
    }
    bodies.push(content.body);
    refs.push({ documentId: record.id, revision: content.revision });
  }
  return { bodies, refs, skipped };
}

/** Reads the proposal artifact. `ARTIFACT_NOT_FOUND` if it is gone. */
export function readSpeakerProposal(artifacts: ArtifactStore, artifactId: string): Promise<SpeakerProposalFile> {
  return readArtifact<SpeakerProposalFile>(artifacts, artifactId);
}

/** The transaction label for applying speaker recognition (written into the video's edit history, generated in the current language). */
export function speakersApplyLabel(): string {
  return J.label().text;
}

/** The upper limit on the length of a name (consistent with the speaker rename UI). */
const NAME_MAX = 100;

/**
 * The operation that turns the proposal into one edit transaction (`edits.applySpeakers`). The transcript gets a new version (the speakers on the words, the speaker table and names, and the sentences split along the new boundaries). Translations that changed each get a new version (re-cut along the new boundaries, not re-translated). The summary is kept from the original, with the speaker count updated.
 *
 * If the transcript or the translations that took part in the trial were changed after recognition (the version differs, or translations were added or removed), it is rejected with `conflict` (`STALE_JOB_INPUT`). When `names` contains a speaker that is not in the proposal, or an empty name, it is `invalid-request`.
 */
export async function speakerApplyOperations(
  videos: Pick<PipelineVideos, 'state' | 'document'>,
  proposal: SpeakerProposalFile,
  names: Readonly<Record<Id, string>> = {},
): Promise<{ operations: EditOperation[]; label: string; speakerCount: number; translationsSplit: number }> {
  const state = videos.state(proposal.videoId);
  if (!state) throw new RpcError('not-found', J.videoNotOpen());
  const record = state.documents[proposal.documentId];
  const stale = (message: JobText, details: Record<string, unknown> = {}) =>
    new RpcError('conflict', message, { code: 'STALE_JOB_INPUT', documentId: proposal.documentId, ...details });
  if (!record) throw stale(J.transcriptGone());
  if (record.currentRevision !== proposal.revision) {
    throw stale(J.transcriptChanged(), { revision: proposal.revision, currentRevision: record.currentRevision });
  }
  const { bodies, refs } = await translationsOf(videos, proposal.videoId, state.documents, proposal.documentId);
  const key = (r: { documentId: Id; revision: string }) => `${r.documentId}@${r.revision}`;
  const was = new Set(proposal.translations.map(key));
  if (refs.length !== was.size || refs.some((r) => !was.has(key(r)))) throw stale(J.translationChanged());

  const known = new Map(proposal.speakers.map((s) => [s.id, s.name]));
  for (const [id, name] of Object.entries(names)) {
    if (!known.has(id)) throw new RpcError('invalid-request', J.unknownSpeaker(), { speakerId: id });
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length > NAME_MAX) {
      throw new RpcError('invalid-request', J.nameInvalid({ max: NAME_MAX }), { speakerId: id });
    }
    known.set(id, trimmed);
  }
  const speech = await videos.document(proposal.videoId, proposal.documentId, proposal.revision);
  let applied;
  try {
    applied = applySpeakers(
      speech.body,
      bodies,
      proposal.wordSpeakers,
      [...known].map(([id, name]) => ({ id, name })),
    );
  } catch (error) {
    if (error instanceof EditorWasmError) throw new RpcError('invalid-request', withCause(J.applyFailed(), error), { code: error.code });
    throw error;
  }
  const summaryOf = (documentId: Id) => {
    const doc = state.documents[documentId]!;
    return doc.revisions[doc.currentRevision]?.summary;
  };
  const speakerCount = Array.isArray(applied.speech.speakers) ? applied.speech.speakers.length : known.size;
  const previous = summaryOf(proposal.documentId);
  const operations: EditOperation[] = [
    {
      type: 'putDocument',
      documentId: proposal.documentId,
      kind: record.kind,
      body: applied.speech,
      summary: previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>), speakerCount } : { speakerCount },
    },
  ];
  applied.translations.forEach((body, index) => {
    if (!body) return;
    const documentId = refs[index]!.documentId;
    // The unit count in the summary is updated along with the re-cut (translation writing recorded `unitCount`).
    const previous = summaryOf(documentId);
    const units = Array.isArray(body.units) ? body.units.length : null;
    const summary =
      previous && typeof previous === 'object' && units !== null && 'unitCount' in previous ? { ...previous, unitCount: units } : previous;
    operations.push({
      type: 'putDocument',
      documentId,
      kind: state.documents[documentId]!.kind,
      body,
      ...(summary !== undefined ? { summary } : {}),
    });
  });
  return { operations, label: speakersApplyLabel(), speakerCount, translationsSplit: applied.translationsSplit };
}
