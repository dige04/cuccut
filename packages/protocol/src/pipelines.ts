import type { Id } from './domain.ts';

/**
 * Fixed pipeline (architecture design §7.9): multi-step work with fixed steps that needs no model planning, orchestrated by the Runtime. It runs as the principal `system:pipeline` and creates no agent session. A pipeline is one parent Job (`kind: 'pipeline'`), and each step is a child Job of it (`kind: 'pipeline-step'`); status and progress are read through `jobs.*` and the `jobs` topic.
 */

/** One item of `pipelines.list`: the pipeline name, its description, and the JSON Schema of its steps and parameters. */
export interface PipelineInfo {
  name: string;
  label: string;
  description: string;
  steps: Array<{ name: string; label: string; optional: boolean }>;
  /** JSON Schema of the parameters (`params` of `pipelines.start`). */
  paramsSchema: Record<string, unknown>;
}

/**
 * File transcoding (`transcode`): file to file, does not create a video and does not go through the video render pipeline. `compress` compresses each input into its own file; `merge` concatenates them in order into one file: if the encoding parameters of the segments (codec, resolution, frame rate, pixel format, sample rate, channels) all match, streams are copied; otherwise they are re-encoded, and the result explains why.
 */
export interface TranscodeParams {
  /** Absolute paths of the input files, at least one; `merge` needs at least two. */
  inputs: string[];
  /**
   * `compress` compresses each one in turn; `merge` concatenates them into one, in order; `extract-audio` extracts the audio track of each one (drops the picture: AAC, MP3, Opus and FLAC streams are copied into `.m4a`, `.mp3`, `.ogg`, `.flac`; others are re-encoded to AAC `.m4a`; an input with no audio track fails with `TRANSCODE_NO_AUDIO`).
   */
  action: 'compress' | 'merge' | 'extract-audio';
  /** Video codec, default `h264`. */
  codec?: 'h264' | 'hevc';
  /** Upper limit on frame height (pixels); not scaled when omitted. */
  maxHeight?: number;
  /** Constant quality (0–51); pick this or `videoBitrateKbps`. If neither is given, h264 uses 23 and hevc uses 28. */
  crf?: number;
  /** Video bitrate (kbps). */
  videoBitrateKbps?: number;
  /** Audio bitrate (kbps, AAC), default 128. */
  audioBitrateKbps?: number;
  /**
   * Absolute path of the output directory, created if it does not exist; when omitted it is the save location (set `downloads.directory`; defaults to the host's Downloads folder, §7.9). Frozen at submission; a directory that cannot be written to gives `OUTPUT_DESTINATION_UNAVAILABLE`. Existing files are not overwritten; a sequence number is added on name clashes.
   */
  outDir?: string;
}

/**
 * Target of the video tools (architecture design §7.9): `{ videoId }` is an open video; `{ entryId }` is a video entry in the Space and does not need to be open (the pipeline opens it with a Runtime lease and releases it when it ends, is cancelled, or fails); `{ create }` creates a new video in a project's or conversation's directory (only a pipeline that accepts it may give this; any other is rejected with `PIPELINE_TARGET_UNSUPPORTED`). A top-level `videoId` is equivalent to `target: { videoId }`; if both are given, they must refer to the same video.
 */
export type PipelineVideoTarget = { videoId: Id } | { entryId: Id } | { create: PipelineCreateTarget };

/**
 * Where the new video is placed: a project (`projectId`), or a conversation (`conversationId`, placed the same way as the agent's `videos_create`: if the conversation belongs to a project, that project; otherwise the conversation's working directory). Give exactly one of the two.
 */
export type PipelineCreateScope = { projectId: Id; conversationId?: never } | { conversationId: Id; projectId?: never };

/**
 * Target for a new video: where it goes (`PipelineCreateScope`), its name (defaults to the page title or the media's file name), and its media. `media` is the absolute path of a local media file and is only given by a pipeline that accepts it (`transcribe`): it is imported as a linked asset (the file stays where it is) and placed on the timeline. When importing from a link, omit it; the media is the download result.
 */
export type PipelineCreateTarget = PipelineCreateScope & {
  name?: string;
  media?: string;
};

/** Video tool parameters accepted by `pipelines.start`: `videoId` becomes optional, and `target` may also be given (give one of the two; if both, they must refer to the same video). */
export type PipelineTargetParams<P extends { videoId: Id }> = Omit<P, 'videoId'> & { videoId?: Id; target?: PipelineVideoTarget };

/** One glossary entry: the source-language form and its translation, with an optional note. */
export interface GlossaryEntry {
  source: string;
  target: string;
  note?: string;
}

/**
 * Translate (`translate`): one `speech` document in the video → one new `translation` document (video format spec §5.3). The pipeline calls text generation batch by batch. If no text model is configured, `pipelines.start` rejects with `CAPABILITY_NOT_CONFIGURED` and does not hand off to an agent.
 * Each run adds a new translation document and does not replace existing ones, since those may have manual edits (architecture design §10.3).
 *
 * When `translationId` is given, the translation is refreshed in place: only the sentences that are stale or have no translation yet (or the ones named in `sentences`) are retranslated, and written as a new version of the same translation. Other units are kept as they are. Subtitle documents generated from this translation swap only those sentences' caption entries, in the same transaction, and their timing stays as it is.
 */
