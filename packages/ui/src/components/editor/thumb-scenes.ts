import type { AssetRecord, Rate, VersionRef } from '@cuccut/protocol';
import { thumbScene } from '../../model/caption-presets.ts';
import { wordAnimationPayload } from '../../model/caption-word-animation.ts';
import type { VisualLayer } from '../../model/new-items.ts';
import { poseOf, type PlacedItem } from '../../model/stage-pose.ts';
import { presetLayers, type MeasureText, type TextPreset } from '../../model/text-presets.ts';
import { CONFETTI_RANGES, confettiDefaults } from '../../render/confetti.ts';
import type { FrozenDocument, RenderPlanner, SpeechTranscript } from '../../render/render-planner.ts';
import { STUDIO_STYLE, type Json, type LineKind } from '../../render/text-style.ts';
import { opaqueBounds, renderThumb, type ThumbLayer, type ThumbScene } from '../../render/thumbnails.ts';

/**
 * How each kind of thumbnail is laid out as a frame of the render kernel, and then pasted into its cell. All sizes are in the cell's device pixels; returns the picture pieces to paste, which the component draws onto the canvas.
 * Same kernel as preview and export: what you see in the cell is what lands on the picture.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Paste the `source` region of `image` into the `target` region of the cell (scaled; may extend beyond the cell). */
export interface Blit {
  image: ImageData;
  source: Rect;
  target: Rect;
}

/** One thumbnail: the picture pieces to paste, and what the kernel cannot draw (with the reason for each layer). */
export interface ThumbPicture {
  blits: Blit[];
  problems: string[];
}

type Size = { width: number; height: number };

/** Longest side of one frame (device pixels): when a small element is enlarged to fill the cell, the whole frame becomes very large, so if it exceeds the limit, draw it smaller and then scale it up when pasting. */
export const MAX_SIDE = 1600;

/** The moment a still thumbnail freezes on: each layer is 10 seconds long and freezes at 6 seconds (60% progress; the entrance has long finished). */
const STILL = { seconds: 6, duration: 10 };

let sample: Uint8Array | null = null;

/**
 * The waveform cell has no sound to play: a fake spectrum (BCS1, the same in every frame) with a row of bumps in the frequency domain and a sine segment in the time domain, drawn in the style of the real one. The frequency domain uses the default
 * dB window (−80 to +40) to give heights from 20% to 85%, converted to the canonical window of BCS1 (−120 to +40).
 */
export function sampleSpectrum(): Uint8Array {
  if (sample) return sample;
  const [frames, timeBins, freqBins] = [30, 128, 512];
  const out = new Uint8Array(40 + frames * (timeBins + freqBins));
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('BCS1'), 0);
  view.setUint16(4, 1, true);
  [60, 48_000, 1024, timeBins, freqBins, frames].forEach((value, index) => view.setUint32(8 + index * 4, value, true));
  const time = Array.from({ length: timeBins }, (_, index) => {
    const u = index / timeBins;
    const value = 0.55 * Math.sin(Math.PI * 2 * 3 * u) * (0.6 + 0.4 * Math.sin(Math.PI * 2 * u + 1));
    return Math.round(128 + value * 127);
  });
  const freq = Array.from({ length: freqBins }, (_, index) => {
    const band = (index * 64) / freqBins;
    const level = 0.25 + 0.6 * Math.abs(Math.sin(Math.floor(band) * 0.42)) * (1 - band / 128);
    const db = -80 + 120 * level;
    return Math.round(((db + 120) / 160) * 255);
  });
  for (let frame = 0; frame < frames; frame++) {
    const at = 40 + frame * (timeBins + freqBins);
    out.set(time, at);
    out.set(freq, at + timeBins);
  }
  sample = out;
  return out;
}

