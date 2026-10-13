import type { Easing, Id, Revision, VersionRef } from '@cuccut/protocol';

/**
 * Frame plan (architecture design §9.1): the output of Rust `render-graph`, passed to the UI through WASM. Fields map one-to-one to the serde output of `crates/render-graph`. The plan only says what to draw and where; the compositor draws the pixels according to it.
 */
export interface FramePlan {
  sequenceId: Id;
  sequenceRevision: Revision;
  /** The video frame at this moment (rounded down). */
  frame: number;
  canvas: PlanCanvas;
  /** In composition order: layers drawn first are underneath. */
  layers: VisualLayer[];
  voices: AudioVoice[];
}

export interface PlanCanvas {
  width: number;
  height: number;
  background: string;
  backgroundAlpha: number;
}

type Matrix = [number, number, number, number, number, number];

/**
 * One picture layer. `matrix` maps the unit square to canvas pixels, i.e. the `setTransform(a, b, c, d, e, f)` of Canvas 2D.
 * For video and images, the source's `sourceRect` (`[u0, v0, u1, v1]`, normalized to the display size) is drawn into the unit square. For text, shapes, generators and unsupported layers, the unit square is the instance's layout box (flip already applied). For captions, the unit square is the whole canvas.
 */
export type VisualLayer = MediaLayer | TextLayer | ShapeLayer | GeneratorLayer | CaptionLayer | UnsupportedLayer;

interface LayerBase {
  /** The instance this layer is drawn from. */
  itemId: Id;
  matrix: Matrix;
  opacity: number;
  /** Enabled effects, in application order (format spec §3.9); omitted when there are none. Unrecognized kinds carry `unsupported`; they are skipped and reported. */
  effects?: LayerEffect[];
  /** Whether this layer is inside a transition at this moment (format spec §3.9). */
  transition?: LayerTransition;
}

export interface LayerEffect {
  id: Id;
  kind: string;
  /** Omitted when empty. */
  params?: Record<string, unknown>;
  /** Reasons it cannot be drawn: `unknown-kind`, `reserved` (e.g. `lut`), `invalid-params`. */
  unsupported?: string;
}

/**
 * The transition the layer is in. `progress` is this moment's position within the window (0–1); `eased` is the value after easing, and all drawing uses `eased`.
 * The other side of a two-sided transition is in `partner` (it lies outside its own range; the source moments are in handles). A one-sided transition has no `partner`; the other side is transparent.
 */
export interface LayerTransition {
  id: Id;
  kind: string;
  params?: Record<string, unknown>;
  easing: Easing;
  progress: number;
  eased: number;
  /** Whether this layer is the outgoing side or the incoming side of the transition. */
  role: 'outgoing' | 'incoming';
  partner?: VisualLayer;
  /** Unrecognized kinds: drawn as a hard cut (only this layer is drawn) and reported. */
  unsupported?: string;
}

export interface MediaLayer extends LayerBase {
  /** A `video` layer does not necessarily come from a video instance: compositions with a pre-rendered stand-in are also given as video layers, and `asset` is the stand-in. */
  kind: 'video' | 'image';
  /** The asset this layer takes its picture from. Which asset to use is read only from here; it is not inferred from the instance. */
  asset: VersionRef;
  /** Source moment (seconds) to take the video frame from; images have none. */
  sourceSeconds?: number;
  /** Speed of source time relative to sequence time; a freeze frame is 0. Images have none. */
  sourceRate?: number;
  sourceRect: [number, number, number, number];
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  /** Style object of a text instance (same fields as the caption style). */
  content: { text: string; style: Record<string, unknown> };
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  content: { shape: Record<string, unknown> };
}

/** The picture a built-in generator draws at its local moment. */
export interface GeneratorLayer extends LayerBase {
  kind: 'generator';
  /** The composition's local moment (after its time mapping) and speed. */
  sourceSeconds: number;
  sourceRate: number;
  content: {
    generator: string;
    version: number;
    parameters: Record<string, unknown>;
    /** How long since the instance started at this moment, and how long the instance is in total (sequence time, seconds). */
    elapsedSeconds: number;
    durationSeconds: number;
  };
}

export interface CaptionLayer extends LayerBase {
  kind: 'caption';
  content: {
    /** A caption instance follows the document's current version. */
    documentId: Id;
    styleDocumentId?: Id;
    /** The sequence time at this moment: when the document is on the sequence clock, sentences are looked up by it. */
    sequenceSeconds: number;
    /** When the document is on the source asset's clock: which effect instance this moment passes through, and which moment of its source it falls on. */
    scope?: { itemId: Id; asset: VersionRef; sourceSeconds: number };
  };
}

/** A picture should be here, but the plan cannot give a way to draw it (a code-package composition without a pre-rendered stand-in, hand-drawn, placeholder box, whiteboard, asset sticker, template layer). It must be reported explicitly, not drawn as blank. */
export interface UnsupportedLayer extends LayerBase {
  kind: 'unsupported';
  asset?: VersionRef;
  content: { reason: string };
}

export function isMediaLayer(layer: VisualLayer): layer is MediaLayer {
  return layer.kind === 'video' || layer.kind === 'image';
}

/** Layers drawn into their own layout box: text, shapes, generators and unsupported layers. */
export type BoxLayer = TextLayer | ShapeLayer | GeneratorLayer | UnsupportedLayer;

export interface AudioVoice {
  itemId: Id;
  /** `embedded`: sound belonging to a video instance (or a composition with a pre-rendered stand-in); `asset` is the video asset that produces the sound. `audio`: an instance on an audio track. */
  source: 'embedded' | 'audio';
  asset: VersionRef;
  sourceSeconds: number;
  sourceRate: number;
  /** Gain at this moment: the instance's gain, fades in and out, the transition's sound crossfade and ducking are all already included. */
  gainDb: number;
  /** The gain before ducking, while ducking is pulling this sound down. Omitted when it is not being pulled down. */
  unduckedGainDb?: number;
  /** The sound in a transition's crossfade (both sides carry the same transition ID). */
  transitionId?: Id;
}

export interface PlanErrorBody {
  code: string;
  message: string;
}
