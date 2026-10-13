import type { Id } from './domain.ts';
import type { ExportJobInfo, ExportValidation } from './exports.ts';
import type { JobLibraryUse } from './library.ts';
import type { ImageFormat, MusicMode, MusicPlanning, SpeechFormat, TextEffort, VoiceMode } from './models.ts';
import type { JobGrantUse } from './grants.ts';
import type { JobWait } from './resources.ts';
import { localizeText, type MessageRef } from './message-ref.ts';

/**
 * Job (architecture design §7): the state of a long computation. Model methods return a `jobId` immediately; progress and results are delivered through the `jobs` topic.
 *
 * States: `queued → running → completed | failed | cancelled | interrupted | needs-reconciliation`.
 * `interrupted` means this attempt did not finish (the Worker crashed, or the Runtime stopped or restarted). When the Worker crashes, the Runtime retries once automatically:
 * the same Job goes back to `running` with `attempt` incremented (§6.5). When the Runtime restarts, unfinished Jobs are handled by the recovery matrix (§7.5): ones that had not started are queued again, local tasks are marked `interrupted`,
 * and outbound calls whose result is unknown are marked `needs-reconciliation`, waiting for the user to decide with `jobs.reconcile`. They are never sent again automatically.
 */

/**
 * Kinds of task: a model task has the same name as the capability it executes. `export` is an export (`exports.create`). A fixed flow (architecture design §7.9) is one `pipeline` parent task, and each step is its `pipeline-step` child task.
 * `modelInstall` installs or repairs a local model package (`models.install`, `models.repair`), and `modelTest` is its check (`models.test`). Neither belongs to any video or agent task (§6.3).
 */
export type JobKind =
  | 'transcribe'
  | 'synthesizeSpeech'
  | 'generateImage'
  | 'generateMusic'
  | 'generateText'
  | 'export'
  | 'pipeline'
  | 'pipeline-step'
  | 'modelInstall'
  | 'modelTest'
  /** Moves a local model to a new model directory (`move` of `models.setDir`, §6.3). It belongs to no video or agent task, and progress is in bytes. */
  | 'modelsMove'
  /** Download and verification of managed external tools (`externalTools.install`, §12.9). */
  | 'toolInstall'
  /** Updates external tools installed on the system using their original install method (`externalTools.update`, §12.9): runs one command, with the output recorded in `command`. */
  | 'toolUpdate'
  /** Voice cloning (architecture design §5.9): uploads a library voice's reference recording to the Provider to create a clone. */
  | 'voiceClone'
  /** On-demand downloaded fonts (`fonts.download`; downloaded automatically for preview and export, §9.1): several faces of one family. */
  | 'fontDownload'
  /**
   * The agent in the session translates a transcript itself (`documents_read` with `translateTo`). There is no Worker and no queue; it is only a progress record, so the video card and the subtitle panel can show “translating”.
   * It completes when the agent writes the translation in this language, and is interrupted at the end of the turn if it has not been written yet (a cancellation by the user stopping).
   */
  | 'agentTranslate';

export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'needs-reconciliation';

/**
 * One attempt to apply a result to a video (architecture design §7.2): executing and applying are two records. Applying is first recorded as `pending`. After validation it is recorded as `validating`, with `commandId` and `baseVideoRevision`,
 * and then the transaction is committed. After the commit, the receipt is recorded (`committed`). On crash recovery, first ask the engine for the receipt by the same `commandId`; if it is found, backfill the record without rewriting it. Only if it is not found is the apply validated again and committed with a new `commandId`.
 *
 * - `stale-input`: the target is gone, the material has changed version, or the video directory is missing. Adjacent objects are not guessed; the output is kept as a candidate.
 * - `rejected`: the engine rejected the transaction, or the video cannot be opened (locked by another process, or the engine is unavailable).
 * - `cancelled`: an apply that was not committed after the stop barrier (the Run ended, `jobs.cancel`, or the user gave up).
 */
export type ApplicationState = 'pending' | 'validating' | 'committed' | 'stale-input' | 'rejected' | 'cancelled';

