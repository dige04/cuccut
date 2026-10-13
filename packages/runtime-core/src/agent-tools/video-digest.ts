import os from 'node:os';
import path from 'node:path';
import {
  framesToSeconds,
  itemAssetRef,
  itemAssetRefs,
  itemRangeSeconds,
  itemTimeMap,
  localizeText,
  mediaTimeToSeconds,
  sequenceDurationFrames,
  type DuckingGroup,
  type DuckingTrigger,
  type EmbeddedAudio,
  type HistoryEntry,
  type Id,
  type VideoSnapshot,
  type Rate,
  type Sequence,
  type SequenceItem,
  type TransactionReceipt,
  type VisualItem,
  type AssetRevision,
} from '@cuccut/protocol';
import { sourceChapters } from '@cuccut/editor-wasm';

/**
 * Video digest for agents (architecture design §3.7: scoped reads). Only fields needed for decisions are kept: stable
 * IDs, seconds and frames, asset kinds and durations, document headers. Times are given both in seconds (easier to
 * understand) and frames (the engine's authoritative unit). Document bodies are not in the digest.
 */

export interface DigestOptions {
  /** List only clips that intersect this time range (seconds). */
  from?: number;
  to?: number;
  /** Maximum number of clips to list; any beyond that are honestly marked as truncated. */
  limit?: number;
}

const DEFAULT_ITEM_LIMIT = 200;
/** Text item content is kept up to this many characters in the digest. */
const TEXT_PREVIEW_CHARS = 120;

export function digestVideo(snapshot: VideoSnapshot, videoPath: string, history: HistoryEntry[], options: DigestOptions = {}) {
  const sequence = snapshot.sequences[snapshot.rootSequenceId];
  if (!sequence) throw new Error('Video has no root sequence');
  const fps = sequence.fps;
  const assets = Object.values(snapshot.assets);
  const from = options.from ?? 0;
  const to = options.to ?? Number.POSITIVE_INFINITY;
  const limit = options.limit ?? DEFAULT_ITEM_LIMIT;

  const inRange = sequence.items
    .map((item) => ({ item, range: itemRangeSeconds(item, fps) }))
    .filter(({ range }) => range.end > from && range.start < to)
    .sort((a, b) => a.range.start - b.range.start || trackOrder(sequence, a.item) - trackOrder(sequence, b.item));
  const listed = inRange.slice(0, limit);

  return {
    videoId: snapshot.id,
    video: videoPath,
    name: snapshot.name,
    revision: snapshot.revision,
    sequence: {
      id: sequence.id,
      fps: formatRate(fps),
      canvas: `${sequence.canvas.width}x${sequence.canvas.height}`,
      durationSeconds: round(framesToSeconds(sequenceDurationFrames(sequence), fps)),
      durationFrames: sequenceDurationFrames(sequence),
    },
    tracks: [...sequence.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => ({
        id: track.id,
        kind: track.kind,
        name: track.name ?? null,
        locked: track.locked,
        visible: track.visible,
        muted: track.muted,
        items: sequence.items.filter((item) => item.trackId === track.id).length,
      })),
    items: listed.map(({ item, range }) => describeItem(item, range, snapshot)),
    itemsCoverage: {
      fromSeconds: from,
      toSeconds: Number.isFinite(to) ? to : null,
      matched: inRange.length,
      listed: listed.length,
      truncated: listed.length < inRange.length,
    },
    transitions: sequence.transitions.map((t) => ({
      id: t.id,
      kind: t.kind,
      ...(t.params && Object.keys(t.params).length ? { params: t.params } : {}),
      ...(t.leftItemId ? { leftItemId: t.leftItemId } : {}),
      ...(t.rightItemId ? { rightItemId: t.rightItemId } : {}),
      durationSeconds: round(framesToSeconds(t.durationFrames, fps)),
      durationFrames: t.durationFrames,
      easing: t.easing,
      placement: t.placement,
      ...(t.audioCrossfade ? { audioCrossfade: true } : {}),
    })),
    chapters: sequence.markers
      .filter((m) => m.kind === 'chapter')
      .map((m) => ({
        id: m.id,
        title: m.label,
        atSeconds: round(framesToSeconds(m.frame, fps)),
        atFrame: m.frame,
        ...(m.summary !== undefined ? { summary: m.summary } : {}),
        ...(m.thumbnail ? { thumbnailAssetId: m.thumbnail.id } : {}),
      })),
    ducking: (sequence.ducking ?? []).map((rule) => ({
      id: rule.id,
      ...(rule.name ? { name: rule.name } : {}),
      enabled: rule.enabled,
      trigger: describeTrigger(rule.trigger),
      target: describeGroup(rule.target),
      depth: rule.depth,
      attackSeconds: round(mediaTimeToSeconds(rule.attack)),
      releaseSeconds: round(mediaTimeToSeconds(rule.release)),
    })),
    assets: assets
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((asset) => {
        const revision = asset.revisions[asset.currentRevision];
        return {
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          durationSeconds: revision?.duration && asset.kind !== 'image' ? round(mediaTimeToSeconds(revision.duration)) : null,
          size: revision?.video ? `${revision.video.displayWidth}x${revision.video.displayHeight}` : null,
          hasAudio: Boolean(revision?.audio),
          storage: revision?.storage.mode ?? null,
          ...(revision?.tree ? { files: revision.tree.fileCount } : {}),
          ...(asset.kind === 'bundle' ? bundleIdentity(revision?.bundle) : {}),
          ...sourceBlock(revision),
          usedBy: sequence.items.filter((item) => itemAssetRefs(item).some((ref) => ref.id === asset.id)).length,
        };
      }),
    documents: Object.values(snapshot.documents)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((document) => {
        const summary = document.revisions[document.currentRevision]?.summary;
        return {
          id: document.id,
          kind: document.kind,
          name: document.name,
          language: document.language ?? null,
          revision: document.currentRevision,
          ...(document.sourceAssetId ? { sourceAssetId: document.sourceAssetId } : {}),
          ...(document.sourceDocumentId ? { sourceDocumentId: document.sourceDocumentId } : {}),
          ...(summary !== undefined ? { summary } : {}),
          usedBy: sequence.items.filter(
            (item) => item.type === 'caption' && (item.documentId === document.id || item.styleDocumentId === document.id),
          ).length,
        };
      }),
    recentHistory: history.slice(0, 10).map((entry) => ({
      transactionId: entry.transactionId,
      label: localizeText(entry.label, entry.labelRef),
      by: entry.actor.kind,
      revision: entry.videoRevision,
      undone: Boolean(entry.undoneBy),
      ...(entry.undoOf ? { undoOf: entry.undoOf } : {}),
    })),
  };
}

