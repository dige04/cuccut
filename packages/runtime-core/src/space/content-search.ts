import type { Id, SpaceSearchDocumentKind, SpaceSearchHit } from '@cuccut/protocol';
import type { CandidateFilter, SegmentRow } from './content-store.ts';

/**
 * Search over the content index (architecture design §5.11). Segments are stored in an SQLite database (`content-store.ts`); FTS5's trigram index narrows the candidates,
 * while hits and snippets are still determined here by the rules below:
 *
 * - Text is first normalized with NFKC and lowercased, so full-width and half-width forms and letter case are not distinguished.
 * - The query is split by whitespace into several terms; a segment is a hit only when all terms appear in it. Chinese is not word-segmented: matching is by character substring, so “edit” finds “video editing”,
 *   at the cost of having no word boundaries (“cut” also matches “scissors”). Terms of three or more characters go through FTS's MATCH; shorter ones fall back to substring filtering (scanning segment by segment).
 * - There is no relevance ranking: results follow the video order the caller gives (most recent activity first), and within one video, time order.
 */

export interface SearchableVideo {
  /** Real path of a video directory (the key of the content index). */
  dir: string;
  videoId: Id;
  videoName: string;
  entryId: Id | null;
  projectId: Id | null;
  revision: string;
}

export interface SearchQuery {
  query: string;
  kinds?: readonly SpaceSearchDocumentKind[];
  speaker?: string;
  limit: number;
}

/** Returns the segments that may hit (`ContentStore.candidates`). */
export interface SegmentSource {
  candidates(filter: CandidateFilter): SegmentRow[];
}

const SNIPPET_MAX = 120;
const SNIPPET_BEFORE = 30;

export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

export function searchTerms(query: string): string[] {
  return [...new Set(normalizeText(query).split(/\s+/).filter(Boolean))];
}

export function searchSegments(
  source: SegmentSource,
  videos: readonly SearchableVideo[],
  query: SearchQuery,
): { hits: SpaceSearchHit[]; truncated: boolean } {
  const terms = searchTerms(query.query);
  const speaker = query.speaker ? normalizeText(query.speaker.trim()) : null;
  const kinds = query.kinds && query.kinds.length > 0 ? query.kinds : null;
  if (videos.length === 0) return { hits: [], truncated: false };
  const byDir = new Map<string, SegmentRow[]>();
  for (const video of videos) byDir.set(video.dir, []);
  for (const row of source.candidates({ terms, kinds, speaker })) byDir.get(row.dir)?.push(row);
  const hits: SpaceSearchHit[] = [];
  for (const video of videos) {
    const rows = byDir.get(video.dir)!;
    rows.sort((a, b) => a.start - b.start || kindOrder(a.kind) - kindOrder(b.kind) || a.id - b.id);
    for (const segment of rows) {
      const found = matchTerms(segment.text, terms);
      if (!found) continue;
      if (hits.length >= query.limit) return { hits, truncated: true };
      hits.push({
        videoId: video.videoId,
        videoName: video.videoName,
        entryId: video.entryId,
        projectId: video.projectId,
        documentId: segment.documentId,
        documentKind: segment.kind,
        language: segment.language,
        time: { clock: segment.clock, start: segment.start, end: segment.end },
        ...found,
        speaker: segment.speaker,
        indexedRevision: video.revision,
      });
    }
  }
  return { hits, truncated: false };
}

/** When all terms are in this text, returns the extracted snippet and the positions of the terms within it. When there are no terms (searching only by speaker), the whole segment counts as a hit. */
export function matchTerms(text: string, terms: readonly string[]): { snippet: string; highlights: [number, number][] } | null {
  const normalized = normalizeText(text);
  // NFKC can change length (ligatures, some compatibility characters): in that case the snippet uses the normalized text, so the positions line up.
  const display = normalized.length === text.length ? text : normalized;
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let at = normalized.indexOf(term);
    if (at < 0) return null;
    while (at >= 0) {
      ranges.push([at, at + term.length]);
      at = normalized.indexOf(term, at + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  if (display.length <= SNIPPET_MAX) return { snippet: display, highlights: merged };
  const first = merged[0]?.[0] ?? 0;
  const start = Math.max(0, Math.min(first - SNIPPET_BEFORE, display.length - SNIPPET_MAX));
  const end = Math.min(display.length, start + SNIPPET_MAX);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < display.length ? '…' : '';
  const shift = prefix.length - start;
  const highlights = merged
    .filter(([a, b]) => a < end && b > start)
    .map(([a, b]) => [Math.max(a, start) + shift, Math.min(b, end) + shift] as [number, number]);
  return { snippet: `${prefix}${display.slice(start, end)}${suffix}`, highlights };
}

function kindOrder(kind: SpaceSearchDocumentKind): number {
  return kind === 'chapter' ? 0 : kind === 'speech' ? 1 : kind === 'caption' ? 2 : 3;
}