export interface TranslateParams {
  /** The open video. `pipelines.start` may also take `target` instead (`{ videoId }` or `{ entryId }`, see `PipelineTargetParams`). */
  videoId: Id;
  /** Source `speech` document; when omitted, the only one in the video is used (if there are several, one must be specified). */
  documentId?: Id;
  /** Target language (BCP 47). */
  targetLanguage: string;
  /** Style hint, for example “口语、简洁” (spoken, concise). */
  style?: string;
  /** Glossary: the list passed in at call time. */
  glossary?: GlossaryEntry[];
  /**
   * Translation glossaries from the user's library (up to 20; a version may be specified, otherwise the current version is used). Used together with the glossaries enabled for the video (`library.getVideoSelection`): this one first, then the video's enabled ones. The version is frozen at start and pinned until the pipeline ends. Public-facing clients cannot use it (`LIBRARY_ENTRY_NOT_APPLICABLE`).
   */
  glossaries?: { id: Id; version?: number }[];
  /** Text model; when omitted, the text generation default is used (architecture design §6.2). */
  provider?: string;
  model?: string;
  /** Sentences per batch, default 20. */
  batchSize?: number;
  /**
   * After the translation is written, build a caption layer in the target language. Default false (when omitted this step is `skipped`, the same as when the step is absent). Skipped if the same translation already has a caption layer.
   * The tool entry (`execution.params` of the tool catalog) and the CLI pass `true`; the editor also passes true, so the pipeline builds the caption layer.
   */
  captions?: boolean;
  /** Studio style document for the new captions. Used only when creating a style; when an existing video style is shared, it is kept as is. Can be given only when building the caption layer. */
  captionStyle?: Record<string, unknown>;
  /**
   * Bilingual display for the caption layer (original and translation as two caption tracks, sharing one style). Default false: only the translation is shown, and the paired original-language caption layer is taken off the picture (not deleted).
   * Can only be given with `captions: true`; otherwise `invalid-request`.
   */
  bilingual?: boolean;
  /**
   * Refresh this `translation` document in place (do not add a new one). Its source is its `sourceDocumentId` (must match `documentId` if given), and `targetLanguage` must be the same as its language. Cannot be given together with `captions`, `captionStyle`, or `bilingual` (existing caption layers are updated along with it).
   */
  translationId?: Id;
  /**
   * Sentences to retranslate during an in-place refresh (`s-<first-word ID>`, up to 500). Up-to-date translations are retranslated too if named. When omitted, the sentences marked stale, those whose source was edited, and those with no translation yet are used.
   * Can only be given together with `translationId`.
   */
  sentences?: Id[];
}

/** Glossary used in translation (`TranslateSummary.glossary`, `DubSummary.glossary`). */
export interface TranslateGlossaryUse {
  /** The library glossaries used, with their frozen versions. `origin` is whether the glossary was given at call time (`explicit`) or enabled for the video (`video`). */
  entries: Array<{ id: Id; version: number; contentHash: string; name: string; origin: 'explicit' | 'video' }>;
  /** Enabled for the video but not used this time: removed from the library (`removed`), or the source or target language does not match (`language`). */
  skipped: Array<{ id: Id; reason: 'removed' | 'language' }>;
  /** Number of glossary entries after de-duplication (call-time and library entries combined). */
  terms: number;
  /** Number of batches where relevant glossary terms exceeded the limit and some could not be fitted into the prompt (architecture design §7.9). */
  cappedBatches: number;
}

/** `pipeline.summary` of the parent task when file transcoding completes. */
export interface TranscodeSummary {
  action: 'compress' | 'merge' | 'extract-audio';
  /**
 * Execution mode: stream copy, or re-encode. `compress` always re-encodes. `extract-audio` is decided per input: `stream-copy` if all are stream-copied, and `re-encode` if any one is re-encoded (`reason` states which ones and why).
 */
  mode: 'stream-copy' | 're-encode';
  /** Why re-encoding happened: in `merge`, where segment parameters do not match; in `extract-audio`, which input's audio codec cannot go into a common container. null for stream copy and `compress`. */
  reason: string | null;
  /** Executor: the ffmpeg version and a digest of the actual command's parameters (paths reduced to file names). */
  executor: { tool: 'ffmpeg'; version: string; commands: string[][] };
  /** Absolute paths of the output files, one-to-one with `result.outputs`. */
  files: string[];
}

/** `pipeline.summary` of the parent task when translation completes. */
export interface TranslateSummary {
  videoId: Id;
  /** The newly written `translation` document. */
  documentId: Id;
  /** The version of the `speech` document that was translated. */
  source: { documentId: Id; revision: string };
  targetLanguage: string;
  unitCount: number;
  providerId: string;
  modelId: string;
  /** Glossary used. Absent when none was given at call time and none is enabled for the video. */
  glossary?: TranslateGlossaryUse;
  /** Caption layer in the target language. Old records from before this step existed do not have this field. */
  captions?: PipelineCaptionsSummary;
  /** Present for an in-place refresh (when `translationId` was given): the version written, the units retranslated and removed, and the subtitle documents updated along with it. */
  refresh?: TranslateRefreshSummary;
}

/** Result of refreshing a translation in place (`TranslateSummary.refresh`). */
export interface TranslateRefreshSummary {
  /** Version of the translation document after writing. */
  revision: string;
  /** Retranslated sentences (`s-<first-word ID>`). */
  sentences: Id[];
  /** Translation units removed this time because their source sentence no longer exists. */
  removedUnitIds: Id[];
  /** Subtitle documents (generated from this translation) whose caption entries were swapped. */
  captionDocumentIds: Id[];
  /** The transaction the write was made in; undo it with this (`{ transaction }` for `videos.undo`). */
  transactionId?: Id;
}