/** Maximum characters of the source description kept in the digest (the full text is in the asset's `provenance.source.description`). */
const SOURCE_DESCRIPTION_CHARS = 1200;

/** Source platform metadata: assets imported from a link (video format spec §4.5), or whose source carries these fields. */
function isPlatformSource(
  provenance: AssetRevision['provenance'] | undefined,
): provenance is { origin: string; source: Record<string, unknown> } {
  const source = provenance?.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  if (provenance.origin === 'link-import') return true;
  return ['description', 'chapters', 'webpageUrl', 'uploader'].some((key) => key in source);
}

/**
 * `assets[].source`: the source platform's title, uploader, description (truncated to 1200 characters) and author
 * chapters (structured `chapters[]` first, otherwise the timestamp outline in the description; source-time seconds, not
 * snapped). Background reference for polishing and speaker identification; adopt chapters with `chapters_adopt`.
 * Chapters are parsed by the captions and translation core (`bc_source_chapters`, no snapping); without a WASM build it
 * falls back to the structured chapters and does not parse the description.
 */
function sourceBlock(revision: AssetRevision | undefined) {
  const provenance = revision?.provenance;
  if (!isPlatformSource(provenance)) return {};
  const { source } = provenance;
  const text = (key: string) => (typeof source[key] === 'string' && source[key] ? (source[key] as string) : null);
  const description = text('description');
  const chars = description ? [...description] : [];
  return {
    source: {
      platform: text('platform'),
      webpageUrl: text('webpageUrl'),
      uploader: text('uploader'),
      uploadDate: text('uploadDate'),
      title: text('title'),
      description: chars.length > SOURCE_DESCRIPTION_CHARS ? chars.slice(0, SOURCE_DESCRIPTION_CHARS).join('') : description,
      descriptionTruncated: chars.length > SOURCE_DESCRIPTION_CHARS,
      chapters: authorChapters(source, revision?.duration ? mediaTimeToSeconds(revision.duration) : 0),
    },
  };
}

