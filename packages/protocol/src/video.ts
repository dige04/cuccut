import type { Id, Seq } from './domain.ts';
import { localizeText, type MessageRef } from './message-ref.ts';

/**
 * Online DTOs for the video domain (video format spec §2–§4; command and protocol spec §4–§6, §10).
 *
 * Semantics and validation are defined once by the Rust video engine (architecture design §13.2). These types are hand-written mirrors of the engine's serde output. Field names and values correspond one-to-one with `crates/video-model` (picture elements are the v2 element model; `crates/timeline`'s `schema.rs`),
 * `crates/video-engine/src/ops.rs` and `receipt.rs`. A generation tool will fill in the rest later. The format version is only 3.
 */

export type Revision = string;

/** A positive integer ratio, reduced. Used for frame rate, timebase and speed. */
export interface Rate {
  num: number;
  den: number;
}

/** Exact time: `ticks / timescale` seconds. `ticks` is a decimal integer string, to avoid losing precision in 64-bit integers. */
export interface MediaTime {
  ticks: string;
  timescale: number;
}

export interface VersionRef {
  id: Id;
  revision: Revision;
}

export interface FrameSpan {
  fromFrame: number;
  durationFrames: number;
}

export type TimeMap = { kind: 'linear'; sourceIn: MediaTime; rate: Rate } | { kind: 'hold'; sourceAt: MediaTime };

export type TrackKind = 'visual' | 'audio' | 'subtitle';
/** Direction for `arrangeItem`: up one layer, down one layer, to the top, to the bottom. */
export type ArrangeDirection = 'forward' | 'backward' | 'front' | 'back';

export interface Track {
  id: Id;
  order: number;
  kind: TrackKind;
  name?: string;
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: { enabled: boolean; group: 'audio' | 'visual' };
}

export interface ItemLineage {
  originItemId: Id;
  parentItemId?: Id;
  viaTransactionId: Id;
}

/** Semantic anchor (video format spec §3.16): an instance's start or end is pinned to a word, a sentence, a local moment of another instance, or a frame of the sequence. */
export type SemanticAnchor =
  | { kind: 'word'; speechRef: VersionRef; wordId: Id; occurrenceId?: Id; edge: 'start' | 'end'; offset?: MediaTime }
  | { kind: 'sentence'; speechRef: VersionRef; sentenceId: Id; occurrenceId?: Id; edge: 'start' | 'end' }
  | { kind: 'item'; itemId: Id; localOffset: MediaTime }
  | { kind: 'sequence'; sequenceId: Id; frame: number };

/**
 * What an instance moves with (video format spec §3.16). `addCuts` and `restoreCut` move instances with `follow-cuts`. New instances default to `follow-cuts`; `sequence-fixed` must be chosen explicitly (written by `insertItems` or `updateItem`).
 */
export type FollowPolicy =
  | { kind: 'sequence-fixed' }
  | { kind: 'follow-cuts' }
  | { kind: 'item-local'; itemId: Id }
  | { kind: 'speech-anchor'; start?: SemanticAnchor; end?: SemanticAnchor }
  | { kind: 'explicit-link-group'; groupId: Id };

interface ItemBase {
  id: Id;
  trackId: Id;
  name?: string;
  enabled: boolean;
  locked: boolean;
  paintOrder: number;
  followPolicy: FollowPolicy;
  lineage?: ItemLineage;
  linkGroupId?: Id;
  /**
   * The role of an instance in the video (open vocabulary). `broll`, `watermark`, `screentext`, `overlay` and `frame` are checked on write against the kinds they pair with:
   * `broll` is only for images and videos, `screentext` only for text, `watermark` for text, images, videos and stickers, and `overlay` and `frame` for images, videos and stickers.
   */
  role?: string;
  /** Description of the generation source. The engine does not interpret it and keeps it as is. */
  ai?: unknown;
  /** End follows the end of the sequence (§3.16): the engine computes the end of `span` at the end of every edit transaction, and the written length is ignored. Omitted otherwise. */
  untilSequenceEnd?: boolean;
  /** Extensions under a namespace. The engine does not interpret them and preserves them on write-back. Omitted when empty. */
  extensions?: Record<string, unknown>;
}

/** Corner radius of each corner, in pixels at a 540 short side. */
export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * Position of a picture instance (video format spec §3.5, the v2 element model). `x` and `y` are the percentage position of the box center within the canvas, and `w` is the box width as a percentage of the canvas width
 * (square variants are measured on the short side). Height is derived from the kind. `scale` and `scaleY` multiply the width and height; `rot` is the clockwise rotation around the center. Omitted fields take the kind's defaults.
 */
export interface Place {
  x?: number;
  y?: number;
  w?: number;
  scale?: number;
  scaleY?: number;
  rot?: number;
  /** [0, 1], default 1. */
  opacity?: number;
  /** Corner radius of the whole box, in pixels at a 540 short side. */
  radius?: number;
  cornerRadii?: CornerRadii;
  /** Omitted when false. */
  flipX?: boolean;
  flipY?: boolean;
}

/** How visual media is placed: fill the canvas, or as picture-in-picture at the source's aspect ratio. Default `pip`. */
export type VisualMode = 'fullscreen' | 'pip';
/** How the source picture fits into the box. Default `cover`. */
export type FitMode = 'cover' | 'contain';
/** When filling with `contain`, what to draw in the rest of the box: a blurred source, black, or a color (`#RRGGBB`). Default `black`. */
export type MediaBackground = 'blur' | 'black' | (string & {});

/** Mask: an ellipse inscribed in the box. `feather` is in pixels at a 540 short side. */
export interface Mask {
  shape: 'ellipse';
  feather?: number;
}

/** Tiling (images and text). */
export interface Tile {
  on: boolean;
  angle?: number;
  gapX?: number;
  gapY?: number;
  stagger?: boolean;
}

export type FilterPreset =
  | 'none'
  | 'calm1'
  | 'calm2'
  | 'calm3'
  | 'clean1'
  | 'clean2'
  | 'clean3'
  | 'cottage1'
  | 'cottage2'
  | 'cottage3'
  | 'peckham1'
  | 'peckham2'
  | 'peckham3';
export type EffectPreset =
  'none' | 'invert' | 'night_vision' | 'thermal_vision' | 'old' | 'polaroid' | 'filmic' | 'snowy' | 'box_blur' | 'bokeh_blur';

/**
 * Picture effects (video format spec §3.8): fixed fields, and omitted ones have no effect. Color-grading fields are in [-1, 1] (`hue` is multiplied by 180 degrees), `blur` is in [0, 100],
 * and lengths are in pixels at a 540 short side. `temperature`, `shadow` and `stroke` are the three merged in from v3.
 */
export interface Fx {
  filterPreset?: FilterPreset;
  effectPreset?: EffectPreset;
  effectIntensity?: number;
  grayscale?: number;
  brightness?: number;
  exposure?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  temperature?: number;
  blur?: number;
  sharpen?: number;
  noise?: number;
  vignette?: number;
  /** Shadow: the alpha outline offset, blurred and filled with color, drawn beneath the picture. Positive is right and down. */
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number };
  /** Stroke: draws a ring along the outside of the alpha outline. `width` is in (0, 100]. */
  stroke?: { width: number; color: string };
}

/** One slot of an element animation (video format spec §3.15). `preset` is a closed list of names. */
export interface AnimationSlot {
  preset: string;
  presetVersion?: number;
  dur?: number;
  delay?: number;
  intensity?: number;
  ease?: string;
  stagger?: number;
  staggerFrom?: string;
  period?: number;
  phase?: number;
  seed?: number;
}

/** The three slots of an element animation: in, out and loop. */
export interface Animation {
  enter?: AnimationSlot;
  exit?: AnimationSlot;
  loop?: AnimationSlot;
}

/** Attributes that can be keyframed (the numeric fields in `place`). */
export type KeyframeProperty = 'x' | 'y' | 'scale' | 'scaleY' | 'rot' | 'opacity' | 'radius';

/** One keyframe. Its time is either a frame local to the instance or a percentage of the instance's length, one of the two. */
export interface Keyframe {
  localFrame?: number;
  percent?: number;
  value: number;
  ease?: string;
}

/** Keyframe binding (video format spec §3.15): one attribute of one instance. Stored on the sequence. */
export interface AnimationBinding {
  id: Id;
  targetId: Id;
  propertyPath: KeyframeProperty;
  keyframes: Keyframe[];
}

/** Crop of the source picture: the proportion trimmed from each of the four sides of the source's display picture, applied before `fit` (video format spec §3.5). Each side is in [0, 1), and the left plus right and top plus bottom sums are less than 1. */
export interface Crop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Fields for visual media, shared by videos, images, asset stickers, placeholder boxes and whiteboards. */
export interface MediaFields {
  mode?: VisualMode;
  fit?: FitMode;
  bg?: MediaBackground;
  mask?: Mask;
  fx?: Fx;
}

