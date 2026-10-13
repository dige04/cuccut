/**
 * The TS side of `bindings/editor-wasm` (architecture design §1.4, §13.1, §13.6): the domain rules that the UI and Node need are called here from the single Rust implementation; TS does not reimplement them.
 * - Sentences of the transcript body and the source fingerprint (core of subtitles and translation): translation flow, translation checking, dubbing staleness checks, the content index (Node), and sentence-by-sentence alignment in the UI (browser);
 * - Stage boxes (`item_box` from `render-graph`): swapping `place` and canvas pixel boxes, default placement by kind, same implementation as the frame plan layers;
 * - Value ranges and defaults used by engine validation (effects, ducking, volume, keyframes, animation): the UI's number inputs are capped by them;
 * - Speakers recognized in an existing transcript (architecture design §6.6): voiceprint separation results become a proposal, applied after confirmation (speaker application in the subtitle and translation core);
 * - Chapters from the source (architecture design §3.5, §7.9): the platform's `chapters[]`, timestamped outlines in the description, or explicit outlines, snapped to transcript paragraph and sentence starts.
 *
 * Instantiation is synchronous (WASM is under 1 MB, and the browser main thread's synchronous compile limit is 8 MB), so callers can call it directly during rendering.
 * How the bytes are loaded differs by environment: `node.ts` reads from a file, `browser.ts` inlines via Vite; both export the same set of functions.
 */

export const SENTENCE_DERIVATION = 'speech-doc/sentences';

/** A sentence of the source text. `start` / `end` are the start of the first word and the end of the last word, as integer ticks at the transcript body's `timescale`. */
export interface SourceSentence {
  /** `s-<first word ID>`. */
  id: string;
  /** Visible words in the sentence, in word order; hidden words are not included. */
  wordIds: string[];
  text: string;
  /** The core's content fingerprint: `<word count>:<first word ID>:<last word ID>:<FNV-1a in base 36>`. */
  fingerprint: string;
  /** The speaker of the first word; omitted if none. Not included in the fingerprint. */
  speaker?: string;
  start: number;
  end: number;
}

/** All sentences of a transcript. */
export interface SpeechSentences {
  derivation: typeof SENTENCE_DERIVATION;
  /** The transcript body's `timescale` (defaults to 1 000 000 if absent). */
  timescale: number;
  /** Derivation rules and a digest of all sentence IDs and fingerprints (`sourceBasis.editViewHash`). */
  editViewHash: string;
  /**
   * The full-text content fingerprint (the core's `fingerprint`, covering all words including hidden ones): same scheme as `stages.asr` in the body; if they differ, someone edited the source after transcription (video format spec §5.5).
   */
  contentFingerprint: string;
  sentences: SourceSentence[];
}

/** Instance fields needed for box pushing (extra fields are ignored; draft layers before creation also work). */
export interface StageItem {
  type: string;
  place?: object;
  mode?: string;
  shape?: object;
  sticker?: object;
  crop?: object;
}

/** Assets referenced by the instance (compositions are prerendered): the parts box pushing needs, namely kind and that version's video info. */
export interface StageAsset {
  kind: string;
  video?: { displayWidth: number; displayHeight: number; pixelAspectRatio: { num: number; den: number } };
}

export interface StageCanvas {
  width: number;
  height: number;
}

/** Box: center, unrotated width and height (canvas pixels, top-left origin), clockwise rotation around the center (degrees). */
export interface StagePose {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}

export interface StageBox extends StagePose {
  flipX: boolean;
  flipY: boolean;
  /** Fills the canvas: the box ignores `place` position and size and can only rotate. */
  fullscreen: boolean;
}

/** Fields written back to `place`: only those that differ from the current value after rounding (percentages and angles to one decimal, `scaleY` to three). */
export interface PlaceChange {
  x?: number;
  y?: number;
  w?: number;
  scaleY?: number;
  rot?: number;
}

/** Default placement by kind: center (percent of frame) and box width (percent of the width basis). */
export interface PlaceDefault {
  x: number;
  y: number;
  w: number;
}

/** Inclusive range `[min, max]`. */
export type Range = readonly [number, number];