export interface ApplicationRecord {
  applicationId: Id;
  jobId: Id;
  /** The outputs to apply (the raw transcription result, each generated output). */
  artifactIds: string[];
  videoId: Id;
  /** The target to write: for transcription, the input material; for a generation import, the reference name of the new material (`output1`……). */
  targetRefs: string[];
  /** The video revision that validation was based on at submission; null if not validated yet. */
  baseVideoRevision: string | null;
  /** The command ID used for the latest transaction commit; null if not yet committed. */
  commandId: string | null;
  state: ApplicationState;
  /**
   * The receipt the engine returned after the commit: the transaction, the video revision after the commit, and the IDs that `ref`s in the operations resolved to. `recovered` means it was not obtained at commit time,
   * but was fetched from the engine later by `commandId` (after a crash, or when the receipt response was lost).
   */
  receipt: { transactionId: Id | null; videoRevision: string | null; refs: Record<string, Id>; recovered?: true } | null;
  /** The reason it ended (`stale-input`, `rejected`, `cancelled`). */
  error: JobError | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Three facts recorded separately for a cancellation or abandonment (architecture design §7.4): whether it stopped locally, whether the remote side was cancelled, and whether a cost was incurred.
 * `remote`: `not-applicable` for a local task; `not-submitted`, not sent yet; `cancelled`, the remote side confirmed the cancellation; `cancel-unsupported`, already sent but the provider has no cancel interface (the request may still complete remotely); `unknown`, not known whether it was sent.
 * `cost`: `none`, nothing was sent out; `possible`, it may be charged (the budget is deducted by the conservative rule); `charged`, a result was obtained, so it is certainly charged.
 */
export interface JobCancellation {
  requestedAt: string;
  localStoppedAt: string | null;
  remote: 'not-applicable' | 'not-submitted' | 'cancelled' | 'cancel-unsupported' | 'unknown';
  cost: 'none' | 'possible' | 'charged';
}

/**
 * The decisions for `jobs.reconcile` (architecture design §7.5), a closed set:
 * - `retry`: transcription and generation tasks in `needs-reconciliation` or `interrupted` run again as the same Job (a new paid call, admitted again).
 * - `discard`: abandons a `needs-reconciliation` task and records it as `cancelled` (budget deducted under the conservative rule is not refunded). If the latest apply was not committed, abandon that apply and keep the output as a candidate.
 * - `apply`: the latest apply was `stale-input`, `rejected` or `cancelled` and the output exists; validate again and apply once more.
 */
export type JobReconcileDecision = 'retry' | 'discard' | 'apply';

/** Phase: the inference phases reported by the Worker, plus the Runtime's own preparation, validation, publishing and applying. */
export type JobPhase =
  | 'queued'
  | 'starting'
  | 'loading'
  | 'decoding'
  | 'vad'
  | 'transcribing'
  | 'aligning'
  | 'diarizing'
  | 'finalizing'
  | 'probing'
  | 'encoding'
  | 'downloading'
  /** Moves the model directory: renames or copies files (`move` of `models.setDir`). */
  | 'moving'
  | 'generating'
  | 'validating'
  | 'publishing'
  | 'applying'
  | 'done';

/** Null when `total` is unknown; a percentage is not made up. */
export interface JobProgress {
  done: number;
  total: number | null;
  /**
   * `outputs`: how many outputs a generation task has received so far (when several images are generated at once). `steps`: how many steps a fixed flow has completed.
   * `units`: how many items a step has processed (sentences translated one by one, files read during transcoding). `bytes`: how many bytes a model install has received (or verified).
   * `frames`: how many frames of the finished export have been rendered.
   */
  unit: 'seconds' | 'segments' | 'outputs' | 'steps' | 'units' | 'bytes' | 'frames';
  /** Steps that call the model per clip or per sentence: the calls already sent, retries and failures (factual counts, architecture design §7.9). The parent task sums the counts of the step that is running. */
  calls?: JobCallCounts;
}

/** Factual counts of the model calls in one step. */
export interface JobCallCounts {
  /** Calls sent (including retries). */
  calls: number;
  /** Calls re-sent because the output did not match the contract. */
  retries: number;
  /** Calls that ended in failure. */
  failures: number;
}

/**
 * Submitter: a principal, not a transport. `connection` is one connection to the local gateway; `system` is the Runtime itself; `node` is a remote task submitted through the LAN node service, with `id` as the initiating `clientId` (architecture design §6.7).
 * `agent` is submitted by the agent in a session through a tool: `id` is the session ID, and `taskId` is the task in progress at the time of submission (architecture design §7.9).
 * `service` is submitted by a client of an external service (a tool of the MCP service, or one request to the model API service): `id` is the service (`mcp`, `model-api`), and `clientId` is the client issued to it (architecture design §4.8).
 * `pipeline` is a step (child task) of a fixed flow: the executing principal is `system:pipeline`, and the parent task records the connection or service that started the flow.
 */
export type JobSubmitter =
  | { kind: 'connection' | 'system' | 'node'; id: string }
  /** One step of a fixed flow: `id` is the `jobId` of the parent task (`kind: 'pipeline'`) (architecture design §7.9). */
  | { kind: 'pipeline'; id: Id }
  | { kind: 'agent'; id: Id; taskId: Id }
  | { kind: 'service'; id: string; clientId: string };

/** For error codes, see the commands and protocol spec §11.3 (`MODEL_LOAD_FAILED`, `MODEL_WORKER_CRASHED`, `MODEL_OUTPUT_INVALID`, `STALE_JOB_INPUT`……). */
export interface JobError {
  code: string;
  message: string;
  /** Message reference for `message` (message-ref.ts): the UI regenerates it in its own language. Old records and third-party original wording have none. */
  messageRef?: MessageRef;
  details?: unknown;
}

/** Structured warning: the Worker's `asr-result` warning, and results such as `no-speech` / `no-audio-track`. */
export interface JobWarning {
  code: string;
  segmentId?: string;
  detail?: string;
  /** Message reference for `detail` (message-ref.ts). */
  detailRef?: MessageRef;
  /**
   * `FONT_NOT_DOWNLOADED` (finished-video export): which face could not be fetched, which family replaces it (the render kernel's fallback family), and why. It says the same thing as `detail`;
   * the UI uses it to list “family → fallback font · reason”.
   */
  font?: { family: string; weight: number; italic: boolean; fallback: string; reason: string };
}

/**
 * The reference recording frozen for local speech synthesis. `source`: `file` comes from the request's `reference.file`; `library` comes from a voice-library entry (fixed to the version at submission);
 * `builtin` is the recording of a built-in voice shipped with the app. `path` is an absolute local path; it appears only in the local task record, not in logs or artifacts.
 */
export interface FrozenSpeechReference {
  source: 'file' | 'library' | 'builtin';
  path: string;
  /** `sha256:<hex>` */
  sha256: string;
  byteLength: number;
  /** The original text of the reference recording; null if there is none (the model uses this to decide which cloning path to take). */
  transcript: string | null;
}

/**
 * The parameters frozen by a generation task (fixed at submission; execution and retries both use this one set, so the model and voice are never swapped). The source text and prompts are recorded as they are,
 * so the generated output can be traced and reproduced from them. For material in a video, only a digest is recorded (`inputHash`), not the original text.
 */
export type GenerationParameters =
  | {
      capability: 'synthesizeSpeech';
      text: string;
      voice: string;
      /** The language given by the request (BCP 47); null if none was given. */
      language: string | null;
      format: SpeechFormat;
      instructions: string | null;
      speed: number | null;
      seed: number | null;
      /**
       * The following exist only for local speech synthesis and are not written otherwise (the records and `inputHash` of online tasks are unchanged).
       * `voiceMode`: the voice mode used this time. With `preset`, `voice` is the model's speaker or a built-in voice.
       */
      voiceMode?: VoiceMode;
      /** The reference recording for `clone`: the digest and size read at submission. It is checked again before execution, and the task fails if it changed (it is not replaced with another voice). */
      reference?: FrozenSpeechReference;
      /** A one-sentence description for `describe`. */
      voiceDescription?: string;
      cfg?: number;
      steps?: number;
    }
  | {
      capability: 'generateImage';
      prompt: string;
      /** The size `WIDTHxHEIGHT` sent to the provider; null means the provider decides. */
      size: string | null;
      /** The aspect ratio given by the request; null when a size is given. */
      aspectRatio: string | null;
      count: number;
      format: ImageFormat;
      seed: number | null;
      /** The denoising steps for local image generation. Not written when the request gives none (the model's default steps are used). Absent for online tasks. */
      steps?: number;
    }
  | {
      /**
       * Local music generation (architecture design §6.1): the style description and lyrics are recorded as they are. With `mode: 'instrumental'`, `lyrics` is null (no filler text is written to make up the field).
       * `maxDurationSec` is a compute budget (mapped to the model's token limit), not a promised duration. The actual duration is the one probed at publish time, and a result that hits the limit is marked `truncated`.
       * `seed` is frozen at submission (drawn at random if the request does not give one).
       */
      capability: 'generateMusic';
      mode: MusicMode;
      style: string;
      lyrics: string | null;
      /** The target duration of the creative intent, in seconds; null if none was given. */
      targetDurationSec: number | null;
      maxDurationSec: number;
      planning: MusicPlanning;
      format: SpeechFormat;
      seed: number;
      /** The number of diffusion steps. Not written when the request gives none (the model's default steps are used). */
      steps?: number;
    }
  | {
      capability: 'generateText';
      messages: TextMessage[];
      responseFormat: TextResponseFormat;
      maxOutputTokens: number;
      temperature: number | null;
      /** The reasoning effort the request asked for (when not given, the default of the capability parameter); null if neither exists. */
      requestedEffort: TextEffort | null;
      /** The reasoning effort actually sent to the provider: when the model does not support that level, the nearest level; null when it cannot be adjusted. */
      effort: TextEffort | null;
      seed: number | null;
    };

/** One message for a text model: text only, with no images and no tool calls. */
export interface TextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** The output form: plain text, or JSON that conforms to the given JSON Schema (validated against the schema before it is returned). */
export type TextResponseFormat = { type: 'text' } | { type: 'json'; schema: Record<string, unknown>; name?: string };

/**
 * The stop reason of a text model. `stop` is a normal finish. `length` is truncation at the output limit; it is never treated as a complete success (a text result carries an `output-truncated` warning, and structured output always fails).
 * `content-filter` is the provider's content filter (always fails with `PROVIDER_REJECTED` and `details.reason: 'content-filter'`).
 */
export type TextFinishReason = 'stop' | 'length' | 'content-filter';

/** Token usage reported by the provider; the whole value is null when none was reported. */
export interface TextUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  /** Input tokens served from cache (when the provider reports them separately). They are part of `inputTokens`: the adapter converts the provider's form into “total input, including cache”. */
  cachedTokens?: number | null;
}