function whole(image: ImageData): Rect {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

/**
 * A newly created layer (element cell): the whole frame is scaled by the box to 84% of the cell, with the box's center aligned to the cell's center; outlines and shadows that extend past the box are pasted as well. The waveform layer uses
 * the fake spectrum from [`sampleSpectrum`].
 */
export function layerThumb(planner: RenderPlanner, layer: VisualLayer, canvas: Size, width: number, height: number): ThumbPicture {
  const box = poseOf(layer as unknown as PlacedItem, canvas);
  const fit = Math.min((width * 0.84) / box.w, (height * 0.84) / box.h);
  const scale = Math.min(fit, MAX_SIDE / Math.max(canvas.width, canvas.height));
  const scene: ThumbScene = {
    canvas,
    layers: [layer as unknown as ThumbLayer],
    ...STILL,
    ...(layer.type === 'visualizer' ? { spectrum: sampleSpectrum() } : {}),
  };
  const { image, problems } = renderThumb(planner, scene, canvas.width * scale, canvas.height * scale);
  const target = { x: width / 2 - box.cx * fit, y: height / 2 - box.cy * fit, width: canvas.width * fit, height: canvas.height * fit };
  return { blits: [{ image, source: whole(image), target }], problems };
}

/** The moment a confetti cell freezes on: all four burst intervals have already exploded and scattered, and the continuous style has reached steady state. */
export const CONFETTI_STILL = 4.5;
/** How long the loop that plays on hover is. */
export const CONFETTI_LOOP = 4;

/**
 * Confetti cell: a layer of particles filling the cell; the same seed (11) always gives the same picture. After the cell is scaled by short side / 540, the particles shrink to one or two pixels, so “size” is pushed to its maximum to make the style recognizable. This only affects how the cell is drawn; what lands on the picture is still the recipe as is.
 */
export function confettiThumb(planner: RenderPlanner, styleKey: string, seconds: number, width: number, height: number): ThumbPicture {
  const props = { ...confettiDefaults(styleKey, 11), size: CONFETTI_RANGES.size[1] };
  const confetti = Object.fromEntries(Object.entries(props).filter(([, value]) => value !== null));
  const layer: ThumbLayer = { type: 'confetti', place: { x: 50, y: 50, w: 100 }, confetti };
  const scene: ThumbScene = { canvas: { width, height }, layers: [layer], seconds, duration: CONFETTI_STILL + CONFETTI_LOOP + 0.5 };
  const { image, problems } = renderThumb(planner, scene, width, height);
  return { blits: [{ image, source: whole(image), target: whole(image) }], problems };
}

/** The fields needed from the Lottie file header to determine the freeze frame. null when it cannot be read. */
export function lottieMeta(bytes: Uint8Array): { seconds: number; width: number; height: number } | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const [ip, op, fr, w, h] = [value.ip, value.op, value.fr, value.w, value.h].map(Number) as [number, number, number, number, number];
    if (![ip, op, fr, w, h].every(Number.isFinite) || fr <= 0 || op <= ip || w <= 0 || h <= 0) return null;
    return { seconds: (op - ip) / fr, width: w, height: h };
  } catch {
    return null;
  }
}

/** The same URL gives the same asset ID (the kernel caches decoded animations per asset). */
function lottieAsset(key: string, byteLength: number): { ref: VersionRef; record: AssetRecord } {
  let hash = 5381;
  for (let index = 0; index < key.length; index++) hash = ((hash * 33) ^ key.charCodeAt(index)) >>> 0;
  const id = `thumb_lottie_${hash.toString(16)}`;
  const record = {
    id,
    kind: 'lottie',
    name: `${id}.json`,
    currentRevision: 'r1',
    revisions: {
      r1: {
        revision: 'r1',
        contentHash: `thumb:${id}`,
        byteLength,
        mediaType: 'application/json',
        storage: { mode: 'managed' },
        provenance: { origin: 'import' },
      },
    },
  } as unknown as AssetRecord;
  return { ref: { id, revision: 'r1' }, record };
}