/** The embedded audio of a video instance, or a composition instance's own sound (video format spec §3.9). */
export interface EmbeddedAudio {
  enabled: boolean;
  /** Linear multiplier, [0, 4]. */
  volume: number;
  fadeIn?: MediaTime;
  fadeOut?: MediaTime;
  /** Omitted when empty. */
  envelope?: EnvelopePoint[];
}

/** Fields shared by picture instances: span, position and element animations. */
interface VisualBase extends ItemBase {
  span: FrameSpan;
  place: Place;
  animate?: Animation;
}

export interface VideoItem extends VisualBase, MediaFields {
  type: 'video';
  assetRef: VersionRef;
  timeMap: TimeMap;
  /** Omitted when there is no crop. */
  crop?: Crop;
  embeddedAudio: EmbeddedAudio;
}

export interface ImageItem extends VisualBase, MediaFields {
  type: 'image';
  assetRef: VersionRef;
  crop?: Crop;
  tile?: Tile;
  /** Edit source of an image (`file` / `html`). Rendering uses only `assetRef`. */
  source?: string;
  /** The original fragment kept when `source` is `html`. */
  html?: string;
}

/** Timer readout: countdown or count-up. */
export interface CounterProps {
  mode: 'countdown' | 'countup';
  /** Default `s`. */
  format?: 's' | 'mm:ss' | 'hh:mm:ss';
}

/**
 * Text instance: a piece of text or a timer readout, plus the text style (video format spec §3.6). Exactly one of `text` and `counter` is given.
 * `style` is the v2 text style object, which the engine stores as an object.
 */
export interface TextItem extends VisualBase {
  type: 'text';
  text?: string;
  counter?: CounterProps;
  style?: Record<string, unknown>;
  stylePresetId?: string;
  /** Which point of the text block `place.y` pins. Default `center`. */
  verticalAlign?: 'top' | 'center' | 'bottom';
  tile?: Tile;
}

