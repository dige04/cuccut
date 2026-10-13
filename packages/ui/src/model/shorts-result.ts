import type { DocumentRecord, Id, SpaceEntry, TimelineItem } from '@cuccut/protocol';
import { derivedFrom } from './space.ts';

/**
 * The result of cutting a short video (product design §5.10 “结果页” / Result page): which sub-videos this session round derived, and which part of the parent video each one came from.
 * The derivation source document of a sub-video (`kind: 'derivation'`, video format spec `cuccut.derivation/1`) is sent with the snapshot; the summary is the body.
 */

export const DERIVATION_KIND = 'derivation';

/** The derivation source of a sub-video: the parent video, the range (seconds) on the parent's timeline after editing, and the primary asset that holds the cut points. */
export interface ShortsDerivation {
  parentVideoId: Id;
  parentRevision: string | null;
  range: { start: number; end: number };
  primaryAssetId: Id | null;
  /** The opening sentence (given by the agent when deriving); null when none was given, and the card then uses the first sentence of the kept segment. */
  hook: string | null;
  /** Why it was picked; null when not given. */
  reason: string | null;
  /** The hint text; empty when none was given. */
  notes: string[];
  /** How many shots the segmented framing has (the derivation source document's `settings.crops`, otherwise `framing.shots`); 0 when there is no segmented framing. */
  shots: number;
}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const lengthOf = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

/** How many shots the segmented framing has: counted by `settings.crops` (the framing given per segment at derivation). `framing.shots` lists the segments of the primary asset on the source clock; a cut splits one shot into several segments, so it is only a fallback. */
function shotCount(summary: Record<string, unknown>): number {
  const framing = summary.framing as { shots?: unknown } | undefined;
  const settings = summary.settings as { crops?: unknown } | undefined;
  return lengthOf(settings?.crops) || lengthOf(framing?.shots);
}

/** The “framing” row on the result card writes how many shots: the number of segments when there is more than one shot, otherwise null (the row is not shown). */
export function framingShots(derivation: Pick<ShortsDerivation, 'shots'> | null): number | null {
  return derivation && derivation.shots > 1 ? derivation.shots : null;
}