/**
 * Brand-library Lottie sticker: fitted into the cell (keeping its aspect ratio), frozen on the middle frame of the animation (the start is often still empty), and after `elapsed` seconds it resumes looping.
 * `key` is the file's address; the same file is decoded only once.
 */
export function lottieThumb(
  planner: RenderPlanner,
  key: string,
  bytes: Uint8Array,
  elapsed: number,
  width: number,
  height: number,
): ThumbPicture {
  const meta = lottieMeta(bytes);
  const { ref, record } = lottieAsset(key, bytes.length);
  const w = meta ? Math.min(100, 100 * (height / width) * (meta.width / meta.height)) : 100;
  const layer: ThumbLayer = { type: 'sticker', place: { x: 50, y: 50, w }, sticker: { source: 'asset' }, assetRef: ref };
  const scene: ThumbScene = {
    canvas: { width, height },
    layers: [layer],
    seconds: (meta ? meta.seconds / 2 : 0) + elapsed,
    duration: 3600,
    assets: { [ref.id]: record },
    assetBytes: [{ asset: ref, bytes }],
  };
  const { image, problems } = renderThumb(planner, scene, width, height);
  return { blits: [{ image, source: whole(image), target: whole(image) }], problems };
}

/** Zoom factor for scene cards: the card is cropped to 1.35× the width of this group's bounding box, so the title and the lower third shrunk into the corner land in the cell at the same font-size scale. */
const CROP = 1.35;

/**
 * Text preset cards. Font-style cards (`stack`): each line is drawn separately, with font size exactly the preset's `previewSize` (times pixel density), arranged in a centered column; if it does not fit, the whole thing is scaled down.
 * Scene cards: the whole frame is drawn from the preset (16:9) and cropped to this group's bounding box. The box width is measured by the same kernel instance (using the same measuring method as when creating).
 */
export function presetThumb(
  planner: RenderPlanner,
  preset: TextPreset,
  fps: Rate,
  ratio: number,
  width: number,
  height: number,
): ThumbPicture {
  const measureOn =
    (canvas: Size): MeasureText =>
    (text, style, wrapWidth) =>
      planner.measureText(text, style, wrapWidth, canvas);
  return preset.layout === 'stack'
    ? stackThumb(planner, preset, measureOn, ratio, width, height)
    : sceneThumb(planner, preset, fps, measureOn, width, height);
}

function stackThumb(
  planner: RenderPlanner,
  preset: TextPreset,
  measureOn: (canvas: Size) => MeasureText,
  ratio: number,
  width: number,
  height: number,
): ThumbPicture {
  const problems: string[] = [];
  const rows: { image: ImageData; bounds: Rect }[] = [];
  for (const layer of preset.layers) {
    if (layer.kind !== 'text') continue;
    const style = layer.style ?? {};
    const fontSize = typeof style.fontSize === 'number' ? style.fontSize : 24;
    // Set the canvas's short side so that this line's font size is exactly previewSize.
    const short = (540 * (layer.previewSize ?? 12) * ratio) / fontSize;
    const box = measureOn({ width: (short * 16) / 9, height: short })(layer.text ?? '', style, null);
    const canvas = { width: Math.max((short * 16) / 9, box.width * 1.5), height: short };
    // Leave 10% slack in the box width: the canvas used for measuring text is sized in whole pixels, so a slight rounding difference from the drawn size will not wrap the line (after drawing, cropping is done by the opaque area, so the box width does not affect placement).
    const w = ((box.width * 1.1) / canvas.width) * 100;
    const text: ThumbLayer = { type: 'text', text: layer.text ?? '', style, place: { x: 50, y: 50, w } };
    const rendered = renderThumb(planner, { canvas, layers: [text], ...STILL }, canvas.width, canvas.height);
    problems.push(...rendered.problems);
    const bounds = opaqueBounds(rendered.image);
    if (bounds) rows.push({ image: rendered.image, bounds });
  }
  const gap = 3 * ratio;
  const total = rows.reduce((sum, row) => sum + row.bounds.height, 0) + gap * Math.max(0, rows.length - 1);
  const widest = Math.max(1, ...rows.map((row) => row.bounds.width));
  const margin = 12 * ratio;
  const fit = Math.min(1, (width - margin) / widest, (height - margin) / Math.max(1, total));
  let top = height / 2 - (total * fit) / 2;
  const blits = rows.map(({ image, bounds }): Blit => {
    const target = { x: width / 2 - (bounds.width * fit) / 2, y: top, width: bounds.width * fit, height: bounds.height * fit };
    top += (bounds.height + gap) * fit;
    return { image, source: bounds, target };
  });
  return { blits, problems };
}