function authorChapters(source: Record<string, unknown>, durationSeconds: number): Array<{ at: number; title: string }> {
  try {
    return sourceChapters({ source, durationSeconds, snap: false }).sourceChapters.map((c) => ({ at: round(c.start), title: c.title }));
  } catch {
    // The digest does not fail over an optional extra: without a WASM build or with an unreadable source, list only the structured chapters (already cleaned at import).
    const raw = Array.isArray(source.chapters) ? (source.chapters as unknown[]) : [];
    return raw.flatMap((item) => {
      const { start, title } = (item ?? {}) as { start?: unknown; title?: unknown };
      return typeof start === 'number' && Number.isFinite(start) && typeof title === 'string' && title.trim()
        ? [{ at: round(start), title: title.trim() }]
        : [];
    });
  }
}

/** Manifest identity of a code bundle asset: the bundle's bundleId and the manifest revision (bumped when repackaging after copy or color changes), used to tell revisions of the same bundle apart. */
function bundleIdentity(manifest: unknown): { bundleId?: string; manifestRevision?: string } {
  if (!manifest || typeof manifest !== 'object') return {};
  const { bundleId, revision } = manifest as { bundleId?: unknown; revision?: unknown };
  return {
    ...(typeof bundleId === 'string' ? { bundleId } : {}),
    ...(typeof revision === 'string' ? { manifestRevision: revision } : {}),
  };
}

function describeItem(item: SequenceItem, range: { start: number; end: number }, snapshot: VideoSnapshot) {
  const assetRef = itemAssetRef(item);
  const startFrame = item.type === 'audio' ? item.fromFrame : item.span.fromFrame;
  const timeMap = itemTimeMap(item);
  return {
    id: item.id,
    type: item.type,
    trackId: item.trackId,
    name: item.name ?? null,
    ...(item.role ? { role: item.role } : {}),
    ...(assetRef ? { asset: { id: assetRef.id, revision: assetRef.revision, name: snapshot.assets[assetRef.id]?.name ?? null } } : {}),
    ...describeContent(item, snapshot),
    startSeconds: round(range.start),
    endSeconds: round(range.end),
    startFrame,
    ...(item.type === 'audio' ? {} : { durationFrames: item.span.durationFrames }),
    ...(timeMap?.kind === 'linear' ? { sourceInSeconds: round(mediaTimeToSeconds(timeMap.sourceIn)) } : {}),
    ...describePlace(item),
    ...describeSound(item),
    ...describeLook(item),
    enabled: item.enabled,
    locked: item.locked,
  };
}

/** Each type's own content: text or counter readout, a composition's prerender stand-in, the document a caption points to. Shape geometry, styles, generated elements and composition parameters are not in the digest. */
function describeContent(item: SequenceItem, snapshot: VideoSnapshot): Record<string, unknown> {
  switch (item.type) {
    case 'text': {
      if (item.counter) return { counter: item.counter };
      const text = item.text ?? '';
      return { text: text.length > TEXT_PREVIEW_CHARS ? `${text.slice(0, TEXT_PREVIEW_CHARS)}…` : text };
    }
    case 'composition':
      return item.prerender
        ? {
            prerender: { id: item.prerender.id, revision: item.prerender.revision, name: snapshot.assets[item.prerender.id]?.name ?? null },
          }
        : {};
    case 'caption':
      return {
        document: { id: item.documentId, name: snapshot.documents[item.documentId]?.name ?? null },
        ...(item.styleDocumentId ? { styleDocumentId: item.styleDocumentId } : {}),
        ...(item.scopeItemIds?.length ? { scopeItemIds: item.scopeItemIds } : {}),
      };
    default:
      return {};
  }
}

/** Visual media with a `mode`: when filling the canvas, `place` position, width and scale do not apply. */
const MEDIA_TYPES = new Set<SequenceItem['type']>(['video', 'image', 'sticker', 'placeholder', 'whiteboard']);