/** Value ranges and defaults used by engine validation (common slider ranges, step sizes and readout multipliers are UI design and are not here). */
export interface EngineRanges {
  fx: {
    /** `grayscale`、`sharpen`、`noise`、`vignette`、`effectIntensity`。 */
    amount: Range;
    /** `brightness`、`contrast`、`exposure`、`hue`、`saturation`。 */
    adjust: Range;
    temperature: Range;
    /** Pixels at a 540 short side. */
    blur: Range;
    shadowBlur: Range;
    shadowOpacity: Range;
    /** The lower bound excludes 0. */
    strokeWidthMax: number;
  };
  ducking: { depth: Range; time: Range; defaults: { depth: number; attack: number; release: number } };
  /** Instance volume and volume envelope (linear multipliers). */
  volume: Range;
  keyframes: { maxPerProp: number; opacity: Range; volume: Range; percent: Range };
  animation: { duration: Range; period: Range; intensity: Range };
  confetti: {
    maxColors: number;
    /** 12 unit shapes (order of the properties page). */
    shapes: readonly string[];
    size: Range;
    speed: Range;
    gravity: Range;
    drift: Range;
    spin: Range;
    /** px/s² at a reference 540 short side. */
    wind: Range;
    opacity: Range;
    rate: Range;
    count: Range;
    interval: Range;
    angle: Range;
    spread: Range;
    /** `origin.x` and `origin.y` (% within the box). */
    origin: Range;
  };
}

/** One style of progress bar: `bar` uses the whole box, `square` takes the inscribed square within the box, `frame` is a border covering the full frame. */
export interface ProgressPreset {
  id: string;
  aspect: 'bar' | 'square' | 'frame';
  mainColor: string;
  secondaryColor: string;
  /** Number of color palettes on the properties page (0–2). */
  numColors: number;
}

/** One style of waveform: styles where `hasControl` is false read the time domain; the dB window, smoothing and gain have no effect on them. */
export interface VisualizerPreset {
  id: string;
  aspect: 'free' | 'square';
  mainColor: string;
  secondaryColor: string;
  minDb: number;
  maxDb: number;
  hasControl: boolean;
  numColors: number;
}

/** One style of confetti: palette, shape mix and default emission parameters. Emitter position is % within the box; `angle` is in screen coordinates (90 downward, −90 upward). */
export interface ConfettiPreset {
  id: string;
  colors: readonly string[];
  shapes: readonly string[];
  /** Adaptation source (`library/part`). */
  sources: readonly string[];
  hasEmitterControl: boolean;
  emit: { mode: 'continuous' | 'burst'; rate: number; count: number; interval: number };
  emitters: readonly { x: number; y: number; angle?: number }[];
  angle: number;
  spread: number;
}

/** Element style catalog (catalog order), read with the same built-in recipes used for rendering. */
export interface ElementPresets {
  progress: readonly ProgressPreset[];
  visualizer: readonly VisualizerPreset[];
  /** Old waveform style id → current catalog style. */
  visualizerAliases: Readonly<Record<string, string>>;
  confetti: readonly ConfettiPreset[];
}

/** An audition clip: one sentence from this speaker; `start` / `end` are ticks at the transcript body's `timescale`. */
export interface SpeakerClip {
  sentenceId: string;
  start: number;
  end: number;
  text: string;
}

/** A speaker in the proposal (as it will look after applying). */
export interface ProposedSpeaker {
  id: string;
  name: string;
  /** A speaker that was not in the transcript before. */
  isNew: boolean;
  words: number;
  /** Total duration of this speaker's words (seconds). */
  seconds: number;
  sentences: number;
  clips: SpeakerClip[];
}

/** A speaker-recognition proposal: a trial computation of applying it. */
export interface SpeakerProposal {
  /** Speaker reassignments for words: word ID → speaker ID (only changed ones listed). */
  wordSpeakers: Record<string, string>;
  /** In the order of first appearance in the body. */
  speakers: ProposedSpeaker[];
  /** Number of words whose speaker changed; 0 means same as now. */
  relabeled: number;
  /** Number of translation entries (summed across languages) that will be re-cut at the new boundaries; not re-translated. */
  translationsSplit: number;
}

