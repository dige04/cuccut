import type { AssetRecord, FontFaceQuery, Id, Sequence, VersionRef } from '@cuccut/protocol';
import type { FramePlan, PlanErrorBody } from './frame-plan.ts';
import type { LocalFont } from './local-fonts.ts';
import { R } from './render-copy.ts';

/** Functions exported by `bindings/preview-wasm`. JSON and bytes go in and out through linear memory; returns 0 on success. */
interface PreviewExports {
  memory: WebAssembly.Memory;
  bc_alloc(len: number): number;
  bc_free(ptr: number, len: number): void;
  bc_set_video(ptr: number, len: number): number;
  bc_plan(seconds: number): number;
  bc_font_files(): number;
  bc_add_font(ptr: number, len: number): number;
  bc_set_documents(ptr: number, len: number): number;
  bc_set_speech(ptr: number, len: number): number;
  bc_set_picture(keyPtr: number, keyLen: number, ptr: number, len: number, width: number, height: number): number;
  bc_clear_pictures(): void;
  bc_set_asset(keyPtr: number, keyLen: number, ptr: number, len: number): void;
  bc_set_spectrum(keyPtr: number, keyLen: number, ptr: number, len: number): void;
  bc_clear_spectra(): void;
  bc_set_audio_spectrum(keyPtr: number, keyLen: number, ptr: number, len: number): void;
  bc_clear_audio_spectra(): void;
  bc_spectrum_begin(): void;
  bc_spectrum_push(ptr: number, len: number): number;
  bc_spectrum_finish(): number;
  bc_render(seconds: number, width: number, height: number, flags: number): number;
  bc_measure_text(ptr: number, len: number): number;
  bc_frame_ptr(): number;
  bc_frame_len(): number;
  bc_output_ptr(): number;
  bc_output_len(): number;
}

/** A transcript: document ID, the asset it describes, and the body of its current version (corresponds to `SpeechInput` in `bindings/preview-wasm`). */
export interface SpeechTranscript {
  documentId: Id;
  sourceAssetId?: Id;
  body: unknown;
}

/** Frozen body of the documents a composition reads (captions and caption styles), corresponding to Rust `frame_render::FrozenDocument`. `null` while the body has not been fetched yet. */
export interface FrozenDocument {
  documentId: Id;
  kind?: string;
  schema?: string;
  /** Whether a caption line is the original text or the translation (captions derived from a translation are `translation`). */
  lineKind?: 'original' | 'translation';
  /** `sourceDocumentId` in the document header: a caption's sentences use `words` to point to words in this transcript (the transcript is sent in through `setSpeech`). */
  sourceDocumentId?: Id;
  /** `sourceAssetId` in the document header. */
  sourceAssetId?: Id;
  body: unknown;
}

/** Hints from the render kernel (font substitution, missing glyphs, waveforms without a spectrum, etc.); the picture is still output. */
export interface RenderWarning {
  code: string;
  detail: string;
}

/** Things not drawn in this frame (`frame_render::UnsupportedItem`): a whole layer not drawn, an effect skipped, a transition turned into a hard cut, or an asset that could not be decoded. */
export interface SkippedItem {
  itemId: Id;
  scope: 'layer' | 'effect' | 'transition' | 'asset';
  layerKind: string;
  effectId?: Id;
  transitionId?: Id;
  kind?: string;
  reason: string;
  message: string;
}

/** Asset spectra needed by waveforms that have not been sent in yet (`setAudioSpectrum`). */
export interface MissingSpectrum {
  itemId: Id;
  asset: VersionRef;
}

/** Real line boxes given by the caption renderer, in sequence canvas pixels; rotation is around the center. */
export interface CaptionHit {
  /** Captions in the same group are composited only at the first layer, and hit-testing uses that layer's stacking order. */
  layerId: Id;
  itemId: Id;
  documentId: Id;
  cueId: Id;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}

