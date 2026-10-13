import type { Id } from './domain.ts';
import type { EditResult } from './methods.ts';
import type { Revision } from './video.ts';

/**
 * User library (architecture design §5.9): glossaries, voices and brand assets reused across videos, stored in the Runtime Home. It is read and written only through the Runtime. It is copied when a video uses it, and later changes to or deletions from the library do not affect the video. Each change produces a new revision number (an integer counting up from 1) and a content digest.
 */
export type LibraryName = 'glossaries' | 'voices' | 'brand';

/** A file in the library (a reference recording for a voice, a brand image, video, sticker or font), stored by content digest in the entry's own directory. */
export interface LibraryFile {
  /** `sha256:<hex>`。 */
  sha256: string;
  byteLength: number;
  mediaType: string;
  /** Source file name: the default name when a video is exported or imported. */
  fileName: string;
}

/** Glossary for recognition: the canonical spelling, plus common mis-recognitions. The canonical spelling is passed as a hint to the recognition model if it accepts hints. */
export interface TranscriptionGlossary {
  name: string;
  kind: 'transcription';
  /** Applicable language (BCP 47). Null when unrestricted. */
  language: string | null;
  /** Whether new videos enable it by default. Enabling is up to each video (§14, pending review); this is only a suggestion. */
  defaultEnabled: boolean;
  terms: { canonical: string; misheard: string[] }[];
}

/** Glossary for translation: source term, translation and notes, with a language direction. */
export interface TranslationGlossary {
  name: string;
  kind: 'translation';
  /** Source language. Null when unrestricted. */
  sourceLanguage: string | null;
  targetLanguage: string;
  defaultEnabled: boolean;
  terms: { source: string; target: string; note: string | null }[];
}

export type GlossaryContent = TranscriptionGlossary | TranslationGlossary;

/**
 * Voice consent declaration: the user declares that they have the right to upload this voice to a provider for cloning. Without a declaration, every upload is rejected (`VOICE_CONSENT_REQUIRED`).
 * `declaredAt` is recorded by the Runtime when the declaration takes effect.
 */
export interface VoiceConsent {
  declared: boolean;
  declaredAt: string | null;
  statement: string | null;
}

export interface VoiceContent {
  name: string;
  /** Language of the reference recording (BCP 47). Null when unknown. */
  language: string | null;
  /** Transcript of the reference recording. */
  transcript: string;
  /** `recorded`: recorded in the app. `imported`: from a file. */
  origin: 'recorded' | 'imported';
  consent: VoiceConsent;
  reference: LibraryFile;
}

/**
 * A cloned voice on a provider. It is not part of the versioned content: if the reference recording changes or the entry is deleted, the clone becomes `stale` and is no longer used for synthesis.
 * Created by `library.createVoiceClone` and deleted by `library.removeVoiceClone` (architecture design §5.9).
 */
export interface VoiceClone {
  voiceId: string;
  state: 'valid' | 'stale';
  /** Digest of the reference recording at the time of cloning. */
  referenceHash: string;
  createdAt: string;
}

/**
 * `library.createVoiceClone`: uploads the voice's reference recording to `providerId` to create a clone. It is an ordinary task (`kind: 'voiceClone'`).
 * Returns `conflict` (`VOICE_CLONE_EXISTS`) if a valid clone already exists. An expired clone is deleted remotely after the new one is created.
 */
export interface VoiceCloneCreateParams {
  id: Id;
  providerId: string;
  /** The clone's name on the provider. The voice name is used when none is given. */
  name?: string;
  commandId?: Id;
}

export interface VoiceCloneRemoveParams {
  id: Id;
  providerId: string;
  /** Clears only the local record, without a remote delete request (when the provider has already deleted it, or it is no longer available). The result's `remote` is `skipped`. */
  localOnly?: boolean;
}

export interface VoiceCloneRemoveResult {
  removed: true;
  /** `deleted`: removed remotely. `not-found`: the voice no longer exists remotely. `skipped`: no remote request was made (`localOnly`). */
  remote: 'deleted' | 'not-found' | 'skipped';
}

