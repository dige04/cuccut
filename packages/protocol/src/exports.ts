import type { Id } from './domain.ts';
import type { JobWarning } from './jobs.ts';
import type { DocumentRecord, Sequence } from './video.ts';

/**
 * Export (architecture design §9.11, §9.13): freeze → preflight → generate in staging → verify → publish atomically. One export is one Job
 * (`kind: 'export'`). `exports.create` returns a `jobId` immediately; progress and results arrive through the `jobs` topic; cancel with `jobs.cancel`.
 *
 * Delivers captions, transcripts, audio, the finished video (`video`), the portable package (`portable`, video format spec §8), and the project (`project`, an exchange file for other editing software).
 */

export type ExportKind = 'subtitles' | 'transcript' | 'audio' | 'video' | 'project' | 'portable';

/** The kinds implemented in this version. */
export const SUPPORTED_EXPORT_KINDS = ['subtitles', 'transcript', 'audio', 'video', 'portable', 'project'] as const;

/** Captions: SRT, VTT, ASS (basic style mapping), and JSON with word timings. */
export type SubtitleExportFormat = 'srt' | 'vtt' | 'ass' | 'json';
/** Transcripts: Markdown, plain text, and JSON with word timings. */
export type TranscriptExportFormat = 'md' | 'txt' | 'json';
export type AudioExportFormat = 'wav' | 'mp3' | 'm4a';
/** Finished video: MP4 (H.264 or HEVC, AAC audio) and WebM (VP9, Opus audio). */
export type VideoExportFormat = 'mp4' | 'webm';
export type VideoExportCodec = 'h264' | 'hevc' | 'vp9';

/** Maximum width of one line (default): measured in display width, where full-width characters (CJK text and full-width punctuation) count as 2 and everything else as 1. */
export const EXPORT_MAX_CHARS_PER_LINE = 42;
/** Maximum number of lines per caption; when it does not fit, it is split into several captions. */
export const EXPORT_MAX_LINES_PER_CUE = 2;
/** Maximum length in seconds of a caption made of words; longer captions are split between words. */
export const EXPORT_MAX_CUE_SECONDS = 7;
/**
 * Transcript segmentation (the editor's transcript panel and the transcript export share the same logic): break at a paragraph start, at a speaker change, or at a pause of `pauseSec` or more;
 * also break when the sentence end is reached and the segment is long enough (`maxWidth` characters), or when the pause is somewhat long (`sentencePauseSec`) and the segment is not too short (`minWidth` characters). Width is estimated by character count.
 */
export const TRANSCRIPT_PARAGRAPH = { pauseSec: 2, sentencePauseSec: 0.6, minWidth: 60, maxWidth: 240 } as const;

/** A `[start, end)` span of sequence time, in seconds. */
export interface ExportRange {
  start: number;
  end: number;
}

/** Ranges and sequences: without `range` / `ranges` the whole sequence is exported; each segment in `ranges` produces its own file (several outputs of the same export Job). */
export interface ExportScope {
  /** When not given, the video's main sequence is used. */
  sequenceId?: Id;
  range?: ExportRange;
  ranges?: ExportRange[];
}

/** Options for captions and transcripts. */
export interface TextExportOptions {
  /**
   * Primary document: `speech` (transcription) or `caption` (captions). When not given, the following are tried in order: the document shown by the enabled caption instance in the sequence, the only `speech` document
   * (when `language` is given, only documents in that language are considered). If it still cannot be determined, reject with `EXPORT_SOURCE_AMBIGUOUS`; `details.candidates` lists the candidates (both displayed captions and transcriptions are listed).
   */
  documentId?: Id;
  /** Used to pick a document only when `documentId` is not given (BCP 47). */
  language?: string;
  /**
   * Bilingual merge: when `true`, take the translation of the primary document (a `translation` document, with `sourceDocumentId` pointing to the primary document; when there are several, `language`
   * or an explicit `documentId` is required). Alternatively, give another document directly (a translation, or a caption or transcription in another language). Reject when no other usable document is available.
   */
  bilingual?: boolean | { documentId?: Id; language?: string };
  /** Maximum width of one line; defaults to `EXPORT_MAX_CHARS_PER_LINE`. */
  maxCharsPerLine?: number;
  /** In transcripts (Markdown, plain text), write the start time of each paragraph at its end (`[mm:ss]`, or `[hh:mm:ss]` past one hour). Off by default. */
  timestamps?: boolean;
  /** Project only through these instances (documents with the source material's clock). When not given, use caption instances first, then instances of the source material referenced by the document. */
  scopeItemIds?: Id[];
}