/** The result summary of a `generateText` task. The full text is the artifact `result.artifactId` (`.txt` or `.json`); only the opening passage is here. */
export interface TextJobResult {
  mediaType: 'text/plain' | 'application/json';
  byteLength: number;
  /** The length of the full text, counted in Unicode code points. */
  length: number;
  /** The opening, at most `TEXT_PREVIEW_CHARS` characters. */
  preview: string;
  /** The preview is shorter than the full text. */
  previewTruncated: boolean;
  finishReason: TextFinishReason;
  usage: TextUsage | null;
  /** The model version reported by the provider (for example a dated snapshot name); null when none was reported. */
  modelVersion: string | null;
  /** A note such as the reasoning effort being mapped to another level or ignored. */
  notes: string[];
}

export const TEXT_PREVIEW_CHARS = 2000;

/** One output of a generation task or export: validated and published as an artifact. When a generation task was given a video, it is also imported as material. */
export interface GeneratedOutput {
  artifactId: string;
  mediaType: string;
  byteLength: number;
  /** The material obtained by importing the video; null when there is no video, the import failed, or it is an export. */
  assetId: Id | null;
  /** Facts in the validation report: audio, images and video (the finished video, transcoding results) come from ffprobe decoding; text comes from parsing the exported file (the number of entries and the duration they cover). */
  media:
    | { kind: 'audio'; durationSec: number; sampleRate: number; channels: number }
    | { kind: 'image'; width: number; height: number }
    | { kind: 'text'; entries: number; durationSec: number }
    | {
        kind: 'video';
        durationSec: number;
        width: number;
        height: number;
        videoCodec: string;
        audioCodec: string | null;
        /** A finished-video export must always fill this: the frame count and frame rate of the video stream (`30/1`, `30000/1001`). A file transcode may leave it empty. */
        frames?: number;
        fps?: string;
      }
    /** Portable package: the number of files in the package, and the number of material versions brought in and marked missing, and the number of document versions. */
    | { kind: 'package'; files: number; assets: number; missingAssets: number; documents: number }
    /** Project export: the number of clips written into the project, and the number of objects it could not express, each reported one by one. */
    | { kind: 'project'; clips: number; omitted: number; durationSec: number }
    /** A file handed to the user (`downloads_save`): copied as it is, not decoded or parsed. */
    | { kind: 'file' };
  /**
   * An output written outside the artifact library (an export, or a file transcode written to a directory the user chose): the absolute path it was published to. For a file transcode, `artifactId` is the digest of the file content,
   * `sha256:<hex>`, which `artifacts.openHandle` cannot find.
   */
  path?: string;
  /** Export: the file format (`srt`, `wav`……). */
  format?: string;
  /** Export: the validation result before publishing. */
  validation?: ExportValidation;
}