export type BrandMediaKind = 'image' | 'video' | 'sticker' | 'font';
/** `overlayTemplate` keeps only its kind. `library.put` rejects it with `LIBRARY_KIND_RESERVED` (architecture design §14). */
export type BrandKind = BrandMediaKind | 'color' | 'captionStyle' | 'overlayTemplate';

/**
 * Caption styles accept only forms the format spec already defines: the body of a `caption-style` document, an object with a string `schema` (≤ 64 KiB).
 * The fields are determined by `schema`. The library does not interpret them.
 */
export interface CaptionStyleBody {
  schema: string;
  [key: string]: unknown;
}

export type BrandContent =
  | { name: string; kind: BrandMediaKind; file: LibraryFile }
  /** `#RRGGBB` or `#RRGGBBAA`, uppercase. */
  | { name: string; kind: 'color'; value: string }
  | { name: string; kind: 'captionStyle'; style: CaptionStyleBody };

export interface LibraryContentMap {
  glossaries: GlossaryContent;
  voices: VoiceContent;
  brand: BrandContent;
}

export type LibraryContent = LibraryContentMap[LibraryName];

export interface LibraryEntry<L extends LibraryName = LibraryName> {
  library: L;
  id: Id;
  version: number;
  /** Content digest `sha256:<hex>`: the UTF-8 of canonical JSON (keys sorted). Files take part by their digests. */
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  content: LibraryContentMap[L];
  /** Voices: clones on each provider, keyed by `providerId`. */
  clones?: Record<string, VoiceClone>;
}

/** A row in lists and in topics. */
export interface LibraryEntrySummary {
  library: LibraryName;
  id: Id;
  version: number;
  contentHash: string;
  name: string;
  /** Glossary: `transcription | translation`. Voice: `voice`. Brand library: `BrandKind`. */
  kind: string;
  updatedAt: string;
  /** Glossary: the number of entries and whether it is enabled by default. */
  termCount?: number;
  defaultEnabled?: boolean;
  /** Voice: whether it has a consent declaration, and the status of its clones on each provider. */
  consentDeclared?: boolean;
  clones?: { providerId: string; state: VoiceClone['state'] }[];
}

/** Points to an entry in the library. The current revision is used when no revision is given. */
export interface LibraryEntryRef {
  library: LibraryName;
  id: Id;
  version?: number;
}

/** A frozen entry: a Job and a video source record this copy. */
export interface FrozenLibraryEntry {
  library: LibraryName;
  id: Id;
  version: number;
  contentHash: string;
}

/**
 * Content of `library.put`: for kinds that carry a file, the file is not given here but supplied by `source` (required for new entries; when editing, omitting it keeps the current file).
 * A consent declaration takes only `declared` and `statement`. The time is recorded by the Runtime.
 */
export type LibraryContentInput =
  | GlossaryContent
  | (Omit<VoiceContent, 'reference' | 'consent'> & { consent: { declared: boolean; statement?: string | null } })
  | Exclude<BrandContent, { file: LibraryFile }>
  | { name: string; kind: BrandMediaKind }
  | { name: string; kind: 'overlayTemplate'; [key: string]: unknown };

/** File source: an absolute local path, or an artifact in the artifact store (for example a generated image or a synthesized voice). */
export type LibrarySource = { path: string } | { artifactId: string };

export interface LibraryPutParams {
  library: LibraryName;
  /** Supply when editing an existing entry. Omit it to create a new one. */
  id?: Id;
  /** Optimistic concurrency: returns `conflict` (`LIBRARY_VERSION_CONFLICT`) when it does not match the current revision. */
  expectedVersion?: number;
  content: LibraryContentInput;
  source?: LibrarySource;
  commandId?: Id;
}

/** A file written by one export. */
export interface LibraryExportResult {
  path: string;
  /** `glossary-markdown`, `voice-package`, `library-item` (color and caption-style JSON), or `media` (the file as is). */
  format: 'glossary-markdown' | 'voice-package' | 'library-item' | 'media';
  byteLength: number;
  entry: FrozenLibraryEntry;
}