/** A frame is finished: the plan for this moment, and what was reported while drawing. The picture is fetched through `frame()`. */
export interface RenderedFrame {
  plan: FramePlan;
  warnings: RenderWarning[];
  skipped: SkippedItem[];
  spectra: MissingSpectrum[];
  /** Font families used by this frame that are not in the font library (drawn with the fallback font; `warnings` has a note). */
  fonts: string[];
  /**
   * Faces named during typesetting so far (kept, including those for captions and template layers). The UI checks which families were reported missing and asks for the local font for that face; once `addLocalFont` sends it in, it is drawn.
   */
  faces?: FontFaceQuery[];
  captionHits?: CaptionHit[];
}

/** Number of samples sent into WASM at once (10 seconds): when computing the spectrum, WASM keeps only one window, not the whole audio. */
const SPECTRUM_BLOCK = 480_000;

/**
 * Planning failed: `code` comes from Rust (`SEQUENCE_NOT_FOUND`, `INVALID_VIDEO`, and similar), or is `PLANNER_CRASHED` (a WASM trap; reloading).
 */
export class PlanFailure extends Error {
  readonly code: string;
  constructor(body: PlanErrorBody) {
    super(body.message);
    this.code = body.code;
  }
}

/** The plan reads only sequences and assets; other documents are not sent into WASM. */
export interface PlanVideo {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Frame planner and frame renderer: Rust's `render-graph` and `frame-render` compiled to WASM (architecture design §2, “pure semantic modules compile to WASM”). Preview asks it once per frame. The plan and the pixels both come from the same implementation as export. WASM does not hold write access to video; video is sent in whole with the snapshot, while the current frame of a media element, the Lottie bytes and the fonts are sent in by the UI.
 *
 * A panic in Rust is a trap in WASM, after which the instance's state cannot be trusted. So it is discarded and re-instantiated from the compiled module, and the fonts, video, documents, transcripts, asset bytes, spectra and asset spectra are sent back (the pictures are re-sent every frame; local fonts keep no bytes and are requested again through `LocalFont.load`). Then `onRecovered` is called. Calls during reloading throw `PLANNER_CRASHED`; callers that need to wait use `recovered()`.
 */
export class RenderPlanner {
  readonly #module: WebAssembly.Module;
  #exports: PreviewExports | null;
  /** Fonts shipped with the kernel (several MB; the bytes are kept). */
  #fonts: Uint8Array[] = [];
  /** Local fonts that have been sent in: bytes are not kept (a single face extracted from a large font collection can also be over 10 MB). They are requested again through `load` when they need to be sent again. */
  readonly #local = new Map<string, LocalFont>();
  /** Instances split off this one (thumbnails): local fonts sent in later are also sent to them. */
  readonly #forks = new Set<RenderPlanner>();
  #videoInput: Uint8Array | null = null;
  #documentsInput: Uint8Array | null = null;
  #speechInput: Uint8Array | null = null;
  readonly #assets = new Map<string, Uint8Array>();
  readonly #spectra = new Map<string, Uint8Array>();
  readonly #audioSpectra = new Map<string, Uint8Array>();
  /** The `recovered()` that is being waited on during reloading. */
  readonly #waiting: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  /** Reason reloading failed: later instances are no longer usable, and `recovered()` rejects every time. */
  #lost: { error: unknown } | null = null;
  onRecovered: (() => void) | null = null;

  private constructor(module: WebAssembly.Module, instance: WebAssembly.Instance) {
    this.#module = module;
    this.#exports = instance.exports as unknown as PreviewExports;
  }

  static async instantiate(bytes: BufferSource | WebAssembly.Module): Promise<RenderPlanner> {
    if (bytes instanceof WebAssembly.Module) return new RenderPlanner(bytes, await WebAssembly.instantiate(bytes, {}));
    const { module, instance } = await WebAssembly.instantiate(bytes, {});
    return new RenderPlanner(module, instance);
  }