/**
 * Caption layers built by the pipeline (`summary.captions` of `transcribe` and `translate`, architecture design §7.9). `status`:
 * `created`: built this time. `existing`: the same script (translation) already has a caption layer, so this step is recorded as `skipped`, and `documentId` is the existing one.
 * `disabled`: parameter `captions: false`. `not-on-timeline`: no clip on the timeline uses this asset, so none was built. `empty`: no caption entries to display.
 */
export interface PipelineCaptionsSummary {
  status: 'created' | 'existing' | 'disabled' | 'not-on-timeline' | 'empty';
  /** Caption document (`caption`); null when none. */
  documentId: Id | null;
  /** Number of caption entries created; null when none were created. */
  cueCount: number | null;
  /** Whether the newly created layer is shown on screen. When this asset already has an original-language caption displayed, the new original-language layer is added disabled. null when none was created. */
  enabled: boolean | null;
  /** Translation: whether it is shown bilingually. */
  bilingual?: boolean;
  /** `created`: the transaction that built the caption layer; undo it with this (`{ transaction }` for `videos.undo`). */
  transactionId?: Id;
}

/**
 * Transcribe (`transcribe`, architecture design §7.9): resolve the target (create a video as needed, import local media and place it on the timeline) → transcribe (submit a `transcribe` Job and wait for it to finish; the Job itself applies the speech document to the video) → build the caption layer. It shares its name with the transcription Job submitted by `models.transcribe`, but they are not the same thing: the pipeline is the parent Job (`kind: 'pipeline'`), and the transcription Job is what one of its steps submits. When the video already has a transcript for this asset, `destination` decides where the result goes: a new video (the default), or switching the transcript (§6.6). One video does not hold two copies.
 */
export interface TranscribeParams {
  /** The open video. `pipelines.start` may also take `target` instead (`{ videoId }`, `{ entryId }`, or `{ create }` with `media`). */
  videoId: Id;
  /**
   * The asset to transcribe. When omitted, it is the only asset on the root sequence's main track (the video track with the smallest `order` that has audio/video clips; the audio track if there is none). If the main track has several assets, reports `TRANSCRIBE_ASSET_AMBIGUOUS` (`details.assetIds`); if the timeline has no audio/video clips, reports `TRANSCRIBE_ASSET_NOT_FOUND`.
   */
  assetId?: Id;
  /** Asserted language (BCP 47); auto-detected when omitted. */
  language?: string;
  /** Transcription provider and model; default when omitted (same as `models.transcribe`). */
  provider?: string;
  model?: string;
  /** Recognition hint (same as `hint` in `models.transcribe`, at most 1200 characters); the transcription glossary enabled for the video is still appended. */
  hint?: string;
  /** Distinguish speakers (same as `diarize` in `models.transcribe`). When omitted, it depends on the model: distinguishes where it can. */
  diarize?: boolean;
  /** Build the caption layer after transcription. Default true; skipped if the same transcript already has a caption layer. */
  captions?: boolean;
  /**
   * Where the result goes when the video already has a transcript for this asset (called `target` in tools and the CLI). `new-video` (default) creates a new video in the same project as the original video (or the conversation's source directory), links the same asset, and writes the transcript into the new video. `replace` switches the transcript (§6.6): one transaction writes a new version of the existing document and carries over translations, captions and dubs. If the video has no transcript for this asset, both write directly into it (`target: 'first'` in the summary). Only for the `{ videoId }` and `{ entryId }` targets.
   */
  destination?: TranscribeDestination;
  /** Name of the new video for `new-video`; when omitted, “<原名> · 重新转录” (“<original name> · re-transcribed”). */
  name?: string;
  /** For `replace`, how translations are carried over per language: `carry` (default) carries them over per video format spec §5.3; `discard` does not (translations stay on the old version, the dub plan is unchanged). */
  translations?: 'carry' | 'discard';
  /**
   * Overrides the manual-edit gate (§6.6). When the full-text fingerprint of the current transcript does not match `stages.asr` (the user edited the source text), `replace` without this is rejected with `TRANSCRIPT_EDITED`. The consent is bound only to the fingerprint at submission: if the transcript is edited again later, the `transcribe` step still fails with that error.
   */
  acceptEdited?: boolean;
  /** Studio style document for the new captions. Used only when creating a style; when an existing video style is shared, it is kept as is. Only when building the caption layer. */
  captionStyle?: Record<string, unknown>;
}

/** Destination of the transcription (`TranscribeParams.destination`). */
export type TranscribeDestination = 'new-video' | 'replace';

/**
 * A Space entry as input (architecture design §7.9, “Space entry as input”): the Runtime resolves it to its file path via the Space directory at the method layer. An entry in the trash gives `SPACE_ENTRY_TRASHED`; an entry with no readable file (the video or its source no longer exists) gives `SPACE_ENTRY_NO_FILE`; a kind that does not fit gives `SPACE_ENTRY_UNSUPPORTED`.
 */
export interface SpaceEntryInput {
  entryId: Id;
}

/**
 * Parameters for `pipelines.start` when submitting `transcode`: each `inputs` item may be a Space entry (video file, final cut, or audio). The Runtime resolves it to a file path at the method layer and freezes it, so the frozen `params` contain only paths.
 */
export type TranscodeStartParams = Omit<TranscodeParams, 'inputs'> & { inputs: Array<string | SpaceEntryInput> };

/** Parameters for `pipelines.start` when submitting `translate-subtitles`: `input` may be a subtitle entry in the Space (.srt, .vtt); the same rules as above apply. */
export type TranslateSubtitlesStartParams = Omit<TranslateSubtitlesParams, 'input'> & { input: string | SpaceEntryInput };

