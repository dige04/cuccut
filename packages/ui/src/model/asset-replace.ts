import { defineMessages } from '@cuccut/protocol';
import type {
  AssetRecord,
  AudioItem,
  EditOperation,
  EmbeddedAudio,
  EnvelopePoint,
  Id,
  MediaTime,
  Rate,
  Sequence,
  SequenceItem,
  SequenceItemInput,
  TimeMap,
  VersionRef,
  VideoItem,
} from '@cuccut/protocol';
import { itemFrames } from './editor.ts';
import type { PlaceableKind } from './editor-ops.ts';
import { zhHans } from './asset-replace.zh-Hans.ts';
import { zhHant } from './asset-replace.zh-Hant.ts';
import { ja } from './asset-replace.ja.ts';
import { ko } from './asset-replace.ko.ts';
import { es } from './asset-replace.es.ts';
import { fr } from './asset-replace.fr.ts';
import { de } from './asset-replace.de.ts';
import { nl } from './asset-replace.nl.ts';
import { ptBR } from './asset-replace.pt-BR.ts';
import { it } from './asset-replace.it.ts';
import { ru } from './asset-replace.ru.ts';
import { pl } from './asset-replace.pl.ts';
import { tr } from './asset-replace.tr.ts';
import { vi } from './asset-replace.vi.ts';

/**
 * Replace asset (rules from the design spec model-video-replace.js, moved to the asset-library layer): every instance on the timeline that uses the old asset is swapped for the new one, in one transaction —
 * a local file is first `importAsset`ed (with a `ref`), then `deleteItems` removes the old instances, `moveItems` shifts the clips after them on the same track, and `insertItems` writes them back as they were
 * (same track, same start; layout, crop, effects, volume, name, role and extensions copied as-is, only the asset and time mapping change), so one undo step reverts everything.
 *
 * Timing rules:
 * - The new asset starts at 0 s (the design spec's second revision dropped the start time). When “Align to the original asset's time” is ticked and the range originally used still fits in the new asset, the source time stays the same
 *   (the design spec's `aligned`: another version of the same content).
 * - The clip length does not change; if the new asset is not long enough, the clip gets shorter with it. Later clips on the same track move forward by the same amount (ripple); other tracks stay put.
 *   (The design spec's “Clip length follows the new asset” only takes the shorter half: at the asset-library layer every clip that uses the asset is replaced at once, and making them longer would stretch every split piece to the full new asset.)
 * - The duration of the new asset is unknown (a local file is only probed after import), so the clip keeps its original duration for now (design spec `keep`); if the new file is too short, the engine rejects the whole transaction.
 * - Locked clips (or clips on a locked track) and the pre-rendered stand-ins of compositions stay as they are; the ripple on the same track stops at the next locked clip.
 *
 * The “Replace video / Replace image” buttons on the canvas toolbar replace only the selected segment (`itemId`): same rules, except that other clips using this asset are left alone.
 *
 * The protocol has no operation for “swapping the asset on an instance”. An instance that is deleted and written back gets a new ID: transitions attached to it are removed by the engine, subtitles projected from it and ducking rules triggered by or targeting it no longer match. The plan counts these items, and the replace dialog states them plainly.
 */

/** The new asset used for the replacement: an existing asset of the same kind in the asset library, or a local file to import in the same transaction. */
export type ReplaceSource = { from: 'library'; asset: AssetRecord } | { from: 'file'; path: string; name: string; kind: PlaceableKind | null };

export interface AssetReplaceInput {
  sequence: Sequence;
  /** The asset to replace. */
  asset: AssetRecord;
  source: ReplaceSource;
  /** Align to the original asset's time: when the range originally used fits in the new asset, the source time stays the same. */
  align?: boolean;
  /** Replace only this segment (canvas toolbar); by default, every segment on the timeline that uses this asset is replaced. */
  itemId?: Id;
}

export interface ReplacedInstance {
  itemId: Id;
  trackId: Id;
  name: string;
  /** Original start and end (seconds). */
  start: number;
  end: number;
  /** Start and end after the replacement (seconds): when earlier clips on the same track get shorter, the start moves forward with them. */
  newStart: number;
  newEnd: number;
  /** How many seconds the clip length changed (≤ 0). */
  delta: number;
  /** Source time unchanged (aligned to the original asset's time). */
  aligned: boolean;
}

export interface KeptInstance {
  itemId: Id;
  name: string;
  start: number;
  end: number;
  reason: 'locked' | 'prerender';
}