/** Shape parameters (v2's `ShapeProps`). `h` is the height as a percentage of the canvas height; when omitted the shape is square. `line` and `arrow` use endpoints (percentages within the box). */
export interface ShapeProps {
  shape: string;
  /** `#RRGGBB` or `#RRGGBBAA`. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: [number, number, number, number];
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface ShapeItem extends VisualBase {
  type: 'shape';
  shape: ShapeProps;
}

/** Sticker: `template` is a vector from the sticker template catalog. `asset` is an image, video or Lottie file that `assetRef` points to. */
export interface StickerProps {
  source: 'template' | 'asset' | (string & {});
  templateId?: string;
  path?: string;
  loop?: string;
  fillOverrides?: Record<string, string>;
}

export interface StickerItem extends VisualBase, MediaFields {
  type: 'sticker';
  assetRef?: VersionRef;
  sticker: StickerProps;
}

export interface VisualizerProps {
  style: string;
  mainColor?: string;
  secondaryColor?: string;
  fftSize?: number;
  minDb?: number;
  maxDb?: number;
  smoothing?: number;
  gain?: number;
  audio?: string;
  speaker?: string;
  alwaysShow?: boolean;
}

/** Sound wave. */
export interface VisualizerItem extends VisualBase {
  type: 'visualizer';
  visualizer: VisualizerProps;
}

export interface ProgressProps {
  style: string;
  mainColor?: string;
  secondaryColor?: string;
  /** Normalized start and end values. `start > end` is allowed to express reverse progress. */
  startProgress?: number;
  endProgress?: number;
}

/** Progress bar. */
export interface ProgressItem extends VisualBase {
  type: 'progress';
  progress: ProgressProps;
}

export interface DrawProps {
  brush: 'round' | 'sliced';
  color: string;
  size: number;
  alpha?: number;
  strokes?: { points: [number, number][] }[];
}

/** Hand-drawn. */
export interface DrawItem extends VisualBase {
  type: 'draw';
  draw: DrawProps;
}

export interface PlaceholderProps {
  variant: 'camera' | 'media' | 'screen';
  notes?: string;
}

/** Placeholder box: draws a placeholder look when there is no `assetRef`, and is sometimes drawn as visual media. */
export interface PlaceholderItem extends VisualBase, MediaFields {
  type: 'placeholder';
  assetRef?: VersionRef;
  placeholder: PlaceholderProps;
}

export interface ConfettiProps {
  style: string;
  seed?: number;
  colors?: string[];
  shapes?: string[];
  size?: number;
  speed?: number;
  gravity?: number;
  drift?: number;
  spin?: number;
  wind?: number;
  opacity?: number;
  emit?: unknown;
  origin?: unknown;
  angle?: number;
  spread?: number;
}

/** Confetti. */
export interface ConfettiItem extends VisualBase {
  type: 'confetti';
  confetti: ConfettiProps;
}

export interface WhiteboardProps {
  hand?: 'marker' | 'pen' | 'none';
  paper?: string;
  draw?: number;
  inkFirst?: boolean;
  pace?: unknown;
  strict?: boolean;
  beats?: unknown[];
}

/** Whiteboard hand-drawing: an image asset drawn out in the derived order. */
export interface WhiteboardItem extends VisualBase, MediaFields {
  type: 'whiteboard';
  assetRef: VersionRef;
  whiteboard: WhiteboardProps;
}

export type CompositionSource = { kind: 'bundle'; assetRef: VersionRef };

/** Composition instance: a picture drawn by a code bundle from local time (video format spec §3.7). When `place` has no position or width, it fills the canvas. */
export interface CompositionItem extends VisualBase {
  type: 'composition';
  source: CompositionSource;
  parameterValues: unknown;
  timeMap: TimeMap;
  /**
   * Pre-rendered stand-in: a pre-rendered video asset of this composition, sharing one time mapping with the composition.
   * Used for preview and export when the composition's runtime is unavailable or cannot render in real time.
   */
  prerender?: VersionRef;
  /** Routing of the sound the composition itself emits. Not written for compositions without sound. */
  audio?: EmbeddedAudio;
  mask?: Mask;
  fx?: Fx;
}

/** Caption instance: shows a caption document over a span of sequence time (video format spec §3.8). It follows the document's current version, so it references the document ID. Only on caption tracks. */
export interface CaptionItem extends ItemBase {
  type: 'caption';
  span: FrameSpan;
  documentId: Id;
  styleDocumentId?: Id;
  /** The instances whose timeMap projects the caption's word times onto the sequence. Omitted (empty) means the times in the document are already sequence time. */
  scopeItemIds?: Id[];
}

/** A point on a volume envelope. Its time is either an exact time local to the instance or a percentage of the instance's length, one of the two. */
export interface EnvelopePoint {
  at?: MediaTime;
  percent?: number;
  /** Linear multiplier, [0, 4]. */
  volume: number;
  /** Easing of the segment leading into this point. Default `linear`. */
  ease?: string;
}

/** Mix (video format spec §3.9). Gain is only the linear multiplier `volume`. */
export interface AudioMix {
  /** Linear multiplier, [0, 4], default 1. */
  volume: number;
  /** Omitted when false. */
  muted?: boolean;
  fadeIn?: MediaTime;
  fadeOut?: MediaTime;
  /** Volume envelope. When present it replaces `volume`. Omitted when empty. */
  envelope?: EnvelopePoint[];
}

/** The start position of an audio instance is `fromFrame` + `subframeOffset`, not snapped to frames (video format spec §2.10). */
export interface AudioItem extends ItemBase {
  type: 'audio';
  assetRef: VersionRef;
  fromFrame: number;
  subframeOffset: MediaTime;
  playDuration: MediaTime;
  timeMap: TimeMap;
  mix: AudioMix;
}

/** Picture instance with `span` and `place`. */
export type VisualItem =
  | VideoItem
  | ImageItem
  | TextItem
  | ShapeItem
  | StickerItem
  | VisualizerItem
  | ProgressItem
  | DrawItem
  | PlaceholderItem
  | ConfettiItem
  | WhiteboardItem
  | CompositionItem;

/** An instance on the sequence (unrelated to `TimelineItem` in the session). */
export type SequenceItem = VisualItem | AudioItem | CaptionItem;

/** Picture instance (has `place`). */
export function isVisualItem(item: SequenceItem): item is VisualItem {
  return item.type !== 'audio' && item.type !== 'caption';
}

/** The asset version that the instance's content references. Text, shapes, generated elements and captions have none. */
export function itemAssetRef(item: SequenceItem): VersionRef | undefined {
  switch (item.type) {
    case 'video':
    case 'image':
    case 'audio':
    case 'whiteboard':
      return item.assetRef;
    case 'sticker':
    case 'placeholder':
      return item.assetRef;
    case 'composition':
      return item.source.assetRef;
    default:
      return undefined;
  }
}

/** All asset versions the instance references: the content itself, plus the composition's pre-rendered stand-in. */
export function itemAssetRefs(item: SequenceItem): VersionRef[] {
  const refs: VersionRef[] = [];
  const content = itemAssetRef(item);
  if (content) refs.push(content);
  if (item.type === 'composition' && item.prerender) refs.push(item.prerender);
  return refs;
}

/** Mapping from instance time to source time. Instances with no source time (images, text, shapes, generated elements, captions) have none. */
export function itemTimeMap(item: SequenceItem): TimeMap | undefined {
  return item.type === 'video' || item.type === 'audio' || item.type === 'composition' ? item.timeMap : undefined;
}

/** Converts a linear multiplier to dB (for display). 0 is recorded as -Infinity. */
export function volumeToDb(volume: number): number {
  return 20 * Math.log10(volume);
}

/** Converts dB to a linear multiplier (for display). */
export function dbToVolume(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Transition kinds defined by this version (video format spec §3.9). The first five can be one-sided or two-sided and take no parameters. `dip-to-color` ({color: '#RRGGBB'})
 * and `push` ({direction}) are only for two-sided use.
 */
export type TransitionKind = 'dissolve' | 'wipe' | 'slide' | 'zoom' | 'iris' | 'dip-to-color' | 'push';
/** Kinds that can be one-sided or two-sided. */
export const SINGLE_SIDED_TRANSITION_KINDS: readonly TransitionKind[] = ['dissolve', 'wipe', 'slide', 'zoom', 'iris'];
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
/** Position of the transition window relative to the cut point: centered, starting at the cut point, or ending at the cut point. One-sided transitions can only be centered. */
export type TransitionPlacement = 'center' | 'start-at-cut' | 'end-at-cut';

/**
 * Transition (video format spec §3.9): between two abutting picture instances on the same track (both IDs present), or at the start of an instance (only `rightItemId`) or its end (only `leftItemId`). A one-sided transition's written length is unchanged, and its effective length is min(length, ⌊instance length/2⌋). Unrecognized kinds are kept as they are and rendered as a hard cut.
 */
export interface Transition {
  id: Id;
  leftItemId?: Id;
  rightItemId?: Id;
  kind: TransitionKind | (string & {});
  /** Omitted when empty. */
  params?: Record<string, unknown>;
  durationFrames: number;
  easing: Easing;
  placement: TransitionPlacement;
  /** Omitted when false. */
  audioCrossfade?: boolean;
}

/** Marker on the sequence (video format spec §3.13). `kind: 'chapter'` is a chapter, fixed to sequence time, and does not move with instances. */
export interface Marker {
  id: Id;
  frame: number;
  durationFrames?: number;
  label: string;
  kind?: 'chapter' | 'note' | 'todo';
  summary?: string;
  thumbnail?: VersionRef;
}

/** One group of a ducking rule: all instances on the track, plus the instances named individually. */
export interface DuckingGroup {
  trackIds?: Id[];
  itemIds?: Id[];
}

/** Ducking trigger: when someone is speaking (following the transcript's word stream), or when these instances are sounding. */
export type DuckingTrigger = { kind: 'speech' } | ({ kind: 'items' } & DuckingGroup);

/**
 * Ducking (video format spec §3.9): during the triggered time span, the target group is lowered by `depth` dB. It starts dropping `attack` early and recovers over `release` after the span ends.
 */
export interface DuckingRule {
  id: Id;
  name?: string;
  enabled: boolean;
  trigger: DuckingTrigger;
  target: DuckingGroup;
  /** [0, 60] dB。 */
  depth: number;
  attack: MediaTime;
  release: MediaTime;
}

/** One layer of a template: the box is in canvas percentages (top-left corner, width and height). Other fields depend on the layer's kind. */
export interface TemplateLayer {
  id: string;
  /** Default true. */
  on?: boolean;
  box: { x: number; y: number; w: number; h: number };
  [key: string]: unknown;
}

/** Template layers of the sequence (video format spec §3.17, the v2 template document). */
export interface TemplateLayers {
  id: string;
  name: string;
  layers: TemplateLayer[];
  [key: string]: unknown;
}

export interface Sequence {
  id: Id;
  revision: Revision;
  name: string;
  /** A reference used while `name` is still the engine default name (`engine.mainSequence`). Absent after renaming. For display, use {@link sequenceDisplayName}. */
  nameRef?: MessageRef;
  fps: Rate;
  /** `background` is an opaque solid color `#RRGGBB` (uppercase). */
  canvas: { width: number; height: number; workingSpace: string; background: string };
  durationPolicy: { kind: 'derived' } | { kind: 'fixed'; frames: number };
  /** Keyframe binding (§3.15). */
  animationBindings: AnimationBinding[];
  /** Template layers. Omitted when there are none. */
  template?: TemplateLayers;
  tracks: Track[];
  items: SequenceItem[];
  /** Sorted by ID. */
  transitions: Transition[];
  /** Sorted by frame (same frame sorted by ID). */
  markers: Marker[];
  /** Sorted by ID. */
  ducking: DuckingRule[];
}

/** `bundle` is a code bundle: a directory. */
export type AssetKind = 'video' | 'audio' | 'image' | 'lottie' | 'font' | 'caption' | 'document' | 'bundle' | 'other';

export interface FileLocator {
  /** Absolute path, or a path relative to the video directory (when the file is inside the project directory). */
  path: string;
  /** Modification time of the file when it was linked. */
  modifiedAt?: string;
  /** Name of the volume the file is on, used to prompt 'please connect a certain drive' when the file cannot be found. */
  volume?: string;
}

/**
 * An asset version that cannot be read at this moment (`videos.assetStatus`, video format spec §4.2). `reason` matches `details.reason` of an `ASSET_MISSING` error:
 * `missing`: the file is gone. `changed`: it is no longer the file that was registered (length mismatch). `outside-project`: the relative path leaves the project directory, so it is not read.
 */
export interface MissingAsset {
  assetId: Id;
  revision: Revision;
  reason: 'missing' | 'changed' | 'outside-project';
  /** The path a linked asset was registered with (relative to the video directory, or absolute). Absent for assets collected into the video. */
  path?: string;
  /** Name of the volume, used to prompt 'please connect a certain drive'. */
  volume?: string;
}

/**
 * An asset with no references (`videos.unusedAssets`, the ones `removeAssets` can delete). References include all instances on all sequences and their pre-rendered stand-ins,
 * chapter thumbnails, and the source assets of documents.
 */
export interface UnusedAsset {
  assetId: Id;
  name: string;
  kind: AssetKind;
  mediaType: string;
  /** Byte count of the current version. */
  byteLength: number;
  /** `managed`: the bytes are in the video directory. `linked`: the file stays where it is, and deleting the record does not touch it. */
  storage: 'managed' | 'linked';
  /** The other half of a pair (a code bundle and the pre-rendered stand-in baked from it). It also has no references, and deleting one deletes both. Omitted when there is none. */
  pairedWith?: Id[];
}

/** Where the bytes live (video format spec §4.2): in the `blobs/` folder of the video directory, or left in place, with the video recording only where to find them. Location is not part of a version's identity. */
export type AssetStorage = { mode: 'managed' } | { mode: 'linked'; locator: FileLocator; frozen: boolean };

/** Source (video format spec §4.5). Local paths appear only in `storage.locator`. */
export interface Provenance {
  origin: string;
  importedFrom?: { originalName: string; importedAt: string };
  /** Known provenance: source URL, metadata from the original platform, generation records, etc. */
  source?: unknown;
}

export interface AssetRevision {
  revision: Revision;
  contentHash: string;
  byteLength: number;
  mediaType: string;
  storage: AssetStorage;
  duration?: MediaTime;
  timebase?: Rate;
  video?: {
    displayWidth: number;
    displayHeight: number;
    rotation: number;
    pixelAspectRatio: Rate;
    frameRate: { kind: 'cfr'; rate: Rate } | { kind: 'vfr'; nominal?: Rate };
    ptsOrigin: MediaTime;
    hasAlpha: boolean;
  };
  audio?: { sampleRate: number; channels: number; layout?: string };
  /** Summary of the file manifest when the asset is a directory. Omitting `include` means the whole directory. */
  tree?: { fileCount: number; include?: string[] };
  /** Manifest of a code bundle (code bundle spec §2). Stored by the engine as an object. */
  bundle?: unknown;
  provenance: Provenance;
}

export interface AssetRecord {
  id: Id;
  kind: AssetKind;
  name: string;
  currentRevision: Revision;
  revisions: Record<Revision, AssetRevision>;
}

export interface DocumentRevision {
  revision: Revision;
  contentHash: string;
  byteLength: number;
  createdAt: string;
  /** The transaction that wrote this version. */
  createdBy: Id;
  /** Summary of the body (word count, sentence count, etc.), so that lists and agents do not need to read the body. */
  summary?: unknown;
}

/** Document header (video format spec §4.4): identity and the fingerprint of each version. Bodies are stored per version in storage and are not sent with snapshots. */
export interface DocumentRecord {
  id: Id;
  /** Document kind: `speech`, `translation`, `caption`, `caption-style`, ... (open vocabulary). */
  kind: string;
  name: string;
  language?: string;
  /** The asset this document describes (for example, the recording a transcript corresponds to). */
  sourceAssetId?: Id;
  /** The document this one derives from (for example, the transcript a translation corresponds to). */
  sourceDocumentId?: Id;
  currentRevision: Revision;
  revisions: Record<Revision, DocumentRevision>;
  extensions?: Record<string, unknown>;
}

/** The body of one version of a document (`documents.read`). */
export interface DocumentContent {
  document: DocumentRecord;
  revision: Revision;
  body: unknown;
}

export interface Checkpoint {
  id: Id;
  name: string;
  videoRevision: Revision;
  createdAt: string;
  origin: { by: string; taskId?: Id };
  note?: string;
}

/** Video snapshot (video format spec §3.1). Script-type content (transcripts, translations, caption styles, etc.) has only the document header in `documents`. Bodies are fetched per version. */
export interface VideoSnapshot {
  format: 'cuccut.video';
  schemaVersion: number;
  timeContractVersion: number;
  id: Id;
  name: string;
  revision: Revision;
  rootSequenceId: Id;
  sequences: Record<Id, Sequence>;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  fonts: Record<Id, unknown>;
  localizationSets: Record<Id, unknown>;
  canvasVariants: Record<Id, unknown>;
  syncGroups: Record<Id, unknown>;
  protections: Record<Id, unknown>;
  checkpoints: Record<Id, Checkpoint>;
  links: unknown[];
}

// ---- Edit operations (command and protocol spec §4.2) ----
// Operations with time inputs must state `sequenceId`: times are quantized to that sequence's frame rate (§6.1).

export type TimelineTimeInput = { unit: 'seconds'; value: string } | { unit: 'frames'; value: number };
export type FrameAlignment = 'exact-frame' | 'nearest-frame' | 'floor-frame' | 'ceil-frame';

type EngineManaged = 'enabled' | 'locked' | 'paintOrder' | 'followPolicy';
/** Which track to place it on: the ID of an existing track, or the `ref` of an `addTrack` in the same transaction. */
type TrackTarget = { trackId: Id; trackRef?: never } | { trackRef: string; trackId?: never };
/** The document a caption instance references: the ID of an existing document, or the `ref` of a `putDocument` in the same transaction. */
type CaptionDocuments = ({ documentId: Id; documentRef?: never } | { documentRef: string; documentId?: never }) &
  ({ styleDocumentId?: Id; styleDocumentRef?: never } | { styleDocumentRef: string; styleDocumentId?: never });
/** The asset for a media instance: a version of an existing asset, or the `ref` of an `importAsset` in the same transaction (the engine takes that asset's current version). */
type AssetTarget = { assetRef: VersionRef; assetImportRef?: never } | { assetImportRef: string; assetRef?: never };
type OptionalAssetTarget = { assetRef?: VersionRef; assetImportRef?: never } | { assetImportRef: string; assetRef?: never };
type ItemInput<Item> = Item extends CaptionItem
  ? Omit<Item, 'id' | 'lineage' | EngineManaged | 'trackId' | 'documentId' | 'styleDocumentId'> &
      Partial<Pick<Item, EngineManaged>> &
      TrackTarget &
      CaptionDocuments
  : Item extends VideoItem | ImageItem | AudioItem | WhiteboardItem
    ? Omit<Item, 'id' | 'lineage' | EngineManaged | 'trackId' | 'assetRef'> & Partial<Pick<Item, EngineManaged>> & TrackTarget & AssetTarget
    : Item extends StickerItem | PlaceholderItem
      ? Omit<Item, 'id' | 'lineage' | EngineManaged | 'trackId' | 'assetRef'> &
          Partial<Pick<Item, EngineManaged>> &
          TrackTarget &
          OptionalAssetTarget
      : Item extends SequenceItem
        ? Omit<Item, 'id' | 'lineage' | EngineManaged | 'trackId'> & Partial<Pick<Item, EngineManaged>> & TrackTarget
        : never;

/**
 * Instances written by `insertItems`. Fields are the same as `SequenceItem`. `id` and `lineage` are assigned by the engine and cannot be supplied. Engine-managed fields have defaults.
 * Tracks, caption documents and media assets can use the `ref` of something created in the same transaction (`trackRef`, `documentRef`, `styleDocumentRef`,
 * `assetImportRef`).
 */
export type SequenceItemInput = ItemInput<SequenceItem>;

/** One group for `setDucking`: `DuckingGroup` plus the `ref` of a track created in the same transaction. */
export type DuckingGroupInput = DuckingGroup & { trackRefs?: string[] };
/** Trigger for `setDucking`: when someone is speaking, or when these tracks and instances are sounding. */
export type DuckingTriggerInput = { kind: 'speech' } | ({ kind: 'items' } & DuckingGroupInput);

/**
 * Body of a cut set (video format spec §6.7, document `kind: 'cut-set'`): intervals on one source asset that were removed by spoken-word editing, sorted by `t0`, non-overlapping.
 * `t0` and `t1` are decimal strings in integer ticks, and `ref` is the provenance (the ID of an edit suggestion). Rewritten by `addCuts` and `restoreCut`.
 */
export interface CutSetBody {
  schema: 'cuccut.cut-set/1';
  timescale: number;
  clock: 'source-asset';
  scopeItemIds: Id[];
  cuts: { id: Id; t0: string; t1: string; ref?: Id }[];
}

/** One suggestion in a cut proposal (video format spec §6.2): the source interval `[t0, t1)` suggested for removal, in integer ticks written as a decimal string. */
export interface CutSuggestion {
  id: Id;
  kind: 'filler' | 'pause';
  t0: string;
  t1: string;
  /** Filler word: the interval's word. */
  wordIds?: Id[];
  /** Pause: the word before the pause. */
  afterWordId?: Id;
  /** Text in the interval: for fillers, the original words; for pauses, empty. */
  text: string;
  /** Short phrase written by the detector, shown as it is. */
  reason: string;
  detail?: string;
  /** 0 to 1. Absent when the detector cannot provide one. */
  confidence?: number;
  status: 'pending' | 'accepted';
}

/**
 * Body of a cut proposal (video format spec §6.2, document `kind: 'editorial-proposal'`, at most one per source asset). Written by `proposeCuts`,
 * and `acceptCutSuggestions` marks accepted suggestions as `accepted`. `speechRef` is the transcript version the detection read. Suggestions become stale if the transcript is changed after the proposal.
 */
export interface EditorialProposalBody {
  schema: 'cuccut.editorial-proposal/1';
  timescale: number;
  clock: 'source-asset';
  speechRef: { id: Id; revision: Revision };
  suggestions: CutSuggestion[];
}

/** Detection parameters for `proposeCuts` (video format spec §6.2). Defaults apply when not given. Seconds are decimal strings. */
export interface CutDetectOptions {
  /** Detect long pauses. Default true. */
  pauses?: boolean;
  /** Detect filler words. Default true. */
  fillers?: boolean;
  /** The shortest pause. Default 0.8 seconds. */
  minPause?: string;
  /** The length a pause is compressed to. Default 0.3 seconds (keep an extra 0.1 seconds at sentence ends, at most 0.5 seconds). Must be less than `minPause`. */
  compressTo?: string;
  /** Longer gaps do not count as pauses. Default 3 seconds. Must be greater than `minPause`. */
  maxGap?: string;
  /** Filler-word table: `auto` (Chinese and English, default), `en` or `zh`. */
  fillerLanguage?: 'auto' | 'en' | 'zh' | 'vi';
  /** Additional words to treat as fillers. */
  customFillers?: string[];
  /** Pauses between chapters are also compressed. Default false. */
  trimChapterStarts?: boolean;
}

export type EditOperation =
  /** Imports a file or directory as an asset (files are linked by default and stay in place). A directory becomes a code bundle asset. `ref` is for later operations in the same transaction to reference. */
  | {
      type: 'importAsset';
      path: string;
      name?: string;
      ref?: string;
      /**
       * Whether the bytes stay in place (`linked`) or are copied into the video directory (`managed`). If not given, files default to `linked`. Directories (code bundles, which have no original file to point to)
       * default to `managed`. `managed` requires an absolute path. `linked` may use a path relative to the video directory. They can later be collected with `collectAssets`.
       */
      storage?: 'managed' | 'linked';
      /** When importing a directory, only collect these files or subdirectories (relative paths). */
      include?: string[];
      /** The code bundle's manifest. Only meaningful for directories. */
      bundle?: unknown;
      /** The provenance known to the importer. If not given, it is recorded as 'user import'. */
      provenance?: { origin: string; source?: unknown };
    }
  /** Collects a linked asset's bytes into the video directory (`linked` to `managed`). The asset version does not change. */
  | { type: 'collectAssets'; assetIds: Id[] }
  /**
   * Deletes asset records that have no references (instances and their pre-rendered stand-ins, chapter thumbnails, and document sources no longer point to them). Rejected while references remain
   * (`INVALID_OPERATION`, `details.rule: 'asset-in-use'`, and `details.usedBy` lists who uses it). A code bundle and the pre-rendered stand-in baked from it are deleted as a pair.
   * Only the records are deleted. The bytes are reclaimed by GC, and undo can restore them. For the pre-check list, see `videos.unusedAssets`.
   */
  | { type: 'removeAssets'; assetIds: Id[] }
  /** A linked asset has moved. Checks that the content matches the registered content, then updates the location. The asset version does not change. */
  | { type: 'relinkAsset'; assetId: Id; path: string }
  /** Writes a batch of instances with exact fields (for format conversion and import). Times are already on the frame grid and in exact time, so they are not quantized again. */
  | { type: 'insertItems'; sequenceId: Id; items: SequenceItemInput[] }
  /** Writes a new version of a document. If no `documentId` is given, a new document is created. `ref` is for later operations in the same transaction to reference. The body is not included in snapshots. */
  | {
      type: 'putDocument';
      documentId?: Id;
      ref?: string;
      kind: string;
      name?: string;
      language?: string;
      sourceAsset?: { assetId: Id } | { ref: string };
      sourceDocument?: { documentId: Id } | { ref: string };
      body: unknown;
      summary?: unknown;
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'addItem';
      sequenceId: Id;
      asset: { assetId: Id } | { ref: string };
      trackId?: Id;
      at?: TimelineTimeInput;
      alignment: FrameAlignment;
      name?: string;
    }
  | {
      type: 'moveItem';
      sequenceId: Id;
      itemId: Id;
      at?: TimelineTimeInput;
      offset?: TimelineTimeInput;
      trackId?: Id;
      alignment: FrameAlignment;
    }
  | {
      type: 'moveItems';
      sequenceId: Id;
      moves: { itemId: Id; at?: TimelineTimeInput; offset?: TimelineTimeInput; trackId?: Id }[];
      alignment: FrameAlignment;
    }
  | { type: 'trimItem'; sequenceId: Id; itemId: Id; edge: 'start' | 'end'; at: TimelineTimeInput; alignment: FrameAlignment }
  | { type: 'splitItem'; sequenceId: Id; itemId: Id; at: TimelineTimeInput; alignment: FrameAlignment }
  /**
   * Merges two abutting instances on the same track into one (the inverse of split). They must be the same kind. Source-clocked instances need continuous source time at the same rate. Other fields must match, or `keep` (by the order of `itemIds`) names which side to take.
   * Keyframes and volume envelopes are rejoined into one continuous series when they can be restored; otherwise it counts as inconsistent. The earlier instance in time is kept, and the later one is deleted.
   */
  | { type: 'joinItems'; sequenceId?: Id; itemIds: [Id, Id]; keep?: 'first' | 'second' }
  | { type: 'deleteItems'; sequenceId?: Id; itemIds: Id[] }
  /**
   * Ripple delete (video format spec §6.4): deletes the sequence's `[from, to)` on `trackIds` and moves later content forward to close the gap. Media instances covering the range are split and the middle is deleted (captions projected through them follow the right-hand part). Static instances are shortened. Tracks not listed are untouched. The whole edit is rejected if a track or an instance to be moved is locked.
   */
  | { type: 'removeRange'; sequenceId?: Id; from: TimelineTimeInput; to: TimelineTimeInput; trackIds: Id[]; alignment: FrameAlignment }
  /**
   * Adds cuts to a source asset's cut set (video format spec §6.7). `from` and `to` are decimal seconds on the source asset's clock, and `ref` is the provenance (the ID of an edit suggestion).
   * A cut within 0.02 seconds of an existing cut is merged into it, keeping the earlier one's ID and provenance. In the same transaction, instances on the affected tracks are rearranged to the new kept ranges (ripple-deleted on their track). Other instances move according to `followPolicy`. Instances that lie entirely within a cut range are listed in `impact.removedByCuts`.
   */
  | { type: 'addCuts'; sequenceId: Id; assetId: Id; cuts: { from: string; to: string; ref?: Id }[] }
  /** Restores a cut: removes it from the cut set, puts back the source interval it removed at the seam, and moves later content back. If no seam can be found, it is listed in `impact.cutsNotRelaid`. */
  | { type: 'restoreCut'; sequenceId: Id; assetId: Id; cutId: Id }
  /**
   * Detects filler words and long pauses from the source asset's transcript, and writes the suggestions into its cut proposal (video format spec §6.2). The proposal is created if missing and replaced wholesale if present. The timeline is not changed.
   * Items that already lie entirely within cuts are not proposed again. If the asset has several transcripts, `speechDocumentId` specifies which one to use.
   */
  | { type: 'proposeCuts'; assetId: Id; speechDocumentId?: Id; detect?: CutDetectOptions }
  /**
   * Accepts suggestions in a cut proposal. In one transaction, it compiles them into cuts (as `addCuts`, with the suggestion's ID as `ref`) and marks them `accepted`. It is rejected (`INVALID_OPERATION`, `details.rule: 'proposal-stale'`) if the transcript was changed after the proposal was made.
   */
  | { type: 'acceptCutSuggestions'; sequenceId: Id; proposalId: Id; suggestionIds: Id[] }
  /** Adds a track, placed at the top. `ref` lets a later `insertItems` in the same transaction reference it with `trackRef`. */
  | { type: 'addTrack'; sequenceId?: Id; kind: TrackKind; name?: string; ref?: string }
  /**
   * Deletes an empty track. The `order` of other tracks is unchanged. Rejected while the track still has clips (`INVALID_OPERATION`, `details.rule: 'track-not-empty'`,
   * `details.itemIds`, and `details.next: ['deleteItems', 'moveItem']`). Also rejected when a ducking rule references it (`track-in-ducking`).
   */
  | { type: 'deleteTrack'; sequenceId?: Id; trackId: Id }
  | { type: 'updateTrack'; sequenceId?: Id; trackId: Id; locked?: boolean; visible?: boolean; muted?: boolean; name?: string }
  /**
   * Adjusts the stacking order of a picture instance (on the canvas: 'bring forward / send backward / bring to front / send to back'). Stacking order is the track's vertical position.
   * If the instance shares its track with others, it is moved to a newly created adjacent track (the new track is listed in `createdIds`, and the track that gives way is listed in `updatedIds`).
   * If it has a track to itself, the whole track moves among tracks of the same kind (swapping with a neighbor, or moving to the top or bottom, with the others shifting). It is rejected when already at the front or back (`INVALID_OPERATION`, `details.rule: 'already-at-edge'`). `TARGET_LOCKED` when the instance or its track is locked.
   */
  | { type: 'arrangeItem'; sequenceId?: Id; itemId: Id; direction: ArrangeDirection }
  /**
   * Moves a track above or below another track of the same kind (`target`). The set of `order` values for same-kind tracks is reassigned in the new order. Other kinds are not affected,
   * and instances follow their tracks. Rejected (`INVALID_OPERATION`) if the kinds differ or the target is the track itself. `TARGET_LOCKED` when the track is locked.
   */
  | { type: 'moveTrack'; sequenceId?: Id; trackId: Id; target: Id; position: 'above' | 'below' }
  /**
   * A clip's name, enabled state, lock state and follow policy. An empty name clears the name. A locked clip must be unlocked first (unlocking and then changing other fields in the same operation is allowed).
   * `followPolicy` is replaced as a whole (video format spec §3.16).
   */
  | { type: 'updateItem'; sequenceId?: Id; itemId: Id; name?: string; enabled?: boolean; locked?: boolean; followPolicy?: FollowPolicy }
  /** Changes a picture instance's position (`place`). Only the given fields change. Give `null` for a numeric field to remove it and return to the kind's default. Captions and audio have no position. */
  | {
      type: 'setTransform';
      sequenceId?: Id;
      itemId: Id;
      x?: number | null;
      y?: number | null;
      w?: number | null;
      scale?: number | null;
      scaleY?: number | null;
      rot?: number | null;
      flipX?: boolean;
      flipY?: boolean;
    }
  /**
   * Changes a picture instance's appearance. Only the given fields change, and `null` removes one (back to the default). `opacity`, `radius` and `cornerRadii` are written into `place`.
   * `mode`, `fit`, `bg` and `mask` apply to visual media. `tile` applies to images and text. `style`, `stylePresetId` and `verticalAlign` apply to text.
   * `shape` replaces the shape parameters as a whole. `crop` applies to videos and images. The engine validates which fields apply and their values against the element model.
   */
  | {
      type: 'setStyle';
      sequenceId?: Id;
      itemId: Id;
      opacity?: number | null;
      radius?: number | null;
      cornerRadii?: CornerRadii | null;
      mode?: VisualMode | null;
      fit?: FitMode | null;
      bg?: MediaBackground | null;
      mask?: Mask | null;
      tile?: Tile | null;
      style?: Record<string, unknown> | null;
      stylePresetId?: string | null;
      verticalAlign?: 'top' | 'center' | 'bottom' | null;
      shape?: ShapeProps;
      /** Crop for videos and images. `null` removes it. */
      crop?: Crop | null;
    }
  /** Changes a text instance's content. Give exactly one of `text` and `counter`. The one given replaces the other. */
  | { type: 'setText'; sequenceId?: Id; itemId: Id; text?: string; counter?: CounterProps }
  /**
   * Replaces the kind parameter of a generated element or shape as a whole (`shape`, `sticker`, `visualizer`, `progress`, `draw`, `placeholder`, `confetti`,
   * or the one in `whiteboard` that matches the instance's kind).
   */
  | { type: 'setProps'; sequenceId?: Id; itemId: Id; props: Record<string, unknown> }
  /** Replaces the three element-animation slots of a picture instance as a whole. `null` removes them. */
  | { type: 'setAnimation'; sequenceId?: Id; itemId: Id; animate: Animation | null }
  /** Replaces one attribute's keyframes of a picture instance as a whole. `null` or an empty table removes the binding. */
  | { type: 'setKeyframes'; sequenceId?: Id; itemId: Id; property: KeyframeProperty; keyframes: Keyframe[] | null }
  /** Replaces the template layers of a sequence as a whole. `null` removes them. */
  | { type: 'setTemplate'; sequenceId: Id; template: TemplateLayers | null }
  /** Changes a composition instance's parameters: `values` replaces `parameterValues` as a whole. Bundle parameters must first be validated against its schema. The engine does not support this yet, so it is rejected. */
  | { type: 'setCodeParameters'; sequenceId?: Id; itemId: Id; values: Record<string, unknown> }
  /**
   * Swaps a composition instance's code bundle version and pre-rendered stand-in in place (code bundle spec §3.3). The instance ID, track, start, geometry, effects, keyframes and so on are unchanged.
   * The time mapping returns to a linear mapping from 0. The length is taken from the new stand-in, or from the manifest's `intrinsic` if there is no stand-in. If it gets shorter, it is trimmed. If it gets longer and collides with the next instance on the track, it is rejected with `TIMELINE_OVERLAP`. If the instance has parameters and the new bundle removes or changes `parametersSchemaRef`, `parameterValues` must be given.
   * The receipt's `impact.codeEdits` states which source layer changed and the lengths before and after.
   */
  | {
      type: 'replaceCodeBundle';
      sequenceId?: Id;
      itemId: Id;
      assetRef: VersionRef;
      prerender?: VersionRef | null;
      parameterValues?: Record<string, unknown>;
    }
  /**
   * Changes sound. Audio instances change their own mix. Videos and compositions with sound change the sound track they carry (muting means it is not used).
   * Volume is a linear multiplier in [0, 4]. Fade-in and fade-out are decimal seconds, and `"0"` removes the fade. Their sum must not exceed the clip length.
   */
  | { type: 'setAudioMix'; sequenceId?: Id; itemId: Id; muted?: boolean; volume?: number; fadeIn?: string; fadeOut?: string }
  /**
   * Constant-rate speed change (video and audio). The source interval used stays the same, and the length is recalculated at the new rate. Video rounds down to a whole frame, and audio stays exact.
   * The rate must be between 0.1 and 10 and reduced. A length change that covers later instances is rejected rather than pushing them.
   */
  | { type: 'setSpeed'; sequenceId?: Id; itemId: Id; rate: Rate }
  /** Changes a caption instance to another caption style document (`kind` is `caption-style`). */
  | { type: 'setCaptionStyle'; sequenceId?: Id; itemId: Id; styleDocument: { documentId: Id } | { ref: string } }
  /** The sequence's name, canvas size (pixels) and background color (`#RRGGBB`). Positions are stored as percentages of the canvas, so instances follow the canvas when its size changes. */
  | {
      type: 'updateSequence';
      sequenceId: Id;
      name?: string;
      canvas?: { width: number; height: number };
      background?: string;
    }
  /**
   * Sets a transition. It goes between two abutting picture instances on the same track (both IDs given), or at the start of an instance (only `rightItemId`) or its end (only
   * `leftItemId`). An existing transition on the same edge is replaced (the same pair of instances keeps the original ID). The duration is quantized to frames. Two-sided transitions must be given, up to 10 seconds.
   * It is rejected (`TRANSITION_HANDLES_INSUFFICIENT`) when there are not enough handles, and it is not shortened automatically. One-sided transitions are 0.1 to 2 seconds, default 0.5 seconds when not given, and their effective length shortens with the instance. If `duration` is given, `alignment` must be stated. One-sided transitions can only be centered and cannot crossfade sound.
   */
  | {
      type: 'setTransition';
      sequenceId: Id;
      leftItemId?: Id;
      rightItemId?: Id;
      kind: TransitionKind;
      params?: Record<string, unknown>;
      duration?: TimelineTimeInput;
      alignment?: FrameAlignment;
      easing?: Easing;
      placement?: TransitionPlacement;
      audioCrossfade?: boolean;
    }
  | { type: 'removeTransition'; sequenceId?: Id; transitionId: Id }
  /** Replaces the `fx` of a visual-media item (video, image, asset sticker, placeholder box or whiteboard) or of a composition instance, as a whole. `null` removes it. */
  | { type: 'setEffects'; sequenceId?: Id; itemId: Id; fx: Fx | null }
  /** Replaces the sequence's chapters as a whole (other markers are untouched). Times must strictly increase. `chapterId` keeps the existing chapter IDs. */
  | {
      type: 'setChapters';
      sequenceId: Id;
      chapters: { chapterId?: Id; at: TimelineTimeInput; title: string; summary?: string; thumbnail?: AssetRefInput }[];
      alignment: FrameAlignment;
    }
  /** Creates a chapter (no `chapterId`; `at` and `title` required) or edits one. When `at` is given, `alignment` must be stated. `summary` and `thumbnail` given as null are removed. */
  | {
      type: 'upsertChapter';
      sequenceId: Id;
      chapterId?: Id;
      at?: TimelineTimeInput;
      alignment?: FrameAlignment;
      title?: string;
      summary?: string | null;
      thumbnail?: AssetRefInput | null;
    }
  | { type: 'removeChapter'; sequenceId?: Id; chapterId: Id }
  /**
   * Creates a ducking rule (no `ruleId`; `trigger` and `target` required) or edits one. `depth` is in [0, 60] dB, default 10.
   * `attack` and `release` are decimal seconds (0 to 5). When triggered by instances, the trigger group and the target group cannot overlap.
   */
  | {
      type: 'setDucking';
      sequenceId: Id;
      ruleId?: Id;
      name?: string;
      enabled?: boolean;
      /** Besides existing tracks and instances, you can use the `ref` of an `addTrack` in the same transaction (`trackRefs`). */
      trigger?: DuckingTriggerInput;
      target?: DuckingGroupInput;
      depth?: number;
      attack?: string;
      release?: string;
    }
  | { type: 'removeDucking'; sequenceId?: Id; ruleId: Id }
  | { type: 'createCheckpoint'; name: string; note?: string }
  | { type: 'renameVideo'; name: string };

/** Asset reference: the ID of an existing asset, or the `ref` of an `importAsset` in the same transaction. */
export type AssetRefInput = { assetId: Id } | { ref: string };

export type EditOperationType = EditOperation['type'];

// ---- Receipts, events, history ----

export interface Actor {
  kind: 'user' | 'agent' | 'system';
  id: Id;
}

export interface TimeQuantizationReceipt {
  domain: { kind: 'sequence'; sequenceId: Id };
  sequenceRevision: Revision;
  editFps: Rate;
  requested: TimelineTimeInput;
  requestedTime: MediaTime;
  actualFrame: number;
  actualTime: MediaTime;
  delta: MediaTime;
  policy: FrameAlignment;
}

/** The receipt after the transaction is persisted (command and protocol spec §5). The UI does not show 'saved' until it receives this. */
/** One change to a code picture (code bundle spec §3.4). `layer` currently has only `source`: it swaps the code bundle version and stand-in. */
export interface CodeEdit {
  itemId: Id;
  layer: 'source';
  previousBundleRef: VersionRef;
  bundleRef: VersionRef;
  previousPrerender: VersionRef | null;
  prerender: VersionRef | null;
  oldDurationFrames: number;
  newDurationFrames: number;
}

export interface TransactionReceipt {
  transactionId: Id;
  commandId: Id;
  status: 'committed';
  videoId: Id;
  previousRevision: Revision;
  videoRevision: Revision;
  eventSeq: Seq;
  /**
   * The human-readable edit name (command and protocol spec §3.1). The caller's text and reference (`labelRef` of `edits.apply`) are stored as given. The engine's default text is in English, and `labelRef` is its message reference.
   * The UI displays it in the current language with `localizeText(label, labelRef)`.
   */
  label: string;
  labelRef?: MessageRef;
  actor: Actor;
  undoOf?: Id;
  createdIds: Id[];
  updatedIds: Id[];
  deletedIds: Id[];
  lineage: Record<Id, Id[]>;
  /** IDs of the assets, documents or tracks that a `ref` in the operations resolved to. Omitted when empty. */
  refs?: Record<string, Id>;
  impact: {
    oldDurationFrames: number;
    newDurationFrames: number;
    translationUnitsStale: Id[];
    dubbingUnitsStale: Id[];
    /**
     * Instances whose semantic anchors (`speech-anchor`) cannot be resolved after this transaction, or cannot be placed at the resolved position, stay where they were (video format spec §3.16).
     * The reason is computed from the timeline by `orphanedAnchors` in `videos.inspect`.
     */
    orphanedAnchors: Id[];
    /** Transitions that no longer hold after this edit and were removed by the engine. Omitted when empty. */
    removedTransitions?: { id: Id; reason: TransitionRemovalReason }[];
    /** One-sided transitions in this transaction that were shortened because their instance got shorter: written length and effective length min(D, ⌊L/2⌋). Omitted when empty. */
    shortenedTransitions?: { id: Id; durationFrames: number; effectiveFrames: number }[];
    /** Instances deleted along with cuts: those that lie entirely within the cut range. They are also in `deletedIds`. Omitted when empty. */
    removedByCuts?: Id[];
    /** Cuts that were restored but whose seam could not be found on the sequence to put them back. They are removed from the cut set, and the instances were not moved. Omitted when empty. */
    cutsNotRelaid?: Id[];
    /** Instances deleted together because the target they followed (`item-local`) was deleted (video format spec §3.16). They are also in `deletedIds`. Omitted when empty. */
    removedWithTarget?: Id[];
    /** Code pictures changed in this transaction (code bundle spec §3.4): which layer changed, the bundle versions and stand-ins before and after, and the lengths. Omitted when empty. */
    codeEdits?: CodeEdit[];
    /** Empty tracks removed by `deleteTrack`. They are also in `deletedIds`. Omitted when empty. */
    removedTracks?: Id[];
    /** Asset records removed by `removeAssets`, including the code bundles or pre-rendered stand-ins deleted as pairs. They are also in `deletedIds`. Omitted when empty. */
    removedAssets?: Id[];
  };
  timeResolution: TimeQuantizationReceipt[];
  preserved: Id[];
  /** `unavailableReason` is the engine's default English text. `unavailableReasonRef` is its message reference (the UI displays it in the current language with `localizeText`). */
  undo: { available: boolean; token?: string; unavailableReason?: string; unavailableReasonRef?: MessageRef };
  committedAt: string;
}

/** Reasons a transition was removed: the instance is gone, the two sides no longer abut, the window extends beyond the instance, handles are insufficient, or it overlaps another transition on the same instance. */
export type TransitionRemovalReason = 'item-deleted' | 'not-adjacent' | 'too-long' | 'handles-insufficient' | 'overlap';

export type VideoEntityKind =
  'video' | 'sequence' | 'track' | 'item' | 'transition' | 'marker' | 'ducking' | 'asset' | 'document' | 'checkpoint' | 'protection';

/** Video event (command and protocol spec §10.1): one per transaction, carrying projection changes that can be applied directly. */
export interface VideoEvent {
  videoId: Id;
  /** The video's own event sequence number (outbox). It is not the same as the topic's delivery sequence number. */
  eventSeq: Seq;
  videoRevision: Revision;
  transactionId: Id;
  changedIds: Id[];
  projection: {
    upserts: { kind: VideoEntityKind; id: Id; sequenceId?: Id; value: unknown }[];
    removals: { kind: VideoEntityKind; id: Id; sequenceId?: Id }[];
  };
  actor: Actor;
  /** Same as the receipt's `label` and `labelRef`. */
  label: string;
  labelRef?: MessageRef;
  undoOf?: Id;
  taskId?: Id;
}

export interface HistoryEntry {
  transactionId: Id;
  commandId: Id;
  /** Same as the receipt. Entries for transactions committed earlier have no `labelRef`, so they are shown as `label` as is. */
  label: string;
  labelRef?: MessageRef;
  actor: Actor;
  videoRevision: Revision;
  committedAt: string;
  undoOf?: Id;
  undoneBy?: Id;
  /** 0 is a forward change. Odd numbers are undos, and positive even numbers are redos. */
  undoDepth: number;
  undoAvailable: boolean;
}

export interface UndoStep {
  transactionId: Id;
  /** The name of the forward change (used for both undo and redo). Displayed like the receipt's `label`. */
  label: string;
  labelRef?: MessageRef;
}

/** The one step the current connection's operator can undo and redo (it contains only their own changes). */
export interface UndoState {
  undo?: UndoStep;
  redo?: UndoStep;
}

export type UndoTarget = 'undo' | 'redo' | { transaction: Id };

/**
 * The engine's error body (command and protocol spec §11), placed in `RpcError.details`.
 * `code` is the error code from the spec, for example `PROJECT_REVISION_CONFLICT` or `TIMELINE_OVERLAP`.
 */
export interface EngineErrorBody {
  code: string;
  message: string;
  entityIds: Id[];
  inputRevisions: VersionRef[];
  retryability: 'same-command' | 'after-refresh' | 'after-user-action' | 'never';
  details: unknown;
  recovery?: string;
  /** The message reference for `message` (command and protocol spec §11.1). `message` and `recovery` are English default text, and the UI displays `localizeText(message, messageRef)` in the current language. */
  messageRef?: MessageRef;
  recoveryRef?: MessageRef;
}

export function isEngineErrorBody(value: unknown): value is EngineErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as EngineErrorBody).code === 'string' && 'retryability' in value;
}

