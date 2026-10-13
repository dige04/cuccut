import { createHash } from 'node:crypto';
import {
  itemAssetRef,
  sequenceDurationFrames,
  type Crop,
  type DocumentRecord,
  type EditOperation,
  type FitMode,
  type Id,
  type MediaTime,
  type Rate,
  type Sequence,
  type SequenceItem,
  type Track,
  type TrackKind,
  type VersionRef,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { upgradeLegacyTranslation } from '../videos/legacy-translation.ts';

/**
 * Planning for deriving a child video (architecture design §3.5 "Deriving child videos", `derivation` in video format spec §4.6):
 * copy the parent video's whole timeline and transcripts, then cut away everything outside the range with cuts (`addCuts`, video
 * format spec §6.7). When the child video opens in the editor, the transcript panel shows the parent's full text, speech outside
 * the range shows as cut, and restoring cuts widens the clip. This module only computes transactions; it does not commit or read or
 * write files. Shared by the `videos_derive` tool, the `videos.derive` RPC and tests.
 *
 * Two transactions:
 *
 * 1. Copy (`operations` of `planDerivation`): tracks, assets (the same files; those managed in the parent are managed in the child
 *    too), all items (except caption items; not shifted, not truncated), whole transcripts, chapters, canvas background and the
 *    derivation source document.
 * 2. Finish (`planDerivationTrim`, needs the IDs created by the first): track hiding and muting, transitions, translations, the
 *    parent's existing cut sets, then the cuts outside the range on the primary asset (after cutting, only the range remains on the
 *    timeline), and finally re-locking tracks that were locked in the parent. Translations are always written as
 *    `cuccut.translation/2`: a `/1` imported from an old project is converted by the transcript's current sentences
 *    (`legacy-translation.ts`); one that cannot be converted is not copied and is reported as `translations-skipped`.
 *
 * Cuts are recorded on the asset's source clock and apply only to items playing that asset; all other items are changed to
 * `follow-cuts` when copied, moving and shrinking with the cuts, and any that fall entirely inside a cut range are deleted (they do
 * not come back when cuts are restored; reported as `items-not-restorable`). The first version only records cuts on one primary
 * asset (the one played most on the timeline): parts outside the range that the primary asset does not cover (gaps, stretches with
 * only other assets or graphics) stay in the child video and are reported as `range-not-exact`.
 */

export type DeriveErrorCode = 'DERIVE_RANGE_EMPTY' | 'DERIVE_UNSUPPORTED_ITEM' | 'DERIVE_PARENT_UNPLACED';

/** A derivation rejection: the caller maps `code` to an RPC error or a tool error. */
export class DeriveError extends Error {
  readonly code: DeriveErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: DeriveErrorCode, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

/** Things dropped, changed or not achieved during derivation. */
export type DeriveWarningCode =
  | 'anchor-dropped'
  | 'locks-dropped'
  | 'animation-bindings-dropped'
  | 'multiple-assets'
  | 'range-not-exact'
  | 'items-not-restorable'
  | 'translations-skipped'
  | 'crops-adjusted'
  | 'animation-split';

export interface DeriveWarning {
  code: DeriveWarningCode;
  itemId?: Id;
  assetId?: Id;
  /** `translations-skipped`: the translation that could not be copied (its ID in the parent). */
  documentId?: Id;
  /**
   * `range-not-exact`: frames outside the range that could not be cut; `items-not-restorable`: items the cuts will delete;
   * `multiple-assets`: number of media assets; `crops-adjusted`: per-shot crops clamped to the range, or dropped as empty after clamping.
   */
  count?: number;
}

export interface DeriveSettings {
  width: number;
  height: number;
  fit: FitMode | null;
  crop: Crop | null;
  captions: boolean;
  translations: boolean;
  chapters: boolean;
  /**
   * Per-shot crops: one crop for each `[from, to)` seconds on the parent's edited timeline. Already frame-aligned, clamped to the
   * range and sorted by from; present only when the caller gave `crops` (may be an empty array after clamping), otherwise omitted and
   * not part of the idempotency key. Uncovered parts use `crop`.
   */
  crops?: CropShot[];
}

/** One shot: `[from, to)` seconds on the timeline and its crop (edge fractions, as in `Crop`). */
export interface CropShot extends Crop {
  from: number;
  to: number;
}

/** The per-shot crops on the primary asset's source clock (`framing` in the derivation source document), for splitting by shot later when cuts are restored. */
export interface DerivationFraming {
  /** The primary asset (its ID in the parent). */
  assetId: Id;
  /** Each piece of the primary asset in the range: `[from, to)` seconds on the source clock and its crop (null when uncropped). */
  shots: { from: number; to: number; crop: Crop | null }[];
}

/** The range after frame alignment: frame numbers and seconds (`[start, end)`). */
export interface AlignedRange {
  startFrame: number;
  endFrame: number;
  start: number;
  end: number;
}

/** One cut outside the range: seconds on the source clock of a parent asset. */
export interface DerivedCut {
  assetId: Id;
  from: number;
  to: number;
}

/** Body of the derivation source document (`cuccut.derivation/1`). */
export interface DerivationBody {
  schema: 'cuccut.derivation/1';
  parentVideoId: Id;
  parentRevision: string;
  range: { start: number; end: number };
  /** The primary asset carrying the cuts (its ID in the parent); null when there is no media to cut. */
  primaryAssetId: Id | null;
  cuts: DerivedCut[];
  settings: DeriveSettings;
  /** The per-shot crops (`settings.crops`) on the primary asset's source clock; only when `crops` was given and there is a primary asset. */
  framing?: DerivationFraming;
  key: string;
  /** Opening line, why it was picked, and note cards (the result page cards for cutting into shorts): only when the caller gave them; not part of the idempotency key. */
  hook?: string;
  reason?: string;
  notes?: string[];
}

/** Notes the caller attaches when deriving (`hook`, `reason`, `notes`), written as is into the derivation source document. */
export interface DerivePick {
  hook?: string;
  reason?: string;
  notes?: string[];
}

/** Which track to place on: an existing track of the child video, or the ref of a track created in the first transaction. */
export type TrackTarget = { trackId: Id } | { trackRef: string };

/** An item in the child video, found again by track, type and timeline position (not shifted when copied, so the same as in the parent). */
export interface ItemLocator {
  track: TrackTarget;
  type: SequenceItem['type'];
  position: string;
}

export interface PlannedTransition {
  left?: ItemLocator;
  right?: ItemLocator;
  kind: string;
  params?: Record<string, unknown>;
  durationFrames: number;
  easing: string;
  placement: string;
  audioCrossfade?: boolean;
}

/** A translation written while finishing: `sourceBasis` and `sourceDocument` are filled in once the child's transcript has an ID. */
export interface PlannedTranslation {
  from: Id;
  speechRef: string;
  name: string;
  language?: string;
  body: Record<string, unknown>;
}

/** A cut set copied while finishing: cuts unchanged, `scopeItemIds` mapped to the child's items. */
export interface PlannedCutSet {
  from: Id;
  importRef: string;
  name: string;
  body: Record<string, unknown>;
  scope: ItemLocator[];
}

export interface PlannedSpeech {
  ref: string;
  from: Id;
  assetId: Id;
  words: number;
}

export interface TrimPlan {
  tracks: { track: TrackTarget; visible?: false; muted?: true; locked?: true }[];
  transitions: PlannedTransition[];
  translations: PlannedTranslation[];
  cutSets: PlannedCutSet[];
  cuts: { importRef: string; cuts: { from: string; to: string }[] } | null;
}

export interface DerivationPlan {
  operations: EditOperation[];
  trim: TrimPlan;
  cuts: DerivedCut[];
  speech: PlannedSpeech[];
  derivation: DerivationBody;
  warnings: DeriveWarning[];
  /** Number of items copied. */
  itemCount: number;
  /** Source ranges played within the range (parent asset IDs, seconds on the source clock), sorted by asset and start; used to count the child caption layer's cues within the range (`cuesInRange`). */
  kept: DerivedCut[];
}

export interface DerivationInput {
  snapshot: VideoSnapshot;
  range: AlignedRange;
  settings: DeriveSettings;
  key: string;
  /** The child video's root sequence: ID, and the tracks and background it was created with. */
  target: { sequenceId: Id; tracks: readonly Track[]; background: string };
  /** Files of asset revisions (absolute paths), keyed by `assetFileKey`. */
  files: ReadonlyMap<string, string>;
  /** Bodies of the parent's transcripts, translations and cut sets (current revisions), keyed by document ID. Missing ones are not copied. */
  documents: ReadonlyMap<Id, unknown>;
  /** Names written into the video (in the current language). */
  labels: { derivationName: string };
  /** Notes attached by the caller; empty ones are not written. */
  pick?: DerivePick;
  /** Number of shots `alignCrops` clamped or dropped: reported as `crops-adjusted` when greater than 0. */
  cropsAdjusted?: number;
}

/** The non-empty note fields (trimmed; empty note cards dropped). */
export function pickFields(pick: DerivePick | undefined): DerivePick {
  if (!pick) return {};
  const hook = pick.hook?.trim();
  const reason = pick.reason?.trim();
  const notes = (pick.notes ?? []).map((n) => n.trim()).filter(Boolean);
  return { ...(hook ? { hook } : {}), ...(reason ? { reason } : {}), ...(notes.length ? { notes } : {}) };
}

export const DERIVATION_REF = 'derivation';
export const DERIVATION_KIND = 'derivation';
export const DERIVATION_SCHEMA = 'cuccut.derivation/1';
const CUT_SET_KIND = 'cut-set';
/** Cuts shorter than this are not recorded (leftovers from sub-frame audio offsets). */
const MIN_CUT_SECONDS = 0.001;

export function assetFileKey(ref: VersionRef): string {
  return `${ref.id}@${ref.revision}`;
}

// ---- Rationals (BigInt), only for time conversion ----

interface Q {
  n: bigint;
  d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function q(n: bigint, d: bigint = 1n): Q {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const ZERO = q(0n);
const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
const cmp = (a: Q, b: Q): number => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
const min = (a: Q, b: Q): Q => (cmp(a, b) <= 0 ? a : b);
const max = (a: Q, b: Q): Q => (cmp(a, b) >= 0 ? a : b);
const toNumber = (a: Q): number => Number(a.n) / Number(a.d);

function floorDiv(n: bigint, d: bigint): bigint {
  const r = n / d;
  return n % d !== 0n && n < 0n !== d < 0n ? r - 1n : r;
}

const frames = (f: number, fps: Rate): Q => q(BigInt(f) * BigInt(fps.den), BigInt(fps.num));
const time = (t: MediaTime): Q => q(BigInt(t.ticks), BigInt(t.timescale));
const rate = (r: Rate): Q => q(BigInt(r.num), BigInt(r.den));
const exact = (a: Q): string => `${a.n}/${a.d}`;

/** Decimal seconds with 9 decimal places: rounds up with `up`, otherwise down (cut starts round up and ends round down, so a cut can only be slightly shorter, never cutting into the range or past the asset). */
function decimal(value: Q, up: boolean): string {
  const scale = 1_000_000_000n;
  const scaled = value.n * scale;
  let units = floorDiv(scaled, value.d);
  if (up && units * value.d !== scaled) units += 1n;
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(9, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

// ---- Range and idempotency key ----

/** A word's position on the timeline (seconds): transcript words projected onto the edited timeline via the items playing them. */
export interface TimelineWord {
  start: number;
  end: number;
}

/**
 * Aligns `[start, end)` seconds on the edited timeline to frames: start rounds down, end rounds up, clamped to the sequence length.
 * `DERIVE_RANGE_EMPTY` when empty. Converting seconds to frames leaves a small margin so float errors like 0.1 × 30 do not add a frame.
 *
 * With `words` (`timelineWords`), the boundaries stay in the pauses between sentences: if rounding the end up passes the start of the
 * next word (the first word starting after the end; with a pause shorter than one frame it would swallow the first word of the next
 * sentence), round it down instead; if rounding the start down lands before the end of the previous word (the last word ending before
 * the start), round it up instead. Neither change is made if it would empty the range. Returns the range actually used.
 */
export function alignRange(sequence: Sequence, start: number, end: number, words: readonly TimelineWord[] = []): AlignedRange {
  const fps = sequence.fps;
  const toFrames = (seconds: number) => (seconds * fps.num) / fps.den;
  const toSeconds = (frame: number) => (frame * fps.den) / fps.num;
  const duration = sequenceDurationFrames(sequence);
  let startFrame = Math.max(0, Math.floor(toFrames(start) + 1e-9));
  let endFrame = Math.min(duration, Math.ceil(toFrames(end) - 1e-9));
  let next = Infinity;
  let previous = -Infinity;
  for (const word of words) {
    if (word.start >= end - 1e-9 && word.start < next) next = word.start;
    if (word.end <= start + 1e-9 && word.end > previous) previous = word.end;
  }
  if (toSeconds(endFrame) > next + 1e-9) {
    const down = Math.min(duration, Math.floor(toFrames(end) + 1e-9));
    if (down > startFrame) endFrame = down;
  }
  if (toSeconds(startFrame) < previous - 1e-9) {
    const up = Math.ceil(toFrames(start) - 1e-9);
    if (up < endFrame) startFrame = up;
  }
  if (!(endFrame > startFrame)) throw new DeriveError('DERIVE_RANGE_EMPTY', { start, end, durationFrames: duration });
  return {
    startFrame,
    endFrame,
    start: toNumber(frames(startFrame, fps)),
    end: toNumber(frames(endFrame, fps)),
  };
}

/** Idempotency key: the first 12 hex digits of the sha256 of the parent video, revision, aligned range and settings. The name is not included. */
export function derivationKey(input: {
  parentVideoId: Id;
  parentRevision: string;
  range: { start: number; end: number };
  settings: DeriveSettings;
}): string {
  const s = input.settings;
  const canonical = JSON.stringify({
    parentVideoId: input.parentVideoId,
    parentRevision: input.parentRevision,
    range: { start: input.range.start, end: input.range.end },
    settings: {
      width: s.width,
      height: s.height,
      fit: s.fit,
      crop: s.crop ? { left: s.crop.left, top: s.crop.top, right: s.crop.right, bottom: s.crop.bottom } : null,
      captions: s.captions,
      translations: s.translations,
      chapters: s.chapters,
      // Only included when per-shot crops are given, so keys of older calls do not change.
      ...(s.crops ? { crops: s.crops.map((c) => [c.from, c.to, c.left, c.top, c.right, c.bottom]) } : {}),
    },
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/** When the gap at the start or end of the range not covered by per-shot crops is shorter than this many seconds, the first or last shot is extended outward to cover it (`alignCrops`). */
const EDGE_CROP_TOLERANCE_SECONDS = 0.5;

/**
 * Aligns per-shot crops to frames: each shot's start and end round to the nearest frame (the earlier one when exactly halfway),
 * clamped to the aligned range `[S, E)` and sorted by from. The number of shots clamped, or dropped as empty after clamping, goes in
 * `adjusted` (reported as `crops-adjusted`). The caller guarantees shots do not overlap in seconds (argument validation).
 * After alignment, if the first shot starts after the range start or the last shot ends before the range end, by a gap shorter than
 * `EDGE_CROP_TOLERANCE_SECONDS` (0.5 s), it is extended outward to the range boundary: the range boundaries snap into pauses (and may
 * be a few frames wider than requested), while the caller's first and last shots match the requested start and end exactly; without
 * extending, that sliver would become a very short clip of its own with the default crop. Only the first and last shots move, only
 * outward, and this does not count toward `adjusted`; larger gaps still use the default crop, and what already counts toward
 * `adjusted` is unchanged.
 */
export function alignCrops(sequence: Sequence, range: AlignedRange, crops: readonly CropShot[]): { crops: CropShot[]; adjusted: number } {
  const fps = sequence.fps;
  const toFrame = (seconds: number) => Math.ceil((seconds * fps.num) / fps.den - 0.5 - 1e-9);
  const out: CropShot[] = [];
  let adjusted = 0;
  const outFrames: Array<{ from: number; to: number }> = [];
  let previous = range.startFrame;
  for (const shot of [...crops].sort((x, y) => x.from - y.from)) {
    const rawFrom = toFrame(shot.from);
    const rawTo = toFrame(shot.to);
    const from = Math.max(rawFrom, range.startFrame, previous);
    const to = Math.min(rawTo, range.endFrame);
    if (from !== rawFrom || to !== rawTo || to <= from) adjusted++;
    if (to <= from) continue;
    previous = to;
    outFrames.push({ from, to });
    out.push({
      from: toNumber(frames(from, fps)),
      to: toNumber(frames(to, fps)),
      left: shot.left,
      top: shot.top,
      right: shot.right,
      bottom: shot.bottom,
    });
  }
  // Small gaps at the edges merge into the first and last shots (outward only, not counted in adjusted).
  const tolerance = (EDGE_CROP_TOLERANCE_SECONDS * fps.num) / fps.den;
  const first = outFrames[0];
  const last = outFrames[outFrames.length - 1];
  if (first && first.from > range.startFrame && first.from - range.startFrame < tolerance) {
    out[0]!.from = toNumber(frames(range.startFrame, fps));
  }
  if (last && last.to < range.endFrame && range.endFrame - last.to < tolerance) {
    out[out.length - 1]!.to = toNumber(frames(range.endFrame, fps));
  }
  return { crops: out, adjusted };
}

// ---- Which items to copy ----

function rootSequence(snapshot: VideoSnapshot): Sequence {
  const sequence = snapshot.sequences[snapshot.rootSequenceId];
  if (!sequence) throw new Error('Video has no root sequence');
  return sequence;
}

/** The tracks to copy (except subtitle tracks, in order, empty ones skipped) and their items (except caption items, in paint order). Rejects composition items. */
function copiedTimeline(sequence: Sequence): { tracks: Track[]; items: SequenceItem[] } {
  const ordered = [...sequence.tracks].filter((t) => t.kind !== 'subtitle').sort((a, b) => a.order - b.order);
  const items: SequenceItem[] = [];
  const tracks: Track[] = [];
  for (const track of ordered) {
    const onTrack = sequence.items
      .filter((item) => item.trackId === track.id && item.type !== 'caption')
      .sort((a, b) => a.paintOrder - b.paintOrder);
    if (!onTrack.length) continue;
    for (const item of onTrack) {
      // Composition items reference a code bundle (a directory) and cannot be copied via asset files.
      if (item.type === 'composition') throw new DeriveError('DERIVE_UNSUPPORTED_ITEM', { itemId: item.id, itemType: item.type });
    }
    tracks.push(track);
    items.push(...onTrack);
  }
  return { tracks, items };
}

/** An item's position on the timeline, used to find it again in the child video (not shifted when copied). */
function positionOf(item: SequenceItem): string {
  if (item.type === 'audio') return `a:${item.fromFrame}:${exact(time(item.subframeOffset))}:${exact(time(item.playDuration))}`;
  return `v:${item.span.fromFrame}:${item.span.durationFrames}`;
}

/** An item's input: drops what the engine assigns (ID, lineage, track, paint order) and references to other objects in the parent (link group, follow target); always follows cuts. */
function itemInput(item: SequenceItem, settings: DeriveSettings, warnings: DeriveWarning[]): Record<string, unknown> {
  const {
    id: _id,
    lineage: _lineage,
    trackId: _trackId,
    paintOrder: _paintOrder,
    linkGroupId: _link,
    followPolicy,
    locked,
    ...rest
  } = item as SequenceItem & Record<string, unknown>;
  const input: Record<string, unknown> = { ...rest, followPolicy: { kind: 'follow-cuts' } };
  if (followPolicy.kind !== 'sequence-fixed' && followPolicy.kind !== 'follow-cuts') warnings.push({ code: 'anchor-dropped', itemId: item.id });
  // Locked items block the ripple delete of cuts: copy them unlocked.
  if (locked) warnings.push({ code: 'locks-dropped', itemId: item.id });
  delete input.assetRef;
  if (item.type === 'video') {
    if (settings.fit) input.fit = settings.fit;
    if (settings.crop) input.crop = settings.crop;
  }
  return input;
}

// ---- Per-shot crops: split the primary asset's video items at shot boundaries ----

/** One frame-aligned shot. */
interface FrameShot {
  fromFrame: number;
  toFrame: number;
  crop: Crop;
}

const cropOf = (c: Crop): Crop => ({ left: c.left, top: c.top, right: c.right, bottom: c.bottom });
const sameCrop = (a: Crop | null, b: Crop | null): boolean =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

function mediaTime(value: Q): MediaTime {
  if (value.d > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('sourceIn timescale overflow');
  return { ticks: value.n.toString(), timescale: Number(value.d) };
}

/** Maps timeline frames to crops: frames before the range follow its first frame, frames after follow its last; frames no shot covers map to null (default crop). */
class Framing {
  readonly shots: FrameShot[];
  readonly #range: AlignedRange;
  /** Frames where the crop changes (strictly inside the range): the primary asset's items are split at these frames. */
  readonly splits: number[];

  constructor(fps: Rate, range: AlignedRange, crops: readonly CropShot[]) {
    this.#range = range;
    this.shots = crops.map((c) => ({
      fromFrame: Math.round((c.from * fps.num) / fps.den),
      toFrame: Math.round((c.to * fps.num) / fps.den),
      crop: cropOf(c),
    }));
    const candidates = [...new Set(this.shots.flatMap((s) => [s.fromFrame, s.toFrame]))]
      .filter((f) => f > range.startFrame && f < range.endFrame)
      .sort((a, b) => a - b);
    this.splits = candidates.filter((f) => !sameCrop(this.at(f - 1), this.at(f)));
  }

  at(frame: number): Crop | null {
    const f = Math.min(Math.max(frame, this.#range.startFrame), this.#range.endFrame - 1);
    return this.shots.find((s) => s.fromFrame <= f && f < s.toFrame)?.crop ?? null;
  }
}

/**
 * The entries a video item is copied into under per-shot crops: an item of the primary asset (positive-rate linear source clock) is
 * split into pieces at frames where the crop changes, with `sourceIn` computed exactly with rationals (so two pieces can later merge
 * by source continuity if their crops become the same); the enter animation stays only on the first piece and the exit only on the
 * last, embedded audio fade-in only on the first and fade-out only on the last, and loop animations and volume envelopes restart on
 * each piece (`animation-split`). Other video items are not split; the whole item takes the crop of its middle frame within the
 * range. Parts no shot covers use the default crop (the `crop` setting, otherwise the item's own). `shots` collects the source
 * ranges and crops of the primary asset's pieces within the range.
 */
function framedEntries(
  item: SequenceItem,
  entry: Record<string, unknown>,
  context: { fps: Rate; range: AlignedRange; framing: Framing; primary: Id | null; warnings: DeriveWarning[]; shots: DerivationFraming['shots'] },
): Record<string, unknown>[] {
  if (item.type !== 'video') return [entry];
  const { fps, range, framing } = context;
  const fallback = (entry.crop as Crop | undefined) ?? null;
  const cropAt = (frame: number): Crop | null => framing.at(frame) ?? fallback;
  const withCrop = (e: Record<string, unknown>, crop: Crop | null) => {
    const out = { ...e };
    if (crop) out.crop = cropOf(crop);
    else delete out.crop;
    return out;
  };
  const a = item.span.fromFrame;
  const b = a + item.span.durationFrames;
  const piece = mediaPiece(item, fps);
  if (!piece || piece === 'unsupported' || piece.assetId !== context.primary) {
    const lo = Math.max(a, range.startFrame);
    const hi = Math.min(b, range.endFrame);
    return [withCrop(entry, cropAt(lo < hi ? Math.floor((lo + hi - 1) / 2) : a))];
  }
  const bounds = [a, ...framing.splits.filter((f) => f > a && f < b), b];
  const last = bounds.length - 2;
  const kept: Interval = { start: frames(range.startFrame, fps), end: frames(range.endFrame, fps) };
  const animate = item.animate;
  const audio = item.embeddedAudio;
  if (last > 0 && (animate?.loop || audio.envelope?.length)) context.warnings.push({ code: 'animation-split', itemId: item.id });
  const out: Record<string, unknown>[] = [];
  for (let n = 0; n <= last; n++) {
    const from = bounds[n]!;
    const to = bounds[n + 1]!;
    const crop = cropAt(from);
    const e: Record<string, unknown> = { ...entry, span: { fromFrame: from, durationFrames: to - from } };
    if (n > 0 && item.timeMap.kind === 'linear') {
      e.timeMap = { ...item.timeMap, sourceIn: mediaTime(add(piece.sourceIn, mul(sub(frames(from, fps), piece.a), piece.rate))) };
    }
    if (last > 0) {
      if (animate) {
        const slots = { ...animate };
        if (n > 0) delete slots.enter;
        if (n < last) delete slots.exit;
        if (Object.keys(slots).length) e.animate = slots;
        else delete e.animate;
      }
      const sound = { ...audio };
      if (n > 0) delete sound.fadeIn;
      if (n < last) delete sound.fadeOut;
      e.embeddedAudio = sound;
    }
    const part = intersect({ start: frames(from, fps), end: frames(to, fps) }, kept);
    if (part) {
      const source = toSource(piece, part);
      context.shots.push({ from: toNumber(source.start), to: toNumber(source.end), crop: crop ? cropOf(crop) : null });
    }
    out.push(withCrop(e, crop));
  }
  return out;
}

// ---- Cuts outside the range ----

interface Interval {
  start: Q;
  end: Q;
}

/** A stretch playing an asset: `[a, b)` on the timeline and source clock `sourceIn + (t − a) × rate`. */
interface MediaPiece {
  item: SequenceItem;
  assetId: Id;
  a: Q;
  b: Q;
  sourceIn: Q;
  rate: Q;
}

function itemInterval(item: SequenceItem, fps: Rate): Interval {
  if (item.type === 'audio') {
    const start = add(frames(item.fromFrame, fps), time(item.subframeOffset));
    return { start, end: add(start, time(item.playDuration)) };
  }
  return { start: frames(item.span.fromFrame, fps), end: frames(item.span.fromFrame + item.span.durationFrames, fps) };
}

function mediaPiece(item: SequenceItem, fps: Rate): MediaPiece | 'unsupported' | null {
  if (item.type !== 'video' && item.type !== 'audio') return null;
  const map = item.timeMap;
  // Cut-set items require a positive-rate linear source clock (no cuts for freeze frames or reversed media).
  if (map.kind !== 'linear' || map.rate.num <= 0) return 'unsupported';
  const { start, end } = itemInterval(item, fps);
  return { item, assetId: item.assetRef.id, a: start, b: end, sourceIn: time(map.sourceIn), rate: rate(map.rate) };
}

function merge(list: Interval[]): Interval[] {
  const sorted = list.filter((s) => cmp(s.end, s.start) > 0).sort((x, y) => cmp(x.start, y.start));
  const out: Interval[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && cmp(s.start, last.end) <= 0) last.end = max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

function subtract(from: Interval[], minus: Interval[]): Interval[] {
  let rest = merge(from);
  for (const m of merge(minus)) {
    rest = rest.flatMap((s) => {
      if (cmp(m.end, s.start) <= 0 || cmp(m.start, s.end) >= 0) return [s];
      const parts: Interval[] = [];
      if (cmp(m.start, s.start) > 0) parts.push({ start: s.start, end: m.start });
      if (cmp(m.end, s.end) < 0) parts.push({ start: m.end, end: s.end });
      return parts;
    });
  }
  return rest;
}

function intersect(x: Interval, y: Interval): Interval | null {
  const start = max(x.start, y.start);
  const end = min(x.end, y.end);
  return cmp(end, start) > 0 ? { start, end } : null;
}

const totalLength = (list: Interval[]): Q => list.reduce((sum, s) => add(sum, sub(s.end, s.start)), ZERO);
const toSource = (p: MediaPiece, s: Interval): Interval => ({
  start: add(p.sourceIn, mul(sub(s.start, p.a), p.rate)),
  end: add(p.sourceIn, mul(sub(s.end, p.a), p.rate)),
});
const toTimeline = (p: MediaPiece, s: Interval): Interval => ({
  start: add(p.a, div(sub(s.start, p.sourceIn), p.rate)),
  end: add(p.a, div(sub(s.end, p.sourceIn), p.rate)),
});

interface CutPlan {
  primaryAssetId: Id | null;
  cuts: Interval[];
  warnings: DeriveWarning[];
}

/**
 * Source ranges to cut outside the range: the source ranges the primary asset (the one played most on the timeline, with all source
 * clocks positive-rate linear) plays in `[0, S)` and `[E, duration)`, minus what it plays within the range (cuts apply to every item
 * playing this asset, so a source stretch that also plays within the range cannot be cut). Source ranges of the parent's existing
 * cuts are not in the items, so they are naturally not recorded twice.
 */
function planCuts(sequence: Sequence, items: SequenceItem[], range: AlignedRange, assetDuration: (assetId: Id) => Q | null): CutPlan {
  const fps = sequence.fps;
  const warnings: DeriveWarning[] = [];
  const pieces: MediaPiece[] = [];
  const unsupported = new Set<Id>();
  for (const item of items) {
    const piece = mediaPiece(item, fps);
    if (piece === 'unsupported') unsupported.add((item as { assetRef: VersionRef }).assetRef.id);
    else if (piece) pieces.push(piece);
  }
  const assets = new Set([...pieces.map((p) => p.assetId), ...unsupported]);
  if (assets.size > 1) warnings.push({ code: 'multiple-assets', count: assets.size });

  // Primary asset: the one played most; ties broken by ID.
  const coverage = new Map<Id, Q>();
  for (const p of pieces) if (!unsupported.has(p.assetId)) coverage.set(p.assetId, add(coverage.get(p.assetId) ?? ZERO, sub(p.b, p.a)));
  const primary = [...coverage.entries()].sort(([x, a], [y, b]) => cmp(b, a) || (x < y ? -1 : x > y ? 1 : 0))[0]?.[0] ?? null;

  const S = frames(range.startFrame, fps);
  const E = frames(range.endFrame, fps);
  const D = frames(sequenceDurationFrames(sequence), fps);
  const outside: Interval[] = [
    { start: ZERO, end: S },
    { start: E, end: D },
  ].filter((s) => cmp(s.end, s.start) > 0);
  const kept: Interval = { start: S, end: E };

  let cuts: Interval[] = [];
  const own = pieces.filter((p) => p.assetId === primary);
  if (primary) {
    const out: Interval[] = [];
    const keep: Interval[] = [];
    for (const p of own) {
      for (const o of outside) {
        const part = intersect({ start: p.a, end: p.b }, o);
        if (part) out.push(toSource(p, part));
      }
      const part = intersect({ start: p.a, end: p.b }, kept);
      if (part) keep.push(toSource(p, part));
    }
    const limit = assetDuration(primary);
    cuts = subtract(out, keep)
      .map((s) => ({ start: max(s.start, ZERO), end: limit ? min(s.end, limit) : s.end }))
      .filter((s) => toNumber(sub(s.end, s.start)) >= MIN_CUT_SECONDS);
  }

  // What the cuts cover on the timeline; frames outside the range left uncovered are reported.
  const covered = merge(
    own.flatMap((p) =>
      cuts.flatMap((c) => {
        const part = intersect(toTimeline(p, c), { start: p.a, end: p.b });
        return part ? [part] : [];
      }),
    ),
  );
  const left = subtract(outside, covered);
  const leftFrames = Math.round(toNumber(div(totalLength(left), frames(1, fps))));
  if (leftFrames >= 1) warnings.push({ code: 'range-not-exact', count: leftFrames });

  // Items not belonging to the primary asset that fall entirely inside a cut range are deleted with the cuts and do not come back when cuts are restored.
  const lost = items.filter((item) => {
    if (own.some((p) => p.item === item)) return false;
    const span = itemInterval(item, fps);
    return covered.some((c) => cmp(c.start, span.start) <= 0 && cmp(span.end, c.end) <= 0);
  });
  if (lost.length) warnings.push({ code: 'items-not-restorable', count: lost.length });

  return { primaryAssetId: primary, cuts, warnings };
}

/**
 * Positions of transcript words on the edited timeline (seconds): for each transcript of an asset on the timeline (with a body in
 * `documents`), projects word source ranges onto the timeline via the items playing that asset (positive-rate linear source clock);
 * a word played by several items counts once per item, and cut words are excluded. `alignRange` uses it to keep range boundaries in
 * the pauses between sentences.
 */
export function timelineWords(snapshot: VideoSnapshot, documents: ReadonlyMap<Id, unknown>): TimelineWord[] {
  const sequence = rootSequence(snapshot);
  const fps = sequence.fps;
  const pieces = new Map<Id, MediaPiece[]>();
  for (const item of copiedTimeline(sequence).items) {
    const piece = mediaPiece(item, fps);
    if (piece && piece !== 'unsupported') pieces.set(piece.assetId, [...(pieces.get(piece.assetId) ?? []), piece]);
  }
  const out: TimelineWord[] = [];
  for (const record of Object.values(snapshot.documents)) {
    const own = record.kind === 'speech' && record.sourceAssetId ? pieces.get(record.sourceAssetId) : undefined;
    const body = own ? documents.get(record.id) : undefined;
    if (!own || !isSpeechBody(body)) continue;
    const scale = BigInt(typeof body.timescale === 'number' && body.timescale > 0 ? body.timescale : 1_000_000);
    for (const raw of body.words) {
      const w = raw as { start?: unknown; end?: unknown };
      if (typeof w.start !== 'number' || typeof w.end !== 'number' || !Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
      const word: Interval = { start: q(BigInt(Math.round(w.start)), scale), end: q(BigInt(Math.round(w.end)), scale) };
      for (const p of own) {
        const played = intersect(word, toSource(p, { start: p.a, end: p.b }));
        if (played) {
          const t = toTimeline(p, played);
          out.push({ start: toNumber(t.start), end: toNumber(t.end) });
        }
      }
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Source ranges played within `[S, E)`: each item's (positive-rate linear source clock) intersection with the range mapped to the source clock, merged per asset. */
function keptSource(sequence: Sequence, items: SequenceItem[], range: AlignedRange): DerivedCut[] {
  const fps = sequence.fps;
  const kept: Interval = { start: frames(range.startFrame, fps), end: frames(range.endFrame, fps) };
  const byAsset = new Map<Id, Interval[]>();
  for (const item of items) {
    const p = mediaPiece(item, fps);
    if (!p || p === 'unsupported') continue;
    const part = intersect({ start: p.a, end: p.b }, kept);
    if (part) byAsset.set(p.assetId, [...(byAsset.get(p.assetId) ?? []), toSource(p, part)]);
  }
  return [...byAsset.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .flatMap(([assetId, list]) => merge(list).map((s) => ({ assetId, from: toNumber(s.start), to: toNumber(s.end) })));
}

/**
 * How many cues in a caption body (`cuccut.caption/1`, asset clock) fall within the source ranges played in the range (`kept`, for
 * the same asset): a cue counts if it overlaps any of them. null when the body cannot be read. Used for `captions[].cueCount` in the
 * derivation result, counting only cues still visible in the child video after cutting.
 */
export function cuesInRange(body: unknown, kept: readonly { from: number; to: number }[]): number | null {
  const b = body as { timescale?: unknown; cues?: unknown } | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b.cues)) return null;
  const scale = typeof b.timescale === 'number' && b.timescale > 0 ? b.timescale : 1000;
  let count = 0;
  for (const raw of b.cues) {
    const cue = raw as { start?: unknown; end?: unknown };
    if (typeof cue.start !== 'number' || typeof cue.end !== 'number') continue;
    const start = cue.start / scale;
    const end = cue.end / scale;
    if (kept.some((k) => start < k.to - 1e-9 && end > k.from + 1e-9)) count++;
  }
  return count;
}

// ---- Inputs the caller prepares first ----

/**
 * What to prepare before planning: the asset revisions to import (to locate files) and the documents whose bodies to read (these
 * assets' transcripts and cut sets, and the transcripts' translations). Also throws `DERIVE_UNSUPPORTED_ITEM` when the parent has
 * composition items.
 */
export function derivationNeeds(snapshot: VideoSnapshot, settings: DeriveSettings): { assets: VersionRef[]; documentIds: Id[] } {
  const { items } = copiedTimeline(rootSequence(snapshot));
  const assets = new Map<string, VersionRef>();
  for (const item of items) {
    const ref = itemAssetRef(item);
    if (ref) assets.set(assetFileKey(ref), ref);
  }
  const assetIds = new Set([...assets.values()].map((a) => a.id));
  const docs = Object.values(snapshot.documents).sort(byId);
  const sourced = docs.filter((d) => (d.kind === 'speech' || d.kind === CUT_SET_KIND) && d.sourceAssetId && assetIds.has(d.sourceAssetId));
  const speechIds = new Set(sourced.filter((d) => d.kind === 'speech').map((d) => d.id));
  const translations = settings.translations
    ? docs.filter((d) => d.kind === 'translation' && d.sourceDocumentId && speechIds.has(d.sourceDocumentId))
    : [];
  return { assets: [...assets.values()], documentIds: [...sourced, ...translations].map((d) => d.id) };
}

// ---- Planning ----

export function planDerivation(input: DerivationInput): DerivationPlan {
  const { snapshot, range, settings, target } = input;
  const sequence = rootSequence(snapshot);
  const { tracks, items } = copiedTimeline(sequence);
  const warnings: DeriveWarning[] = [];
  const operations: EditOperation[] = [];

  // Tracks: the first used track of each kind maps to the one the child video was created with; the rest are created in the parent's order (new ones go on top, relative order kept).
  const trackTargets = new Map<Id, TrackTarget>();
  const defaults = new Map<TrackKind, Track[]>();
  for (const t of [...target.tracks].sort((a, b) => a.order - b.order)) defaults.set(t.kind, [...(defaults.get(t.kind) ?? []), t]);
  const trimTracks: TrimPlan['tracks'] = [];
  for (const [n, track] of tracks.entries()) {
    const free = defaults.get(track.kind)?.shift();
    let targetTrack: TrackTarget;
    if (free) targetTrack = { trackId: free.id };
    else {
      const ref = `track-${n + 1}`;
      operations.push({ type: 'addTrack', sequenceId: target.sequenceId, kind: track.kind, ...(track.name ? { name: track.name } : {}), ref });
      targetTrack = { trackRef: ref };
    }
    trackTargets.set(track.id, targetTrack);
    if (!track.visible || track.muted || track.locked) {
      trimTracks.push({
        track: targetTrack,
        ...(!track.visible ? { visible: false as const } : {}),
        ...(track.muted ? { muted: true as const } : {}),
        ...(track.locked ? { locked: true as const } : {}),
      });
    }
  }

  // Assets: each used asset revision is imported once, keeping the provenance recorded in the parent; managed ones are managed in the child too, linked ones stay linked to the original file.
  const importRefs = new Map<string, string>();
  const assetImportRef = new Map<Id, string>();
  for (const item of items) {
    const asset = itemAssetRef(item);
    if (!asset) continue;
    const fileKey = assetFileKey(asset);
    if (importRefs.has(fileKey)) continue;
    const file = input.files.get(fileKey);
    if (!file) throw new Error(`No file for asset ${fileKey}`);
    const record = snapshot.assets[asset.id];
    const assetRevision = record?.revisions[asset.revision];
    const provenance = assetRevision?.provenance;
    const storage = assetRevision?.storage.mode === 'managed' ? 'managed' : 'linked';
    const ref = `asset-${importRefs.size + 1}`;
    importRefs.set(fileKey, ref);
    if (!assetImportRef.has(asset.id) || record?.currentRevision === asset.revision) assetImportRef.set(asset.id, ref);
    operations.push({
      type: 'importAsset',
      path: file,
      ...(record?.name ? { name: record.name } : {}),
      storage,
      ref,
      ...(provenance ? { provenance: { origin: provenance.origin, ...(provenance.source !== undefined ? { source: provenance.source } : {}) } } : {}),
    });
  }

  // Transcripts: copied whole (asset clock, independent of the timeline).
  const speech: PlannedSpeech[] = [];
  const speechRefs = new Map<Id, string>();
  const docs = Object.values(snapshot.documents).sort(byId);
  for (const record of docs) {
    if (record.kind !== 'speech' || !record.sourceAssetId) continue;
    const importRef = assetImportRef.get(record.sourceAssetId);
    const body = input.documents.get(record.id);
    if (!importRef || !isSpeechBody(body)) continue;
    const ref = `speech-${speech.length + 1}`;
    speech.push({ ref, from: record.id, assetId: record.sourceAssetId, words: body.words.length });
    speechRefs.set(record.id, ref);
    operations.push({
      type: 'putDocument',
      ref,
      kind: 'speech',
      name: record.name,
      ...(record.language ? { language: record.language } : {}),
      sourceAsset: { ref: importRef },
      body,
    });
  }

  // Cuts outside the range (the primary asset also decides which items per-shot crops split).
  const durationOf = (assetId: Id): Q | null => {
    const record = snapshot.assets[assetId];
    const duration = record?.revisions[record.currentRevision]?.duration;
    return duration ? time(duration) : null;
  };
  const cutPlan = planCuts(sequence, items, range, durationOf);

  // Items: the whole timeline, not shifted or truncated. With per-shot crops, the primary asset's video items split at frames where
  // the crop changes (`framedEntries`), so one parent item maps to several pieces in the child (`piecesOf`, in time order).
  const inserted: Record<string, unknown>[] = [];
  const piecesOf = new Map<Id, ItemLocator[]>();
  const framing = settings.crops ? new Framing(sequence.fps, range, settings.crops) : null;
  const framingShots: DerivationFraming['shots'] = [];
  if (input.cropsAdjusted) warnings.push({ code: 'crops-adjusted', count: input.cropsAdjusted });
  for (const item of items) {
    const track = trackTargets.get(item.trackId)!;
    const entry: Record<string, unknown> = { ...itemInput(item, settings, warnings), ...track };
    const asset = itemAssetRef(item);
    if (asset) entry.assetImportRef = importRefs.get(assetFileKey(asset));
    const entries = framing
      ? framedEntries(item, entry, { fps: sequence.fps, range, framing, primary: cutPlan.primaryAssetId, warnings, shots: framingShots })
      : [entry];
    inserted.push(...entries);
    piecesOf.set(
      item.id,
      entries.length > 1
        ? entries.map((e) => {
            const span = e.span as { fromFrame: number; durationFrames: number };
            return { track, type: item.type, position: `v:${span.fromFrame}:${span.durationFrames}` };
          })
        : [{ track, type: item.type, position: positionOf(item) }],
    );
  }
  if (inserted.length) operations.push({ type: 'insertItems', sequenceId: target.sequenceId, items: inserted as never });
  if (sequence.animationBindings.length) warnings.push({ code: 'animation-bindings-dropped' });

  // Chapters: all copied; when cuts remove content, chapters move with it (the exception in §3.13). Thumbnails reference parent assets and are not carried over.
  if (settings.chapters) {
    const chapters = sequence.markers
      .filter((m) => m.kind === 'chapter')
      .sort((a, b) => a.frame - b.frame)
      .map((m) => ({ at: { unit: 'frames' as const, value: m.frame }, title: m.label, ...(m.summary ? { summary: m.summary } : {}) }));
    if (chapters.length) operations.push({ type: 'setChapters', sequenceId: target.sequenceId, chapters, alignment: 'exact-frame' });
  }

  // Canvas background follows the parent (width and height were given at creation).
  if (sequence.canvas.background !== target.background) {
    operations.push({ type: 'updateSequence', sequenceId: target.sequenceId, background: sequence.canvas.background });
  }

  // Transitions: both sides were copied; while finishing, items are found again by position. A split item on the left attaches its last piece, on the right its first.
  const transitions: PlannedTransition[] = [];
  for (const t of sequence.transitions) {
    const left = t.leftItemId !== undefined ? piecesOf.get(t.leftItemId)?.at(-1) : undefined;
    const right = t.rightItemId !== undefined ? piecesOf.get(t.rightItemId)?.[0] : undefined;
    if ((t.leftItemId !== undefined && !left) || (t.rightItemId !== undefined && !right)) continue;
    transitions.push({
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
      kind: t.kind,
      ...(t.params ? { params: t.params } : {}),
      durationFrames: t.durationFrames,
      easing: t.easing,
      placement: t.placement,
      ...(t.audioCrossfade ? { audioCrossfade: true } : {}),
    });
  }

  // Translations: copied whole; `sourceBasis` is filled in once the child's transcript has an ID.
  const translations: PlannedTranslation[] = [];
  if (settings.translations) {
    for (const record of docs) {
      if (record.kind !== 'translation' || !record.sourceDocumentId) continue;
      const speechRef = speechRefs.get(record.sourceDocumentId);
      if (!speechRef) continue;
      const raw = input.documents.get(record.id);
      // A `/1` translation imported from an old project is converted to `/2` (sentence-aligned) by the transcript's current sentences so the child can build a caption layer from it; one that cannot be converted is not copied and is reported as a warning.
      const body = isTranslationBody(raw)
        ? raw
        : (upgradeLegacyTranslation(raw, input.documents.get(record.sourceDocumentId), record.language, {
            speechRef: { id: record.sourceDocumentId, revision: snapshot.documents[record.sourceDocumentId]?.currentRevision ?? '' },
            sequenceId: sequence.id,
          })?.body ?? null);
      if (!body) {
        warnings.push({ code: 'translations-skipped', documentId: record.id });
        continue;
      }
      translations.push({ from: record.id, speechRef, name: record.name, ...(record.language ? { language: record.language } : {}), body });
    }
  }

  // The parent's existing cut sets: cuts unchanged (their source ranges are no longer in the copied items), scope mapped to the child's items.
  const cutSets: PlannedCutSet[] = [];
  for (const record of docs) {
    if (record.kind !== CUT_SET_KIND || !record.sourceAssetId) continue;
    const importRef = assetImportRef.get(record.sourceAssetId);
    const body = input.documents.get(record.id) as { scopeItemIds?: unknown } | undefined;
    if (!importRef || !body || typeof body !== 'object') continue;
    const scopeIds = Array.isArray(body.scopeItemIds) ? (body.scopeItemIds as Id[]) : [];
    cutSets.push({
      from: record.id,
      importRef,
      name: record.name,
      body: body as Record<string, unknown>,
      // Every piece of a split item is in scope.
      scope: scopeIds.flatMap((id) => piecesOf.get(id) ?? []),
    });
  }

  const kept = keptSource(sequence, items, range);
  warnings.push(...cutPlan.warnings);
  const primaryRef = cutPlan.primaryAssetId ? assetImportRef.get(cutPlan.primaryAssetId) : undefined;
  const cuts: DerivedCut[] = cutPlan.primaryAssetId
    ? cutPlan.cuts.map((c) => ({ assetId: cutPlan.primaryAssetId!, from: toNumber(c.start), to: toNumber(c.end) }))
    : [];

  const derivation: DerivationBody = {
    schema: DERIVATION_SCHEMA,
    parentVideoId: snapshot.id,
    parentRevision: snapshot.revision,
    range: { start: range.start, end: range.end },
    primaryAssetId: cutPlan.primaryAssetId,
    cuts,
    settings,
    ...(framing && cutPlan.primaryAssetId
      ? { framing: { assetId: cutPlan.primaryAssetId, shots: framingShots.sort((x, y) => x.from - y.from) } }
      : {}),
    key: input.key,
    ...pickFields(input.pick),
  };
  operations.push({
    type: 'putDocument',
    ref: DERIVATION_REF,
    kind: DERIVATION_KIND,
    name: input.labels.derivationName,
    body: derivation,
    summary: derivation,
  });

  return {
    operations,
    trim: {
      tracks: trimTracks,
      transitions,
      translations,
      cutSets,
      cuts:
        primaryRef && cutPlan.cuts.length
          ? { importRef: primaryRef, cuts: cutPlan.cuts.map((c) => ({ from: decimal(c.start, true), to: decimal(c.end, false) })) }
          : null,
    },
    cuts,
    speech,
    derivation,
    warnings: dedupeWarnings(warnings),
    itemCount: inserted.length,
    kept,
  };
}

/**
 * The second transaction (needs the IDs created by the first; `refs` is the `refs` of the first receipt): track hiding and muting,
 * transitions, translations, the parent's cut sets, then the cuts outside the range, and finally re-locking locked tracks. Returns an
 * empty array when there is nothing to do.
 */
export function planDerivationTrim(
  plan: Pick<DerivationPlan, 'trim'>,
  child: { sequence: Sequence; documents: Record<Id, DocumentRecord> },
  refs: Readonly<Record<string, Id>>,
): EditOperation[] {
  const operations: EditOperation[] = [];
  const sequence = child.sequence;
  const trackId = (track: TrackTarget) => ('trackId' in track ? track.trackId : refs[track.trackRef]);
  const itemAt = (locator: ItemLocator | undefined): Id | undefined => {
    if (!locator) return undefined;
    const id = trackId(locator.track);
    const matches = sequence.items.filter((item) => item.trackId === id && item.type === locator.type && positionOf(item) === locator.position);
    // With more than one item of the same type at the same position on the same track, it cannot be told which one it is.
    return matches.length === 1 ? matches[0]!.id : undefined;
  };

  for (const t of plan.trim.tracks) {
    const id = trackId(t.track);
    if (!id || (t.visible === undefined && t.muted === undefined)) continue;
    operations.push({
      type: 'updateTrack',
      sequenceId: sequence.id,
      trackId: id,
      ...(t.visible === false ? { visible: false } : {}),
      ...(t.muted ? { muted: true } : {}),
    });
  }
  for (const t of plan.trim.transitions) {
    const left = itemAt(t.left);
    const right = itemAt(t.right);
    if ((t.left && !left) || (t.right && !right)) continue;
    operations.push({
      type: 'setTransition',
      sequenceId: sequence.id,
      ...(left ? { leftItemId: left } : {}),
      ...(right ? { rightItemId: right } : {}),
      kind: t.kind as never,
      ...(t.params ? { params: t.params } : {}),
      duration: { unit: 'frames', value: t.durationFrames },
      alignment: 'exact-frame',
      easing: t.easing as never,
      placement: t.placement as never,
      ...(t.audioCrossfade ? { audioCrossfade: true } : {}),
    });
  }
  for (const [n, t] of plan.trim.translations.entries()) {
    const speechId = refs[t.speechRef];
    const speech = speechId ? child.documents[speechId] : undefined;
    if (!speechId || !speech) continue;
    const basis = (t.body.sourceBasis ?? {}) as Record<string, unknown>;
    operations.push({
      type: 'putDocument',
      ref: `translation-${n + 1}`,
      kind: 'translation',
      name: t.name,
      ...(t.language ? { language: t.language } : {}),
      sourceDocument: { documentId: speechId },
      // The transcript is copied whole, so the edit view fingerprint (which depends only on the transcript body) is unchanged; point to the child's transcript and sequence.
      body: { ...t.body, sourceBasis: { ...basis, speechRef: { id: speechId, revision: speech.currentRevision }, sequenceId: sequence.id } },
    });
  }
  for (const [n, c] of plan.trim.cutSets.entries()) {
    const assetId = refs[c.importRef];
    if (!assetId) continue;
    const scope = c.scope.flatMap((locator) => itemAt(locator) ?? []);
    operations.push({
      type: 'putDocument',
      ref: `cut-set-${n + 1}`,
      kind: CUT_SET_KIND,
      name: c.name,
      sourceAsset: { assetId },
      body: { ...c.body, scopeItemIds: scope },
    });
  }
  const cuts = plan.trim.cuts;
  const cutAsset = cuts ? refs[cuts.importRef] : undefined;
  if (cuts && cutAsset) operations.push({ type: 'addCuts', sequenceId: sequence.id, assetId: cutAsset, cuts: cuts.cuts });
  for (const t of plan.trim.tracks) {
    const id = trackId(t.track);
    if (id && t.locked) operations.push({ type: 'updateTrack', sequenceId: sequence.id, trackId: id, locked: true });
  }
  return operations;
}

function dedupeWarnings(list: DeriveWarning[]): DeriveWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => {
    const k = JSON.stringify(w);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- Transcript and translation bodies ----

interface SpeechBodyShape {
  schema: 'cuccut.speech/1';
  words: unknown[];
  [key: string]: unknown;
}

function isSpeechBody(body: unknown): body is SpeechBodyShape {
  const b = body as SpeechBodyShape | null;
  return !!b && b.schema === 'cuccut.speech/1' && Array.isArray(b.words);
}

interface TranslationBodyShape {
  schema: 'cuccut.translation/2';
  units: unknown[];
  [key: string]: unknown;
}

function isTranslationBody(body: unknown): body is TranslationBodyShape {
  const b = body as TranslationBodyShape | null;
  return !!b && b.schema === 'cuccut.translation/2' && Array.isArray(b.units);
}

function byId(a: { id: Id }, b: { id: Id }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Formats seconds as mm:ss (h:mm:ss from one hour), for the child video's default name. */
export function clockLabel(seconds: number): string {
  const total = Math.floor(seconds + 1e-6);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