/**
 * Placement of visual items (`place`, as percentages of the frame): `x`, `y` are the box center, `w` is the box width as
 * a percentage of the frame width; only fields that are set are listed (omitted ones take the per-kind default). Visual
 * media carry `mode`; when filling the canvas (`fullscreen`, or for a composition whose `place` has no position or
 * width) only rotation, flips and opacity are listed.
 */
function describePlace(item: SequenceItem): Record<string, unknown> {
  if (item.type === 'audio' || item.type === 'caption') return {};
  const place = item.place;
  const fullscreen = MEDIA_TYPES.has(item.type)
    ? mediaMode(item) === 'fullscreen'
    : item.type === 'composition' && place.x === undefined && place.y === undefined && place.w === undefined;
  const out: Record<string, unknown> = {};
  if (MEDIA_TYPES.has(item.type) || item.type === 'composition') out.mode = fullscreen ? 'fullscreen' : 'pip';
  const fields = fullscreen ? (['rot'] as const) : (['x', 'y', 'w', 'scale', 'scaleY', 'rot'] as const);
  for (const key of fields) if (place[key] !== undefined) out[key] = round(place[key], 2);
  if (place.flipX) out.flipX = true;
  if (place.flipY) out.flipY = true;
  if (place.opacity !== undefined && place.opacity !== 1) out.opacity = round(place.opacity, 2);
  return Object.keys(out).length > 0 ? { place: out } : {};
}

function mediaMode(item: VisualItem): 'fullscreen' | 'pip' {
  return 'mode' in item && item.mode === 'fullscreen' ? 'fullscreen' : 'pip';
}

/** Sound: an audio item's mix, a video's embedded audio, a composition's own audio. Volume is a linear multiplier (1 is the original level). */
function describeSound(item: SequenceItem): Record<string, unknown> {
  const fades = (audio: { fadeIn?: { ticks: string; timescale: number }; fadeOut?: { ticks: string; timescale: number } }) => ({
    ...(audio.fadeIn ? { fadeInSeconds: round(mediaTimeToSeconds(audio.fadeIn)) } : {}),
    ...(audio.fadeOut ? { fadeOutSeconds: round(mediaTimeToSeconds(audio.fadeOut)) } : {}),
  });
  const embedded = (audio: EmbeddedAudio) => ({ enabled: audio.enabled, volume: round(audio.volume), ...fades(audio) });
  switch (item.type) {
    case 'audio':
      return { volume: round(item.mix.volume), ...(item.mix.muted ? { muted: true } : {}), ...fades(item.mix) };
    case 'video':
      return { embeddedAudio: embedded(item.embeddedAudio) };
    case 'composition':
      return item.audio ? { audio: embedded(item.audio) } : {};
    default:
      return {};
  }
}

/** Crop and effects: effects list only the `fx` field names that are set; values are not in the digest. */
function describeLook(item: SequenceItem): Record<string, unknown> {
  const look: Record<string, unknown> = {};
  if ((item.type === 'video' || item.type === 'image') && item.crop) look.crop = item.crop;
  const fx = item.type === 'audio' || item.type === 'caption' || !('fx' in item) ? undefined : item.fx;
  if (fx && Object.keys(fx).length > 0) look.fx = Object.keys(fx);
  return look;
}

/** Ducking trigger: during speech, or when these tracks and items make sound. */
function describeTrigger(trigger: DuckingTrigger): Record<string, unknown> {
  return trigger.kind === 'speech' ? { kind: 'speech' } : { kind: 'items', ...describeGroup(trigger) };
}

/** One group of a ducking rule: an empty half is omitted. */
function describeGroup(group: DuckingGroup): DuckingGroup {
  return {
    ...(group.trackIds?.length ? { trackIds: group.trackIds } : {}),
    ...(group.itemIds?.length ? { itemIds: group.itemIds } : {}),
  };
}

function trackOrder(sequence: Sequence, item: SequenceItem): number {
  return sequence.tracks.find((track) => track.id === item.trackId)?.order ?? 0;
}

/**
 * Receipt digest: tool results and change cards both come from here, not from what the model says (command and protocol
 * spec §5). Edit labels, like engine errors, are given in the Runtime's language (`localizeText`); change cards also
 * carry `labelRef`, which the UI shows in its own language.
 */