// ---- Topic ----

/** The location and identity of an open video. */
export interface VideoRef {
  videoId: Id;
  name: string;
  /** Absolute path of the video directory. */
  path: string;
  /** The source it belongs to: the project, or the working directory of a session that is not part of a project. */
  source: { projectId: Id | null; conversationId: Id | null };
  /** Path relative to the source directory, using `/` as the separator. */
  relPath: string;
}

export interface VideoTopicSnapshot {
  video: VideoSnapshot;
  /** The video event sequence number at which the snapshot was taken. */
  eventSeq: Seq;
}

/**
 * Events on the `video:<id>` topic. `video.replaced` replaces everything when the engine process restarts and incremental continuity cannot be proven.
 * `video.closed` means the video was closed in the Runtime, and the UI must reopen it.
 */
export type VideoTopicEvent =
  | { type: 'video.event'; event: VideoEvent }
  | { type: 'video.replaced'; snapshot: VideoTopicSnapshot }
  | { type: 'video.closed'; reason: string };

// ---- Shared projection reducer: used by both the Runtime mirror and the UI ----

function itemStart(item: SequenceItem, fps: Rate): number {
  if (item.type === 'audio') return (item.fromFrame * fps.den) / fps.num + mediaTimeToSeconds(item.subframeOffset);
  return (item.span.fromFrame * fps.den) / fps.num;
}