export interface JobRecord {
  jobId: Id;
  kind: JobKind;
  state: JobState;
  phase: JobPhase;
  progress: JobProgress | null;
  /**
   * The input material in the video. Tasks that a LAN node runs for another machine (`submitter.kind === 'node'`) have no video, and all three are null.
   * Generation tasks have no input material: `assetId` and `assetRevision` are null. `videoId` is the video the result is imported into (null if none).
   */
  videoId: Id | null;
  assetId: Id | null;
  assetRevision: string | null;
  /** The digest of the input content, `sha256:<hex>`: of the material revision, of a file uploaded by a remote task, or of the source text and prompt (UTF-8) of a generation task. */
  contentHash: string;
  /** The Provider that executes it (`local`, `node:<nodeId>`, `openai`, `google`, `custom:<slug>`), and the model. */
  providerId: string;
  /** For local and node, the model package ID; for online providers, the provider's model name. */
  modelId: string;
  /** The model package for local and node; null for online providers. */
  bundleId: string | null;
  /** The input hash of the task spec (`sha256:<hex>`), used to de-duplicate in-flight tasks with the same input. */
  inputHash: string;
  submitter: JobSubmitter;
  /** Which attempt this is, starting from 1. */
  attempt: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  error: JobError | null;
  /**
   * On completion: the `speech` document written to the video (null when there is no speech or no audio track), and the artifact of the raw result. The result of a remote task is handed back to the initiator, so this is always null here.
   * Generation tasks: `documentId` is null, `artifactId` is the artifact of the first output, and `outputs` is all the outputs (kept even if importing the video failed).
   * Text generation tasks: `artifactId` is the artifact of the full text, `text` is the summary and preview, and there is no `outputs`.
   * Export: the same as generation tasks, with `outputs` as the published files. If some of several files were not published, the task is `failed` (`EXPORT_PARTIALLY_PUBLISHED`),
   * and `result` still lists the ones that were published.
   */
  result: { documentId: Id | null; artifactId: string; outputs?: GeneratedOutput[]; text?: TextJobResult } | null;
  warnings: JobWarning[];
  /** The parameters frozen by a generation task. Transcription tasks have none. */
  generation?: GenerationParameters;
  /** The export's settings, frozen snapshot and target (present only for `kind: 'export'`). */
  export?: ExportJobInfo;
  /**
   * The language and speaker diarization fixed at submission for a video's transcription (submitted by `models.transcribe` and by flows, `kind: 'transcribe'`): `language` is the normalized request,
   * and `diarize` is the effective value (set by the model when the request does not give one). Remote transcriptions, file-only transcriptions and earlier records have none.
   */
  transcribe?: { language: LanguageRequest; diarize: boolean; replace?: TranscriptReplace };
  /** The user library entries used (the version and digest frozen at submission), and whether the glossary entered the recognition hint (architecture design §5.9). */
  library?: JobLibraryUse;
  /** The grant and budget used by the outbound calls: which grant (and which generation), the reservation and the settlement (architecture design §12.5, §7.8). Local and node tasks have none. */
  grant?: JobGrantUse;
  /** The agent's own translation (`kind: 'agentTranslate'`): which transcript it translates, into which language, and how many sentences. */
  translation?: AgentTranslation;
  /** A step of a fixed flow (`kind: 'pipeline-step'`): the `jobId` of its parent task. `jobs.list` folds child tasks under their parent by default. */
  parentJobId?: Id;
  /** The parent task of a fixed flow (`kind: 'pipeline'`): the frozen parameters and the state of each step. */
  pipeline?: PipelineRun;
  /** A step of a fixed flow: which flow it belongs to, and its position in that flow. */
  step?: PipelineStepRef;
  /** The attempts to apply the result to the video (architecture design §7.2), oldest first. Tasks with no video have none. */
  applications?: ApplicationRecord[];
  /** The three facts for a cancellation or abandonment (architecture design §7.4). Present only if it was cancelled. */
  cancellation?: JobCancellation;
  /** The command run on the user's behalf and its output (`kind: 'toolUpdate'`, §12.9). Absent before execution starts. */
  command?: JobCommandRun;
  /**
   * What a `queued` task is waiting for: the concurrency limit of the same queue, or a machine resource (architecture design §7.6, §7.7). Absent after execution starts.
   * Steps of a fixed flow that declare requirements also carry this before admission (it is recorded on both the child and the parent task).
   */
  wait?: JobWait;
}