export function digestReceipt(receipt: TransactionReceipt, fps: Rate, replayed: boolean) {
  return {
    status: receipt.status,
    replayed,
    transactionId: receipt.transactionId,
    label: localizeText(receipt.label, receipt.labelRef),
    revision: { before: receipt.previousRevision, after: receipt.videoRevision },
    createdIds: receipt.createdIds,
    updatedIds: receipt.updatedIds,
    deletedIds: receipt.deletedIds,
    ...(Object.keys(receipt.lineage).length ? { lineage: receipt.lineage } : {}),
    durationSeconds: {
      before: round(framesToSeconds(receipt.impact.oldDurationFrames, fps)),
      after: round(framesToSeconds(receipt.impact.newDurationFrames, fps)),
    },
    timeResolution: receipt.timeResolution.map((t) => ({
      requested: t.requested.unit === 'seconds' ? `${t.requested.value}s` : `${t.requested.value}f`,
      actualFrame: t.actualFrame,
      actualSeconds: round(mediaTimeToSeconds(t.actualTime)),
      deltaMs: round(mediaTimeToSeconds(t.delta) * 1000, 1),
      policy: t.policy,
    })),
    ...(receipt.impact.removedTransitions?.length ? { removedTransitions: receipt.impact.removedTransitions } : {}),
    ...(receipt.impact.shortenedTransitions?.length ? { shortenedTransitions: receipt.impact.shortenedTransitions } : {}),
    ...(receipt.impact.removedByCuts?.length ? { removedByCuts: receipt.impact.removedByCuts } : {}),
    ...(receipt.impact.cutsNotRelaid?.length ? { cutsNotRelaid: receipt.impact.cutsNotRelaid } : {}),
    ...(receipt.impact.removedWithTarget?.length ? { removedWithTarget: receipt.impact.removedWithTarget } : {}),
    ...(receipt.impact.codeEdits?.length ? { codeEdits: receipt.impact.codeEdits } : {}),
    ...(receipt.impact.removedTracks?.length ? { removedTracks: receipt.impact.removedTracks } : {}),
    ...(receipt.impact.removedAssets?.length ? { removedAssets: receipt.impact.removedAssets } : {}),
    ...(receipt.impact.orphanedAnchors.length ? { orphanedAnchors: receipt.impact.orphanedAnchors } : {}),
    undoAvailable: receipt.undo.available,
    ...(receipt.undoOf ? { undoOf: receipt.undoOf } : {}),
  };
}

// ---- Normalizing operations ----

/** These operations carry times: without `sequenceId` they use the root sequence, without `alignment` the nearest frame. */
const TIMED = new Set(['addItem', 'moveItem', 'moveItems', 'trimItem', 'splitItem', 'removeRange', 'setTransition', 'setChapters', 'upsertChapter']);
const SEQUENCE_SCOPED = new Set([
  ...TIMED,
  'deleteItems',
  'arrangeItem',
  'addTrack',
  'deleteTrack',
  'updateTrack',
  'moveTrack',
  'updateSequence',
  'setDucking',
  'addCuts',
  'restoreCut',
  'acceptCutSuggestions',
]);

export class OperationShapeError extends Error {
  readonly index: number;
  constructor(index: number, message: string) {
    super(`Operation ${index + 1}: ${message}`);
    this.name = 'OperationShapeError';
    this.index = index;
  }
}

/**
 * Completes operations written by the agent into the engine's canonical form (command and protocol spec §4.2, §6.1).
 * Only fills defaults and converts time notation, without changing semantics; field and value validation still happens
 * in the engine, which rejects unknown fields.
 *
 * - Times may be numbers or numeric strings (seconds), converted to `{ unit: 'seconds', value }`; `{ unit, value }` is
 *   kept as is.
 * - `setAudioMix` fades and `setDucking` attack / release may be numbers (seconds), converted to decimal strings.
 * - `setTransition.duration`, each chapter's `at` in `setChapters`, `upsertChapter.at` and `removeRange`'s `from` / `to`
 *   are converted to time inputs in the same way.
 * - `addItem.asset` and a chapter's `thumbnail` may be given directly as an asset ID.
 * - `importAsset.path` is relative to the session's working directory; `~/` expands to the home directory.
 */
