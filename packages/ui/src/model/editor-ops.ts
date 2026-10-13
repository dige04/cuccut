import {
  defineMessages,
  live,
  itemAssetRefs,
  itemTimeMap,
  mediaTimeToSeconds,
  type ArrangeDirection,
  type AssetRecord,
  type DocumentRecord,
  type EditOperation,
  type Id,
  type Sequence,
  type SequenceItem,
  type SequenceItemInput,
  type Track,
} from '@cuccut/protocol';
import { languageName } from './caption-tracks.ts';
import { DUB_EXTENSION } from './dub-undo.ts';
import { itemFrames, stackingGroup, trackAccepts, trackRows } from './editor.ts';
import { zhHans } from './editor-ops.zh-Hans.ts';
import { zhHant } from './editor-ops.zh-Hant.ts';
import { ja } from './editor-ops.ja.ts';
import { ko } from './editor-ops.ko.ts';
import { es } from './editor-ops.es.ts';
import { fr } from './editor-ops.fr.ts';
import { de } from './editor-ops.de.ts';
import { nl } from './editor-ops.nl.ts';
import { ptBR } from './editor-ops.pt-BR.ts';
import { it } from './editor-ops.it.ts';
import { ru } from './editor-ops.ru.ts';
import { pl } from './editor-ops.pl.ts';
import { tr } from './editor-ops.tr.ts';
import { vi } from './editor-ops.vi.ts';

type DubStatus = 'failed' | 'needs-fit' | 'stale' | 'draft';
const sentencesEn = (n: number) => (n === 1 ? '1 sentence' : `${n} sentences`);
const filesEn = (n: number) => (n === 1 ? '1 file' : `${n} files`);

/** Copy for the edit operations and the dub-group card (English is the source of keys and types; translations are in `editor-ops.zh-Hans.ts`). */
const en = {
  dubStatus: {
    failed: 'Not synthesized',
    'needs-fit': 'Too long',
    stale: 'Translation outdated',
    draft: 'Not placed',
  } as Record<DubStatus, string>,
  dubStatusCount: (n: number, status: DubStatus) =>
    `${sentencesEn(n)} ${{ failed: 'not synthesized', 'needs-fit': 'too long', stale: 'with outdated translation', draft: 'not placed' }[status]}`,
  stemVocals: 'Separated vocals',
  stemBackground: 'Separated background',
  background: 'Background',
  sentenceN: (n: number) => `Sentence ${n}`,
  dub: 'Voice-over',
  files: filesEn,
  sentences: sentencesEn,
  muted: (n: number) => `${sentencesEn(n)} muted`,
  dubTitle: (language: string | null) => `Voice-over · ${language ?? 'Unknown language'}`,
  aside: (groups: number, files: number) =>
    groups ? `${groups === 1 ? '1 voice-over group' : `${groups} voice-over groups`} · ${filesEn(files)}` : filesEn(files),
};
export type EditorOpsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The engine operations behind manual actions in the editor (command and protocol spec §4.2). Drag and split commit on frames: the drop point is on a frame, and nothing is quantized again. Seconds typed into an input box are committed as a decimal string. The engine quantizes them and reports the actual landing point in the receipt (product design §5.8).
 */

const frames = (value: number) => ({ unit: 'frames' as const, value: Math.max(0, Math.round(value)) });

/** The default length of an image placed on the timeline (matches the engine). */
const IMAGE_SECONDS = 5;

export type PlaceableKind = 'video' | 'image' | 'audio';

export function isPlaceable(asset: AssetRecord): asset is AssetRecord & { kind: PlaceableKind } {
  return asset.kind === 'video' || asset.kind === 'image' || asset.kind === 'audio';
}