/**
 * Options specific to transcripts (command and protocol spec §4.4). The defaults keep the result the agent and CLI produced before: no front-matter header and no chapter subheadings, speakers written, cut portions skipped.
 */
export interface TranscriptExportOptions {
  /**
   * Front matter for Markdown (YAML, between `---` lines): title, description, source, author, published, platform, duration, language,
   * translation, followed by speakers in the body and a chapter table. Fields that are missing are not written. Plain text and JSON do not write it. Default false.
   */
  frontmatter?: boolean;
  /** Chapter subheadings: the `kind: 'chapter'` marker on the sequence, written before the first paragraph of that chapter (chapters with no paragraphs are not written). Default false. */
  chapters?: boolean;
  /** Speakers: when a segment has a speaker, every segment writes it (Markdown `**name:**`, plain text `name: `; the JSON `speaker` field). Default true. */
  speakers?: boolean;
  /**
   * Skip the cut portions, default true: the body comes from the timeline projection, so cut words do not appear, and the times are timeline times. When false, the document's original text is taken without the projection
   * (hidden words are still not written), and the times are the document's clock (source-material time). When a range is given, take the original text between the first and last word that this range projects onto.
   */
  skipCut?: boolean;
}

/**
 * Target for loudness normalization (the master of architecture design §9.13): alternate three rounds of BS.1770 integrated-loudness normalization and true-peak limiting, then a static fallback by true peak;
 * the measured values and the applied gain are written into the verification result. Integrated loudness is in [−70, 0] LUFS, and the true-peak ceiling is in [−20, 0] dBTP.
 */
export interface LoudnessTarget {
  /** Integrated loudness, in LUFS. */
  integratedLufs: number;
  /** True-peak ceiling, in dBTP. */
  truePeakDb: number;
}

/**
 * A time point in a transcript (rounded down to the second): `mm:ss` under one hour, `hh:mm:ss` at one hour or more (hours padded to two digits). The exported transcript's end-of-segment timestamps, chapters,
 * the duration and chapter table in the front matter, and the editor transcript panel's copy and quote all use it.
 */
