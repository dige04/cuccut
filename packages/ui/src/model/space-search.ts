import {
  defineMessages,
  live,
  SPACE_SEARCH_MAX_LIMIT,
  type FileTarget,
  type Id,
  type SpaceEntry,
  type SpaceSearchDocumentKind,
  type SpaceSearchHit,
  type SpaceSearchParams,
  type SpaceSearchResult,
} from '@cuccut/protocol';
import { formatClock } from './format.ts';
import { videoTargetOf } from './space.ts';
import { zhHans } from './space-search.zh-Hans.ts';
import { zhHant } from './space-search.zh-Hant.ts';
import { ja } from './space-search.ja.ts';
import { ko } from './space-search.ko.ts';
import { es } from './space-search.es.ts';
import { fr } from './space-search.fr.ts';
import { de } from './space-search.de.ts';
import { nl } from './space-search.nl.ts';
import { ptBR } from './space-search.pt-BR.ts';
import { it } from './space-search.it.ts';
import { ru } from './space-search.ru.ts';
import { pl } from './space-search.pl.ts';
import { tr } from './space-search.tr.ts';
import { vi } from './space-search.vi.ts';

/** Copy for content matches (translations are in `space-search.<locale>.ts`). */
const en = {
  documentKind: { speech: 'Transcript', caption: 'Subtitles', translation: 'Translation', chapter: 'Chapter' } satisfies Record<
    SpaceSearchDocumentKind,
    string
  >,
  pendingVideos: (count: number) =>
    `The content index for ${count} ${count === 1 ? 'video' : 'videos'} hasn’t finished updating; results may be missing videos or out of date`,
  indexUpdating: 'The content index is updating; results may be out of date',
  truncated: (count: number) => `Too many matches; showing only the first ${count}`,
  /** Joins several notes into one sentence. */
  notes: (notes: readonly string[]) => `${notes.join('; ')}.`,
  sourceTime: (clock: string) => `Asset time ${clock}`,
};
export type SpaceSearchMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Content matches in Space (architecture design §5.11, cross-video content search): the words in the search box are checked against item names (local filter) and against the video's content index
 * (`space.search`: transcript, subtitles, translations, chapters). This only decides how a match is written and where a click goes.
 */

/** How long to stop typing before querying the content index. */
export const SEARCH_DEBOUNCE_MS = 300;
/** The most content matches wanted at once: grouped by video, paged within each group, up to the contract's limit, so that one video's matches do not push other videos out of the results. */
export const SEARCH_LIMIT = SPACE_SEARCH_MAX_LIMIT;

export const DOCUMENT_KIND_LABEL: Record<SpaceSearchDocumentKind, string> = live(() => M.documentKind);

/** Splits a snippet at the match position so the matched part can be marked. Positions are UTF-16 indices; out-of-range and overlapping ones are clamped. */
export function snippetParts(snippet: string, highlights: readonly [number, number][]): { text: string; hit: boolean }[] {
  const ranges = highlights
    .map(([a, b]) => [Math.max(0, Math.min(a, snippet.length)), Math.max(0, Math.min(b, snippet.length))] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of ranges) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [a, b] of merged) {
    if (a > at) parts.push({ text: snippet.slice(at, a), hit: false });
    parts.push({ text: snippet.slice(a, b), hit: true });
    at = b;
  }
  if (at < snippet.length) parts.push({ text: snippet.slice(at), hit: false });
  return parts;
}

/** The locator used to open the video a match is in: a Space item, or a video entry found by videoId; null when the video is not in any source directory at the moment. */
export function hitTarget(hit: Pick<SpaceSearchHit, 'entryId' | 'videoId'>, entries: readonly SpaceEntry[]): FileTarget | null {
  const entry = entries.find((e) => (hit.entryId ? e.id === hit.entryId : !!e.ref && 'videoId' in e.ref && e.ref.videoId === hit.videoId));
  if (entry && entry.kind === 'video' && !entry.user.trashedAt) return videoTargetOf(entry);
  return hit.entryId && !entry ? { entryId: hit.entryId } : null;
}

/** Which second to jump to after opening: only sequence time can be jumped to directly; source time does not jump. */
export function seekSeconds(hit: Pick<SpaceSearchHit, 'time'>): number | null {
  return hit.time.clock === 'sequence' ? hit.time.start : null;
}

/** A sentence explaining that results are incomplete (the index is being rebuilt or incrementally updated, or there are too many matches). null when complete. */
export function searchNote(result: Pick<SpaceSearchResult, 'complete' | 'pendingVideos' | 'truncated' | 'hits'>): string | null {
  const notes: string[] = [];
  if (!result.complete) {
    notes.push(
      result.pendingVideos > 0 ? M.pendingVideos(result.pendingVideos) : M.indexUpdating,
    );
  }
  if (result.truncated) notes.push(M.truncated(result.hits.length));
  return notes.length ? M.notes(notes) : null;
}