  /**
   * Another instance of the same compiled module (for thumbnails, so it does not compete with the preview for video). Fonts are still injected: the built-in batch is sent as usual, and local fonts already sent in are requested again and sent (any that cannot be obtained are skipped). Local fonts sent to this instance later are also sent to it.
   */
  async fork(): Promise<RenderPlanner> {
    const planner = await RenderPlanner.instantiate(this.#module);
    planner.addFonts(this.#fonts);
    this.#forks.add(planner);
    await Promise.allSettled([...this.#local.values()].map(async (font) => planner.addLocalFont(font, await font.load())));
    return planner;
  }

  /** Font file names to inject; the order is the injection order (the first one is the fallback font). */
  fontFiles(): string[] {
    return JSON.parse(this.#call((exports) => exports.bc_font_files())) as string[];
  }

  /**
   * Injects the fonts shipped with the kernel: they are injected in `fontFiles()` order, and drawing happens only after all of them are injected. On reload, they are all sent back in injection order.
   */
  addFonts(fonts: readonly Uint8Array[]): void {
    for (const font of fonts) {
      this.#call((exports) => giveBytes(exports, font, (ptr, len) => exports.bc_add_font(ptr, len)));
      this.#fonts.push(font);
    }
  }

  /**
   * Injects one local font face (as requested through `RenderedFrame.faces`). The next frame is laid out again with the new font library, and split-off instances receive it too. The bytes are not kept here once copied into WASM (and the caller need not keep them either): on reload or when a new instance is split off, they are requested again through `font.load`. The same `key` is sent only once; returns true if it was sent.
   * During reloading, it is only recorded and requested back together with the reload.
   */
  addLocalFont(font: LocalFont, bytes: Uint8Array): boolean {
    if (this.#local.has(font.key)) return false;
    this.#local.set(font.key, font);
    const exports = this.#exports;
    if (exports) giveBytes(exports, bytes, (ptr, len) => exports.bc_add_font(ptr, len));
    for (const fork of this.#forks) fork.addLocalFont(font, bytes);
    return true;
  }

  /** Sends in the video. Later plans are computed against this sequence. */
  setVideo(video: PlanVideo): void {
    const { sequence, assets } = video;
    const document = { rootSequenceId: sequence.id, sequences: { [sequence.id]: sequence }, assets };
    const input = encoder.encode(JSON.stringify({ video: document, sequenceId: sequence.id }));
    this.#call((exports) => withBytes(exports, input, (ptr, len) => exports.bc_set_video(ptr, len)));
    // A video that cannot be sent in is not recorded: WASM keeps the previous one, and reloading also sends the previous one.
    this.#videoInput = input;
  }

  /** Replaces the batch of caption and caption style documents. */
  setDocuments(documents: readonly FrozenDocument[]): void {
    const input = encoder.encode(JSON.stringify(documents));
    this.#call((exports) => withBytes(exports, input, (ptr, len) => exports.bc_set_documents(ptr, len)));
    this.#documentsInput = input;
  }

  /**
   * Transcript of the video (a `kind: speech` document, the body of its current version). The effective word stream projected onto the sequence gives the trigger ranges for script-triggered ducking. It is the same as the export's sound plan, so preview and export duck by the same amount at the same moment.
   */
  setSpeech(transcripts: readonly SpeechTranscript[]): void {
    const input = encoder.encode(JSON.stringify(transcripts));
    this.#call((exports) => withBytes(exports, input, (ptr, len) => exports.bc_set_speech(ptr, len)));
    this.#speechInput = input;
  }

  /** The instance's picture at this moment (non-premultiplied RGBA, `width`×`height`). Keys are instance IDs. */
  setPicture(itemId: Id, rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): void {
    const key = encoder.encode(itemId);
    this.#call((exports) =>
      withBytes(exports, key, (keyPtr, keyLen) =>
        withBytes(exports, rgba, (ptr, len) => exports.bc_set_picture(keyPtr, keyLen, ptr, len, width, height)),
      ),
    );
  }

  /** Clears the pictures sent in for the previous frame. */
  clearPictures(): void {
    this.#call((exports) => (exports.bc_clear_pictures(), 0));
  }

  /** Raw bytes of the asset (Lottie needs to read them). */
  setAsset(asset: VersionRef, bytes: Uint8Array): void {
    const name = assetKey(asset);
    if (this.#assets.get(name) === bytes) return;
    const key = encoder.encode(name);
    this.#call((exports) =>
      withBytes(exports, key, (keyPtr, keyLen) =>
        withBytes(exports, bytes, (ptr, len) => (exports.bc_set_asset(keyPtr, keyLen, ptr, len), 0)),
      ),
    );
    this.#assets.set(name, bytes);
  }

  /** Whole-track spectrum (BCS1) for waveform instances, keyed by instance ID. Bytes sent again are not processed again. */
  setSpectrum(itemId: string, bytes: Uint8Array): void {
    if (this.#spectra.get(itemId) === bytes) return;
    const key = encoder.encode(itemId);
    this.#call((exports) =>
      withBytes(exports, key, (keyPtr, keyLen) =>
        withBytes(exports, bytes, (ptr, len) => (exports.bc_set_spectrum(keyPtr, keyLen, ptr, len), 0)),
      ),
    );
    this.#spectra.set(itemId, bytes);
  }

  /** Clears all spectra. */
  clearSpectra(): void {
    if (this.#spectra.size === 0) return;
    this.#call((exports) => (exports.bc_clear_spectra(), 0));
    this.#spectra.clear();
  }

  /**
   * Asset spectrum (BCS1, computed by `analyzeAudio`). Waveforms build the sound they hear from the sequence's sound plan using this, with the same code as export. Bytes sent again are not reassembled (returns false).
   */
  setAudioSpectrum(asset: VersionRef, bytes: Uint8Array): boolean {
    const name = assetKey(asset);
    if (this.#audioSpectra.get(name) === bytes) return false;
    const key = encoder.encode(name);
    this.#call((exports) =>
      withBytes(exports, key, (keyPtr, keyLen) =>
        withBytes(exports, bytes, (ptr, len) => (exports.bc_set_audio_spectrum(keyPtr, keyLen, ptr, len), 0)),
      ),
    );
    this.#audioSpectra.set(name, bytes);
    return true;
  }

  /** Clears all asset spectra. */
  clearAudioSpectra(): void {
    if (this.#audioSpectra.size === 0) return;
    this.#call((exports) => (exports.bc_clear_audio_spectra(), 0));
    this.#audioSpectra.clear();
  }

  /**
   * Computes one asset spectrum. `channels` are the 48 kHz samples of each channel: mono is passed through as-is, multi-channel is averaged, and the result is sent in blocks into a temporary instance of the same module. The memory used for analysis is dropped with that instance and is not kept in the instance that draws frames. Analysis is the same Rust code as export; decoding is not (here the browser decodes), so lossy formats differ slightly from export, and the spectrum is close but not byte-identical.
   */
  async analyzeAudio(channels: readonly Float32Array[]): Promise<Uint8Array> {
    const instance = await WebAssembly.instantiate(this.#module, {});
    const exports = instance.exports as unknown as PreviewExports;
    const length = Math.min(...channels.map((channel) => channel.length));
    const read = (status: number): Uint8Array => {
      const output = new Uint8Array(exports.memory.buffer, exports.bc_output_ptr(), exports.bc_output_len()).slice();
      if (status !== 0) throw new PlanFailure(JSON.parse(decoder.decode(output)) as PlanErrorBody);
      return output;
    };
    exports.bc_spectrum_begin();
    const block = new Float32Array(SPECTRUM_BLOCK);
    for (let start = 0; start < length; start += SPECTRUM_BLOCK) {
      const size = Math.min(SPECTRUM_BLOCK, length - start);
      const mono = block.subarray(0, size);
      if (channels.length === 1) mono.set(channels[0]!.subarray(start, start + size));
      else {
        mono.fill(0);
        for (const channel of channels) for (let i = 0; i < size; i++) mono[i]! += channel[start + i]!;
        for (let i = 0; i < size; i++) mono[i]! /= channels.length;
      }
      read(withBytes(exports, new Uint8Array(mono.buffer, 0, size * 4), (ptr, len) => exports.bc_spectrum_push(ptr, len)));
    }
    return read(exports.bc_spectrum_finish());
  }

  /**
   * How large a box a piece of text needs as a text element on `canvas` (the sequence canvas), in sequence pixels, including background padding. It uses the same typesetting engine and the same fonts as drawing the text (`frame_render::text_measure`). If `wrapWidth` is given, the text wraps to it and the box width is that width; otherwise it is laid out as one unwrapped block. Fonts must be injected first.
   */
  measureText(
    text: string,
    style: Record<string, unknown>,
    wrapWidth: number | null,
    canvas: { width: number; height: number },
  ): { width: number; height: number } {
    const input = encoder.encode(JSON.stringify({ text, style, wrapWidth, canvas: { width: canvas.width, height: canvas.height } }));
    return JSON.parse(this.#call((exports) => withBytes(exports, input, (ptr, len) => exports.bc_measure_text(ptr, len)))) as {
      width: number;
      height: number;
    };
  }

  /**
   * Computes the plan at `seconds` and draws it at `width`×`height` (same aspect ratio as the sequence canvas). Things that cannot be drawn are skipped and reported in the result.
   * `captions: false` does not draw the caption layer; `transparent` does not fill the background (thumbnails).
   */
  render(seconds: number, width: number, height: number, options: { captions?: boolean; transparent?: boolean } = {}): RenderedFrame {
    const flags = (options.captions === false ? 0 : 1) | (options.transparent ? 2 : 0);
    return JSON.parse(this.#call((exports) => exports.bc_render(seconds, width, height, flags))) as RenderedFrame;
  }

  /**
   * The frame drawn by the last `render`: non-premultiplied RGBA (transparent where there is no background fill, otherwise opaque). This is a view into WASM memory, not a copy: use it before the next call into WASM, because when memory grows the old view becomes invalid.
   */
  frame(): Uint8ClampedArray<ArrayBuffer> {
    const exports = this.#exports;
    if (!exports) return new Uint8ClampedArray(0);
    return new Uint8ClampedArray(exports.memory.buffer as ArrayBuffer, exports.bc_frame_ptr(), exports.bc_frame_len());
  }

  /** The plan at `seconds`. */
  planAt(seconds: number): FramePlan {
    return JSON.parse(this.planJson(seconds)) as FramePlan;
  }

  /** Raw JSON of the plan (byte-identical to native Rust output; used by the gold-standard test). */
  planJson(seconds: number): string {
    return this.#call((exports) => exports.bc_plan(seconds));
  }

  /**
   * Resolves when the instance is usable. Normally it resolves right away. After a `PLANNER_CRASHED` has been thrown, it waits until reloading finishes (before `onRecovered`), and rejects if reloading fails (and every time after that). It does not occupy `onRecovered`, which belongs to the preview engine.
   */
  recovered(): Promise<void> {
    if (this.#exports) return Promise.resolve();
    if (this.#lost) return Promise.reject(this.#lost.error);
    return new Promise((resolve, reject) => this.#waiting.push({ resolve, reject }));
  }

  /** Calls one export function and reads the output area; throws `PlanFailure` on failure. */
  #call(invoke: (exports: PreviewExports) => number): string {
    const exports = this.#exports;
    if (!exports) throw new PlanFailure({ code: 'PLANNER_CRASHED', message: R.planner.reloading });
    let status: number;
    try {
      status = invoke(exports);
    } catch (error) {
      if (!(error instanceof WebAssembly.RuntimeError)) throw error;
      this.#restart();
      throw new PlanFailure({ code: 'PLANNER_CRASHED', message: R.planner.crashed(error.message) });
    }
    // Memory may grow during a call, which invalidates old ArrayBuffers, so it is fetched from memory.buffer each time.
    const output = decoder.decode(new Uint8Array(exports.memory.buffer, exports.bc_output_ptr(), exports.bc_output_len()));
    if (status !== 0) throw new PlanFailure(JSON.parse(output) as PlanErrorBody);
    return output;
  }

  #restart(): void {
    this.#exports = null;
    // The module is already compiled, so re-instantiation is fast; it can only be done asynchronously on the main thread.
    const restored = WebAssembly.instantiate(this.#module, {}).then(async (instance) => {
      const exports = instance.exports as unknown as PreviewExports;
      for (const font of this.#fonts) giveBytes(exports, font, (ptr, len) => exports.bc_add_font(ptr, len));
      // Local fonts keep no bytes: they are requested again (including any sent during the request). Those that cannot be obtained are skipped (drawn with the fallback font; the missing-font notices are still reported).
      const given = new Set<string>();
      for (;;) {
        const todo = [...this.#local.values()].filter((font) => !given.has(font.key));
        if (todo.length === 0) break;
        const loaded = await Promise.allSettled(todo.map((font) => font.load()));
        todo.forEach((font, i) => {
          given.add(font.key);
          const result = loaded[i]!;
          if (result.status === 'fulfilled') giveBytes(exports, result.value, (ptr, len) => exports.bc_add_font(ptr, len));
        });
      }
      if (this.#videoInput) withBytes(exports, this.#videoInput, (ptr, len) => exports.bc_set_video(ptr, len));
      if (this.#documentsInput) withBytes(exports, this.#documentsInput, (ptr, len) => exports.bc_set_documents(ptr, len));
      if (this.#speechInput) withBytes(exports, this.#speechInput, (ptr, len) => exports.bc_set_speech(ptr, len));
      for (const [name, bytes] of this.#assets) {
        const key = encoder.encode(name);
        withBytes(exports, key, (keyPtr, keyLen) =>
          withBytes(exports, bytes, (ptr, len) => (exports.bc_set_asset(keyPtr, keyLen, ptr, len), 0)),
        );
      }
      for (const [itemId, bytes] of this.#spectra) {
        const key = encoder.encode(itemId);
        withBytes(exports, key, (keyPtr, keyLen) =>
          withBytes(exports, bytes, (ptr, len) => (exports.bc_set_spectrum(keyPtr, keyLen, ptr, len), 0)),
        );
      }
      for (const [name, bytes] of this.#audioSpectra) {
        const key = encoder.encode(name);
        withBytes(exports, key, (keyPtr, keyLen) =>
          withBytes(exports, bytes, (ptr, len) => (exports.bc_set_audio_spectrum(keyPtr, keyLen, ptr, len), 0)),
        );
      }
      this.#exports = exports;
      for (const { resolve } of this.#waiting.splice(0)) resolve();
      this.onRecovered?.();
    });
    restored.catch((error: unknown) => {
      if (this.#exports) return;
      console.warn(R.planner.reloadFailed, error);
      this.#lost = { error };
      for (const { reject } of this.#waiting.splice(0)) reject(error);
    });
  }
}

/** Keys for asset bytes (same as on the Rust side). */
export function assetKey(asset: VersionRef): string {
  return `${asset.id}@${asset.revision}`;
}

/** Hands a buffer, into which the bytes were written in WASM memory, to `invoke`. Afterwards the buffer belongs to WASM and is not freed (`bc_add_font`: large fonts are not copied an extra time). */
function giveBytes(exports: PreviewExports, input: Uint8Array, invoke: (ptr: number, len: number) => number): number {
  const ptr = exports.bc_alloc(input.length);
  try {
    new Uint8Array(exports.memory.buffer, ptr, input.length).set(input);
  } catch (error) {
    exports.bc_free(ptr, input.length);
    throw error;
  }
  return invoke(ptr, input.length);
}

/** Writes bytes into a temporary WASM buffer, and frees it after the call. */
function withBytes(exports: PreviewExports, input: Uint8Array | Uint8ClampedArray, invoke: (ptr: number, len: number) => number): number {
  const ptr = exports.bc_alloc(input.length);
  try {
    new Uint8Array(exports.memory.buffer, ptr, input.length).set(input);
    return invoke(ptr, input.length);
  } finally {
    exports.bc_free(ptr, input.length);
  }
}