/** The scope of the agent's own translation (`JobRecord.translation`). */
export interface AgentTranslation {
  /** The documentId of the transcript being translated (kind `speech`). */
  sourceDocumentId: Id;
  /** The target language (BCP 47). */
  targetLanguage: string;
  /** The number of sentences the transcript was split into by the rules (the length of `translationBasis.sentences`). */
  sentences: number;
}

/**
 * A command run on the user's behalf (architecture design §12.9): the line shown to people, its output and its exit code. It is updated with task events during execution. The output is the raw text of stdout and stderr merged in arrival order, with terminal colors removed.
 * Progress lines rewritten with `\r` keep only the last rewrite. Only the tail is kept (about 32 KB, cut on whole lines); the full text is in the result artifact.
 */
export interface JobCommandRun {
  /** The command run: one line with POSIX quoting, which can be copied into a terminal. */
  line: string;
  output: string;
  /** The number of lines written so far (including the ones cut off). A last line of `output` that is not finished yet is not counted. Clients that follow the output line by line use this to print only the new lines. */
  lines: number;
  /** Earlier output was cut off. */
  truncated: boolean;
  /** The exit code; null while it is still running, after it was stopped, or if it failed to start. */
  exitCode: number | null;
}

/**
 * One execution of a fixed flow (architecture design §7.9), recorded on the parent task. The parameters are validated and frozen at submission; execution and retries read only this one set.
 * Each step's output (artifacts, output files, written documents) is also recorded here. A retry starts from the failed step and reuses the output of the earlier steps.
 */
