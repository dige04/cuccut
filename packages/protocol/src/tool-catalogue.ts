import type { Id } from './domain.ts';
import type { ModelServiceCapability } from './models.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * Tool catalogue (architecture design §7.9; product design §2.7): the product-level catalogue of fixed pipelines and direct tasks. A tool is not a separate execution mechanism. Each tool corresponds to a fixed pipeline (`pipelines.start`) or a kind of directly submitted Job (`models.*`). The catalogue only declares what inputs a tool accepts, what it produces, and what it depends on.
 *
 * - The catalogue is a static registry (`TOOL_CATALOGUE` in `@cuccut/jobs`), plus the Runtime's availability check at this moment (`tools.list`).
 * - Candidate inputs (`tools.candidates`) come from the content index (§5.11) and the Space directory (§5.7), without opening videos.
 */

/**
 * Tool groups (architecture design §7.9, product design §2.7): `speech` for voice and subtitles, `text-image` for text and images, `music` for music, `video-file` for video files. Grouped by what the user wants to do, not by whether the result is written into the video or becomes an artifact (that is each tool's `results`).
 */
export const TOOL_CATEGORIES = ['speech', 'text-image', 'music', 'video-file'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Kinds of input: a local file, a link, a piece of text, a video in Space, or a document. For pipeline tools, a document means a document in the video. For direct tasks, it means a document or subtitle entry in Space, as `material`. */
export const TOOL_INPUT_KINDS = ['file', 'link', 'text', 'video', 'document'] as const;
export type ToolInputKind = (typeof TOOL_INPUT_KINDS)[number];

/** Kinds of result: written into the video (a new script, translation, dubbing group, or a newly created video), or an artifact (a file, generated audio and images). */
export type ToolResultKind = 'video' | 'artifact';

/** Method used by direct Jobs. */
export type ToolJobMethod =
  | 'models.transcribe'
  | 'models.synthesizeSpeech'
  | 'models.generateImage'
  | 'models.generateMusic'
  | 'models.generateText';

/**
 * How it executes:
 * - `pipeline`: `pipelines.start` starts this pipeline. `params` are parameters this tool always carries (for example, the `action` for transcoding); the rest are supplied by the client;
 * - `job`: directly submits one kind of model task.
 */
export type ToolExecution =
  | { kind: 'pipeline'; method: 'pipelines.start'; pipeline: string; params?: Record<string, unknown> }
  | { kind: 'job'; method: ToolJobMethod; capability: ModelServiceCapability };

/**
 * Rules for candidate inputs (`tools.candidates`):
 * - `videos`: all videos except those in the trash (transcription targets, and link imports written into existing videos);
 * - `videos-with-transcript`: videos that have a script. Each video lists its optional scripts (translated subtitles, translated dubbing).
 */
export type ToolCandidateRule = 'videos' | 'videos-with-transcript';

/** One tool in the registry (a static declaration that does not change with Runtime state). */
export interface ToolDefinition {
  /** Stable ID (lowercase letters and hyphens). The UI, the CLI and artifact sources all use it. */
  id: string;
  label: string;
  description: string;
  category: ToolCategory;
  inputs: ToolInputKind[];
  results: ToolResultKind[];
  execution: ToolExecution;
  /**
   * Execution differs by input kind: the same tool is completed by different pipelines for different inputs (for example, translating subtitles: a script in the video goes through `translate`, and a subtitle file goes through `translate-subtitles`). Input kinds not listed use `execution`.
   */
  executionByInput?: Partial<Record<ToolInputKind, ToolExecution>>;
  /** A capability that must be used. */
  capabilities: ModelServiceCapability[];
  /** A capability used only for certain inputs or parameters (for example, text generation when dubbing lacks a translation). The tool still works when it is not configured; `limitations` explains this. */
  optionalCapabilities: ModelServiceCapability[];
  /** Managed external tools (§12.9) that must be used, by tool name. */
  externalTools: string[];
  /** External tools used only for certain inputs (for example, a download tool is needed for link input to transcription). */
  optionalExternalTools: string[];
  /** Whether it downloads from the internet (this is not a model call). `required` must be used; `optional` is used only for link input. Under strict offline mode (`offline.strict`), this is used to decide. */
  network: 'required' | 'optional' | 'none';
  /** Rules for candidate inputs. null for tools that do not accept video input. */
  candidates: ToolCandidateRule | null;
}

/**
 * One reason a tool is unavailable. `code` reuses the existing error codes (command and protocol spec §11.3): `CAPABILITY_NOT_CONFIGURED`, `TOOL_NOT_INSTALLED`, `TOOL_UNAVAILABLE`, `TOOL_OUTDATED`, `TOOL_CONSENT_REQUIRED`, `TOOL_UPDATING`, `OFFLINE_STRICT`. In a browser session, when the method being executed is not on the allowlist, it is `WEB_METHOD_NOT_ALLOWED`.
 */
export interface ToolProblem {
  code: string;
  /** A one-sentence message for people (in the Runtime's language). The UI shows it in its own language using `localizeText(message, messageRef)`. */
  message: string;
  messageRef?: MessageRef;
  /** When a capability is not configured: which capability, with the `reason` for `CAPABILITY_NOT_CONFIGURED`. */
  capability?: ModelServiceCapability;
  reason?: string;
  /** A problem with an external tool: which tool. */
  tool?: string;
  /** How to fix it (a one-sentence message for people). Omitted when there is none. */
  remedy?: string;
  remedyRef?: MessageRef;
}

/** One item of `tools.list`: the declaration plus its current availability. */
export interface ToolStatus extends ToolDefinition {
  /** Can start right now: `problems` is empty. */
  available: boolean;
  /** Reasons it cannot start (required capabilities, external tools, network access). */
  problems: ToolProblem[];
  /** Reasons that do not prevent starting but mean some inputs or parameters cannot be used (optional capabilities or external tools). */
  limitations: ToolProblem[];
}

export interface ToolsListResult {
  tools: ToolStatus[];
  /**
   * Save location (architecture design §7.9, “Save location”): for tools whose results are not attached to a video, the absolute local path where results land (the `downloads.directory` setting; when it is not set, the host's Downloads folder). The tool page shows it, and direct tasks pass it in as `saveDir`. It carries a local path, so the Web service does not provide it.
   */
  saveDirectory?: string;
}

// ---- Video facts from the content index (§5.11): for candidate inputs, without opening the video ----

/** One script (a `speech` document). */
export interface VideoTranscriptFact {
  documentId: Id;
  name: string;
  language: string | null;
  /** Has visible words, and no word has an estimated or missing time (`timingQuality`). */
  wordTiming: boolean;
  /** Content derived by projection on the root sequence (the corresponding material is on the timeline). */
  onTimeline: boolean;
}

/** One translation (a `translation` document). */
export interface VideoTranslationFact {
  documentId: Id;
  name: string;
  /** Target language. */
  language: string | null;
  /** The script it was translated from. null when it cannot be determined. */
  sourceDocumentId: Id | null;
  units: number;
  /**
   * Number of stale units: marked stale, the source sentence no longer exists, the source was changed (fingerprint mismatch), or the translation is empty. A glossary change (`glossary-changed`) requires reading the user's library, which the index does not judge. Dubbing still checks it anyway.
   */
  staleUnits: number;
}

/** A dubbing group: the dubbing plan and instances written by the same dubbing run. */
export interface VideoDubGroupFact {
  groupId: string;
  language: string | null;
  /** Dubbing plan (a `dubbing-plan` document). null when there are only instances. */
  planDocumentId: Id | null;
  /** The translation this dubbing group uses, and the script corresponding to that translation. null when it cannot be determined. */
  translationId: Id | null;
  transcriptId: Id | null;
  /** Number of dubbing instances on the timeline that belong to this group. */
  items: number;
}

// ---- tools.candidates ----

/** Maximum number of videos per page for `tools.candidates`. */
export const TOOL_CANDIDATES_MAX_LIMIT = 500;

export interface ToolCandidatesParams {
  toolId: string;
  /** Only list videos of this project. `null` is a video that belongs to no project. When not given, no project filter is applied. */
  projectId?: Id | null;
  /** `nextCursor` from the previous page's result. */
  cursor?: string;
  /** Default 100, max `TOOL_CANDIDATES_MAX_LIMIT`. */
  limit?: number;
}

/** An optional script in a video, with any existing translations and dubbing groups attached (the tool uses this to show “already has an English translation”). */
export interface ToolCandidateDocument extends VideoTranscriptFact {
  kind: 'speech';
  translations: Array<Pick<VideoTranslationFact, 'documentId' | 'language' | 'units' | 'staleUnits'>>;
  dubs: Array<Pick<VideoDubGroupFact, 'groupId' | 'language' | 'translationId'>>;
}

export interface ToolCandidate {
  entryId: Id;
  /** Not yet indexed, and not recorded in the directory either. null. */
  videoId: Id | null;
  name: string;
  projectId: Id | null;
  lastActivityAt: string;
  /**
   * Whether the index is current. False means: not indexed yet, queued for re-reading (a cache from an old version, or the video was changed), or the read failed. `documents` may then be incomplete. Tools that list only when there is a script still list the video, since it cannot be concluded that there is no script.
   */
  indexed: boolean;
  /** Video version at indexing time. null when not indexed. */
  indexedRevision: string | null;
  /** Optional documents for this tool (`videos-with-transcript` means scripts). Empty for tools using the `videos` rule. */
  documents: ToolCandidateDocument[];
}

export interface ToolCandidatesResult {
  toolId: string;
  /** Sorted from most recent activity to oldest. */
  candidates: ToolCandidate[];
  /** Total number of matching videos (not just this page). */
  total: number;
  nextCursor: string | null;
  /** Same as `space.search`: no videos waiting to be indexed, the first scan has finished, and the index is available. */
  complete: boolean;
  pendingVideos: number;
  scanning: boolean;
}
