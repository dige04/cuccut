import type { AssetRecord, Id, MissingAsset, Sequence, VersionRef } from '@cuccut/protocol';
import { itemFrames } from './editor.ts';
import { M } from './stage-media-copy.ts';

/**
 * Stage notice shown when the main media cannot be played (design draft model-stage-media.js, `StageMediaNotice` in stage.jsx). A pure function; does not touch React or the DOM.
 *
 * Main media: the asset versions used by the enabled video and audio instances in the root sequence, ordered by when they first appear on the timeline. When they are missing, the video still opens, and subtitles, elements and the clock keep running (the preview clock does not depend on the media); there is just no picture or sound. The card stays at the center of the frame, and does not hide during playback. Missing other assets such as images alone does not show a card. Videos without main media (blank, element-only) do not show a card.
 *
 * Four cases, one card:
 * - `missing` / `changed` / `outside-project`: `videos.assetStatus` reports that it cannot be read (video format spec §4.2); the reason is passed through as is;
 * - `unplayable`: the file exists and its address was obtained, but the player cannot open or decode it (with the player's own message).
 *
 * Recovering the picture: the design draft puts “Relink media…” in the ⋯ menu of the Space video card; but Space does not open the video, so it cannot know whether assets are missing. Instead, on the desktop, the card shows “Relink…” (only if the host has `pickFiles`); on the web host, the card explains that recovery must be done in the desktop app.
 */

export type StageMediaKind = MissingAsset['reason'] | 'unplayable';

export interface StageMediaNotice {
  kind: StageMediaKind;
  title: string;
  /** File name of the first main media that cannot be read (not the full path). */
  name: string;
  body: string;
  /** When the volume it lives on is registered, reconnecting that volume restores it automatically. */
  volume: string | null;
  /** How many other main media also cannot be played. */
  more: string | null;
  /** Where to recover it from, or why this one cannot be recovered. */
  hint: string | null;
  /** The one that can be relinked on the card (desktop, linked asset, current version). */
  relink: { assetId: Id; name: string } | null;
}

/** Card copy (translations are in `stage-media-copy.<language>.ts`). */
export const STAGE_MEDIA_COPY = M;

/** Main media: the asset version and its kind (decides whether it says “picture and original sound” or “this audio”). */
export interface PrimaryMedia {
  ref: VersionRef;
  kind: 'video' | 'audio';
}

export function refKey(ref: VersionRef): string {
  return `${ref.id}@${ref.revision}`;
}

/** Asset versions used by the enabled video and audio instances in the root sequence: sorted by start point (videos starting at the same time come first); each version is counted only once. */
export function primaryMedia(sequence: Sequence): PrimaryMedia[] {
  const found = sequence.items
    .filter((item) => (item.type === 'video' || item.type === 'audio') && item.enabled)
    .map((item) => ({ item, start: itemFrames(item, sequence.fps).start }))
    .sort(
      (a, b) =>
        a.start - b.start ||
        (a.item.type === b.item.type ? 0 : a.item.type === 'video' ? -1 : 1) ||
        (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    );
  const seen = new Set<string>();
  const out: PrimaryMedia[] = [];
  for (const { item } of found) {
    if (item.type !== 'video' && item.type !== 'audio') continue;
    const key = refKey(item.assetRef);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ref: item.assetRef, kind: item.type });
  }
  return out;
}

/** Path → file name; if no file name can be derived, the path is returned as is. */
export function fileName(path: string): string {
  const match = /[^/\\]+$/.exec(path);
  return match ? match[0] : path;
}

/** The name an asset shows on the card: the file name of its registered path; when there is no path (it is stored in the video folder), the asset name is used. */
function assetName(ref: VersionRef, assets: Record<Id, AssetRecord>, path?: string): string {
  if (path) return fileName(path);
  const asset = assets[ref.id];
  const storage = asset?.revisions[ref.revision]?.storage;
  if (storage?.mode === 'linked') return fileName(storage.locator.path);
  return asset?.name || ref.id;
}

export interface StageMediaInput {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  /** Result of `videos.assetStatus`; null until it has been checked. */
  missing: readonly MissingAsset[] | null;
  /** Asset versions whose file exists but the player cannot open (`refKey` → the player's message). */
  unplayable: ReadonlyMap<string, string>;
  /** The host can pick files (desktop): the card shows “Relink…”. */
  canPick: boolean;
}

type Problem = { media: PrimaryMedia; missing: MissingAsset } | { media: PrimaryMedia; error: string };