export interface PipelineRun {
  /** The flow name (`name` in `pipelines.list`). */
  name: string;
  /** The frozen parameters. */
  params: Record<string, unknown>;
  steps: PipelineStepState[];
  /** The index of the step that is executing; null if none. */
  current: number | null;
  /** The step that stopped the flow (failed, cancelled or interrupted); null if none. */
  stoppedAt: string | null;
  /** The result summary when the flow completes (each flow has its own shape, see the commands and protocol spec §4.1); null while it is not complete. */
  summary: Record<string, unknown> | null;
}

export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled' | 'interrupted';

export interface PipelineStepState {
  name: string;
  /** The step name for people to read. */
  label: string;
  /** Message reference for `label` (message-ref.ts). */
  labelRef?: MessageRef;
  status: PipelineStepStatus;
  /** The child task of this step's most recent execution; null if not executed yet. A retry replaces it with a new child task, and the old one stays in the task list. */
  jobId: Id | null;
  /** How many times it has been executed. */
  attempts: number;
  /** The output on completion: artifact IDs, output files, document references and the like (the step's own shape). */
  output: Record<string, unknown> | null;
}

/** The step name in the reader's current language: regenerated when there is a `labelRef`; otherwise the recorded `label` is used. */
export function pipelineStepLabel(step: { label: string; labelRef?: MessageRef }): string {
  return localizeText(step.label, step.labelRef);
}

export interface PipelineStepRef {
  pipeline: string;
  name: string;
  label: string;
  /** Message reference for `label` (message-ref.ts). */
  labelRef?: MessageRef;
  /** The index, starting from 0. */
  index: number;
}

/** The language: either an assertion (the model must not change it) or a preference (auto-detect; a `tag` of null means no language preference). BCP 47. */
export type LanguageRequest = { mode: 'assert'; tag: string } | { mode: 'prefer'; tag: string | null };

/**
 * The parameters of `models.transcribe`: one audio or video material revision in an opened video.
 *
 * The Provider and model are chosen in the order of architecture design §6.2: the explicit `provider` / `model`, then the user's default, then the factory default (a model package available locally).
 * If none exists, the call is rejected with `CAPABILITY_NOT_CONFIGURED`. `node: x` is the same as `provider: 'node:<x>'` (`x` can be an alias), and `bundleId: b` is the same as `model: b`.
 * If the two forms contradict each other, `invalid-request` is returned.
 */
export interface TranscribeRequest {
  videoId: Id;
  assetId: Id;
  /** If not given, the material's current revision is used. */
  revision?: string;
  /** Provider: `local`, `node:<nodeId or alias>`, `openai`, `google`, `custom:<slug>`. */
  provider?: string;
  /** Model: for local and node, the model package ID; for online, the provider's model name. When only a Provider is given, the default value (if it points to that Provider) or its default model is used. */
  model?: string;
  /** Legacy form, the same as `model`. */
  bundleId?: string;
  /** When not given: `{ mode: 'prefer', tag: null }`. */
  language?: LanguageRequest;
  /** The track index; default 0. */
  track?: number;
  /** Terms and context, ≤ 1200 characters. */
  hint?: string;
  /**
   * Speaker diarization (architecture design §6.6). When not given, the model decides: a model that can tell speakers apart (`TranscribeModelInfo.speakers` is `native` or `pack`) does it, and others do not.
   * If `true` is given but the model cannot tell speakers apart, the transcription proceeds as usual, and the result carries a `diarization-unavailable` warning.
   */
  diarize?: boolean;
  /**
   * The recognition glossary (architecture design §5.9): the canonical spellings are appended after `hint` as a prompt (the total is still ≤ 1200 characters, and what does not fit is dropped). If the model does not accept prompts,
   * the glossary is ignored, and this is explained in `JobRecord.library.glossaryHint`. The version and digest of the entries are frozen at submission.
   */
  glossaries?: { id: Id; version?: number }[];
  /** Legacy form, the same as `provider: 'node:<x>'`: the `nodeId` or alias of the remote node. There is no automatic failover. */
  node?: string;
  /**
   * Replace the transcript (architecture design §6.6, `destination: 'replace'` in the transcription flow): on apply, this `speech` document gets a new version, dependent content is carried over, all in one transaction.
   * Before applying, check that the transcript's full-text fingerprint is still the `fingerprint` from submission. If it does not match, the task fails with `TRANSCRIPT_EDITED`. If not given, a new document is written.
   */
  replace?: TranscriptReplace;
  commandId?: Id;
}