export type AssetReplacePlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      /** Whether the duration of the new asset is known (true for assets in the library); false for local files. */
      durationKnown: boolean;
      replaced: ReplacedInstance[];
      kept: KeptInstance[];
      /** Number of clips on the same track that move forward with it. */
      moved: number;
      /** Total seconds by which all the clips together got shorter (≤ 0). */
      delta: number;
      /** Associations that deleting and rewriting would lose: transitions attached to these clips, subtitle instances projected from them, and ducking rules that use them. */
      transitions: number;
      captions: number;
      ducking: number;
      operations: EditOperation[];
    };

/** The `ref` used to import the new file within the same transaction. */
export const REPLACE_IMPORT_REF = 'replacement';

// ---- Exact time: fractions (BigInt), computed by value as the engine does, without floating point ----

interface Q {
  n: bigint;
  d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
};
const q = (n: bigint, d: bigint): Q => {
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const ofTime = (t: MediaTime): Q => q(BigInt(t.ticks), BigInt(t.timescale));
const ofRate = (r: Rate): Q => q(BigInt(r.num), BigInt(r.den));
const ofInt = (v: number): Q => q(BigInt(v), 1n);
const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
const cmp = (a: Q, b: Q): number => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
const minQ = (a: Q, b: Q): Q => (cmp(a, b) <= 0 ? a : b);
const floorQ = (a: Q): bigint => (a.n >= 0n ? a.n / a.d : -((-a.n + a.d - 1n) / a.d));
const ceilQ = (a: Q): bigint => -floorQ(q(-a.n, a.d));
const toTime = (a: Q): MediaTime => ({ ticks: String(a.n), timescale: Number(a.d) });
const ZERO: Q = { n: 0n, d: 1n };

/** Frames → seconds (as a fraction). */
const framesQ = (frames: number, fps: Rate): Q => q(BigInt(frames) * BigInt(fps.den), BigInt(fps.num));

// ---- Time of an instance after its asset is replaced ----

interface Timing {
  /** Images have no time mapping. */
  timeMap?: TimeMap;
  /** New length: video in frames, audio in exact time. */
  lengthFrames?: number;
  playDuration?: MediaTime;
  /** How many frames the clip got shorter (≥ 0): later clips on the same track move forward by this much. */
  shrinkFrames: number;
  aligned: boolean;
}

const restartMap = (map: TimeMap): TimeMap =>
  map.kind === 'linear'
    ? { kind: 'linear', sourceIn: { ticks: '0', timescale: map.sourceIn.timescale }, rate: map.rate }
    : { kind: 'hold', sourceAt: { ticks: '0', timescale: map.sourceAt.timescale } };

/** Does the time mapping still hold in the new asset (does the range originally used fit)? */
function fits(map: TimeMap, length: Q, duration: Q): boolean {
  if (map.kind === 'hold') return cmp(ofTime(map.sourceAt), duration) < 0;
  return cmp(add(ofTime(map.sourceIn), mul(length, ofRate(map.rate))), duration) <= 0;
}

/** How long the new asset is from 0 s (seconds). */
const reach = (map: TimeMap, duration: Q): Q | null => (map.kind === 'linear' ? div(duration, ofRate(map.rate)) : null);

function videoTiming(item: VideoItem, fps: Rate, duration: Q | null, align: boolean): Timing | null {
  const lengthFrames = item.span.durationFrames;
  const length = framesQ(lengthFrames, fps);
  if (align && duration && fits(item.timeMap, length, duration)) return { timeMap: item.timeMap, lengthFrames, shrinkFrames: 0, aligned: true };
  // Duration unknown: keep the original duration for now (design spec `keep`); when aligned, the source time also stays the same.
  if (!duration) return { timeMap: align ? item.timeMap : restartMap(item.timeMap), lengthFrames, shrinkFrames: 0, aligned: align };
  const most = reach(item.timeMap, duration);
  const maxFrames = most ? Number(floorQ(mul(most, ofRate(fps)))) : lengthFrames;
  if (maxFrames < 1) return null;
  const next = Math.min(lengthFrames, maxFrames);
  return { timeMap: restartMap(item.timeMap), lengthFrames: next, shrinkFrames: lengthFrames - next, aligned: false };
}

function audioTiming(item: AudioItem, fps: Rate, duration: Q | null, align: boolean): Timing | null {
  const length = ofTime(item.playDuration);
  const keep = { playDuration: item.playDuration, shrinkFrames: 0 };
  if (align && duration && fits(item.timeMap, length, duration)) return { timeMap: item.timeMap, ...keep, aligned: true };
  if (!duration) return { timeMap: align ? item.timeMap : restartMap(item.timeMap), ...keep, aligned: align };
  const most = reach(item.timeMap, duration);
  if (!most || cmp(length, most) <= 0) return { timeMap: restartMap(item.timeMap), ...keep, aligned: false };
  // Whole frames shorter: later clips on the same track move forward by whole frames, leaving no gap and no overlap (an audio start need not fall on a frame; its length is subtracted in exact time).
  const shrinkFrames = Number(ceilQ(mul(sub(length, most), ofRate(fps))));
  const next = sub(length, framesQ(shrinkFrames, fps));
  if (cmp(next, ZERO) <= 0) return null;
  return { timeMap: restartMap(item.timeMap), playDuration: toTime(next), shrinkFrames, aligned: false };
}

/** When the fade-in and fade-out no longer fit after the clip gets shorter, they are fitted into the new length (fade-out takes priority), and envelope points beyond it are removed (the engine requires fade-in plus fade-out not to exceed the clip length). */
function clampFades<T extends { fadeIn?: MediaTime; fadeOut?: MediaTime }>(fades: T, length: Q): T {
  const out = fades.fadeOut ? minQ(ofTime(fades.fadeOut), length) : null;
  const room = out ? sub(length, out) : length;
  const inn = fades.fadeIn ? minQ(ofTime(fades.fadeIn), room) : null;
  const next = { ...fades };
  if (fades.fadeOut) next.fadeOut = toTime(out!);
  if (fades.fadeIn) next.fadeIn = toTime(inn!);
  return next;
}
const clampEnvelope = (points: EnvelopePoint[] | undefined, length: Q) => points?.filter((p) => !p.at || cmp(ofTime(p.at), length) <= 0);

// ---- Plan ----

/** Copy for asset replacement (the English is the source of the keys and types; translations are in `asset-replace.zh-Hans.ts`). */
const en = {
  cantReplaceKind: 'This kind of asset can’t be replaced yet.',
  sameKind: (kind: PlaceableKind) => `You can only replace it with an asset of the same kind: this needs ${{ video: 'a video', image: 'an image', audio: 'an audio' }[kind]} asset.`,
  sameAsset: 'That’s the current asset. Pick a different one.',
  unused: 'This asset isn’t used on the timeline, so there’s nothing to replace.',
  tooShort: 'The new asset is too short to fill a single frame.',
  allLocked: 'Every clip that uses it is locked (or is a prerendered stand-in for a composition). Unlock them first.',
  clipLocked: 'This clip is locked. Unlock it first.',
  durationUnknown: 'The asset’s length is unknown, so the clips keep their current length for now.',
  longEnoughMany: 'The new asset is long enough. None of these clips change length, and the timeline stays the same.',
  longEnoughOne: 'The new asset is long enough. The clip keeps its length, and the timeline stays the same.',
  shortenMany: (n: number, seconds: string) => `${n === 1 ? '1 clip gets' : `${n} clips get`} shorter, ${seconds} sec in total`,
  shortenOne: (seconds: string) => `The clip gets ${seconds} sec shorter`,
  moved: (head: string, n: number) => `${head}, and ${n === 1 ? 'the next clip' : `the next ${n} clips`} on the track move earlier.`,
  trackShorter: (head: string) => `${head}, and the track gets shorter.`,
  transitions: (n: number) => (n === 1 ? 'The transition on these clips will be removed.' : `The ${n} transitions on these clips will be removed.`),
  captions: (n: number) =>
    `${n === 1 ? '1 caption is' : `${n} captions are`} timed against these clips and will need realigning after the replacement.`,
  ducking: (n: number) =>
    `${n === 1 ? '1 ducking rule points' : `${n} ducking rules point`} at these clips and won’t match after the replacement.`,
};
export type AssetReplaceMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

function sourceKind(source: ReplaceSource): PlaceableKind | null {
  if (source.from === 'file') return source.kind;
  const kind = source.asset.kind;
  return kind === 'video' || kind === 'image' || kind === 'audio' ? kind : null;
}

function sourceDuration(source: ReplaceSource): Q | null {
  if (source.from === 'file') return null;
  const duration = source.asset.revisions[source.asset.currentRevision]?.duration;
  return duration && BigInt(duration.ticks) > 0n ? ofTime(duration) : null;
}

const usesAsset = (item: SequenceItem, assetId: Id) =>
  ((item.type === 'video' || item.type === 'image' || item.type === 'audio') && item.assetRef.id === assetId) ||
  (item.type === 'composition' && item.prerender?.id === assetId);

/** Computes one replacement: which clips are swapped, how long each becomes, which clips on the same track move, and the operation itself. It does not change the timeline; it only computes. */
export function planAssetReplace({ sequence, asset, source, align = false, itemId }: AssetReplaceInput): AssetReplacePlan {
  const fail = (reason: string) => ({ ok: false as const, reason });
  const kind = asset.kind;
  if (kind !== 'video' && kind !== 'image' && kind !== 'audio') return fail(M.cantReplaceKind);
  const incoming = sourceKind(source);
  if (incoming !== kind) return fail(M.sameKind(kind));
  if (source.from === 'library' && source.asset.id === asset.id) return fail(M.sameAsset);
  const fps = sequence.fps;
  const toSeconds = (frames: number) => (frames * fps.den) / fps.num;
  const lockedTracks = new Set(sequence.tracks.filter((t) => t.locked).map((t) => t.id));
  const users = sequence.items.filter((item) => usesAsset(item, asset.id) && (itemId === undefined || item.id === itemId));
  if (!users.length) return fail(M.unused);

  const duration = sourceDuration(source);
  const target: { assetRef: VersionRef } | { assetImportRef: string } =
    source.from === 'library' ? { assetRef: { id: source.asset.id, revision: source.asset.currentRevision } } : { assetImportRef: REPLACE_IMPORT_REF };
  const newName = source.from === 'library' ? source.asset.name : source.name;

  const kept: KeptInstance[] = [];
  const timings = new Map<Id, Timing>();
  for (const item of users) {
    const range = itemFrames(item, fps);
    const facts = { itemId: item.id, name: item.name ?? asset.name, start: toSeconds(range.start), end: toSeconds(range.end) };
    if (item.type === 'composition') kept.push({ ...facts, reason: 'prerender' });
    else if (item.locked || lockedTracks.has(item.trackId)) kept.push({ ...facts, reason: 'locked' });
    else {
      const timing =
        item.type === 'video'
          ? videoTiming(item, fps, duration, align)
          : item.type === 'audio'
            ? audioTiming(item, fps, duration, align)
            : { shrinkFrames: 0, aligned: false };
      if (!timing) return fail(M.tooShort);
      timings.set(item.id, timing);
    }
  }
  if (!timings.size) return fail(itemId === undefined ? M.allLocked : M.clipLocked);

  // Ripple on the same track: sorted by start; clips after a shortened clip move forward by the accumulated frames; stops at a locked clip (it and the clips after it stay put).
  const shiftOf = new Map<Id, number>();
  const moves: { itemId: Id; frames: number }[] = [];
  for (const trackId of new Set(users.filter((i) => timings.has(i.id)).map((i) => i.trackId))) {
    const lane = sequence.items
      .filter((item) => item.trackId === trackId)
      .map((item) => ({ item, start: itemFrames(item, fps).start }))
      .sort((a, b) => a.start - b.start || a.item.id.localeCompare(b.item.id));
    let shift = 0;
    for (const { item } of lane) {
      if (item.locked) {
        shift = 0;
        continue;
      }
      const timing = timings.get(item.id);
      if (timing) {
        shiftOf.set(item.id, shift);
        shift -= timing.shrinkFrames;
      } else if (shift !== 0) moves.push({ itemId: item.id, frames: shift });
    }
  }

  const replaced: ReplacedInstance[] = [];
  const inputs: SequenceItemInput[] = [];
  for (const item of users) {
    const timing = timings.get(item.id);
    if (!timing) continue;
    const shift = shiftOf.get(item.id) ?? 0;
    const range = itemFrames(item, fps);
    const input = rewrite(item, timing, shift, target, fps);
    if (!input) continue;
    // If a clip's name is still the old asset's name (the default name given when placed on the timeline), it changes to the new asset's name; renamed clips keep their name.
    inputs.push(item.name === asset.name ? ({ ...input, name: newName } as SequenceItemInput) : input);
    replaced.push({
      itemId: item.id,
      trackId: item.trackId,
      name: item.name ?? asset.name,
      start: toSeconds(range.start),
      end: toSeconds(range.end),
      newStart: toSeconds(range.start + shift),
      newEnd: toSeconds(range.end + shift - timing.shrinkFrames),
      delta: timing.shrinkFrames ? -toSeconds(timing.shrinkFrames) : 0,
      aligned: timing.aligned,
    });
  }

  const gone = new Set(replaced.map((r) => r.itemId));
  const operations: EditOperation[] = [];
  if (source.from === 'file') operations.push({ type: 'importAsset', path: source.path, ref: REPLACE_IMPORT_REF });
  operations.push({ type: 'deleteItems', sequenceId: sequence.id, itemIds: [...gone] });
  if (moves.length)
    operations.push({
      type: 'moveItems',
      sequenceId: sequence.id,
      moves: moves.map((m) => ({ itemId: m.itemId, offset: { unit: 'frames', value: m.frames } })),
      alignment: 'exact-frame',
    });
  operations.push({ type: 'insertItems', sequenceId: sequence.id, items: inputs });

  const touches = (ids: readonly Id[] | undefined) => !!ids?.some((id) => gone.has(id));
  return {
    ok: true,
    durationKnown: duration !== null,
    replaced,
    kept,
    moved: moves.length,
    delta: replaced.reduce((sum, r) => sum + r.delta, 0),
    transitions: sequence.transitions.filter((t) => (t.leftItemId && gone.has(t.leftItemId)) || (t.rightItemId && gone.has(t.rightItemId))).length,
    captions: sequence.items.filter((item) => item.type === 'caption' && touches(item.scopeItemIds)).length,
    ducking: (sequence.ducking ?? []).filter(
      (rule) => (rule.trigger.kind === 'items' && touches(rule.trigger.itemIds)) || touches(rule.target.itemIds),
    ).length,
    operations,
  };
}

/** Writes an instance back as it was: drops the engine-assigned `id` and `lineage`, swaps the asset and the time, and moves the start by `shift` frames. */
function rewrite(
  item: SequenceItem,
  timing: Timing,
  shift: number,
  target: { assetRef: VersionRef } | { assetImportRef: string },
  fps: Rate,
): SequenceItemInput | null {
  if (item.type === 'video') {
    const { id: _id, lineage: _lineage, assetRef: _asset, ...rest } = item;
    const lengthFrames = timing.lengthFrames ?? item.span.durationFrames;
    const audio: EmbeddedAudio = timing.shrinkFrames ? clampFades(item.embeddedAudio, framesQ(lengthFrames, fps)) : item.embeddedAudio;
    return {
      ...rest,
      ...target,
      span: { fromFrame: item.span.fromFrame + shift, durationFrames: lengthFrames },
      timeMap: timing.timeMap ?? item.timeMap,
      embeddedAudio: audio,
    } as SequenceItemInput;
  }
  if (item.type === 'audio') {
    const { id: _id, lineage: _lineage, assetRef: _asset, ...rest } = item;
    const playDuration = timing.playDuration ?? item.playDuration;
    const length = ofTime(playDuration);
    let mix = item.mix;
    if (timing.shrinkFrames) {
      const { envelope: _envelope, ...fades } = clampFades(item.mix, length);
      const envelope = clampEnvelope(item.mix.envelope, length);
      mix = envelope?.length ? { ...fades, envelope } : fades;
    }
    return { ...rest, ...target, fromFrame: item.fromFrame + shift, playDuration, timeMap: timing.timeMap ?? item.timeMap, mix } as SequenceItemInput;
  }
  if (item.type === 'image') {
    const { id: _id, lineage: _lineage, assetRef: _asset, ...rest } = item;
    return { ...rest, ...target, span: { fromFrame: item.span.fromFrame + shift, durationFrames: item.span.durationFrames } } as SequenceItemInput;
  }
  return null;
}

/** One sentence explaining how this replacement affects the timeline (the wording of design spec `describe`, extended to replacing several segments at once). */
export function describeReplace(plan: AssetReplacePlan): string {
  if (!plan.ok) return plan.reason;
  if (!plan.durationKnown) return M.durationUnknown;
  const shortened = plan.replaced.filter((r) => r.delta < 0);
  if (!shortened.length) return plan.replaced.length > 1 ? M.longEnoughMany : M.longEnoughOne;
  const d = Math.abs(plan.delta).toFixed(1);
  const head = plan.replaced.length > 1 ? M.shortenMany(shortened.length, d) : M.shortenOne(d);
  return plan.moved ? M.moved(head, plan.moved) : M.trackShorter(head);
}

/** The associations that deleting and rewriting would lose, one sentence each; empty when there are none. */
export function replaceSideEffects(plan: AssetReplacePlan): string[] {
  if (!plan.ok) return [];
  const out: string[] = [];
  if (plan.transitions) out.push(M.transitions(plan.transitions));
  if (plan.captions) out.push(M.captions(plan.captions));
  if (plan.ducking) out.push(M.ducking(plan.ducking));
  return out;
}