/** Result of applying: the new transcript body and the translation bodies that changed. */
export interface AppliedSpeakers {
  speech: Record<string, unknown>;
  /** One-to-one with the input translation bodies: changed ones are the whole new body; unchanged ones are null. */
  translations: Array<(Record<string, unknown> & { language: string }) | null>;
  relabeled: number;
  translationsSplit: number;
  sentencesSplit: number;
  /** Content dropped because the v3 format cannot hold it (normally empty). */
  dropped: string[];
}

/** A chapter from the source (the author's original time, source-time seconds, not snapped). Outlines parsed from the description have no `end`. */
export interface SourceChapter {
  start: number;
  end?: number;
  title: string;
}

/** Snap result: exactly one candidate in the same-second window (`matched`), multiple same-level candidates (`ambiguous`, defaults to the nearest), a paragraph or sentence start in the widened window (`snapped`), or no structural start nearby (`unanchored`, original time kept). */
export type SourceChapterStatus = 'matched' | 'ambiguous' | 'snapped' | 'unanchored';

/** Positions in the transcript usable as chapter starts: paragraph > sentence > cue > word. `time` is source-time seconds; `snippet` is a few words from that point. */
export interface SourceChapterAnchor {
  tier: 'paragraph' | 'sentence' | 'cue' | 'word';
  id: string;
  time: number;
  snippet: string;
}

/** A snap of one source chapter. */
export interface SourceChapterEntry {
  source: { start: number; title: string };
  status: SourceChapterStatus;
  /** The start point after snapping (source-time seconds); the author's original time when `unanchored`. */
  at: number;
  /** The selected anchor; absent when `unanchored`. */
  anchor?: SourceChapterAnchor;
  /** Candidates sorted by time; multiple when `ambiguous`. */
  candidates: SourceChapterAnchor[];
}

/** A cleaned chapter (source-time seconds): drops empty titles, sorts by start, deduplicates same starts, clamps the first chapter to 0, drops non-strictly-increasing ones; `end` is the next chapter's start, and the last chapter ends at the material's duration. */
export interface SourceChapterRow {
  title: string;
  start: number;
  end: number;
  status: SourceChapterStatus;
}

/** Input for `sourceChapters`. All times are source (material) times. */
export interface SourceChaptersInput {
  /** The material's transcript body (`cuccut.speech/1`); omitted if there is no transcript or `snap: false`, in which case all entries keep their original times. */
  speech?: unknown;
  /** The material's source metadata (`provenance.source`): reads `chapters[]` first (`start_time | start`, `end_time | end`, `title`), and parses `description` only if absent. */
  source?: unknown;
  /** Explicit outline, takes precedence over `source`: `[{ at, title }]` (seconds), or raw text (parsed as a timestamped outline, at least two entries). */
  outline?: ReadonlyArray<{ at: number; title: string }> | string;
  /** Material duration (seconds): the end of the last chapter. */
  durationSeconds: number;
  /** Default true; false means parse only, no snapping. */
  snap?: boolean;
}

/** Parsing and snapping of source chapters. With no source chapters, `sourceChapters` and `rows` are empty (no error). */
export interface SourceChaptersResult {
  sourceChapters: SourceChapter[];
  entries: SourceChapterEntry[];
  rows: SourceChapterRow[];
  summary: { entries: number; matched: number; ambiguous: number; snapped: number; unanchored: number };
}

/** Input rejected by WASM: `INVALID_SPEECH` (transcript body not in valid format), `INVALID_INPUT` (input not in the agreed shape), `INVALID_PROPOSAL` (speaker proposal doesn't match the body). */
export class EditorWasmError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EditorWasmError';
    this.code = code;
  }
}

/** WASM not built yet (run `npm run build:wasm` first). With a `code`: when a flow step fails because of it, the error code and description are passed through as-is to the task record. */
export class EditorWasmUnavailable extends Error {
  readonly code = 'EDITOR_WASM_UNAVAILABLE';
  constructor(detail: string) {
    super(`The editor semantics WASM is unavailable. Run npm run build:wasm first (${detail})`);
    this.name = 'EditorWasmUnavailable';
  }
}