export function transcriptStamp(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(total % 60)}` : `${pad(m)}:${pad(total % 60)}`;
}

/** Text in a Markdown transcript (body, speaker, chapter name): escape Markdown marker characters. The exported transcript and the editor transcript panel's copy use the same format. */
export function transcriptMarkdownText(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, '\\$1');
}

/** Whitespace (including newlines) collapses to one space: transcript subheadings and front-matter values each take only one line. */
export function transcriptOneLine(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Which languages the captions burned into the finished video's picture use (the default filename suffix for the finished video, command and protocol spec §4): the caption track of an enabled caption instance is rendered into the picture this time
 * (visible; on tracks with a visual group, only the discrete GPU's member counts when the discrete GPU is in use). Take the languages of their caption documents. Sort top to bottom along the timeline and de-duplicate; documents with no language written are not counted.
 * The export panel's expected filename and the Runtime's default naming read the same source.
 */
export function burnedCaptionLanguages(sequence: Pick<Sequence, 'tracks' | 'items'>, documents: Readonly<Record<Id, Pick<DocumentRecord, 'language'>>>): string[] {
  const visualSolo = sequence.tracks.some((t) => t.solo.enabled && t.solo.group === 'visual');
  const languages: string[] = [];
  const tracks = sequence.tracks
    .filter((t) => t.kind === 'subtitle' && t.visible && (!visualSolo || (t.solo.enabled && t.solo.group === 'visual')))
    .sort((a, b) => b.order - a.order);
  for (const track of tracks) {
    for (const item of sequence.items) {
      if (item.trackId !== track.id || !item.enabled || item.type !== 'caption') continue;
      const language = documents[item.documentId]?.language;
      if (language && !languages.includes(language)) languages.push(language);
    }
  }
  return languages;
}

export const DEFAULT_LOUDNESS_TARGET: Required<LoudnessTarget> = { integratedLufs: -16, truePeakDb: -1.2 };

export interface AudioExportOptions {
  /** Default 48000. */
  sampleRate?: number;
  /** Default 2. */
  channels?: 1 | 2;
  /** Bitrate for MP3 and M4A, default 192; not accepted for WAV. */
  bitrateKbps?: number;
  /** Loudness normalization; off by default, so the audio is exported as mixed in the video. */
  loudness?: LoudnessTarget | null;
}

/**
 * The audio source for audio export (architecture design §9.13): `mix` (default) is the timeline mix; `original` takes only the original sound: all dubbing is removed (instances with the `cuccut.dub`
 * marker, including the separated background), the original sound muted by dubbing is restored, and the ducking triggered by dubbing goes away with it; `{ dubGroupId }` takes only that one dubbing group
 * (the instance's `extensions['cuccut.dub'].groupId`), with the original sound, music and other dubbing all left out. Used for `kind: 'audio'` and `kind: 'video'`:
 * it changes only the sound plan of this one export (the finished video's picture is not affected), and does not change the video.
 */
export type AudioExportSource = 'mix' | 'original' | { dubGroupId: string };

/**
 * Parameters for the finished video (architecture design §9.13). The picture is drawn frame by frame by native composition from the frame plan (the same plan as the preview), and the sound is the audio export's mix.
 * Content that cannot be drawn (code packages with no pre-rendered stand-in, built-in generators that exist only as preview implementations, effects and transitions that are not recognized, media whose picture cannot be decoded, ...)
 * is listed item by item at submission: by default it is rejected with `EXPORT_UNSUPPORTED_CONTENT` (`details.items`); with `onUnsupported: 'skip'` those items are skipped
 * (the whole layer is not drawn, the effect is skipped, transitions become hard cuts), and each item records one task warning.
 */
export interface VideoExportOptions {
  /** MP4 defaults to `h264`, with `hevc` as an option; WebM only has `vp9`. Rejected with `EXPORT_TOOL_MISSING` when the local ffmpeg lacks the corresponding encoder. */
  codec?: VideoExportCodec;
  /**
   * Output width (pixels). When only the width is given, the height follows the canvas aspect ratio. When both `height` and width are given, the output is exactly this size: the picture is scaled to the largest size that fits, keeping the canvas aspect ratio (centered), with black bars for the rest; the layout is not reflowed to the output's aspect ratio. Both width and height are rounded to even numbers (a requirement of yuv420p); a warning is recorded when an adjustment is made.
   */
  width?: number;
  /** Output height (pixels); when only the height is given, the width follows the canvas aspect ratio. Both width and height are rounded to even numbers; a warning is recorded when an adjustment is made. When neither is given, the canvas size is used. */
  height?: number;
  /** Output frame rate; defaults to the sequence frame rate. When they differ, the picture is taken at the exact times of the output frames (architecture design §9.10). */
  fps?: { num: number; den: number };
  /** Constant quality (H.264 / HEVC 0–51, VP9 0–63; defaults 20 / 23 / 32). Only one of this and `bitrateKbps` may be given. */
  crf?: number;
  /** Target video bitrate (kbps). */
  bitrateKbps?: number;
  /** Draw the timeline's captions into the picture; default `true`. Affects only this export. */
  burnCaptions?: boolean;
  /** Content that cannot be drawn: `fail` (default) rejects it; `skip` skips it and warns item by item. */
  onUnsupported?: 'fail' | 'skip';
  /** Sound: the same parameters as audio export (bitrate defaults to MP4 192, WebM 128 kbps). */
  audio?: AudioExportOptions;
}

/**
 * Portable package (architecture design §5.8, video format spec §8): a single `.cuccut` file containing a snapshot of the video, the body of every document version, and the bytes of every media version
 * (linked media is included as well), together with the length and sha256 of each file. It carries no local paths, keys, authorizations, task records, or sessions.
 */
export interface PortableExportOptions {
  /**
   * Media versions that cannot be read (file missing, no longer the content recorded when registered, relative path escapes the project): `fail` (default) rejects each item at submission;
   * `skip` does not include it in the package, honestly marks it `missing` in the manifest, and when the package is opened, those are missing linked media in the resulting video.
   */
  missingAssets?: 'fail' | 'skip';
}

/**
 * Format of the project export (architecture design §9.13): `xmeml` is Final Cut Pro 7 XML (xmeml v5), which Premiere Pro and DaVinci Resolve can import.
 * Media is written by reference (absolute local paths); objects that cannot be expressed are written item by item into the task warnings.
 */
export type ProjectExportFormat = 'xmeml';

/**
 * `preview` is a file for the agent's internal checks: it is not delivered as a session output and does not enter the Space. When no directory is given, it is written to `.cuccut-out/exports/` under the source directory.
 * When omitted, it is treated as `deliverable`.
 */
export type ExportPurpose = 'deliverable' | 'preview';

export type ExportSettings = { purpose?: ExportPurpose } & (
  | ({ kind: 'subtitles'; format: SubtitleExportFormat } & ExportScope & TextExportOptions)
  | ({ kind: 'transcript'; format: TranscriptExportFormat } & ExportScope & TextExportOptions & TranscriptExportOptions)
  | ({ kind: 'audio'; format: AudioExportFormat; source?: AudioExportSource } & ExportScope & AudioExportOptions)
  | ({ kind: 'video'; format: VideoExportFormat; source?: AudioExportSource } & ExportScope & VideoExportOptions)
  | ({ kind: 'portable'; format?: 'cuccut' } & PortableExportOptions)
  | { kind: 'project'; format: ProjectExportFormat; sequenceId?: Id }
);

/**
 * The output location. When `dir` is not given, it is `exports/` under the video's source directory (the project directory; for a video outside a project, the parent of the video directory), and `preview` uses
 * `.cuccut-out/exports/`.
 * A given `dir` must be an absolute path that already exists and is writable. The default filename is "video name.kind suffix.extension" (the suffix for the finished video is the language of the captions burned into the picture;
 * when there are none, no suffix is added, see `burnedCaptionLanguages`). On a name clash, a sequence number is added.
 * When `fileName` is given and the file already exists, it is rejected with `EXPORT_DESTINATION_EXISTS` unless `overwrite` is set.
 */
export interface ExportDestination {
  dir?: string;
  /** Only usable when a single file is produced; no directory included. The correct extension is appended if the given one is wrong. */
  fileName?: string;
  overwrite?: boolean;
}

export interface ExportCreateRequest {
  videoId: Id;
  settings: ExportSettings;
  destination?: ExportDestination;
  commandId?: Id;
}

/** Settings for captions and transcripts: `exports.renderText` accepts only these two kinds. */
export type TextExportSettings = Extract<ExportSettings, { kind: 'subtitles' | 'transcript' }>;

/**
 * `exports.renderText`: writes no file and creates no task; it renders the text with the same freezing, preflight, and writing as `exports.create` (the preview on the transcript page of the export panel and "copy text").
 * The text obtained is byte-for-byte identical to the file exported with the same settings.
 */
export interface ExportRenderTextRequest {
  videoId: Id;
  settings: TextExportSettings;
}

/** One rendered result: with several ranges, one per range, matching the exported files one to one. */
export interface RenderedTextOutput {
  /** The expected filename under the default destination (on a name clash, the actual export will add a sequence number). */
  fileName: string;
  format: SubtitleExportFormat | TranscriptExportFormat;
  mediaType: string;
  content: string;
  /** Count of items: captions are entries, JSON is sentences, Markdown and plain text are paragraphs. */
  entries: number;
  /** End time of the last item (seconds, relative to the range start). */
  durationSec: number;
  /** Counts of Latin words and Han characters in the body of the primary document (excluding headings, speakers, timecodes, and translations), for showing the length in the UI. */
  words: number;
  cjkCharacters: number;
}

export interface ExportRenderTextResult {
  outputs: RenderedTextOutput[];
  /** Same warnings as the export task; with several ranges, `segmentId` is the filename of that segment. */
  warnings: JobWarning[];
}

/** A frozen media version: location and fingerprint. Linked media is checked against its content digest once before preflight and once before execution. */
export interface ExportAssetVersion {
  assetId: Id;
  revision: string;
  name: string;
  storage: 'managed' | 'linked';
  path: string;
  contentHash: string;
  byteLength: number;
}

/**
 * The local font faces frozen for the finished video (the "fonts" in architecture design §9.11): apart from the fonts shipped with the render kernel, the font family name, weight, and italic style named by the typesetting of the finished video.
 * The one face found on this machine at freeze time: the file it is in, its index within the file, and the digest and byte count of the whole file (checked against these at execution; if it has changed, it fails with `FONT_MISSING`). A face that cannot be found is recorded as `fallback` (rendered with the fallback font, and the result carries a hint).
 *
 * On-demand fonts (§9.1): at freeze time, a face already in the download cache is still recorded as a file (`source: 'downloaded'`). A face present in the font directory but not yet downloaded is recorded as `download`, and it is downloaded before rendering begins (progress and cancellation follow the export task). A downloaded face is frozen into this render in the same way. When the download fails or is not attempted (automatic download is off, or strictly offline), it is recorded as `fallback: 'not-downloaded'`, rendered with the fallback font, with the warning `FONT_NOT_DOWNLOADED` explaining the reason.
 */
export type ExportFontFace = { family: string; weight: number; italic: boolean } & (
  | { path: string; faceIndex: number; contentHash: string; byteLength: number; source?: 'local' | 'downloaded' }
  | { fallback: 'not-found' | 'too-large' | 'not-downloaded' }
  | { download: 'google-fonts' }
);

/** A frozen document version. */
export interface ExportDocumentVersion {
  documentId: Id;
  revision: string;
  kind: string;
  language: string | null;
  schema: string;
}

/**
 * The freeze at export start (architecture design §9.11): later edits do not affect this export. It is stored as a JSON artifact (`JobRecord.export.snapshotArtifactId`).
 * `parts` is the plan the engine derived for this one video version (one per output range: either the audio's interval plan, or the document's projection onto the timeline).
 */
export interface ExportSnapshot {
  schema: 'cuccut.export-snapshot/1';
  videoId: Id;
  videoName: string;
  videoRevision: string;
  sequenceId: Id;
  sequenceRevision: string;
  settings: ExportSettings;
  assets: ExportAssetVersion[];
  /** Finished video: the local fonts used (other kinds of export have none). */
  fonts?: ExportFontFace[];
  documents: ExportDocumentVersion[];
  /** One per output: the range (seconds), the target filename, and the plan given by the engine. */
  parts: Array<{ range: ExportRange; fileName: string; plan: unknown }>;
  /** Finished video: the part of the video (sequence and media records) that the Render Worker needs to derive the plan frame by frame, and the body of the caption documents to be drawn. */
  render?: { document: unknown; documents: unknown[] };
  output: { dir: string; overwrite: boolean };
  frozenAt: string;
}

/** Export information in the public record. */
export interface ExportJobInfo {
  settings: ExportSettings;
  snapshotArtifactId: string;
  videoRevision: string;
  sequenceId: Id;
  /** The target directory and the filename of each output (on a name clash at publish, a sequence number is added; the actual path is `result.outputs[].path`). */
  destination: { dir: string; files: string[]; overwrite: boolean };
}

/** Verification of one output before publishing: the parsed result must match the count and duration; audio and finished video are read by ffprobe. A package has no duration, so its three duration fields are 0. */
export interface ExportValidation {
  /** The checks performed (all must pass before publishing). */
  checks: string[];
  expectedDurationSec: number;
  durationSec: number;
  toleranceSec: number;
  expectedEntries?: number;
  entries?: number;
  /** Finished video: expected and read frame count, dimensions, frame rate (`num/den`), and streams. */
  video?: {
    expectedFrames: number;
    frames: number;
    width: number;
    height: number;
    fps: string;
    streams: string[];
  };
  /** Portable package: the number of files and total bytes, re-read from the written archive before publishing and checked against the manifest's length and sha256. */
  package?: { files: number; verifiedFiles: number; bytes: number };
  /**
   * Loudness normalization: target, measurement, and applied static gain. `measured.inputLufs` is the integrated loudness before mastering; `integratedLufs` and `truePeakDb`
   * are after mastering; `gainDb` is the sum of the static gains from each loudness normalization round (limiting is counted separately).
   */
  loudness?: {
    target: Required<LoudnessTarget>;
    measured: { inputLufs: number; integratedLufs: number; truePeakDb: number };
    gainDb: number;
  };
}

// ---- Portable package (video format spec §8) ----

export const PACKAGE_FORMAT = 'cuccut.package';
/** The package version this version writes and can read. A higher version is rejected with `PACKAGE_VERSION_UNSUPPORTED`. */
export const PACKAGE_VERSION = 1;
export const PACKAGE_EXTENSION = 'cuccut';
export const PACKAGE_MANIFEST_FILE = 'video.manifest.json';

/** A media version or document version in the manifest. */
export interface PackageEntry {
  ref: { id: Id; revision: string };
  kind: 'asset' | 'document';
  /** The relative path inside the package; entries not included in the package have none. */
  path?: string;
  contentHash: string;
  byteLength: number;
  /** `included` means it was packed; `missing` means it could not be read at export (`missingAssets: 'skip'`). `linked` and `excluded-license` are reserved for future linked-style packages. */
  inclusion: 'included' | 'linked' | 'missing' | 'excluded-license';
  note?: string;
}

/** A file inside the package (the manifest itself excluded): path, length, and sha256. Checked file by file on open; extra or missing files are both rejected. */
export interface PackageFile {
  path: string;
  byteLength: number;
  sha256: string;
}

/** `video.manifest.json` (video format spec §8.1). */
export interface PackageManifest {
  format: typeof PACKAGE_FORMAT;
  packageVersion: number;
  videoSchemaVersion: number;
  timeContractVersion: number;
  /** The video's identity and version at export time. Opening the package yields a new video, with a new videoId. */
  videoId: Id;
  videoName: string;
  videoRevision: string;
  createdAt: string;
  entries: PackageEntry[];
  files: PackageFile[];
}