function sortItems(items: SequenceItem[], tracks: Track[], fps: Rate): SequenceItem[] {
  const order = new Map(tracks.map((t) => [t.id, t.order]));
  return [...items].sort(
    (a, b) =>
      (order.get(a.trackId) ?? 0) - (order.get(b.trackId) ?? 0) ||
      itemStart(a, fps) - itemStart(b, fps) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function compareIds(a: Id, b: Id): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Applies one video event to the snapshot and returns a new snapshot (the input is not modified). Events whose sequence number is not greater than the snapshot's are returned as they are (duplicate delivery).
 */
export function applyVideoEvent(state: VideoTopicSnapshot, event: VideoEvent): VideoTopicSnapshot {
  if (BigInt(event.eventSeq) <= BigInt(state.eventSeq)) return state;
  const video: VideoSnapshot = {
    ...state.video,
    sequences: { ...state.video.sequences },
    assets: { ...state.video.assets },
    documents: { ...state.video.documents },
    checkpoints: { ...state.video.checkpoints },
    protections: { ...state.video.protections },
  };
  const touched = new Set<Id>();
  const sequenceOf = (id: Id | undefined): Sequence | undefined => {
    if (!id) return undefined;
    const seq = video.sequences[id];
    if (!seq) return undefined;
    if (!touched.has(id)) {
      touched.add(id);
      video.sequences[id] = {
        ...seq,
        tracks: [...seq.tracks],
        items: [...seq.items],
        transitions: [...seq.transitions],
        markers: [...seq.markers],
        ducking: [...seq.ducking],
      };
    }
    return video.sequences[id];
  };

  for (const removal of event.projection.removals) {
    switch (removal.kind) {
      case 'item': {
        const seq = sequenceOf(removal.sequenceId);
        if (seq) seq.items = seq.items.filter((i) => i.id !== removal.id);
        break;
      }
      case 'track': {
        const seq = sequenceOf(removal.sequenceId);
        if (seq) seq.tracks = seq.tracks.filter((t) => t.id !== removal.id);
        break;
      }
      case 'transition': {
        const seq = sequenceOf(removal.sequenceId);
        if (seq) seq.transitions = seq.transitions.filter((t) => t.id !== removal.id);
        break;
      }
      case 'marker': {
        const seq = sequenceOf(removal.sequenceId);
        if (seq) seq.markers = seq.markers.filter((m) => m.id !== removal.id);
        break;
      }
      case 'ducking': {
        const seq = sequenceOf(removal.sequenceId);
        if (seq) seq.ducking = seq.ducking.filter((r) => r.id !== removal.id);
        break;
      }
      case 'sequence':
        delete video.sequences[removal.id];
        break;
      case 'asset':
        delete video.assets[removal.id];
        break;
      case 'document':
        delete video.documents[removal.id];
        break;
      case 'checkpoint':
        delete video.checkpoints[removal.id];
        break;
      case 'protection':
        delete video.protections[removal.id];
        break;
      case 'video':
        break;
    }
  }

  for (const upsert of event.projection.upserts) {
    switch (upsert.kind) {
      case 'video': {
        const value = upsert.value as { name: string; rootSequenceId: Id };
        video.name = value.name;
        video.rootSequenceId = value.rootSequenceId;
        break;
      }
      case 'sequence': {
        const header = upsert.value as Omit<Sequence, 'tracks' | 'items' | 'transitions' | 'markers' | 'ducking'>;
        const existing = sequenceOf(upsert.id);
        if (existing) {
          Object.assign(existing, header);
          // Omitted when there are no template layers: after removal, the projection must not keep the old ones. The same applies to references to the default name (omitted after renaming).
          if (!('template' in header)) delete existing.template;
          if (!('nameRef' in header)) delete existing.nameRef;
        } else {
          video.sequences[upsert.id] = {
            transitions: [],
            markers: [],
            ducking: [],
            tracks: [],
            items: [],
            ...header,
            id: upsert.id,
          };
          touched.add(upsert.id);
        }
        break;
      }
      case 'track': {
        const seq = sequenceOf(upsert.sequenceId);
        const track = upsert.value as Track;
        if (seq) seq.tracks = [...seq.tracks.filter((t) => t.id !== track.id), track];
        break;
      }
      case 'item': {
        const seq = sequenceOf(upsert.sequenceId);
        const item = upsert.value as SequenceItem;
        if (seq) seq.items = [...seq.items.filter((i) => i.id !== item.id), item];
        break;
      }
      case 'transition': {
        const seq = sequenceOf(upsert.sequenceId);
        const transition = upsert.value as Transition;
        if (seq) seq.transitions = [...seq.transitions.filter((t) => t.id !== transition.id), transition];
        break;
      }
      case 'marker': {
        const seq = sequenceOf(upsert.sequenceId);
        const marker = upsert.value as Marker;
        if (seq) seq.markers = [...seq.markers.filter((m) => m.id !== marker.id), marker];
        break;
      }
      case 'ducking': {
        const seq = sequenceOf(upsert.sequenceId);
        const rule = upsert.value as DuckingRule;
        if (seq) seq.ducking = [...seq.ducking.filter((r) => r.id !== rule.id), rule];
        break;
      }
      case 'asset':
        video.assets[upsert.id] = upsert.value as AssetRecord;
        break;
      case 'document':
        video.documents[upsert.id] = upsert.value as DocumentRecord;
        break;
      case 'checkpoint':
        video.checkpoints[upsert.id] = upsert.value as Checkpoint;
        break;
      case 'protection':
        video.protections[upsert.id] = upsert.value;
        break;
    }
  }

  for (const id of touched) {
    const seq = video.sequences[id];
    if (!seq) continue;
    seq.tracks = sortTracks(seq.tracks);
    seq.items = sortItems(seq.items, seq.tracks, seq.fps);
    seq.transitions = [...seq.transitions].sort((a, b) => compareIds(a.id, b.id));
    seq.markers = [...seq.markers].sort((a, b) => a.frame - b.frame || compareIds(a.id, b.id));
    seq.ducking = [...seq.ducking].sort((a, b) => compareIds(a.id, b.id));
  }
  video.revision = event.videoRevision;
  return { video, eventSeq: event.eventSeq };
}

// ---- Display time conversion (only for display and hit testing; commands use frames or decimal second strings) ----

export function mediaTimeToSeconds(time: MediaTime): number {
  return Number(time.ticks) / time.timescale;
}

export function framesToSeconds(frames: number, fps: Rate): number {
  return (frames * fps.den) / fps.num;
}

export function secondsToFrames(seconds: number, fps: Rate): number {
  return (seconds * fps.num) / fps.den;
}

/** An instance's span on the sequence (seconds). */
export function itemRangeSeconds(item: SequenceItem, fps: Rate): { start: number; end: number } {
  if (item.type === 'audio') {
    const start = itemStart(item, fps);
    return { start, end: start + mediaTimeToSeconds(item.playDuration) };
  }
  return { start: framesToSeconds(item.span.fromFrame, fps), end: framesToSeconds(item.span.fromFrame + item.span.durationFrames, fps) };
}

// i18n-ignore: Videos created before nameRef existed stored this default name (video format spec §3.2). It is used only to recognize it
const LEGACY_DEFAULT_SEQUENCE_NAME = '主序列';

/**
 * The sequence's name for display (video format spec §3.2). The engine's default name is shown in the reader's language, and names the user chose are shown as they are. Videos created before `nameRef` existed
 * stored the Chinese default name "主序列" (main sequence) with no reference. That is also treated as a default name.
 */
export function sequenceDisplayName(sequence: Pick<Sequence, 'name' | 'nameRef'>): string {
  const ref = sequence.nameRef ?? (sequence.name === LEGACY_DEFAULT_SEQUENCE_NAME ? { key: 'engine.mainSequence' } : undefined);
  return localizeText(sequence.name, ref);
}

/** Sequence length (frames): the maximum end of all instances, rounded up. */
export function sequenceDurationFrames(sequence: Sequence): number {
  let max = 0;
  for (const item of sequence.items) {
    if (item.type === 'audio')
      max = Math.max(max, Math.ceil(secondsToFrames(itemRangeSeconds(item, sequence.fps).end, sequence.fps) - 1e-9));
    else max = Math.max(max, item.span.fromFrame + item.span.durationFrames);
  }
  return max;
}

/**
 * The frame the video's cover is taken from (product design §4.2, 'the cover is taken from the current working draft'): the earliest video clip on the root sequence that is enabled, on a visible track, and whose asset has picture.
 * It is the asset time (seconds) corresponding to the start of that clip. The video card in the session header and Space's thumbnail (`space.thumbnail`) use this same frame. It is null when there is no such clip.
 */
export function posterFrame(video: VideoSnapshot): { asset: VersionRef; at: number } | null {
  const sequence = video.sequences[video.rootSequenceId];
  if (!sequence) return null;
  const visible = new Set(sequence.tracks.filter((track) => track.visible).map((track) => track.id));
  let best: { from: number; asset: VersionRef; at: number } | null = null;
  for (const item of sequence.items) {
    if (item.type !== 'video' || !item.enabled || !visible.has(item.trackId)) continue;
    if (!video.assets[item.assetRef.id]?.revisions[item.assetRef.revision]?.video) continue;
    if (best && best.from <= item.span.fromFrame) continue;
    const at = item.timeMap.kind === 'hold' ? mediaTimeToSeconds(item.timeMap.sourceAt) : mediaTimeToSeconds(item.timeMap.sourceIn);
    best = { from: item.span.fromFrame, asset: item.assetRef, at };
  }
  return best ? { asset: best.asset, at: best.at } : null;
}