/**
 * Transcription of a file only (`transcribe` pipeline without `videoId` or `target`, architecture design §7.9): transcribes one local media file and writes `<source file name>.txt` and `.srt` to the save location. It creates no video and no caption layer. It does not accept `assetId`, `diarize`, or `captions`.
 */
export interface TranscribeFileParams {
  /** Absolute path of the media file, or a file entry in the Space (audio or video file). */
  file: string | SpaceEntryInput;
  /** Absolute path of the output directory, created if it does not exist; when omitted it is the save location (same as `TranscodeParams.outDir`). */
  outDir?: string;
  language?: string;
  provider?: string;
  model?: string;
  hint?: string;
}

/** `pipeline.summary` of the parent task when file-only transcription completes; `result.outputs` are the written TXT and SRT (with `path`). */
export interface TranscribeFileSummary {
  /** Source file of the transcription. */
  file: string;
  /** Written transcripts: `<source file name>.txt` and `.srt`. On name clashes a sequence number is added to both; nothing is overwritten. */
  files: string[];
  transcribeJobId: Id;
  /** Asserted or detected language; null when none. */
  language: string | null;
  providerId: string;
  modelId: string;
}

/** `pipeline.summary` of the parent task when transcription completes. */
export interface TranscribeSummary {
  videoId: Id;
  /** A new video was created this time (`target.create`). */
  createdVideo: boolean;
  assetId: Id;
  /** The `transcribe` Job submitted by this transcription step. */
  transcribeJobId: Id;
  /** The newly written `speech` document. */
  documentId: Id;
  /** Language of the document (asserted or detected); null when none. */
  language: string | null;
  providerId: string;
  modelId: string;
  /** Destination: `new-video` created a video; `replace` switched the transcript; `first` had no transcript for this asset and wrote directly into it. */
  target: 'new-video' | 'replace' | 'first';
  /** `new-video`: the new video (`videoId` is the same). null for other destinations. */
  newVideo: { videoId: Id; name: string } | null;
  /** `replace`: the previous transcript version and the undoable transaction (`{ transaction }` for `videos.undo`). null for other destinations. */
  replaced: { documentId: Id; previousVersion: string; transactionId: Id | null } | null;
  /** Carry-over of translations per language on `replace` (video format spec §5.3); empty when nothing was carried over. */
  translations: TranscriptCarryTranslation[];
  /** On `replace`, pins re-anchored by time: the counts re-anchored and those that could not be anchored (`orphaned`). null for other destinations. */
  captionPins: { reanchored: number; orphaned: number } | null;
  /** On `replace`, carry-over of dub plans per language (video format spec §7.2); empty when nothing was carried over. */
  dubs: TranscriptCarryDub[];
  /** Number of speakers distinguished in the new transcript (0 if not distinguished); null when the transcript summary cannot be read. */
  speakerCount: number | null;
  captions: PipelineCaptionsSummary;
}

/** Carry-over of one language's translation when the transcript is switched: sentences kept (of which reviewed), stale ones, and new sentences that could not be matched (also counted as stale). */
export interface TranscriptCarryTranslation {
  language: string;
  /** Translation document (a new version of the same document). */
  documentId: Id;
  kept: number;
  keptReviewed: number;
  stale: number;
  unmatched: number;
}

/** Carry-over of one language's dub plan when the transcript is switched: units kept and units stale. */
export interface TranscriptCarryDub {
  language: string;
  /** Dub plan document (a new version of the same document). */
  documentId: Id;
  kept: number;
  stale: number;
}

/** Effects of the transaction that switched the transcript (`translations`, `captionPins`, `dubs` in the summary; also recorded in the transcript's `extensions['cuccut.transcriptSwitch']`). */
export interface TranscriptSwitchImpact {
  translations: TranscriptCarryTranslation[];
  captionPins: { reanchored: number; orphaned: number };
  dubs: TranscriptCarryDub[];
}

/** Browsers the download tool can read cookies from (values for yt-dlp `--cookies-from-browser`). */
export const LINK_COOKIE_BROWSERS = ['chrome', 'edge', 'firefox', 'safari', 'brave', 'chromium', 'opera', 'vivaldi', 'whale'] as const;
export type LinkCookieBrowser = (typeof LINK_COOKIE_BROWSERS)[number];

/**
 * Import from a link (`link-import`, architecture design §7.9): uses the managed download tool (yt-dlp, §12.9) to download a video page's media into a directory, optionally imports one video (`target`: an existing one, or a new one placed on the timeline), and then submits a transcription. The download tool must be installed and the user must have consented; otherwise `pipelines.start` rejects with `conflict` (`TOOL_NOT_INSTALLED` / `TOOL_CONSENT_REQUIRED`).
 *
 * Download location: the `downloads.directory` setting if set; otherwise `~/Downloads` on the host that runs the download.
 * Without a video target, the transcription TXT and SRT are written to the same download directory as the video. The optional projectId only decides which project owns the transcription result; it does not change the file path. Frozen at submission.
 */