export interface LibraryApplyParams {
  videoId: Id;
  entry: LibraryEntryRef;
  commandId: Id;
  /** When not given, the commit uses the video's current revision. */
  expectedRevision?: Revision;
  /** Name of the material or style document. The entry name is used when none is given. */
  name?: string;
  /** Caption style: in the same transaction, points the styles of these caption instances at the new document. */
  captionItemIds?: Id[];
  sequenceId?: Id;
}

export interface LibraryApplyResult extends EditResult {
  entry: FrozenLibraryEntry;
  /** Assets imported from images, videos, stickers and fonts. */
  assetId?: Id;
  /** `caption-style` document written from a caption style. */
  documentId?: Id;
}

/**
 * Library entries enabled in a video (architecture design §5.9): which glossaries each step uses, and which voice each speaker uses. The video records this itself, not the library:
 * it is a `library-selection` document in the video (video format spec §4.6), with body `cuccut.library-selection/1`. There is at most one per video.
 * It records entry IDs, not contents. When it is used (on submitting transcription, translation or dubbing), the entry's revision at that time is read and frozen. Without this document, nothing is enabled.
 */
export const LIBRARY_SELECTION_KIND = 'library-selection';
export const LIBRARY_SELECTION_SCHEMA = 'cuccut.library-selection/1';
/** Maximum number of glossaries enabled per step. Maximum number of speaker bindings. */
export const MAX_SELECTED_GLOSSARIES = 20;
export const MAX_SPEAKER_VOICES = 200;

/** A speaker's voice: `documentId` is which transcript (`speech`), and `speakerId` is the speaker's ID in that transcript. */
export interface SpeakerVoiceBinding {
  documentId: Id;
  speakerId: string;
  /** `library:<id>` for a library entry (replaced at synthesis with a valid clone on the chosen provider), or a provider voice ID. */
  voice: string;
  /** A provider voice ID only means something on that provider. When one is given and the dubbing provider chosen is not that provider, this binding is not used. Not given for `library:` voices. */
  providerId?: string;
}

export interface LibrarySelection {
  /** Per step: `transcribe` carries only the transcription glossary, and `translate` only the translation glossary. In order; earlier ones take priority. */
  glossaries: { transcribe: Id[]; translate: Id[] };
  speakerVoices: SpeakerVoiceBinding[];
}

/** Result of `library.getVideoSelection`: when there is no such document, `documentId` and `revision` are null and `selection` is empty. */
export interface VideoLibrarySelection {
  videoId: Id;
  documentId: Id | null;
  revision: Revision | null;
  selection: LibrarySelection;
}

/**
 * `library.setVideoSelection`: an ordinary editing transaction (the operator is identified by the connection that started it, and it can be undone). Fields that are given are replaced as a whole; omitted fields stay as they are.
 * Giving only `transcribe` or `translate` in `glossaries` replaces only that step.
 */
export interface LibrarySetSelectionParams {
  videoId: Id;
  commandId: Id;
  /** When not given, the commit uses the video's current revision. */
  expectedRevision?: Revision;
  glossaries?: { transcribe?: Id[]; translate?: Id[] };
  speakerVoices?: SpeakerVoiceBinding[];
}

export interface LibrarySetSelectionResult extends EditResult {
  documentId: Id;
  selection: LibrarySelection;
}

/** When a recognition glossary enters a transcription task, it is recorded on the Job (`JobRecord.library`). */
export interface TranscribeGlossaryUse {
  /** `sent`: the canonical spellings were put into the prompt. `unsupported`: this model does not accept prompts, so the glossary was ignored. */
  status: 'sent' | 'unsupported';
  /** The number of canonical spellings that entered the prompt, and the number that did not fit under the 1200-character limit. */
  terms: number;
  dropped: number;
}

/** Library entries used by the Job (frozen at submission). */
export interface JobLibraryUse {
  entries: FrozenLibraryEntry[];
  glossaryHint?: TranscribeGlossaryUse;
}

export interface LibrarySnapshot {
  /** Entries from all libraries, sorted by library and then by name. */
  entries: LibraryEntrySummary[];
}

export type LibraryEvent = { type: 'entry.upsert'; entry: LibraryEntrySummary } | { type: 'entry.removed'; library: LibraryName; id: Id };
