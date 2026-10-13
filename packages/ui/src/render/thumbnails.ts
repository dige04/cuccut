import type { AssetRecord, Id, Rate, Sequence, SequenceItem, Track, VersionRef } from '@cuccut/protocol';
import { loadRenderPlanner } from './preview-wasm.ts';
import type { FrozenDocument, RenderPlanner, SpeechTranscript } from './render-planner.ts';

/**
 * Thumbnails in the UI (element grid, text preset cards, caption style cards, and the Lottie stickers in the brand library) are also drawn by the render kernel. The layers to draw are placed as a sequence containing only those layers, handed to WASM to draw as one frame on a transparent background, then cropped to the cell. It is the same implementation as preview and export, so a thumbnail shows exactly how it lands on the picture.
 *
 * Thumbnails use another instance of the same compiled module (fonts are still injected), so they do not compete with the preview for video and documents.
 */

let planner: Promise<RenderPlanner> | null = null;

export function thumbnailPlanner(): Promise<RenderPlanner> {
  planner ??= loadRenderPlanner()
    .then((preview) => preview.fork())
    .catch((error: unknown) => {
      planner = null;
      throw error;
    });
  return planner;
}

/** A layer in a thumbnail: the instance's own fields (excluding ID, track and time range). */
export type ThumbLayer = Record<string, unknown> & { type: string };

/** The scene to draw: several layers on one sequence canvas (lower layers first; each occupies a track, and all start at 0 and last `duration` seconds). */
export interface ThumbScene {
  canvas: { width: number; height: number };
  fps?: Rate;
  layers: readonly ThumbLayer[];
  /** Which moment to draw (seconds). */
  seconds: number;
  /** How long each layer lasts (seconds): progress bars, timers and in/out animations are computed from it. */
  duration: number;
  documents?: readonly FrozenDocument[];
  assets?: Record<Id, AssetRecord>;
  /** Asset bytes (Lottie). */
  assetBytes?: readonly { asset: VersionRef; bytes: Uint8Array }[];
  /** Spectrum (BCS1) for waveform layers: supplied to all waveform layers. */
  spectrum?: Uint8Array;
  /** Which transcript the caption's words come from (the caption document's `sourceDocumentId` points to it): word-by-word animation advances through these words. */
  speech?: readonly SpeechTranscript[];
}

const FPS: Rate = { num: 30, den: 1 };