export interface LinkImportParams {
  /** Link to the video page. Only `http(s)://` is accepted; local, link-local and private network addresses are not. */
  url: string;
  projectId?: Id;
  conversationId?: Id;
  /** Import this open video after download (a linked asset; the file stays in the download directory). Equivalent to `target: { videoId }`. */
  videoId?: Id;
  /**
   * Import target (see `PipelineVideoTarget`). `create` makes a new video in the project's or conversation's source directory (without `media`, since the media is the download result; the name defaults to the page title). After import it is placed on the main track, starting at 0, covering the whole media. If `projectId` and `conversationId` are both given, they must match it.
   * With no target, it only downloads: `result.outputs[0].artifactId` is the content digest of the downloaded file, and the agent can later import the video by it.
   */
  target?: PipelineVideoTarget;
  /** Download audio only. */
  audioOnly?: boolean;
  /**
   * Which browsers' logins this download explicitly uses (no duplicates, in order of attempt). When omitted or empty, the download is anonymous. When resolving the link, they are tried one at a time in order: if a browser's cookies cannot be read, or the site still requires login, the next one is tried; other failures (network, disk, unsupported, outdated tool) do not move on. The browser that was used is recorded in the result's `cookieBrowser`, and the download reuses it. Cookie contents are not stored.
   */
  cookieBrowsers?: LinkCookieBrowser[];
  /** Legacy form: use only one browser, equivalent to `cookieBrowsers: [it]`. Cannot be given together with `cookieBrowsers`. */
  cookieBrowser?: LinkCookieBrowser;
  /** Subtitle languages to download alongside (e.g. `en`, `zh-Hans`); when omitted, no subtitles are downloaded. Subtitles are saved as files next to the media and are not imported into the video. */
  subtitleLanguages?: string[];
  /** Transcribe after download. Without a video target, outputs a standalone transcript and SRT, and creates no new video. */
  transcribe?: boolean;
  /** Asserted language of the transcription (BCP 47); auto-detected when omitted. Only given together with `transcribe`. */
  language?: string;
  /** Transcription provider and model; default when omitted (same as `TranscribeParams`). Only given together with `transcribe`. */
  provider?: string;
  model?: string;
  /** Recognition hint (same as `TranscribeParams.hint`, at most 1200 characters). Only given together with `transcribe`. */
  hint?: string;
  /** Distinguish speakers (same as `TranscribeParams.diarize`). Only given together with `transcribe` and a video target (standalone transcripts are not diarized). */
  diarize?: boolean;
  /**
   * Build the caption layer after transcription (same step as `TranscribeParams.captions`). Default false: `download` only transcribes; `transcribe` turns it on when a link is given.
   * Only given together with `transcribe` and a video target.
   */
  captions?: boolean;
  /**
   * Where the files go. `downloads` (default) is the download directory (set `downloads.directory`, otherwise the host's Downloads folder). `project` is the `downloads/` folder inside the project it belongs to (`projectId`, the project of the imported or new video). If the conversation does not belong to a project, or there is no ownership, the download directory is still used.
   */
  saveTo?: 'downloads' | 'project';
}

/** `pipeline.summary` of the parent task when the import from link completes. */
export interface LinkImportSummary {
  /** The link after redaction (rules in architecture design §7.9). */
  url: string;
  /** Parsed metadata (from the download tool; some fields may be missing). */
  title: string | null;
  platform: string | null;
  uploader: string | null;
  durationSec: number | null;
  /** Video description, truncated to 1200 characters (the full text is in the source's `source.description`, up to 20000); null when none. Earlier versions do not have this field. */
  description?: string | null;
  /** Number of structured chapters (`chapters[]`) given by the platform; 0 when none. Timestamp outlines in the description are not counted. Earlier versions do not have this field. */
  sourceChapters?: number;
  /** Files downloaded (absolute paths): the media and the subtitles. */
  files: { media: string; subtitles: string[] };
  tool: { name: string; version: string; source: string };
  /** Browser cookies actually used; null for anonymous downloads. Earlier versions do not have this field. */
  cookieBrowser?: LinkCookieBrowser | null;
  downloadedAt: string;
  /** Imported video and assets; null when nothing was imported. */
  videoId: Id | null;
  assetId: Id | null;
  /** Whether the video was newly created this time (`target.create`). Earlier versions do not have this field. */
  createdVideo?: boolean;
  /** The transcription Job submitted; null when there was no transcription. */
  transcribeJobId: Id | null;
  /** Transcription files written without a video target (TXT, SRT). */
  transcriptFiles?: string[];
  /** The transcript written into the video; absent when nothing was transcribed into a video. Earlier versions do not have this field. */
  documentId?: Id | null;
  /** Caption layer (when `captions` is on); absent when it is off. */
  captions?: PipelineCaptionsSummary;
}

/** How the original sound is handled for the translated dub: ducked while the dub plays (`duck`, default), muted (`mute`), or left alone (`keep`). */
export type DubOriginalAudio = 'duck' | 'mute' | 'keep';

/**
 * Translated dub (`dub`, architecture design §7.9): if translations are missing, translate first (same implementation as `translate`) → check the current versions of the translation and the source → optional separation of vocals and background (skipped when not configured) → synthesize sentence by sentence → time alignment → apply as one dub group in one editing transaction (video format spec §7.2).
 * A dub that is already given (an existing dub track in the video) is not automatically turned into speech synthesis. Each run adds a new dub group and does not replace existing ones.
 */