/** The summary of the derivation source document in the video; null when it is not a sub-video (no such document, or it is not recognized). */
export function readDerivation(documents: Record<Id, DocumentRecord> | null | undefined): ShortsDerivation | null {
  if (!documents) return null;
  for (const record of Object.values(documents)) {
    if (record.kind !== DERIVATION_KIND) continue;
    const summary = record.revisions[record.currentRevision]?.summary as Record<string, unknown> | undefined;
    if (!summary || typeof summary !== 'object' || typeof summary.parentVideoId !== 'string') continue;
    const range = summary.range as { start?: unknown; end?: unknown } | undefined;
    const start = Number(range?.start);
    const end = Number(range?.end);
    if (range?.start === undefined || range?.end === undefined || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    return {
      parentVideoId: summary.parentVideoId,
      parentRevision: typeof summary.parentRevision === 'string' ? summary.parentRevision : null,
      range: { start, end },
      primaryAssetId: typeof summary.primaryAssetId === 'string' ? summary.primaryAssetId : null,
      // Additive field: older derivation source documents do not have it, so the card does not show it.
      hook: textOf(summary.hook),
      reason: textOf(summary.reason),
      notes: Array.isArray(summary.notes) ? summary.notes.flatMap((n) => textOf(n) ?? []) : [],
      shots: shotCount(summary),
    };
  }
  return null;
}

/** Videos the agent created in one session (`video-created`: `videos_create` and newly derived sub-videos; sub-videos recognized as existing ones are not recorded). null until the timeline has been read. */
export function createdVideoIds(items: readonly TimelineItem[] | undefined): Set<Id> | null {
  if (!items) return null;
  const ids = new Set<Id>();
  for (const item of items) if (item.kind === 'video-created') ids.add(item.videoId);
  return ids;
}

/** Basis for recognizing this round: the session handed over, the moment of handover, and (when the timeline has been read) the videos created in the session. */
export interface ShortsBatchKey {
  parentVideoId: Id;
  conversationId: Id;
  /** The moment the work was handed to the Agent (ISO). */
  handedAt: string;
  /** The video of `video-created` in that session's timeline; null until the timeline has been read. */
  created: ReadonlySet<Id> | null;
}

const videoIdOf = (entry: Pick<SpaceEntry, 'ref'>): Id | null => (entry.ref && 'videoId' in entry.ref ? entry.ref.videoId : null);
const createdAt = (entry: Pick<SpaceEntry, 'createdAt' | 'lastActivityAt'>) => entry.createdAt ?? entry.lastActivityAt;

/**
 * The sub-videos cut in this round (including those in the trash; callers filter as needed), in order of creation. They are recognized among the video entries in the Space derived from this parent video:
 *
 * 1. When an entry's `origin.conversationId` has a value, match only by it (Runtime's derived entries do not carry it yet; kept for later);
 * 2. Otherwise, it was created in the session timeline (`video-created`), or it was created after the handover (`createdAt`; when an older Runtime lacks it, use the most recent activity).
 *
 * A sub-video that was re-derived as an existing one (same range and settings derived again) has no `video-created`, and its creation time is earlier than this round: it cannot be recognized, so the result page does not list it.
 */
export function shortsBatch(entries: readonly SpaceEntry[], key: ShortsBatchKey): SpaceEntry[] {
  const out: SpaceEntry[] = [];
  const seen = new Set<Id>();
  for (const entry of entries) {
    if (derivedFrom(entry) !== key.parentVideoId) continue;
    const videoId = videoIdOf(entry);
    if (!videoId || seen.has(videoId)) continue;
    const origin = entry.origin?.conversationId;
    const mine = origin ? origin === key.conversationId : !!key.created?.has(videoId) || createdAt(entry) >= key.handedAt;
    if (!mine) continue;
    seen.add(videoId);
    out.push(entry);
  }
  return out.sort((a, b) => createdAt(a).localeCompare(createdAt(b)) || a.name.localeCompare(b.name));
}

/** The video the entry points to (for the sub-video card); null when the entry is not a video entry. */
export function entryVideoId(entry: Pick<SpaceEntry, 'ref'>): Id | null {
  return videoIdOf(entry);
}

/**
 * The k (0-based) in the header “k/N”: if one of the sub-videos is open, it is that one; if the parent video is open, it is the one last selected, or the first one if none was selected.
 * -1 when there are no sub-videos.
 */
export function pagerIndex(ids: readonly Id[], openId: Id | null, focus: Id | null): number {
  if (!ids.length) return -1;
  const open = openId ? ids.indexOf(openId) : -1;
  if (open >= 0) return open;
  const focused = focus ? ids.indexOf(focus) : -1;
  return focused >= 0 ? focused : 0;
}

/** How many rows the group of “cut short videos” on the parent video shows by default (prototype `MADE_SHOWN`); the extra ones are collapsed, and “N more” expands them. */
export const MADE_SHOWN = 6;

/**
 * The sub-videos in the group of “cut short videos” on the parent video (prototype `madeOrder`): cut from this video and not moved to the trash; the same video is counted only once;
 * sorted by creation time, newest first, so the newly cut ones are at the top; at the same moment, sorted by name.
 */
export function madeShorts(entries: readonly SpaceEntry[], videoId: Id): SpaceEntry[] {
  const seen = new Set<Id>();
  const createdAt = (entry: SpaceEntry) => entry.createdAt ?? entry.lastActivityAt;
  return entries
    .filter((e) => !e.user.trashedAt && derivedFrom(e) === videoId)
    .filter((e) => {
      const id = entryVideoId(e);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => createdAt(b).localeCompare(createdAt(a)) || a.name.localeCompare(b.name));
}