/** Card content; null when all main media can be played. */
export function stageMediaNotice({ sequence, assets, missing, unplayable, canPick }: StageMediaInput): StageMediaNotice | null {
  const lost = new Map((missing ?? []).map((m) => [refKey({ id: m.assetId, revision: m.revision }), m]));
  const problems: Problem[] = [];
  for (const media of primaryMedia(sequence)) {
    const key = refKey(media.ref);
    const gone = lost.get(key);
    const error = unplayable.get(key);
    if (gone) problems.push({ media, missing: gone });
    else if (error !== undefined) problems.push({ media, error });
  }
  const first = problems[0];
  if (!first) return null;
  const C = STAGE_MEDIA_COPY;
  const more = problems.length > 1 ? C.more(problems.length - 1) : null;
  const tail = C.tail[first.media.kind];
  if ('error' in first) {
    return {
      kind: 'unplayable',
      title: C.titles.unplayable,
      name: assetName(first.media.ref, assets),
      body: C.body(C.unplayable(first.error), tail),
      volume: null,
      more,
      hint: null,
      relink: null,
    };
  }
  const m = first.missing;
  const name = assetName(first.media.ref, assets, m.path);
  // Relinking only applies to linked assets (with a registered path), and only changes the asset's current version (engine relink_asset).
  const current = assets[m.assetId]?.currentRevision === m.revision;
  const relinkable = !!m.path && current;
  return {
    kind: m.reason,
    title: C.titles[m.reason],
    name,
    body: C.body(C.causes[m.reason], tail),
    volume: m.reason === 'missing' && m.volume ? C.volume(m.volume) : null,
    more,
    hint: relinkable ? (canPick ? C.relinkHint : C.desktopOnly) : m.path ? C.oldRevision : C.managed,
    relink: relinkable && canPick ? { assetId: m.assetId, name } : null,
  };
}

/**
 * Fingerprint of the asset registry: it changes when assets are added or removed, the current version is switched, assets are collected into the video, or they are moved. Video events rebuild `assets` every time, so identity cannot be used to tell whether an asset operation was committed; this string is used to decide whether to re-check `videos.assetStatus`.
 */
export function assetsFingerprint(assets: Record<Id, AssetRecord>): string {
  return Object.keys(assets)
    .sort()
    .map((id) => {
      const asset = assets[id]!;
      const revisions = Object.keys(asset.revisions)
        .sort()
        .map((r) => {
          const storage = asset.revisions[r]!.storage;
          return `${r}:${storage.mode === 'linked' ? `L${storage.locator.path}` : 'M'}`;
        });
      return `${id}=${asset.currentRevision}|${revisions.join(',')}`;
    })
    .join(';');
}

/** Assets that could not be read last time but can be read now (relinked, or the drive reconnected): the preview must fetch their addresses again. */
export function recoveredAssets(before: readonly MissingAsset[] | null, after: readonly MissingAsset[]): Id[] {
  if (!before) return [];
  const still = new Set(after.map((m) => m.assetId));
  return [...new Set(before.map((m) => m.assetId))].filter((id) => !still.has(id));
}

/** Result of one load of a source element: loaded; errored (the `MediaError` code and its message); address could not be obtained (`media.resolve` failed). */
export type MediaOutcome = { kind: 'loaded' } | { kind: 'error'; code: number; message: string } | { kind: 'unresolved' };

/** For each source element (keyed by the preview's media key), how many times in a row it failed to decode, plus the message from the last failure. */
export type PlaybackLog = Readonly<Record<string, { ref: string; failures: number; message: string }>>;

const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
/** It only counts as unplayable when it still fails to decode after getting a new address: a stale media handle (after a Runtime restart) also errors the first time, and fetching once more fixes it. */
const UNPLAYABLE_AFTER = 2;

/**
 * Records one load result. Only decode failures and unsupported formats count (network interruptions and aborts do not); a successful load resets the count.
 * Media addresses are new each time they are fetched, and the element re-fetches after an error, so “two in a row” means it still fails after getting a new address.
 */
export function notePlayback(log: PlaybackLog, key: string, ref: VersionRef, outcome: MediaOutcome): PlaybackLog {
  if (outcome.kind === 'loaded') {
    if (!(key in log)) return log;
    const rest = { ...log };
    delete rest[key];
    return rest;
  }
  if (outcome.kind !== 'error' || (outcome.code !== MEDIA_ERR_DECODE && outcome.code !== MEDIA_ERR_SRC_NOT_SUPPORTED)) return log;
  const previous = log[key];
  const failures = previous && previous.ref === refKey(ref) ? previous.failures + 1 : 1;
  return { ...log, [key]: { ref: refKey(ref), failures, message: mediaErrorText(outcome.code, outcome.message) } };
}

/** Asset versions that cannot be played (`refKey` → the player's message). */
export function unplayableRefs(log: PlaybackLog): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of Object.values(log)) if (entry.failures >= UNPLAYABLE_AFTER && !out.has(entry.ref)) out.set(entry.ref, entry.message);
  return out;
}

/** The player's message; if the browser does not provide one, a sentence is built from the error code. */
export function mediaErrorText(code: number, message: string): string {
  const said = message.trim();
  if (said) return said;
  return code === MEDIA_ERR_DECODE ? M.decodeFailed : M.unsupported;
}