export interface DubParams {
  /** The open video. `pipelines.start` may also take `target` instead (`{ videoId }` or `{ entryId }`, see `PipelineTargetParams`). */
  videoId: Id;
  /** Source `speech` document; when omitted, the only one in the video is used. When `translationId` is given, the source of that translation is used. */
  documentId?: Id;
  /** Target language (BCP 47). Can be omitted when `translationId` is given (the translation's language is used); if given, it must match the translation. */
  targetLanguage?: string;
  /** Existing `translation` document; when omitted, it is translated first (a new translation document is added). */
  translationId?: Id;
  /**
   * Voice: a preset voice of the model, a voice ID in the account, or `library:<id>` from the user's library (requires a valid clone on this provider). When omitted, the model's default voice is used.
   * When the video binds a voice to a speaker (`speakerVoices` of `library.setVideoSelection`), that speaker's sentences use the bound voice; the value here is used only for speakers without a binding.
   */
  voice?: string;
  /** Provider and model for speech synthesis; when omitted, the speech synthesis default is used (architecture design §6.2). */
  provider?: string;
  model?: string;
  /** Text model, style hint, glossary and batch size for translation when translations are missing (same as `translate`). */
  textProvider?: string;
  textModel?: string;
  style?: string;
  glossary?: GlossaryEntry[];
  glossaries?: { id: Id; version?: number }[];
  batchSize?: number;
  /** How the original sound is handled. Default `duck`. */
  originalAudio?: DubOriginalAudio;
  /** How many dB to duck by when `duck` (1–60, default 18). */
  duckDb?: number;
  /** Separate the original audio into vocals and background first (`separateAudio`). When no separation capability is configured, this step is skipped (`skipped`) and reported honestly. */
  separateBackground?: boolean;
  /**
   * Per-sentence redub: re-synthesizes only these sentences of an existing dub group and writes back to that same group (a new version of the same dub track and dub plan). It does not create a new group or touch other sentences.
   * Translation, language, provider, model and voice are taken from that group's dub plan, so `translationId`, `targetLanguage`, `documentId`, `voice`, `provider`, `model`, the translation parameters and the original-sound handling cannot be given together with it (`invalid-request`). See `DubRegroup`.
   */
  regroup?: DubRegroup;
}

/** Result on the timeline for one sentence: `fit` placed as is; `tempo` placed after speeding up; `extended` sped up to the limit and occupies the silence after it; `overlong` does not fit (not placed). */
export type DubFitStatus = 'fit' | 'tempo' | 'extended' | 'overlong';

/** `pipeline.summary` of the parent task when dubbing completes. */
export interface DubSummary {
  videoId: Id;
  language: string;
  /** The translation used: an existing one, or one newly written by this run (`created: true`). */
  translation: { documentId: Id; revision: string; created: boolean };
  /** Newly written dub plan (`dubbing-plan`), dub track, and the ID of this dub group (`extensions['cuccut.dub'].groupId` on the instance). */
  planDocumentId: Id;
  trackId: Id;
  groupId: string;
  units: {
    /** Number of sentences in the translation. */
    total: number;
    /** Number of sentences placed on the timeline. */
    placed: number;
    /** Number of sentences not synthesized because their translation is outdated (the source was edited or the translation is marked `stale`). */
    stale: number;
    /** Number of sentences not placed because the original sentence is no longer on the timeline (cut entirely). */
    offTimeline: number;
    tempo: number;
    extended: number;
    overlong: number;
    /** Number of sentences not synthesized because the speaker's bound voice is unavailable (clone expired or missing, consent declaration withdrawn, or deleted from the library). */
    voiceUnavailable: number;
  };
  /** Stale sentences (translation unit IDs). */
  staleUnits: Id[];
  /** Sentences whose voice is unavailable and that were not synthesized: which speaker, which bound voice, and why (an error code, or a reason such as `stale` or `missing`). */
  voiceUnavailableUnits: Array<{ unitId: Id; speakerId: string; voice: string; code: string; reason: string }>;
  /** Voice used for each speaker: `video` is the binding in the video, `params` is the `voice` parameter, `default` is the model's default voice; `available: false` when unavailable. */
  speakers: Array<{ speakerId: string | null; voice: string; voiceSource: DubVoiceSource; available: boolean; units: number }>;
  /** Sentences that do not fit: how many seconds they exceed the start of the next sentence. */
  overlongUnits: Array<{ unitId: Id; overflowSeconds: number }>;
  synthesis: {
    providerId: string;
    modelId: string;
    voice: string;
    /** Number of synthesis calls, resends and failures; `reused` is the number of sentences that reused earlier synthesis results on retry. */
    calls: number;
    retries: number;
    failures: number;
    reused: number;
  };
  originalAudio: DubOriginalAudio;
  /** Vocal and background separation: completed, not requested, or requested but not configured (skipped). */
  separation: 'completed' | 'not-requested' | 'not-configured';
  /** Glossary used for this translation (when translations were missing and translated first). */
  glossary?: TranslateGlossaryUse;
  /** For sentence-level redub (`params.regroup`): the result per sentence. Absent when there was no redub. */
  regroup?: DubRegroupSummary;
}

/**
 * Parameters for sentence-level redub (`DubParams.regroup`).
 *
 * - `groupId`: an existing dub group (`extensions['cuccut.dub'].groupId` on the instance, `summary.groupId` of the dub plan).
 * - `units`: translation unit IDs to redub (1–200, no duplicates); all must be in this group's plan and translation.
 * - `seed`: synthesis seed. `'new'` (default) picks one at random at submission; a number is used as given (integer 0–4294967295). When the model does not accept a seed, `'new'` is recorded as `null`, and a number is rejected with `invalid-request`.
 */
export interface DubRegroup {
  groupId: string;
  units: Id[];
  seed?: 'new' | number;
}

/** The frozen sentence-level redub (`pipeline.params.regroup` of the parent task): the interface uses it to know which sentences of which group are being redubbed. */
export interface FrozenDubRegroup {
  groupId: string;
  units: Id[];
  /** The dub plan and dub track of this group. */
  planDocumentId: Id;
  trackId: Id;
  /** Seed actually used; `null` when the model does not accept a seed. */
  seed: number | null;
}

/**
 * Result per sentence of a sentence-level redub: `replaced`: the new version is placed on the timeline and becomes current; `overlong`: synthesized but does not fit, so the old version is kept; `stale`: the translation is outdated, not synthesized; `voice-unavailable`: the voice is unavailable, not synthesized; `off-timeline`: the original sentence is not on the timeline.
 */