export function normalizeOperations(operations: unknown[], rootSequenceId: Id, cwd: string): Record<string, unknown>[] {
  return operations.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new OperationShapeError(index, 'must be an object');
    const op: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
    const type = op.type;
    if (typeof type !== 'string') throw new OperationShapeError(index, 'missing type');
    if (SEQUENCE_SCOPED.has(type) && op.sequenceId === undefined) op.sequenceId = rootSequenceId;
    if (TIMED.has(type) && op.alignment === undefined) op.alignment = 'nearest-frame';
    for (const key of ['at', 'offset'] as const) {
      if (op[key] !== undefined) op[key] = timeInput(op[key], index);
    }
    if (type === 'removeRange') {
      for (const key of ['from', 'to'] as const) {
        if (op[key] !== undefined) op[key] = timeInput(op[key], index);
      }
    }
    if (type === 'moveItems' && Array.isArray(op.moves)) {
      op.moves = op.moves.map((move) => {
        if (typeof move !== 'object' || move === null) return move;
        const next: Record<string, unknown> = { ...(move as Record<string, unknown>) };
        for (const key of ['at', 'offset'] as const) {
          if (next[key] !== undefined) next[key] = timeInput(next[key], index);
        }
        return next;
      });
    }
    if (type === 'setAudioMix' || type === 'setDucking') {
      for (const key of type === 'setAudioMix' ? ['fadeIn', 'fadeOut'] : ['attack', 'release']) {
        if (typeof op[key] === 'number' && Number.isFinite(op[key])) op[key] = decimal(op[key]);
      }
    }
    if (type === 'setTransition' && op.duration !== undefined) op.duration = timeInput(op.duration, index);
    // Cuts are decimal seconds on the source asset's clock, not sequence time.
    if (type === 'addCuts' && Array.isArray(op.cuts)) {
      op.cuts = op.cuts.map((cut) => {
        if (typeof cut !== 'object' || cut === null) return cut;
        const next: Record<string, unknown> = { ...(cut as Record<string, unknown>) };
        for (const key of ['from', 'to'] as const) {
          if (typeof next[key] === 'number' && Number.isFinite(next[key])) next[key] = decimal(next[key]);
        }
        return next;
      });
    }
    // Detection parameters for cut suggestions: seconds may be numbers, converted to decimal strings.
    if (type === 'proposeCuts' && typeof op.detect === 'object' && op.detect !== null && !Array.isArray(op.detect)) {
      const detect: Record<string, unknown> = { ...(op.detect as Record<string, unknown>) };
      for (const key of ['minPause', 'compressTo', 'maxGap'] as const) {
        if (typeof detect[key] === 'number' && Number.isFinite(detect[key])) detect[key] = decimal(detect[key]);
      }
      op.detect = detect;
    }
    if (type === 'upsertChapter' && typeof op.thumbnail === 'string') op.thumbnail = { assetId: op.thumbnail };
    if (type === 'setChapters' && Array.isArray(op.chapters)) {
      op.chapters = op.chapters.map((chapter) => {
        if (typeof chapter !== 'object' || chapter === null) return chapter;
        const next: Record<string, unknown> = { ...(chapter as Record<string, unknown>) };
        if (next.at !== undefined) next.at = timeInput(next.at, index);
        if (typeof next.thumbnail === 'string') next.thumbnail = { assetId: next.thumbnail };
        return next;
      });
    }
    if (type === 'addItem' && typeof op.asset === 'string') op.asset = { assetId: op.asset };
    if (type === 'importAsset' && typeof op.path === 'string') op.path = resolveUserPath(op.path, cwd);
    return op;
  });
}

function timeInput(value: unknown, index: number): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new OperationShapeError(index, 'time is not a finite number');
    return { unit: 'seconds', value: decimal(value) };
  }
  if (typeof value === 'string') {
    const text = value.trim().replace(/s$/, '');
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new OperationShapeError(index, `unrecognized time "${value}": write seconds, e.g. 1.5`);
    return { unit: 'seconds', value: text };
  }
  return value;
}

function decimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

/** A user-given path: `~/` expands to the home directory, relative paths resolve against `cwd`. */
export function resolveUserPath(file: string, cwd: string): string {
  if (file === '~' || file.startsWith('~/')) return path.join(os.homedir(), file.slice(1));
  return path.resolve(cwd, file);
}

function formatRate(rate: Rate): string {
  return rate.den === 1 ? String(rate.num) : `${rate.num}/${rate.den}`;
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