/** The assets of one kind in the library, sorted by name. The image, video and audio pages of the asset panel each have one. */
export function libraryAssets<K extends PlaceableKind>(assets: Record<Id, AssetRecord>, kind: K): (AssetRecord & { kind: K })[] {
  return Object.values(assets)
    .filter((asset): asset is AssetRecord & { kind: K } => asset.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

/** Roughly how many frames an asset takes on the timeline. Used to judge whether it fits; the engine decides the actual length. */
export function assetFrames(asset: AssetRecord, sequence: Sequence): number {
  const revision = asset.revisions[asset.currentRevision];
  const seconds = asset.kind === 'image' || !revision?.duration ? IMAGE_SECONDS : mediaTimeToSeconds(revision.duration);
  return Math.max(1, Math.floor((seconds * sequence.fps.num) / sequence.fps.den));
}

/** Whether this track is empty between frames [start, end). Instances in `ignore` are not counted. */
export function trackFree(sequence: Sequence, trackId: Id, start: number, end: number, ignore: ReadonlySet<Id> = new Set()): boolean {
  return sequence.items.every((item) => {
    if (item.trackId !== trackId || ignore.has(item.id)) return true;
    const range = itemFrames(item, sequence.fps);
    return range.end <= start + 1e-6 || range.start >= end - 1e-6;
  });
}

function unlockedTracks(sequence: Sequence, kind: PlaceableKind): Track[] {
  return [...sequence.tracks]
    .filter((track) => !track.locked && trackAccepts(track, { type: kind }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * “add to timeline”: placed at the playhead. In the prototype (editor-elements.jsx `addElement`), what is added from the panel is a layer at the playhead.
 * - Images and videos must be on top to be seen. Only an empty track above the topmost visual track that has content during this span is used. If there is none, a new track is created at the top (`addItem` cannot reference a track created in the same transaction, so it is written with `insertItems`, using the engine `addItem` default fields).
 * - Audio goes onto the first audio track that is empty there. If all of them are taken, it is appended to the end of the first audio track.
 * - When a track is specified (dragged onto a row), only that track is considered. If it is empty, the asset goes at the drop point. Otherwise it is appended to its end.
 */
export function placeAsset(sequence: Sequence, asset: AssetRecord & { kind: PlaceableKind }, atFrame: number, trackId?: Id): EditOperation[] {
  const length = assetFrames(asset, sequence);
  const base = { type: 'addItem' as const, sequenceId: sequence.id, asset: { assetId: asset.id }, alignment: 'exact-frame' as const };
  const candidates = unlockedTracks(sequence, asset.kind).filter((track) => !trackId || track.id === trackId);
  const free = (tracks: Track[]) => tracks.find((track) => trackFree(sequence, track.id, atFrame, atFrame + length));
  if (trackId || asset.kind === 'audio') {
    const open = free(candidates);
    if (open) return [{ ...base, trackId: open.id, at: frames(atFrame) }];
    const fallback = candidates[0];
    return [fallback ? { ...base, trackId: fallback.id } : base];
  }
  const busy = sequence.tracks.filter((track) => track.kind === 'visual' && !trackFree(sequence, track.id, atFrame, atFrame + length));
  const floor = busy.length ? Math.max(...busy.map((track) => track.order)) : Number.NEGATIVE_INFINITY;
  const open = free(candidates.filter((track) => track.order > floor && track.visible));
  if (open) return [{ ...base, trackId: open.id, at: frames(atFrame) }];
  const ref = 'place-track';
  return [
    { type: 'addTrack', sequenceId: sequence.id, kind: 'visual', ref },
    { type: 'insertItems', sequenceId: sequence.id, items: [overlayItem(sequence, asset, atFrame, ref)] },
  ];
}

/** An image or video layer matching the engine's `addItem` default: it covers the canvas (`fullscreen` + `contain`), is opaque, and starts from the asset's beginning. An image is 5 s, and a video is its whole length. */
function overlayItem(sequence: Sequence, asset: AssetRecord & { kind: PlaceableKind }, atFrame: number, trackRef: string): SequenceItemInput {
  const perSecond = sequence.fps.num / sequence.fps.den;
  const duration = asset.revisions[asset.currentRevision]?.duration;
  const common = {
    trackRef,
    name: asset.name,
    place: {},
    assetRef: { id: asset.id, revision: asset.currentRevision },
    mode: 'fullscreen' as const,
    fit: 'contain' as const,
  };
  const from = Math.max(0, Math.round(atFrame));
  if (asset.kind === 'image' || !duration) {
    return { ...common, type: 'image', span: { fromFrame: from, durationFrames: Math.max(1, Math.round(IMAGE_SECONDS * perSecond)) } };
  }
  return {
    ...common,
    type: 'video',
    span: { fromFrame: from, durationFrames: Math.max(1, Math.floor(mediaTimeToSeconds(duration) * perSecond)) },
    timeMap: { kind: 'linear', sourceIn: { ticks: '0', timescale: duration.timescale }, rate: { num: 1, den: 1 } },
    embeddedAudio: { enabled: true, volume: 1 },
  };
}

/**
 * Files dragged in from the computer: import and placement are in one transaction (the import uses a ref so the later placement can reference it). When the importer knows the asset's name and source, it passes them along (files downloaded by home-page link import are recorded with the `link-import` source).
 */
export function importAndPlace(
  sequence: Sequence,
  files: readonly { path: string; kind: PlaceableKind | null; name?: string; provenance?: { origin: string; source?: unknown } }[],
  atFrame: number | null,
  trackId?: Id,
): EditOperation[] {
  const operations: EditOperation[] = [];
  files.forEach((file, index) => {
    const ref = `drop${index}`;
    operations.push({
      type: 'importAsset',
      path: file.path,
      ref,
      ...(file.name ? { name: file.name } : {}),
      ...(file.provenance ? { provenance: file.provenance } : {}),
    });
    if (!file.kind) return;
    const track = trackId ? sequence.tracks.find((t) => t.id === trackId) : undefined;
    const fits = track && !track.locked && trackAccepts(track, { type: file.kind });
    // The first file goes at the drop point. Later ones are appended to the end of the same track, not stacked on top.
    operations.push({
      type: 'addItem',
      sequenceId: sequence.id,
      asset: { ref },
      ...(fits ? { trackId: track.id } : {}),
      ...(index === 0 && atFrame !== null && fits ? { at: frames(atFrame) } : {}),
      alignment: 'exact-frame',
    });
  });
  return operations;
}

export interface DragMove {
  /** The instance that was grabbed. */
  itemId: Id;
  /** The instances moved together (including the one grabbed). */
  itemIds: Id[];
  /** How many frames it moved. */
  deltaFrames: number;
  /** The track the grabbed instance moves to. null when the track does not change. It only changes track when there is a single instance. */
  trackId: Id | null;
}

/** Drag: one instance uses moveItem (which can change track). Several use moveItems in one transaction, and overlap is checked after all the moves. */
export function moveOperation(sequence: Sequence, drag: DragMove): EditOperation | null {
  const byId = new Map(sequence.items.map((item) => [item.id, item]));
  const moved = drag.itemIds.map((id) => byId.get(id)).filter((item): item is SequenceItem => !!item);
  if (!moved.length) return null;
  const changeTrack = drag.trackId !== null && moved.length === 1 && drag.trackId !== moved[0]!.trackId;
  if (drag.deltaFrames === 0 && !changeTrack) return null;
  const startOf = (item: SequenceItem) => itemFrames(item, sequence.fps).start;
  if (moved.length === 1) {
    const item = moved[0]!;
    return {
      type: 'moveItem',
      sequenceId: sequence.id,
      itemId: item.id,
      at: frames(startOf(item) + drag.deltaFrames),
      ...(changeTrack ? { trackId: drag.trackId! } : {}),
      alignment: 'exact-frame',
    };
  }
  return {
    type: 'moveItems',
    sequenceId: sequence.id,
    moves: moved.map((item) => ({ itemId: item.id, at: frames(startOf(item) + drag.deltaFrames) })),
    alignment: 'exact-frame',
  };
}

/** Trim one end to a frame. Keeps at least one frame. Returns null when unreasonable. */
export function trimOperation(sequence: Sequence, item: SequenceItem, edge: 'start' | 'end', frame: number): EditOperation | null {
  const range = itemFrames(item, sequence.fps);
  const target = Math.round(frame);
  if (edge === 'start' && (target >= Math.ceil(range.end) || target === Math.round(range.start))) return null;
  if (edge === 'end' && (target <= Math.floor(range.start) || target === Math.round(range.end))) return null;
  return { type: 'trimItem', sequenceId: sequence.id, itemId: item.id, edge, at: frames(target), alignment: 'exact-frame' };
}

/** Split at the playhead: among the selected instances, those that cross the playhead. With no selection, split all unlocked instances that cross the playhead. */
export function splitOperations(sequence: Sequence, selection: readonly Id[], playheadFrame: number): EditOperation[] {
  const locked = new Set(sequence.tracks.filter((t) => t.locked).map((t) => t.id));
  const pool = selection.length ? sequence.items.filter((item) => selection.includes(item.id)) : sequence.items;
  return pool
    .filter((item) => !item.locked && !locked.has(item.trackId))
    .filter((item) => {
      const range = itemFrames(item, sequence.fps);
      return range.start < playheadFrame - 1e-6 && range.end > playheadFrame + 1e-6;
    })
    .map((item) => ({ type: 'splitItem', sequenceId: sequence.id, itemId: item.id, at: frames(playheadFrame), alignment: 'exact-frame' }));
}

/**
 * The clips Delete removes: the instances in the selection that are still on the timeline (in timeline order). If there are none, there is nothing to delete, and the transport's delete key is greyed out.
 * Locking is not checked here (consistent with the Delete key; the engine decides).
 */
export function deletableItemIds(sequence: Sequence, selection: readonly Id[]): Id[] {
  if (!selection.length) return [];
  const ids = new Set(selection);
  return sequence.items.filter((item) => ids.has(item.id)).map((item) => item.id);
}

/** How many times an asset is used on the timeline (pre-rendered stand-ins of compositions count too). */
export function usageCount(sequence: Sequence | null, assetId: Id): number {
  return sequence ? sequence.items.filter((item) => itemAssetRefs(item).some((ref) => ref.id === assetId)).length : 0;
}

/**
 * How far a trim can go, in frames: the start is not earlier than the asset's beginning, the end is not later than the asset's end, and the two ends are at least one frame apart.
 * Instances without source time (images, text, shapes, subtitles) have no length limit. A composition's end is limited only by its pre-rendered stand-in's length (the code package itself has no duration). Without a stand-in, only the start limit applies.
 * This limit is only in the UI. The engine also rejects trims that go out of bounds.
 */
export function trimBounds(item: SequenceItem, assets: Record<Id, AssetRecord>, sequence: Sequence): { min: number; max: number } {
  const { start, end } = itemFrames(item, sequence.fps);
  const perSecond = sequence.fps.num / sequence.fps.den;
  const timeMap = itemTimeMap(item);
  if (timeMap?.kind !== 'linear') return { min: 0, max: Number.POSITIVE_INFINITY };
  const rate = timeMap.rate.num / timeMap.rate.den;
  const sourceIn = mediaTimeToSeconds(timeMap.sourceIn);
  const timed = item.type === 'composition' ? item.prerender : item.type === 'video' || item.type === 'audio' ? item.assetRef : undefined;
  const revision = timed ? assets[timed.id]?.revisions[timed.revision] : undefined;
  const duration = revision?.duration ? mediaTimeToSeconds(revision.duration) : null;
  const min = Math.max(0, Math.ceil(start - (sourceIn / rate) * perSecond - 1e-6));
  const max = duration === null ? Number.POSITIVE_INFINITY : Math.floor(start + ((duration - sourceIn) / rate) * perSecond + 1e-6);
  return { min, max: Math.max(max, Math.ceil(end)) };
}

/** ⌘A: the clips whose time span covers the frame under the playhead (prototype visibleAt: the elements under the playhead). */
export function itemsAtFrame(sequence: Sequence, frame: number): Id[] {
  return sequence.items
    .filter((item) => {
      const { start, end } = itemFrames(item, sequence.fps);
      return start <= frame + 1e-6 && end > frame + 1e-6;
    })
    .map((item) => item.id);
}

/**
 * The step for ⌥←/→ time nudging. After the selected clips move `step` frames further, if the start is not before 0 and does not collide with unselected clips on the same track, return the new cumulative offset. If it cannot move (or something is locked), return the input unchanged. `delta` is the cumulative offset not yet committed.
 */
export function nudgeDelta(sequence: Sequence, itemIds: readonly Id[], delta: number, step: number): number {
  const ids = new Set(itemIds);
  const moved = sequence.items.filter((item) => ids.has(item.id));
  if (!moved.length || step === 0) return delta;
  const locked = new Set(sequence.tracks.filter((track) => track.locked).map((track) => track.id));
  if (moved.some((item) => item.locked || locked.has(item.trackId))) return delta;
  const next = delta + step;
  const fps = sequence.fps;
  for (const item of moved) {
    const { start, end } = itemFrames(item, fps);
    if (start + next < -1e-6) return delta;
    const blocked = sequence.items.some((other) => {
      if (other.trackId !== item.trackId || ids.has(other.id)) return false;
      const range = itemFrames(other, fps);
      return range.end > start + next + 1e-6 && range.start < end + next - 1e-6;
    });
    if (blocked) return delta;
  }
  return next;
}

// ---- The asset panel's ⋯ menu and dub groups (design draft panel-media.jsx `MediaMenu`, `AudioGroup`) ----

/** One place an asset is used on the timeline (“where it's used”). */
export interface AssetUsage {
  itemId: Id;
  /** The name on the track header (matches the timeline). */
  track: string;
  name: string;
  /** Start and end (seconds). */
  start: number;
  end: number;
}

/** Where the asset is used on the timeline: sorted by start, with the track name. Pre-rendered stand-ins of compositions count too. */
export function assetUsages(sequence: Sequence | null, assetId: Id): AssetUsage[] {
  if (!sequence) return [];
  const labels = new Map(trackRows(sequence).map((row) => [row.track.id, row.label]));
  const perSecond = sequence.fps.num / sequence.fps.den;
  return sequence.items
    .filter((item) => itemAssetRefs(item).some((ref) => ref.id === assetId))
    .map((item) => {
      const range = itemFrames(item, sequence.fps);
      return { itemId: item.id, track: labels.get(item.trackId) ?? '', name: item.name ?? '', start: range.start / perSecond, end: range.end / perSecond };
    })
    .sort((a, b) => a.start - b.start || a.itemId.localeCompare(b.itemId));
}

/**
 * The file for “show in folder”. A linked asset is its registered original file (the relative path is appended after the video directory). Assets imported into the video directory are managed by CucCut. The Runtime does not give their location on disk (same wording as library-brand), so this returns null.
 */
export function assetFilePath(asset: AssetRecord, videoDir: string | null): string | null {
  const storage = asset.revisions[asset.currentRevision]?.storage;
  if (storage?.mode !== 'linked') return null;
  const path = storage.locator.path;
  // Absolute paths: macOS / Linux `/…`, Windows `C:\…` or `\\server\…` (same as isAbsolutePath in tools-transcode).
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')) return path;
  if (!videoDir) return null;
  const windows = /^[A-Za-z]:\\/.test(videoDir) || videoDir.startsWith('\\\\');
  // A link outside the video directory (`../downloads/a.webm`) has `.` and `..` folded away, so both the display and the path handed to the file manager are clean.
  const sep = windows ? '\\' : '/';
  const parts = videoDir.replace(/[\\/]+$/, '').split(/[\\/]/);
  // Does not go past the root: `/` (splitting gives an empty string), `C:`, or UNC `\\server\share`.
  const root = videoDir.startsWith('\\\\') ? 4 : 1;
  for (const segment of path.split(/[\\/]+/)) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length > root) parts.pop();
    } else parts.push(segment);
  }
  return parts.length === 1 ? `${parts[0]}${sep}` : parts.join(sep);
}

/** One file row in a dub group (design draft `.agfile`). The separated background (and vocals) each get a row, one per sentence. Sentences that were not synthesized, are too long, or have a stale translation have no instance, but they are listed too. */
export interface DubFileRow {
  key: string;
  kind: 'bed' | 'sentence';
  /** The instance on the timeline. Clicking a row selects it and jumps there. null when it is not on the timeline. */
  itemId: Id | null;
  name: string;
  /** This sentence's translation. The separated tracks say “separated background” or “separated vocals”. */
  text: string;
  status: 'failed' | 'needs-fit' | 'stale' | 'draft' | null;
  muted: boolean;
  /** Duration in seconds. null when there is no instance and the asset's length is unknown. */
  seconds: number | null;
}

export interface DubGroupCard {
  groupId: string;
  language: string | null;
  /** Small tag on the row header: the language sub-tag (EN, JA). When the language is unknown, write “dub”. */
  badge: string;
  /** “Dub · English”. */
  title: string;
  /** Group header subtitle: `63 个文件 · 62 句 · 3 句没合成 · 模型` (sample text, kept as is). */
  line: string;
  /** On the timeline / track off / not on the timeline (the instances were all deleted, but the asset is still in the library). */
  state: 'on' | 'off' | 'gone';
  files: DubFileRow[];
  /** The dub track (“remove this dub group” removes the ducking triggered by it). */
  trackId: Id | null;
  /** This group's instances on the timeline (including the separated background). */
  itemIds: Id[];
  /** Sentences that need regenerating: the ones not synthesized and the overlong ones. */
  regen: number;
}

export const DUB_STATUS_TEXT: Record<NonNullable<DubFileRow['status']>, string> = live(() => M.dubStatus);

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const dubMark = (extensions: Record<string, unknown> | undefined): (Json & { groupId: string }) | null => {
  const mark = extensions?.[DUB_EXTENSION];
  return isJson(mark) && typeof mark.groupId === 'string' ? (mark as Json & { groupId: string }) : null;
};

/** Which group an asset generated by the dub flow belongs to: the flow creates `groupId` from the task ID (`dub_<task>`). */
function dubGroupOfAsset(asset: AssetRecord): { groupId: string; language: string | null; stem: string | null } | null {
  const source = asset.revisions[asset.currentRevision]?.provenance.source;
  if (!isJson(source) || source.pipeline !== 'dub' || typeof source.jobId !== 'string') return null;
  return {
    groupId: `dub_${source.jobId.replace(/^job_/, '')}`,
    language: typeof source.language === 'string' ? source.language : null,
    stem: typeof source.stem === 'string' ? source.stem : null,
  };
}

/** Dub plan document: the summary of the current version records the `groupId`. */
export function dubPlanRecord(documents: Record<Id, DocumentRecord>, groupId: string): DocumentRecord | undefined {
  return Object.values(documents).find((record) => {
    if (record.kind !== 'dubbing-plan') return false;
    const summary = record.revisions[record.currentRevision]?.summary;
    return isJson(summary) && summary.groupId === groupId;
  });
}

/**
 * The audio page groups by dub (design draft `audioGroups`): the instances on the timeline that carry `extensions['cuccut.dub']`, and the assets generated by the dub flow, with one card per group. The remaining audio assets stay flat (`loose`). Groups are ordered by first appearance, with those on the timeline first.
 */
export function dubGroupIds<A extends AssetRecord>(sequence: Sequence | null, assets: readonly A[]): { groups: string[]; loose: A[] } {
  const groups: string[] = [];
  const grouped = new Set<Id>();
  const add = (groupId: string) => {
    if (!groups.includes(groupId)) groups.push(groupId);
  };
  for (const item of sequence?.items ?? []) {
    const mark = dubMark(item.extensions);
    if (!mark) continue;
    add(mark.groupId);
    for (const ref of itemAssetRefs(item)) grouped.add(ref.id);
  }
  for (const asset of assets) {
    const own = dubGroupOfAsset(asset);
    if (!own) continue;
    add(own.groupId);
    grouped.add(asset.id);
  }
  return { groups, loose: assets.filter((asset) => !grouped.has(asset.id)) };
}

interface PlanUnit {
  unitId: string;
  index: number;
  text: string;
  status: string;
}

function planUnits(body: unknown): PlanUnit[] | null {
  if (!isJson(body) || !Array.isArray(body.units)) return null;
  const out: PlanUnit[] = [];
  body.units.forEach((unit: unknown, index: number) => {
    if (!isJson(unit)) return;
    const own = isJson(unit.extensions) ? unit.extensions[DUB_EXTENSION] : undefined;
    const unitId =
      isJson(own) && typeof own.translationUnitId === 'string' ? own.translationUnitId : typeof unit.id === 'string' ? unit.id.replace(/^d-/, '') : null;
    if (!unitId) return;
    const text = isJson(unit.script) && typeof unit.script.text === 'string' ? unit.script.text : '';
    out.push({ unitId, index, text, status: typeof unit.status === 'string' ? unit.status : 'ready' });
  });
  return out;
}

/** The model used for dubbing (the plan body's `extensions['cuccut.dub'].voice`). */
function planEngine(body: unknown): string | null {
  if (!isJson(body) || !isJson(body.extensions)) return null;
  const own = body.extensions[DUB_EXTENSION];
  const voice = isJson(own) && isJson(own.voice) ? own.voice : null;
  if (!voice) return null;
  return typeof voice.modelId === 'string' && voice.modelId
    ? voice.modelId
    : typeof voice.providerId === 'string' && voice.providerId
      ? voice.providerId
      : null;
}

/** A dub group's card (one group of the design draft `audioGroups`, and `groupLine`). `planBody` is the body of the dub plan. It is undefined when not yet fetched. */
export function dubGroupCard(sequence: Sequence | null, assets: Record<Id, AssetRecord>, groupId: string, planBody: unknown): DubGroupCard {
  const fps = sequence?.fps ?? { num: 30, den: 1 };
  const perSecond = fps.num / fps.den;
  const items = (sequence?.items ?? [])
    .map((item) => ({ item, mark: dubMark(item.extensions), range: itemFrames(item, fps) }))
    .filter(
      (entry): entry is { item: SequenceItem; mark: Json & { groupId: string }; range: { start: number; end: number } } => entry.mark?.groupId === groupId,
    )
    .sort((a, b) => a.range.start - b.range.start || a.item.id.localeCompare(b.item.id));
  const sentences = items.filter((entry) => entry.mark.stem === undefined);
  const beds = items.filter((entry) => entry.mark.stem !== undefined);
  const owned = Object.values(assets).filter((asset) => dubGroupOfAsset(asset)?.groupId === groupId);
  const language =
    sentences.map((e) => e.mark.language).find((l): l is string => typeof l === 'string') ??
    owned.map((a) => dubGroupOfAsset(a)!.language).find((l): l is string => l !== null) ??
    null;

  const assetOf = (item: SequenceItem) => itemAssetRefs(item)[0]?.id ?? null;
  const secondsOf = (asset: AssetRecord | undefined) => {
    const duration = asset?.revisions[asset.currentRevision]?.duration;
    return duration ? mediaTimeToSeconds(duration) : null;
  };
  const silent = (item: SequenceItem) => !item.enabled || (item.type === 'audio' && item.mix.muted === true);
  const files: DubFileRow[] = [];
  // The separated background and vocals: the assets used on the timeline for those segments (one each). Instances that were deleted while their assets remain in the library are also listed as one row.
  const stemText = (stem: unknown) => (stem === 'vocals' ? M.stemVocals : M.stemBackground);
  const bedAssets = new Set<Id>();
  for (const { item, mark, range } of beds) {
    const assetId = assetOf(item);
    if (assetId && bedAssets.has(assetId)) continue;
    if (assetId) bedAssets.add(assetId);
    const asset = assetId ? assets[assetId] : undefined;
    files.push({
      key: item.id,
      kind: 'bed',
      itemId: item.id,
      name: asset?.name ?? item.name ?? M.background,
      text: stemText(mark.stem),
      status: null,
      muted: silent(item),
      seconds: secondsOf(asset) ?? (range.end - range.start) / perSecond,
    });
  }
  for (const asset of owned) {
    if (!dubGroupOfAsset(asset)!.stem || bedAssets.has(asset.id)) continue;
    const text = stemText(dubGroupOfAsset(asset)!.stem);
    files.push({ key: asset.id, kind: 'bed', itemId: null, name: asset.name, text, status: null, muted: false, seconds: secondsOf(asset) });
  }

  const units = planUnits(planBody);
  const unitOf = new Map((units ?? []).map((u) => [u.unitId, u]));
  const placed = new Set<string>();
  for (const { item, mark, range } of sentences) {
    const unitId = typeof mark.unitId === 'string' ? mark.unitId : null;
    const unit = unitId ? unitOf.get(unitId) : undefined;
    if (unitId) placed.add(unitId);
    const assetId = assetOf(item);
    files.push({
      key: item.id,
      kind: 'sentence',
      itemId: item.id,
      name: unit ? M.sentenceN(unit.index + 1) : (item.name ?? (assetId ? assets[assetId]?.name : undefined) ?? M.dub),
      text: unit?.text ?? '',
      status: null,
      muted: silent(item),
      seconds: (range.end - range.start) / perSecond,
    });
  }
  for (const unit of units ?? []) {
    if (placed.has(unit.unitId) || unit.status === 'ready') continue;
    const status = unit.status === 'failed' || unit.status === 'needs-fit' || unit.status === 'stale' ? unit.status : 'draft';
    files.push({
      key: `unit:${unit.unitId}`,
      kind: 'sentence',
      itemId: null,
      name: M.sentenceN(unit.index + 1),
      text: unit.text,
      status,
      muted: false,
      seconds: null,
    });
  }

  const count = (status: DubFileRow['status']) => files.filter((f) => f.status === status).length;
  const fileCount = new Set([...items.map((e) => assetOf(e.item)).filter((id): id is Id => !!id), ...owned.map((a) => a.id)]).size;
  const parts = [M.files(fileCount), M.sentences(units ? units.length : sentences.length)];
  for (const status of ['failed', 'needs-fit', 'stale', 'draft'] as const) {
    const n = count(status);
    if (n) parts.push(M.dubStatusCount(n, status));
  }
  const muted = files.filter((f) => f.kind === 'sentence' && f.muted).length;
  if (muted) parts.push(M.muted(muted));
  const engine = planEngine(planBody);
  if (engine) parts.push(engine);

  const trackId = sentences[0]?.item.trackId ?? null;
  const track = trackId ? sequence?.tracks.find((t) => t.id === trackId) : undefined;
  const state: DubGroupCard['state'] = !items.length ? 'gone' : !track || track.muted || sentences.every((e) => !e.item.enabled) ? 'off' : 'on';
  return {
    groupId,
    language,
    badge: language ? language.split('-')[0]!.toUpperCase() : M.dub,
    title: M.dubTitle(language ? languageName(language) : null),
    line: parts.join(' · '),
    state,
    files,
    trackId,
    itemIds: items.map((e) => e.item.id),
    regen: count('failed') + count('needs-fit'),
  };
}

/** The side note on the section header (design draft `audioAside`): `2 组配音 · 65 个文件` / `2 个文件` (sample text, kept as is). */
export function audioAside(groups: number, files: number): string {
  return M.aside(groups, files);
}

// ---- Layers on the canvas ----

/**
 * Whether this item can still move one layer in this direction. The stacking order is the track's up and down order (command protocol spec §4.2 `arrangeItem`). An item that shares its track with other clips can always be split onto a newly created adjacent track. An item that has its own track and is already at the top or bottom of this stack (the picture and subtitle tracks share one stack) cannot move further. Sound has no stacking order, and subtitle instances are not adjusted on the canvas.
 */
export function canArrange(sequence: Sequence, itemId: Id, direction: ArrangeDirection): boolean {
  const item = sequence.items.find((candidate) => candidate.id === itemId);
  if (!item || item.type === 'audio' || item.type === 'caption') return false;
  const track = sequence.tracks.find((candidate) => candidate.id === item.trackId);
  if (!track) return false;
  if (sequence.items.some((other) => other.trackId === item.trackId && other.id !== itemId)) return true;
  const upward = direction === 'forward' || direction === 'front';
  const group = stackingGroup(track.kind);
  return sequence.tracks.some((other) => stackingGroup(other.kind) === group && (upward ? other.order > track.order : other.order < track.order));
}

/** The result of one layer move. null when it cannot move (the menu item is greyed out, and the shortcut does nothing). */
export function arrangeOperation(sequence: Sequence, itemId: Id, direction: ArrangeDirection): EditOperation | null {
  if (!canArrange(sequence, itemId, direction)) return null;
  return { type: 'arrangeItem', sequenceId: sequence.id, itemId, direction };
}