/* ---------- Filtering and grouping (design mock model-project-search.js field labels and planRows, HitGroup in page-projects.jsx) ---------- */

/** Document kind: all, or just one kind (contract `kinds`). */
export type HitKindFilter = 'all' | SpaceSearchDocumentKind;
export const HIT_KIND_FILTERS: readonly HitKindFilter[] = ['all', 'speech', 'caption', 'translation', 'chapter'];

export interface HitFilter {
  kind: HitKindFilter;
  /** Only this speaker (a name recognized from the matches); null means no limit. */
  speaker: string | null;
}

export const ANY_HIT: HitFilter = { kind: 'all', speaker: null };

/** Arguments of `space.search`: for all kinds, `kinds` is not passed; for no speaker limit, `speaker` is not passed; `projectId` null means all projects, and 'none' means videos not in any project. */
export function searchRequest(query: string, projectId: Id | 'none' | null, filter: HitFilter): SpaceSearchParams {
  return {
    query,
    limit: SEARCH_LIMIT,
    ...(projectId === null ? {} : { projectId: projectId === 'none' ? null : projectId }),
    ...(filter.kind === 'all' ? {} : { kinds: [filter.kind] }),
    ...(filter.speaker ? { speaker: filter.speaker } : {}),
  };
}

/** The Runtime finds speakers by “name contains”; the dropdown picks one exact name, and “宝玉” (a name) should not bring up “宝玉的嘉宾” (Baoyu's guest). */
export function exactSpeaker(hits: readonly SpaceSearchHit[], speaker: string | null): SpaceSearchHit[] {
  return speaker ? hits.filter((hit) => hit.speaker === speaker) : [...hits];
}

/** The speakers in this batch of matches are merged into those already seen (so the dropdown does not shrink when the same term switches kind). */
export function collectSpeakers(seen: readonly string[], hits: readonly Pick<SpaceSearchHit, 'speaker'>[]): string[] {
  const names = new Set(seen);
  for (const hit of hits) if (hit.speaker) names.add(hit.speaker);
  return names.size === seen.length ? [...seen] : [...names];
}

/** Speaker dropdown options: those already seen plus the selected ones, sorted by name. */
export function speakerOptions(seen: readonly string[], selected: string | null): string[] {
  const names = new Set(seen);
  if (selected) names.add(selected);
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

export interface HitGroup {
  videoId: Id;
  videoName: string;
  hits: SpaceSearchHit[];
}

/**
 * Grouped by video (design mock: when one video has a dozen matches, a flat list pushes other videos out; “which videos contain this word” is what this screen should answer).
 * Groups are in order of first appearance; within a group the order the Runtime gives (by time) is kept.
 */
export function groupHits(hits: readonly SpaceSearchHit[]): HitGroup[] {
  const groups = new Map<Id, HitGroup>();
  for (const hit of hits) {
    const group = groups.get(hit.videoId);
    if (group) group.hits.push(hit);
    else groups.set(hit.videoId, { videoId: hit.videoId, videoName: hit.videoName, hits: [hit] });
  }
  return [...groups.values()];
}

/** Each group first shows a few; “show N more” shows that many again (design mock PAGE). */
export const GROUP_PAGE = 10;

/** How far a group is shown (design mock `planRows`): `shown` defaults to one page when not given; `more` is how many more to show next time, and `next` is the count after showing them. */
export function planGroupRows<T>(rows: readonly T[], shown?: number, pageSize = GROUP_PAGE): { rows: T[]; rest: number; more: number; next: number } {
  const take = Math.max(0, Math.min(shown ?? pageSize, rows.length));
  const rest = rows.length - take;
  return { rows: rows.slice(0, take), rest, more: Math.min(rest, pageSize), next: take + pageSize };
}

/** The tag in front of a match row (the design mock's chip): document kind; translations include the language (“译文 · en”, translation · en). */
export function hitChip(hit: Pick<SpaceSearchHit, 'documentKind' | 'language'>): string {
  const label = DOCUMENT_KIND_LABEL[hit.documentKind];
  return hit.documentKind === 'translation' && hit.language ? `${label} · ${hit.language}` : label;
}

/** The position of a match row: time (source time is written as “素材时间”, material time) · speaker. */
export function hitWhere(hit: Pick<SpaceSearchHit, 'time' | 'speaker'>): string {
  const clock = formatClock(hit.time.start);
  const parts = [hit.time.clock === 'sequence' ? clock : M.sourceTime(clock)];
  if (hit.speaker) parts.push(hit.speaker);
  return parts.join(' · ');
}