function sceneThumb(
  planner: RenderPlanner,
  preset: TextPreset,
  fps: Rate,
  measureOn: (canvas: Size) => MeasureText,
  width: number,
  height: number,
): ThumbPicture {
  const crop = Math.min(100, Math.max(preset.box.w * CROP, 20));
  const inner = width * (100 / crop);
  const canvas = { width: inner, height: (inner * 9) / 16 };
  const layers = presetLayers(preset, canvas, fps, measureOn(canvas)) as unknown as ThumbLayer[];
  const scale = Math.min(1, MAX_SIDE / inner);
  const { image, problems } = renderThumb(planner, { canvas, layers, ...STILL }, canvas.width * scale, canvas.height * scale);
  // Align the bounding box's center to the card's center.
  const target = {
    x: width / 2 - (preset.box.x / 100) * canvas.width,
    y: height / 2 - (preset.box.y / 100) * canvas.height,
    width: canvas.width,
    height: canvas.height,
  };
  return { blits: [{ image, source: whole(image), target }], problems };
}

/** How long each word of the caption sample is read (seconds; prototype panel-substyle.jsx beat of 620ms): one word per beat, then one extra beat of pause after reading through, then loop. */
export const CAPTION_BEAT = 0.62;

/** The moment a still sample freezes on: the second word is 35% read (prototype `SAMPLE_ON`), which shows which per-word animation it is. */
const SAMPLE_ON = 0.35;

/** Chinese characters and kana each form their own word; everything else is split on whitespace (the kernel also splits multi-character CJK words in the transcript into individual characters). */
const SAMPLE_WORD = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu;

/** The sample's words. */
export function sampleWords(text: string): string[] {
  return text.match(SAMPLE_WORD) ?? [];
}

const SAMPLE_SPEECH = 'thumb_speech';
const speeches = new Map<string, SpeechTranscript[]>();

/** Transcript of the sample's source sentence: one word per beat. The same sentence always gives the same result (the transcript in the kernel does not need to be re-sent for every card). */
function sampleSpeech(text: string): SpeechTranscript[] {
  let speech = speeches.get(text);
  if (!speech) {
    const words = sampleWords(text).map((word, index) => ({
      id: `w${index}`,
      text: word,
      start: Math.round(index * CAPTION_BEAT * 1000),
      end: Math.round((index + 1) * CAPTION_BEAT * 1000),
    }));
    speech = [{ documentId: SAMPLE_SPEECH, body: { schema: 'cuccut.speech/1', clock: 'sequence', timescale: 1000, words } }];
    speeches.set(text, speech);
  }
  return speech;
}

/**
 * Scene for the caption sample: one subtitle document per line type (one cue, from 0 to `duration` seconds), sharing one style document. The source cue points to the sample's transcript,
 * and the per-word animation advances beat by beat along its words; the translation has no per-word timing (same as on the picture).
 */