/** The sequence the scene is arranged as. */
export function thumbSequence(scene: ThumbScene): Sequence {
  const fps = scene.fps ?? FPS;
  const frames = Math.max(1, Math.round((scene.duration * fps.num) / fps.den));
  const tracks: Track[] = scene.layers.map((layer, index) => ({
    id: `thumb_track_${index}`,
    order: index,
    kind: layer.type === 'caption' ? 'subtitle' : 'visual',
    locked: false,
    visible: true,
    muted: false,
    solo: { enabled: false, group: 'visual' },
  }));
  const items = scene.layers.map((layer, index) => {
    const fields: Record<string, unknown> = { ...layer };
    // A thumbnail is a single still frame: layers appear together, without animation.
    delete fields.delayFrames;
    delete fields.animate;
    return {
      ...fields,
      id: `thumb_item_${index}`,
      trackId: `thumb_track_${index}`,
      enabled: true,
      locked: false,
      paintOrder: index,
      followPolicy: { kind: 'sequence-fixed' },
      span: { fromFrame: 0, durationFrames: frames },
    } as unknown as SequenceItem;
  });
  return {
    id: 'thumb_sequence',
    revision: '1',
    name: '',
    fps,
    canvas: { width: Math.round(scene.canvas.width), height: Math.round(scene.canvas.height), workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    animationBindings: [],
    tracks,
    items,
    transitions: [],
    markers: [],
    ducking: [],
  };
}

const NO_SPEECH: readonly SpeechTranscript[] = [];

/** The scene and transcript last sent to each instance (compared by reference only). When the same thumbnail draws the next moment, they are not sent again. */
const loaded = new WeakMap<RenderPlanner, { scene: ThumbScene | null; speech: readonly SpeechTranscript[] }>();

/** Two scenes are identical except for which moment they draw (same layers, documents and assets, same size and length). */
function sameScene(a: ThumbScene, b: ThumbScene): boolean {
  return (
    a.layers === b.layers &&
    a.documents === b.documents &&
    a.assets === b.assets &&
    a.assetBytes === b.assetBytes &&
    a.spectrum === b.spectrum &&
    a.fps === b.fps &&
    a.duration === b.duration &&
    a.canvas.width === b.canvas.width &&
    a.canvas.height === b.canvas.height
  );
}

/**
 * Draws the scene as a `width`×`height` picture on a transparent background (same aspect ratio as the scene canvas). `problems` lists things that could not be drawn, and hints from the kernel.
 * The picture is copied, so later WASM calls do not affect it. A scene that differs only in `seconds` (an animated thumbnail) does not re-send the sequence and documents.
 */
export function renderThumb(
  planner: RenderPlanner,
  scene: ThumbScene,
  width: number,
  height: number,
): { image: ImageData; problems: string[] } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const last = loaded.get(planner) ?? { scene: null, speech: NO_SPEECH };
  const speech = scene.speech ?? NO_SPEECH;
  // The transcript stays in the instance: a scene without a transcript must clear the one the previous caption card sent in.
  if (speech !== last.speech) planner.setSpeech(speech);
  if (!last.scene || !sameScene(last.scene, scene)) {
    planner.setVideo({ sequence: thumbSequence(scene), assets: scene.assets ?? {} });
    planner.setDocuments(scene.documents ?? []);
    for (const { asset, bytes } of scene.assetBytes ?? []) planner.setAsset(asset, bytes);
    if (scene.spectrum) {
      for (const [index, layer] of scene.layers.entries())
        if (layer.type === 'visualizer') planner.setSpectrum(`thumb_item_${index}`, scene.spectrum);
    }
  }
  loaded.set(planner, { scene, speech });
  planner.clearPictures();
  const rendered = planner.render(scene.seconds, w, h, { transparent: true });
  const image = new ImageData(new Uint8ClampedArray(planner.frame()), w, h);
  const problems = [...rendered.skipped.map((item) => item.message), ...rendered.warnings.map((warning) => warning.detail)];
  return { image, problems };
}

/** Bounding box of opaque pixels (pixels); null if fully transparent. */
export function opaqueBounds(image: ImageData): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = image;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

let stage: CanvasRenderingContext2D | null = null;

/**
 * Draws the `source` region of the picture onto the `target` region of `context` (scaled; it may extend beyond the picture). It goes through a canvas that is not attached to the page: `putImageData` does not scale and does not blend by alpha.
 */
export function drawImage(
  context: CanvasRenderingContext2D,
  image: ImageData,
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
): void {
  stage ??= document.createElement('canvas').getContext('2d');
  if (!stage) return;
  if (stage.canvas.width !== image.width || stage.canvas.height !== image.height) {
    stage.canvas.width = image.width;
    stage.canvas.height = image.height;
  }
  stage.putImageData(image, 0, 0);
  context.drawImage(stage.canvas, source.x, source.y, source.width, source.height, target.x, target.y, target.width, target.height);
}

const queue: (() => void)[] = [];
let draining = false;

/**
 * Queues a thumbnail draw: one at a time, yielding the main thread between them, so dozens of cells on screen do not freeze the UI all at once. Returns a cancel function (draws not yet started are skipped).
 */
export function scheduleThumb(task: () => void): () => void {
  let live = true;
  queue.push(() => live && task());
  if (!draining) {
    draining = true;
    setTimeout(drain, 0);
  }
  return () => {
    live = false;
  };
}

function drain(): void {
  const task = queue.shift();
  if (!task) {
    draining = false;
    return;
  }
  try {
    task();
  } finally {
    setTimeout(drain, 0);
  }
}