/**
 * Module-level constants computed by WASM (value ranges, element recipes, and the catalog built from them): computed on first read. Loading the module doesn't touch WASM, so the UI still loads without a build; reading these constants throws `EditorWasmUnavailable`; if computation fails, the next read tries again.
 * The proxy's target is the object or array that holds the result; once computed, the whole thing is filled in, and later reads land on it.
 */
export function lazyObject<T extends object>(init: () => T): T {
  return filledOnFirstRead({} as T, init, (target, value) => Object.assign(target, value));
}

/** Same as `lazyObject`, but the result is an array (`Array.isArray`, spreading and array methods work as usual). */
export function lazyArray<T>(init: () => readonly T[]): readonly T[] {
  return filledOnFirstRead([] as T[], init, (target, value) => target.push(...value));
}

function filledOnFirstRead<C extends object, V>(target: C, init: () => V, fill: (target: C, value: V) => void): C {
  let filled = false;
  const ready = (): C => {
    if (!filled) {
      fill(target, init());
      filled = true;
    }
    return target;
  };
  return new Proxy(target, {
    get: (_, key, receiver) => Reflect.get(ready(), key, receiver),
    has: (_, key) => Reflect.has(ready(), key),
    ownKeys: () => Reflect.ownKeys(ready()),
    getOwnPropertyDescriptor: (_, key) => Reflect.getOwnPropertyDescriptor(ready(), key),
  });
}

interface Exports {
  memory: WebAssembly.Memory;
  bc_alloc(len: number): number;
  bc_free(ptr: number, len: number): void;
  bc_speech_sentences(ptr: number, len: number): number;
  bc_stage_box(ptr: number, len: number): number;
  bc_stage_place(ptr: number, len: number): number;
  bc_place_default(ptr: number, len: number): number;
  bc_engine_ranges(ptr: number, len: number): number;
  bc_element_presets(ptr: number, len: number): number;
  bc_speaker_proposal(ptr: number, len: number): number;
  bc_apply_speakers(ptr: number, len: number): number;
  bc_source_chapters(ptr: number, len: number): number;
  bc_output_ptr(): number;
  bc_output_len(): number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class EditorSemantics {
  private readonly exports: Exports;

  private constructor(exports: Exports) {
    this.exports = exports;
  }

  /** Compile and instantiate synchronously. */
  static instantiate(bytes: Uint8Array<ArrayBuffer>): EditorSemantics {
    const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {});
    return new EditorSemantics(instance.exports as unknown as Exports);
  }

  /**
   * Sentences of the transcript body (`cuccut.speech/1`): split at sentence-ending punctuation, pauses of at least 1.8 seconds, speaker changes, 80 words within a sentence, and segment and chapter boundaries; `sentences` stored in the body are not used. Throws `EditorWasmError` if the body is malformed, a word lacks source time, or a speaker is invalid.
   */
  speechSentences(body: unknown): SpeechSentences {
    return this.call('bc_speech_sentences', body);
  }

  /** The instance's box on the canvas (the frame plan draws from it). */
  stageBox(item: StageItem, canvas: StageCanvas, asset?: StageAsset): StageBox {
    return this.call('bc_stage_box', { item, asset, canvas });
  }

  /**
   * Box → `place` (the inverse of `stageBox`): `scale` is left alone, box width is folded into `w`, box height is written to `scaleY` (the ratio of the natural height inferred from the saved width); for a full-canvas item only the angle is written. If nothing changed, returns an empty object.
   */
  stagePlace(item: StageItem, pose: StagePose, canvas: StageCanvas, asset?: StageAsset): PlaceChange {
    return this.call('bc_stage_place', { item, asset, canvas, pose });
  }

  /** Default placement by kind: where the box lands when no `place` field is written at all. */
  placeDefault(type: string): PlaceDefault {
    return this.call('bc_place_default', { type });
  }

  /** Value ranges and defaults used by engine validation (a constant table, read once). */
  engineRanges(): EngineRanges {
    return (this.ranges ??= this.call<EngineRanges>('bc_engine_ranges', {}));
  }