/** Which transcript to replace: its version and full-text fingerprint at submission, and whether its translations are carried over. */
export interface TranscriptReplace {
  documentId: Id;
  /** The transcript's current version at submission (`replaced.previousVersion` in the digest). */
  revision: string;
  /** The transcript's full-text fingerprint at submission (`count:firstId:lastId:hash`, the same format as `stages.asr`). */
  fingerprint: string;
  translations: 'carry' | 'discard';
}

/**
 * The parameters of `models.synthesizeSpeech`: synthesize a piece of text into speech.
 *
 * The Provider and model are chosen in the order of architecture design §6.2 (explicit, then the user's default; this capability has no factory default). If none exists, the call is rejected with
 * `CAPABILITY_NOT_CONFIGURED`. If the text exceeds the model's `maxInputChars`, it is rejected at submission; it is not truncated or split into chunks.
 * When `videoId` is given, the result is imported into that (opened) video as material and is not placed on the timeline. When it is not given, only the artifact is published.
 */
export interface SynthesizeSpeechRequest {
  text: string;
  /**
   * The voice ID. When not given, the model's `defaultVoice` is used (when there is also no `reference` and no `voiceDescription`). `library:<id>` refers to an entry in the voice library. For an online Provider, it uses
   * that entry's valid clone on the Provider; if there is none or it has expired, the call is rejected with `VOICE_CLONE_REQUIRED` (create the clone first). For a local model, the entry's reference recording and its original text are
   * cloned directly (`clone`). Nothing leaves this machine, and no clone has to be created first.
   */
  voice?: string;
  /**
   * The local model's `clone`: a reference recording (an absolute local path) and its original text. Mutually exclusive with `voice` and `voiceDescription`. If the model does not support `clone`, the call is rejected.
   * The digest is read and frozen at submission. If the file changes before execution, the task fails.
   */
  reference?: { file: string; transcript?: string };
  /** The local model's `describe`: one sentence describing the voice. Mutually exclusive with `voice` and `reference`. For models with a closed vocabulary, it is checked against that vocabulary. */
  voiceDescription?: string;
  /** The local model's guidance strength and diffusion steps. Accepted only if the model's `local.knobs` lists them; the ranges are given there. */
  cfg?: number;
  steps?: number;
  provider?: string;
  model?: string;
  /** The language of the text (BCP 47). If the model declares a language list, it is checked against it; if the provider accepts it, it is passed to the provider. */
  language?: string;
  format?: SpeechFormat;
  /** A description of tone and style. Only models with `acceptsInstructions` accept it. */
  instructions?: string;
  speed?: number;
  seed?: number;
  videoId?: Id;
  /** The material name when the video is imported. */
  name?: string;
  /**
   * The save location (architecture design §7.9, “Save location”): an absolute local path. When it is given, after the result is published as an artifact, a copy with a readable name is also written into this directory.
   * The copy is named after the start of the text, cleaned the same way as downloaded file names, and existing files are not overwritten. The path is recorded in `result.outputs[].path`. The directory is created if it does not exist.
   * If it cannot be written, the call is rejected with `OUTPUT_DESTINATION_UNAVAILABLE`. A failed copy does not fail the task; the result carries a `save-copy-failed` warning.
   * When it is not given, no copy is written (model auditions, probes and calls from the editor do not give it). The tool page gives the `saveDirectory` returned by `tools.list`.
   */
  saveDir?: string;
  /**
   * The material (architecture design §7.9, “Space entries as input”): a document (.txt, .md) or subtitle (.srt, .vtt, with timecodes removed) entry in Space. The Runtime reads its text at the method layer and uses it as `text`.
   * When it is given, `text` is passed as an empty string. The entry's rejections are the same as for `SpaceEntryInput`.
   */
  material?: { entryId: Id };
  commandId?: Id;
}

/** The parameters of `models.generateImage`: generate an image from a prompt. The rules for selection, limits and video are the same as for `SynthesizeSpeechRequest`. */
export interface GenerateImageRequest {
  prompt: string;
  /** `WIDTHxHEIGHT` (one of the model's `sizes`) or an aspect ratio `W:H` (one of the model's `aspectRatios`). If not given, `defaultSize` is used. */
  size?: string;
  /** The number of images; default 1, not exceeding the model's `maxCount`. */
  count?: number;
  format?: ImageFormat;
  seed?: number;
  /** The local model's denoising steps. Accepted only if the model's `local.steps` lists them; the range is given there. */
  steps?: number;
  provider?: string;
  model?: string;
  videoId?: Id;
  name?: string;
  /** The save location; the rules are the same as `SynthesizeSpeechRequest.saveDir`. The copy is named after the start of the prompt, and when there are several images, sequence numbers are added. */
  saveDir?: string;
  commandId?: Id;
}