export type DubRegroupUnitStatus = 'replaced' | 'overlong' | 'stale' | 'voice-unavailable' | 'off-timeline';

export interface DubRegroupSummary {
  seed: number | null;
  units: Array<{ unitId: Id; status: DubRegroupUnitStatus; take: number | null; seed: number | null }>;
}

/**
 * One take of a sentence in the dub plan (`units[].extensions['cuccut.dub'].takes[]`, appended by sentence-level redub). The current take is the `take` in the same place; the instance's `extensions['cuccut.dub']` also records `take` and `seed`. Switching takes is one edit: delete this sentence's instance, put that take's asset back in place, and write a new version of the dub plan (with `take` changed to that take).
 */
export interface DubPlanTake {
  /** Take number, starting from 1. */
  k: number;
  seed: number | null;
  /** Audio asset placed on the timeline (after speed change); the asset's `provenance.source.artifactId` is the same. */
  artifactId: string | null;
  /** Asset of this take (recorded when known; for the current take, the instance is authoritative). */
  assetRef?: { id: Id; revision: string };
  samples: number | null;
  sampleRate: number | null;
  fit: Exclude<DubFitStatus, 'overlong'> | null;
  tempo: number | null;
  /** When this take was not placed on the timeline: how many seconds it exceeds the available space. */
  overflowSeconds?: number;
  /** Translation used for the synthesis. */
  text: string | null;
  /** The pipeline (parent task) that produced this take; take 1 backfilled for old plans is that dubbing run. */
  jobId: Id | null;
  at: string | null;
}

/** Where a sentence's voice comes from: the speaker binding in the video, the pipeline's `voice` parameter, or the model's default voice. */
export type DubVoiceSource = 'video' | 'params' | 'default';

/**
 * Translation of a subtitle file (`translate-subtitles`, architecture design §7.9): one SRT or WebVTT file → a translated subtitle file with the same number of entries and the same timecodes.
 * File to file; does not touch the video. The pipeline calls text generation batch by batch. If no text model is configured, it rejects with `CAPABILITY_NOT_CONFIGURED` and does not hand off to an agent.
 * Files that cannot be read correctly are rejected at start (`SUBTITLE_FILE_INVALID`, `SUBTITLE_FILE_TOO_LARGE`), and no task is created. Subtitle text is authorized as `transcript` data.
 */
export interface TranslateSubtitlesParams {
  /** Absolute path of the subtitle file (`.srt` or `.vtt`; no more than 4 MiB or 10000 entries). */
  input: string;
  /** Target language (BCP 47). */
  targetLanguage: string;
  /** Source language (BCP 47); when omitted, the model decides. Used in the prompt and to match the language of glossaries in the library. */
  sourceLanguage?: string;
  style?: string;
  glossary?: GlossaryEntry[];
  /** Translation glossaries from the user's library (same as `TranslateParams.glossaries`; with no video, the video's enabled glossaries cannot be merged in). */
  glossaries?: { id: Id; version?: number }[];
  provider?: string;
  model?: string;
  /** Entries per batch, default 20. */
  batchSize?: number;
  /** Output format; when omitted, the same as the input. */
  format?: 'srt' | 'vtt';
  /** Bilingual: each original entry above its translation. Default false (translation only). */
  bilingual?: boolean;
  /**
   * Absolute path of the output directory, created if it does not exist; when omitted it is the save location (same as `TranscodeParams.outDir`). File name: `<original name>.<target language>[.bilingual].<format>`. On name clashes a sequence number is added; nothing is overwritten.
   */
  outDir?: string;
}

/** `pipeline.summary` of the parent task when subtitle file translation completes. */
export interface TranslateSubtitlesSummary {
  /** Absolute path, format and content digest of the source file. */
  source: { path: string; format: 'srt' | 'vtt'; contentHash: string };
  /** Absolute path of the output file (same as `result.outputs[0].path`). */
  file: string;
  format: 'srt' | 'vtt';
  bilingual: boolean;
  targetLanguage: string;
  sourceLanguage: string | null;
  /** Number of subtitle entries (the same for input and output), of which this many were sent for translation (entries with empty text are kept as they are). */
  cueCount: number;
  translatedCount: number;
  /** Number of entries whose source has inline markup (`<i>`, `{\an8}`, VTT `<c>`, etc.); this markup is stripped from the output. */
  markupStripped: number;
  /** Number of cue settings dropped when converting VTT to SRT, and the number of NOTE, STYLE and REGION blocks. */
  droppedSettings: number;
  droppedBlocks: number;
  providerId: string;
  modelId: string;
  glossary?: TranslateGlossaryUse;
}

/**
 * Identify speakers (`speakers`, architecture design §6.6): re-distinguish speakers by voiceprint for a transcript already in the video, without re-transcribing. The local speaker-diarization model bundle (“说话人区分”, speaker diarization) does the work. The result is first made into a proposal (`SpeakersSummary`) and does not change the video. Once the user confirms, it is applied with `edits.applySpeakers` as one undoable edit.
 * When that model bundle is not properly installed, it rejects with `conflict` (`MODEL_UNAVAILABLE`; `details.bundle` is its status).
 */
export interface SpeakersParams {
  videoId: Id;
  /** `speech` document to diarize; can be omitted when the video has only one. */
  documentId?: Id;
}

/** A preview clip in the proposal: one sentence from this speaker. `start` and `end` are asset time ticks at the transcript body's `timescale`. */
export interface SpeakerClip {
  sentenceId: Id;
  start: number;
  end: number;
  text: string;
}