  /** Style catalogs for waveform, progress bar and confetti (constant tables, read once). */
  elementPresets(): ElementPresets {
    return (this.presets ??= this.call<ElementPresets>('bc_element_presets', {}));
  }

  /**
   * Speaker-recognition proposal: `labels` correspond one-to-one with the body's words (clusters projected from voiceprint separation; null where there is no evidence). Clusters reuse existing speakers by overlap duration; those that can't be reused become new `spk-<n>` "Speaker n". `translations` is only given for `cuccut.translation/2` bodies.
   */
  speakerProposal(speech: unknown, translations: readonly unknown[], labels: ReadonlyArray<string | null>): SpeakerProposal {
    return this.call('bc_speaker_proposal', { speech, translations, labels });
  }

  /** Applies a proposal (`speakers` carries names edited on the confirmation page): when new speaker boundaries split sentences, translations are re-cut at natural seams and not re-translated. */
  applySpeakers(
    speech: unknown,
    translations: readonly unknown[],
    wordSpeakers: Readonly<Record<string, string>>,
    speakers: ReadonlyArray<{ id: string; name: string }>,
  ): AppliedSpeakers {
    return this.call('bc_apply_speakers', { speech, translations, wordSpeakers, speakers });
  }

  /**
   * Chapters from the source: an explicit outline takes precedence, then the material's source metadata (structured `chapters[]`; if absent, a timestamped outline parsed from the description). When there is a transcript, each entry is snapped to the nearest paragraph or sentence start (authors' timestamps are only precise to the second and often come a few seconds before the topic starts). All times are source-time seconds; projection onto the timeline is done by the caller.
   */
  sourceChapters(input: SourceChaptersInput): SourceChaptersResult {
    return this.call('bc_source_chapters', input);
  }

  private ranges: EngineRanges | undefined;
  private presets: ElementPresets | undefined;

  private call<T>(
    name: Exclude<keyof Exports, 'memory' | 'bc_alloc' | 'bc_free' | 'bc_output_ptr' | 'bc_output_len'>,
    payload: unknown,
  ): T {
    const input = encoder.encode(JSON.stringify(payload));
    const { exports } = this;
    const ptr = exports.bc_alloc(input.length);
    try {
      new Uint8Array(exports.memory.buffer, ptr, input.length).set(input);
      const status = exports[name](ptr, input.length);
      // After the call, memory may have grown; re-fetch the buffer.
      const output = decoder.decode(new Uint8Array(exports.memory.buffer, exports.bc_output_ptr(), exports.bc_output_len()));
      const value = JSON.parse(output) as unknown;
      if (status !== 0) {
        const error = value as { code: string; message: string };
        throw new EditorWasmError(error.code, error.message);
      }
      return value as T;
    } finally {
      exports.bc_free(ptr, input.length);
    }
  }
}

/** Synchronous function form (Node and browser both export the same set): `get` loads the WASM on the first call. */
export function semanticsApi(get: () => EditorSemantics) {
  return {
    speechSentences: (body: unknown): SpeechSentences => get().speechSentences(body),
    stageBox: (item: StageItem, canvas: StageCanvas, asset?: StageAsset): StageBox => get().stageBox(item, canvas, asset),
    stagePlace: (item: StageItem, pose: StagePose, canvas: StageCanvas, asset?: StageAsset): PlaceChange =>
      get().stagePlace(item, pose, canvas, asset),
    placeDefault: (type: string): PlaceDefault => get().placeDefault(type),
    engineRanges: (): EngineRanges => get().engineRanges(),
    elementPresets: (): ElementPresets => get().elementPresets(),
    speakerProposal: (speech: unknown, translations: readonly unknown[], labels: ReadonlyArray<string | null>): SpeakerProposal =>
      get().speakerProposal(speech, translations, labels),
    applySpeakers: (
      speech: unknown,
      translations: readonly unknown[],
      wordSpeakers: Readonly<Record<string, string>>,
      speakers: ReadonlyArray<{ id: string; name: string }>,
    ): AppliedSpeakers => get().applySpeakers(speech, translations, wordSpeakers, speakers),
    sourceChapters: (input: SourceChaptersInput): SourceChaptersResult => get().sourceChapters(input),
  };
}