/**
 * The parameters of `models.generateMusic`: generate a piece of music from a style (and lyrics). The rules for selection, limits and video are the same as for `SynthesizeSpeechRequest`. Local Provider only.
 * `mode: 'song'` requires lyrics; `instrumental` does not take lyrics. `maxDurationSec` is the generation budget (not more than the model's `maxDurationSec`). If not given, the model's default budget is used.
 * `targetDurationSec` is only a creative intent for the model and is not guaranteed to be exact. A result that reaches the budget carries an `output-truncated` warning (`JobRecord.warnings`).
 */
export interface GenerateMusicRequest {
  mode: MusicMode;
  style: string;
  lyrics?: string;
  targetDurationSec?: number;
  maxDurationSec?: number;
  planning?: MusicPlanning;
  format?: SpeechFormat;
  seed?: number;
  /** The number of diffusion steps. Accepted only if the model's `local.steps` lists them; the range is given there. */
  steps?: number;
  provider?: string;
  model?: string;
  videoId?: Id;
  name?: string;
  /** The save location; the rules are the same as `SynthesizeSpeechRequest.saveDir`. The copy is named after the start of the style description. */
  saveDir?: string;
  commandId?: Id;
}

/**
 * The parameters of `models.generateText`: one call to a text model, with the result published as an artifact. The rules for selection are the same as for `SynthesizeSpeechRequest` (there is no factory default).
 * Text messages only, with no images and no tools; no video is imported. If `maxOutputTokens` is not given, the model's limit is used. A `temperature` / `seed` / structured output that the model does not accept, a value above the model's limit,
 * and an invalid JSON Schema are all rejected at submission with `invalid-request`.
 */
export interface GenerateTextRequest {
  messages: TextMessage[];
  /** When not given: `{ type: 'text' }`. */
  responseFormat?: TextResponseFormat;
  maxOutputTokens?: number;
  temperature?: number;
  /** When not given, the capability parameter's default is used. If the model does not support that level, the nearest level is substituted; if it cannot be adjusted, it is ignored. All of this is noted in the result. */
  effort?: TextEffort;
  seed?: number;
  provider?: string;
  model?: string;
  /**
   * The save location; the rules are the same as `SynthesizeSpeechRequest.saveDir`. The copy is named after the start of the last user message, and its extension follows `responseFormat` (text `.md`, JSON `.json`).
   * When a copy is written, `result.outputs` has a text artifact item with a `path`.
   */
  saveDir?: string;
  /**
   * The material; the rules are the same as `SynthesizeSpeechRequest.material`: the entry's text is appended after the last user message (a blank line first, then the file name).
   */
  material?: { entryId: Id };
  commandId?: Id;
}

/**
 * A segment already recognized during transcription (architecture design §6.6, “live transcript”). Times are seconds on the transcribed material's own clock (`source-asset`). Even when only one range (`range`) is transcribed, the count starts from 0 of the material.
 * The finished `speech` document is ticks on the same clock; dividing by its `timescale` gives the value here.
 * It has no speakers and no word-level times; those come with the final state. It is a projection of the task event stream, not project content: it is not in the document and not on the undo stack, and it is dropped when the task ends.
 */
export interface JobLiveSegment {
  start: number;
  end: number;
  text: string;
}

export interface JobsSnapshot {
  /** Newest first. */
  jobs: JobRecord[];
  /**
   * All the segments recognized so far by the transcription tasks that are still running, keyed by `jobId`, in arrival order. Omitted when no transcription task is running.
   * A client that subscribes midway (for example, an agent-started transcription that is half done when the editor opens) uses this to fill in the earlier segments, and then follows with `job.segments`.
   */
  liveSegments?: Record<Id, JobLiveSegment[]>;
}

/**
 * `job.updated`: sent on every change of state, phase or progress, carrying the full record. When the record is no longer `running` (a terminal state, or `interrupted` before an automatic crash retry), the client drops this task's live segments.
 * `job.segments`: new segments recognized by a transcription task (not resent with `job.updated`, so that a long video does not resend all the text on every progress update). `from` is the index of the first segment among all the segments of this task
 * (starting from 0; a new attempt that is retried automatically after a crash starts recognition from scratch, so it also starts from 0). The client uses it to de-duplicate: an existing index is replaced with the new content.
 * When `from` is past the number of segments already held (a gap in the middle), the whole message is ignored rather than guessed at, and the next snapshot fills the gap.
 */
export type JobsEvent =
  | { type: 'job.updated'; job: JobRecord }
  | { type: 'job.segments'; jobId: Id; from: number; segments: JobLiveSegment[] };