function captionScene(style: Json, lines: readonly { kind: LineKind; text: string }[], canvas: Size, duration: number): ThumbScene {
  const original = lines.find((line) => line.kind === 'original');
  const documents: FrozenDocument[] = [
    { documentId: 'thumb_style', kind: 'caption-style', schema: STUDIO_STYLE, body: { schema: STUDIO_STYLE, style } },
    ...lines.map((line): FrozenDocument => ({
      documentId: `thumb_${line.kind}`,
      kind: 'caption',
      schema: 'cuccut.caption/1',
      lineKind: line.kind,
      ...(line.kind === 'original' ? { sourceDocumentId: SAMPLE_SPEECH } : {}),
      body: {
        schema: 'cuccut.caption/1',
        clock: 'sequence',
        timescale: 1000,
        cues: [{ id: 'c0', start: 0, end: Math.round(duration * 1000), text: line.text }],
      },
    })),
  ];
  const layers = lines.map((line): ThumbLayer => ({
    type: 'caption',
    documentId: `thumb_${line.kind}`,
    styleDocumentId: 'thumb_style',
    scopeItemIds: [],
  }));
  return { canvas, layers, documents, seconds: 0, duration, ...(original ? { speech: sampleSpeech(original.text) } : {}) };
}

/** A measured caption sample: the scene (`seconds` is supplied when a frame is captured), the length of one cycle (seconds; 0 when there is no source line), and the moment it freezes on when still. */
export interface CaptionSample {
  scene: ThumbScene;
  period: number;
  still: number;
}

/**
 * Sample for the caption style card: lays out an English and a Chinese line in this style, with the larger line at `px` device pixels. Thumbnails do not wrap: first draw without animation on a canvas four times as wide to measure the sample's width and height,
 * and if it does not fit, scale the whole thing down; after that every frame uses this font size, so per-word animation (drop-in, bounce, …) does not make the font size jump.
 * Per-word animation and motion follow this style's own settings (applying the card swaps in the current word and motion together, so what moves on the card is exactly what gets applied).
 */
export function captionSample(planner: RenderPlanner, root: Json, kinds: readonly LineKind[], px: number, width: number, height: number): CaptionSample {
  const scene = thumbScene(root, kinds, { width, height }, px);
  const original = scene.lines.find((line) => line.kind === 'original');
  const words = original ? sampleWords(original.text).length : 0;
  const period = words ? (words + 1) * CAPTION_BEAT : 0;
  const duration = period || 10;
  const still = words ? (Math.min(1, words - 1) + SAMPLE_ON) * CAPTION_BEAT : duration / 2;
  // When measuring width, no animation: per-word animation and textMotion are both removed (`wordAnimation` overrides the old key `anim`, and both are set to “none”); the per-word background block stays, since it takes up width.
  const { textMotion: _motion, ...still0 } = scene.root;
  const plain = { ...still0, anim: { name: 'None' }, wordAnimation: wordAnimationPayload('none') };
  const wide = renderThumb(planner, { ...captionScene(plain, scene.lines, { width: width * 4, height }, duration), seconds: still }, width * 4, height);
  const bounds = opaqueBounds(wide.image);
  const fit = bounds ? Math.min(1, (width * 0.92) / bounds.width, (height * 0.9) / bounds.height) : 1;
  const sized = fit < 1 ? { ...scene.root, scale: (typeof scene.root.scale === 'number' ? scene.root.scale : 1) * fit } : scene.root;
  return { scene: captionScene(sized, scene.lines, { width, height }, duration), period, still };
}

/** The sample's picture at the moment `seconds` (cell size, transparent background; the component lays the background color). */
export function captionFrame(planner: RenderPlanner, sample: CaptionSample, seconds: number, width: number, height: number): ThumbPicture {
  const { image, problems } = renderThumb(planner, { ...sample.scene, seconds }, width, height);
  return { blits: [{ image, source: whole(image), target: whole(image) }], problems };
}

/** The still cell of the caption style card (the `still` moment of `captionSample`). */
export function captionThumb(
  planner: RenderPlanner,
  root: Json,
  kinds: readonly LineKind[],
  px: number,
  width: number,
  height: number,
): ThumbPicture {
  const sample = captionSample(planner, root, kinds, px, width, height);
  return captionFrame(planner, sample, sample.still, width, height);
}