/** One speaker in the proposal, as it will look after applying. Existing speakers keep their ID and name; new ones are `spk-<n>`, “说话人 n” (Speaker n). */
export interface ProposedSpeaker {
  id: Id;
  name: string;
  /** A speaker that was not in the transcript before. */
  isNew: boolean;
  words: number;
  /** Total duration of this speaker's words, in seconds. */
  seconds: number;
  sentences: number;
  clips: SpeakerClip[];
}

/** `pipeline.summary` of the parent task when speaker identification completes: a proposal, not yet applied. */
export interface SpeakersSummary {
  videoId: Id;
  /** The `speech` document and version that were diarized; the transcript must still be this version when applied. */
  source: { documentId: Id; revision: string };
  /** `timescale` of the transcript body (the tick scale for preview clips). */
  timescale: number;
  /** In order of first appearance in the transcript. */
  speakers: ProposedSpeaker[];
  /** Number of words whose speaker changed; 0 means the same as now, and applying only changes the name. */
  relabeled: number;
  /** Number of translation entries re-cut to the new speaker boundaries when applied (summed across languages). They are not retranslated. */
  translationsSplit: number;
  /** Translation documents not in the current format; they are not re-cut when applied (their sentences will not line up, so they are marked stale). */
  skippedTranslations: number;
  /** Output of the proposal (`edits.applySpeakers` reads it). */
  proposalArtifactId: Id;
  /** The local model bundle used for diarization, and the time the diarization took (milliseconds). */
  bundleId: string;
  diarizeMs: number;
}

/**
 * `edits.applySpeakers`: applies the speaker-identification proposal to the video (one editing transaction, undone by `edits.undo`). `names` are the names edited on the confirmation page (speaker ID → name); those not given use the name from the proposal. If the transcript or its translations were edited after identification, it rejects with `conflict` (`STALE_JOB_INPUT`): identify again.
 */
export interface ApplySpeakersParams {
  videoId: Id;
  /** Parent task of the speaker identification. */
  jobId: Id;
  names?: Record<Id, string>;
  commandId: Id;
}

/**
 * AI tool “direct model call” (`ai-tool`, product design §5.10): without going through a conversation, it hands the prompt and this video's context (transcript, chapters, attachments) directly to a text model. The attached skill serves as the system prompt, carrying only `SKILL.md` and the `references/` files it uses. `polish` and `chapters` are written into the video as soon as they complete (one undoable transaction). The results of other tools are for reading, picking from, or copying, and are not written into the video (`AiToolSummary.text`).
 * If no text model is configured, `pipelines.start` rejects with `CAPABILITY_NOT_CONFIGURED` and does not hand off to an agent.
 */
export const AI_TOOL_PIPELINE = 'ai-tool';

/** Tools that call the model directly. Retranscribing, finding speech to cut, retranslating stale sentences, and making covers are not among them (product design §5.10). */
export const AI_TOOL_KINDS = ['polish', 'chapters', 'summary', 'blog', 'title', 'desc'] as const;
export type AiToolKind = (typeof AI_TOOL_KINDS)[number];

/** Tools whose results are written into the video on completion; the rest only return results. */
export const AI_TOOL_APPLY_KINDS: readonly AiToolKind[] = ['polish', 'chapters'];

/** Upper limit of the prompt, in characters. */
export const AI_TOOL_PROMPT_MAX = 20_000;

export interface AiToolParams {
  videoId: Id;
  tool: AiToolKind;
  /** The text in the prompt box on the tool page, as sent verbatim. */
  prompt: string;
  /** Range: a segment of the timeline (seconds, same as `ExportRange`); when omitted, the whole timeline. `chapters` always covers the whole thing and does not accept a range. */
  range?: { start: number; end: number };
  /** Which `speech` document to use; can be omitted when the video has only one. */
  documentId?: Id;
  /** Attachments in the prompt box (registered by `attachments.prepare`): text files are attached in full; images and other files are not sent, only counted in the summary. */
  attachments?: Id[];
  /** Attached skills, in the order attached; duplicates count only once. */
  skills?: { id: string }[];
  /** Text model; when omitted, the text generation default is used (architecture design §6.2). */
  provider?: string;
  model?: string;
  /** The user's UI language (BCP 47, e.g. `zh-Hans`, `en`), written into the system prompt; not written when omitted. */
  uiLanguage?: string;
}

/** Context sent to the model (`AiToolSummary.context`, same as the “sent to the model” line on the tool page). */
export interface AiToolContext {
  /** Number of segments and words in the transcript (letter-based text counted by word, Chinese and Japanese by character); 0 when there is no transcript. */
  paragraphs: number;
  characters: number;
  /** Number of chapters the video already has (given with the transcript). */
  chapters: number;
  /** Number of attachments included in full, and number not sent (images and non-text files). */
  attachments: number;
  skippedAttachments: number;
  /** Skills used as the system prompt, and the number of `references/` files taken along with them. */
  skills: string[];
  references: number;
}

/** `pipeline.summary` of the parent task when `ai-tool` completes. */
export interface AiToolSummary {
  videoId: Id;
  tool: AiToolKind;
  providerId: string;
  modelId: string;
  context: AiToolContext;
  /** The transaction written into the video, and how many places changed (polish: number of words whose text changed; chapters: number of chapters written). null for tools that only return results. */
  applied: { transactionId: Id | null; changes: number } | null;
  /** For tools that only return results: the body text written by the model (Markdown). null for tools that write into the video. */
  text: string | null;
  /** The model's output artifact (verbatim). */
  artifactId: Id;
  /** The model's stop reason: `length` means the output reached the limit and may be incomplete. */
  finishReason: 'stop' | 'length';
}
